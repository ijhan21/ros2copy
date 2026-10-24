import { Tab, Snippet, Command, SharedFile } from "./types";
import { getTabs, getSnippets, getCommands, getSharedFiles, pingDatabase } from "./db";

export interface StreamPayload {
  version: number;
  timestamp: string;
  tabs: Tab[];
  snippets: Snippet[];
  commands: Command[];
  files: SharedFile[];
}

export type SseSender = (event: string, data: any) => void;

interface SseHub {
  tabs: Tab[];
  snippets: Snippet[];
  commands: Command[];
  files: SharedFile[];
  version: number;
  lastFetchedAt: number;
  subscribers: Map<string, SseSender>;
  syncTimer: NodeJS.Timeout | null;
  keepaliveTimer: NodeJS.Timeout | null;
  dailyPingTimer: NodeJS.Timeout | null;
  isSyncing: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __ROS2_SSE_HUB__: SseHub | undefined;
}

function getHub(): SseHub {
  if (!globalThis.__ROS2_SSE_HUB__) {
    globalThis.__ROS2_SSE_HUB__ = {
      tabs: [],
      snippets: [],
      commands: [],
      files: [],
      version: 1,
      lastFetchedAt: 0,
      subscribers: new Map(),
      syncTimer: null,
      keepaliveTimer: null,
      dailyPingTimer: null,
      isSyncing: false,
    };
    initDailyTimer();
  }
  return globalThis.__ROS2_SSE_HUB__;
}

// 3시간 주기 Supabase 정지 방지 경량 핑 (구독자가 0명이어도 Supabase 7일 정지 완벽 방지)
function initDailyTimer() {
  const hub = getHub();
  if (hub.dailyPingTimer) return;

  const runPing = async () => {
    try {
      await pingDatabase();
      console.log("[SSE Hub] Supabase 정지 방지 핑 성공:", new Date().toISOString());
    } catch (err) {
      console.error("[SSE Hub] Supabase 핑 실패:", err);
    }
  };

  // 서버 시작 시 최초 1회 즉시 실행
  runPing();

  // 3시간마다 주기적 실행
  hub.dailyPingTimer = setInterval(runPing, 3 * 60 * 60 * 1000);
}

// 탭별 본문 합이 256KB를 초과할 경우 본문 비우고 목록만 전송
export function formatPayload(
  tabs: Tab[],
  snippets: Snippet[],
  commands: Command[],
  files: SharedFile[],
  version: number
): StreamPayload {
  const tabBodyBytes = new Map<number | null, number>();
  for (const s of snippets) {
    const bytes = Buffer.byteLength(s.body || "", "utf-8");
    tabBodyBytes.set(s.tab_id, (tabBodyBytes.get(s.tab_id) || 0) + bytes);
  }

  const processedSnippets = snippets.map((s) => {
    const totalBytesInTab = tabBodyBytes.get(s.tab_id) || 0;
    if (totalBytesInTab > 256 * 1024) {
      // 256KB 초과 탭: 목록만 보내고 본문은 GET /api/snippets/:id 로 따로 받음
      return {
        ...s,
        body: "",
        has_body: false,
      };
    }
    return {
      ...s,
      has_body: true,
    };
  });

  return {
    version,
    timestamp: new Date().toISOString(),
    tabs,
    snippets: processedSnippets,
    commands,
    files,
  };
}

// 모든 활성 구독자에게 브로드캐스트
export function broadcastState() {
  const hub = getHub();
  if (hub.subscribers.size === 0) return;

  const payload = formatPayload(hub.tabs, hub.snippets, hub.commands, hub.files, hub.version);
  for (const [id, send] of hub.subscribers.entries()) {
    try {
      send("update", payload);
    } catch {
      hub.subscribers.delete(id);
    }
  }
}

// DB(Supabase / 로컬)와 메모리 캐시 동기화
export async function syncFromDatabase(): Promise<boolean> {
  const hub = getHub();
  if (hub.isSyncing) return false;
  hub.isSyncing = true;

  try {
    const [tabs, snippets, commands, files] = await Promise.all([
      getTabs(),
      getSnippets(),
      getCommands(),
      getSharedFiles(),
    ]);

    // 변경 여부 비교 (간단한 JSON 직렬화 비교)
    const prevSig = JSON.stringify({
      t: hub.tabs.map((t) => [t.id, t.name, t.sort, t.deleted_at]),
      s: hub.snippets.map((s) => [s.id, s.title, s.pinned, s.deleted_at, s.body]),
      c: hub.commands.map((c) => [c.id, c.body, c.memo, c.pinned, c.deleted_at]),
      f: hub.files.map((f) => [f.id, f.original_name, f.tab_id, f.deleted_at, f.download_count, f.memo]),
    });

    const newSig = JSON.stringify({
      t: tabs.map((t) => [t.id, t.name, t.sort, t.deleted_at]),
      s: snippets.map((s) => [s.id, s.title, s.pinned, s.deleted_at, s.body]),
      c: commands.map((c) => [c.id, c.body, c.memo, c.pinned, c.deleted_at]),
      f: files.map((f) => [f.id, f.original_name, f.tab_id, f.deleted_at, f.download_count, f.memo]),
    });

    hub.lastFetchedAt = Date.now();

    if (prevSig !== newSig || hub.version === 1) {
      hub.tabs = tabs;
      hub.snippets = snippets;
      hub.commands = commands;
      hub.files = files;
      hub.version++;
      broadcastState();
      return true;
    }
    return false;
  } catch (err) {
    console.error("[SSE Hub] DB 동기화 오류:", err);
    return false;
  } finally {
    hub.isSyncing = false;
  }
}

// 주기적 DB 동기화 타이머 시작/정지 (강사 작성 시에는 notifyMutationImmediate로 0초 즉시 반영)
function updateSyncTimer() {
  const hub = getHub();
  const hasSubscribers = hub.subscribers.size > 0;

  if (hasSubscribers && !hub.syncTimer) {
    // 구독자가 있으면 30초 주기로 보조 동기화 (대역폭 낭비 방지)
    hub.syncTimer = setInterval(async () => {
      await syncFromDatabase();
    }, 30000);

    // 15초 주기 keepalive 전송 (주석 한 줄)
    if (!hub.keepaliveTimer) {
      hub.keepaliveTimer = setInterval(() => {
        for (const [id, send] of hub.subscribers.entries()) {
          try {
            send("keepalive", null);
          } catch {
            hub.subscribers.delete(id);
          }
        }
      }, 15000);
    }
  } else if (!hasSubscribers && hub.syncTimer) {
    // 구독자가 없으면 5초 주기 읽기를 멈춤
    clearInterval(hub.syncTimer);
    hub.syncTimer = null;

    if (hub.keepaliveTimer) {
      clearInterval(hub.keepaliveTimer);
      hub.keepaliveTimer = null;
    }
  }
}

// SSE 구독 등록
export async function subscribeClient(
  clientId: string,
  sender: SseSender
): Promise<() => void> {
  const hub = getHub();
  hub.subscribers.set(clientId, sender);

  // 첫 구독자 진입 또는 최초 캐시 비어있으면 즉시 동기화
  if (hub.tabs.length === 0 && hub.snippets.length === 0 && hub.commands.length === 0 && hub.files.length === 0) {
    await syncFromDatabase();
  }

  // 연결 즉시 현재 최신 상태 전달
  sender("init", formatPayload(hub.tabs, hub.snippets, hub.commands, hub.files, hub.version));

  updateSyncTimer();

  // 구독 해제 클린업 함수
  return () => {
    hub.subscribers.delete(clientId);
    updateSyncTimer();
  };
}

// 강사 액션 발생 시 기다리지 않고 즉시 메모리 캐시 갱신 및 브로드캐스트
export function notifyMutationImmediate() {
  const hub = getHub();
  hub.version++;
  // 비동기 동기화 실행 및 즉각 브로드캐스트
  syncFromDatabase().catch(console.error);
}

// 현재 메모리 상태 반환 (폴링 또는 단건 API용)
export function getCachedState(): StreamPayload {
  const hub = getHub();
  return formatPayload(hub.tabs, hub.snippets, hub.commands, hub.files, hub.version);
}

// 단건 스니펫 원본 본문 반환 (256KB 초과 탭용)
export function getSnippetBodyById(id: number): string | null {
  const hub = getHub();
  const snip = hub.snippets.find((s) => s.id === id);
  return snip ? snip.body : null;
}

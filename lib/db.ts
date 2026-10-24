import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Tab, Snippet, Command, SnippetKind, SharedFile } from "./types";
import fs from "fs";
import path from "path";

// Supabase 싱글톤 클라이언트
let cachedSupabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseSecretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseSecretKey) {
    return null;
  }

  if (!cachedSupabase) {
    cachedSupabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedSupabase;
}

// 강사 액션 시 SSE 브로드캐스트 즉시 트리거
function notifyChange(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { notifyMutationImmediate } = require("./serverState");
    notifyMutationImmediate();
  } catch {
    // 빌드/초기화 시 무시
  }
}

// 로컬/인메모리 Fallback 스토리지 (Supabase 미설정 시 안전 모드)
interface LocalData {
  tabs: Tab[];
  snippets: Snippet[];
  commands: Command[];
  sharedFiles?: SharedFile[];
  nextTabId: number;
  nextSnippetId: number;
  nextCommandId: number;
  nextSharedFileId?: number;
}

const LOCAL_DB_PATH = path.join("/tmp", ".ros2copy_local_db.json");

declare global {
  // eslint-disable-next-line no-var
  var __ROS2_MEMORY_DB__: LocalData | undefined;
}

function getLocalData(): LocalData {
  if (globalThis.__ROS2_MEMORY_DB__) {
    if (!globalThis.__ROS2_MEMORY_DB__.sharedFiles) {
      globalThis.__ROS2_MEMORY_DB__.sharedFiles = [];
    }
    if (!globalThis.__ROS2_MEMORY_DB__.nextSharedFileId) {
      globalThis.__ROS2_MEMORY_DB__.nextSharedFileId = 1;
    }
    return globalThis.__ROS2_MEMORY_DB__;
  }

  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.sharedFiles) parsed.sharedFiles = [];
      if (!parsed.nextSharedFileId) parsed.nextSharedFileId = 1;
      globalThis.__ROS2_MEMORY_DB__ = parsed;
      return parsed;
    } catch {
      // 파싱 실패 시 새로 생성
    }
  }

  const initial: LocalData = {
    tabs: [
      { id: 1, name: "실습 1차시", sort: 1, created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, name: "실습 2차시", sort: 2, created_at: new Date(Date.now() - 1800000).toISOString() },
    ],
    snippets: [],
    commands: [],
    sharedFiles: [],
    nextTabId: 3,
    nextSnippetId: 1,
    nextCommandId: 1,
    nextSharedFileId: 1,
  };

  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
  } catch (err) {
    console.warn("로컬 DB 파일 쓰기 건너뜀 (메모리만 사용):", err);
  }

  globalThis.__ROS2_MEMORY_DB__ = initial;
  return initial;
}

function saveLocalData(data: LocalData): void {
  globalThis.__ROS2_MEMORY_DB__ = data;
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("로컬 DB 파일 저장 실패 (메모리 보존 유지):", err);
  }
}

// ---------------- Tabs ----------------
export async function getTabs(): Promise<Tab[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("tabs")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) {
      console.error("Supabase getTabs error:", error);
      throw error;
    }
    return data || [];
  }

  const local = getLocalData();
  return local.tabs
    .filter((t) => !t.deleted_at)
    .sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA || b.id - a.id;
    });
}

export async function createTab(name: string, sort?: number): Promise<Tab> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("탭 이름은 필수입니다.");

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("tabs")
      .insert({
        name: trimmed,
        sort: sort ?? 0,
      })
      .select()
      .single();
    if (error) {
      console.error("Supabase createTab error:", error);
      throw error;
    }
    notifyChange();
    return data;
  }

  const local = getLocalData();
  const existing = local.tabs.find((t) => t.name === trimmed && !t.deleted_at);
  if (existing) {
    throw new Error("이미 존재하는 탭 이름입니다.");
  }
  const newTab: Tab = {
    id: local.nextTabId++,
    name: trimmed,
    sort: sort ?? local.tabs.length + 1,
    deleted_at: null,
    created_at: new Date().toISOString(),
  };
  local.tabs.push(newTab);
  saveLocalData(local);
  notifyChange();
  return newTab;
}

export async function updateTab(
  id: number,
  data: Partial<Tab>
): Promise<Tab> {
  const supabase = getSupabase();
  if (supabase) {
    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.sort !== undefined) updatePayload.sort = data.sort;
    if (data.deleted_at !== undefined) updatePayload.deleted_at = data.deleted_at;

    const { data: updated, error } = await supabase
      .from("tabs")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateTab error:", error);
      throw error;
    }
    notifyChange();
    return updated;
  }

  const local = getLocalData();
  const target = local.tabs.find((t) => t.id === id);
  if (!target) throw new Error("탭을 찾을 수 없습니다.");
  if (data.name !== undefined) target.name = data.name.trim();
  if (data.sort !== undefined) target.sort = data.sort;
  if (data.deleted_at !== undefined) target.deleted_at = data.deleted_at;
  saveLocalData(local);
  notifyChange();
  return target;
}

export async function deleteTab(id: number, permanent = false): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    if (permanent) {
      const { error } = await supabase.from("tabs").delete().eq("id", id);
      if (error) {
        console.error("Supabase deleteTab error:", error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("tabs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Supabase deleteTab (soft) error:", error);
        throw error;
      }
    }
    notifyChange();
    return;
  }

  const local = getLocalData();
  if (permanent) {
    local.tabs = local.tabs.filter((t) => t.id !== id);
  } else {
    const target = local.tabs.find((t) => t.id === id);
    if (target) {
      target.deleted_at = new Date().toISOString();
    }
  }
  saveLocalData(local);
  notifyChange();
}

// ---------------- Snippets ----------------
export async function getSnippets(tabId?: number): Promise<Snippet[]> {
  const supabase = getSupabase();
  if (supabase) {
    const [snippetsRes, tabsRes] = await Promise.all([
      supabase
        .from("snippets")
        .select("*")
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("tabs").select("id, name").is("deleted_at", null),
    ]);

    if (snippetsRes.error) {
      console.error("Supabase getSnippets error:", snippetsRes.error);
      throw snippetsRes.error;
    }

    const activeTabs = tabsRes.data || [];
    const activeTabMap = new Map(activeTabs.map((t) => [t.id, t.name]));
    // 활성 탭에 속한 스니펫만 포함 (삭제된 탭의 코드는 함께 감춤)
    let items = (snippetsRes.data || [])
      .filter((s) => !s.tab_id || activeTabMap.has(s.tab_id))
      .map((s) => ({
        ...s,
        tabs: s.tab_id ? { name: activeTabMap.get(s.tab_id) || "" } : null,
      }));

    if (tabId) {
      items = items.filter((s) => s.tab_id === tabId);
    }
    return items as Snippet[];
  }

  const local = getLocalData();
  const activeTabs = local.tabs.filter((t) => !t.deleted_at);
  const activeTabMap = new Map(activeTabs.map((t) => [t.id, t.name]));
  let result = local.snippets
    .filter((s) => !s.deleted_at && (!s.tab_id || activeTabMap.has(s.tab_id)))
    .map((s) => ({
      ...s,
      tabs: s.tab_id ? { name: activeTabMap.get(s.tab_id) || "" } : null,
    }));

  if (tabId) {
    result = result.filter((s) => s.tab_id === tabId);
  }
  return result.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function getSnippetById(id: number): Promise<Snippet | null> {
  const supabase = getSupabase();
  if (supabase) {
    const [snipRes, tabsRes] = await Promise.all([
      supabase.from("snippets").select("*").eq("id", id).is("deleted_at", null).single(),
      supabase.from("tabs").select("id, name").is("deleted_at", null),
    ]);

    if (snipRes.error || !snipRes.data) return null;
    const tabMap = new Map((tabsRes.data || []).map((t) => [t.id, t.name]));
    return {
      ...snipRes.data,
      tabs: snipRes.data.tab_id ? { name: tabMap.get(snipRes.data.tab_id) || "" } : null,
    };
  }

  const local = getLocalData();
  const found = local.snippets.find((s) => s.id === id && !s.deleted_at);
  if (!found) return null;
  const tab = local.tabs.find((t) => t.id === found.tab_id && !t.deleted_at);
  return {
    ...found,
    tabs: tab ? { name: tab.name } : null,
  };
}

export async function createSnippet(input: {
  tab_id?: number | null;
  title?: string | null;
  path?: string | null;
  kind: SnippetKind;
  body: string;
  pinned?: boolean;
}): Promise<Snippet> {
  if (!input.body || !input.body.trim()) {
    throw new Error("본문 내용은 필수입니다.");
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("snippets")
      .insert({
        tab_id: input.tab_id || null,
        title: input.title?.trim() || null,
        path: input.path?.trim() || null,
        kind: input.kind,
        body: input.body,
        pinned: input.pinned ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase createSnippet error:", error);
      throw error;
    }

    let tabName = "";
    if (data.tab_id) {
      const { data: tabData } = await supabase
        .from("tabs")
        .select("name")
        .eq("id", data.tab_id)
        .single();
      tabName = tabData?.name || "";
    }

    notifyChange();
    return {
      ...data,
      tabs: tabName ? { name: tabName } : null,
    };
  }

  const local = getLocalData();
  const tab = local.tabs.find((t) => t.id === input.tab_id && !t.deleted_at);
  const newSnippet: Snippet = {
    id: local.nextSnippetId++,
    tab_id: input.tab_id || null,
    title: input.title?.trim() || null,
    path: input.path?.trim() || null,
    kind: input.kind,
    body: input.body,
    pinned: input.pinned ?? false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    tabs: tab ? { name: tab.name } : null,
  };
  local.snippets.unshift(newSnippet);
  saveLocalData(local);
  notifyChange();
  return newSnippet;
}

export async function updateSnippet(
  id: number,
  data: Partial<Snippet>
): Promise<Snippet> {
  const supabase = getSupabase();
  if (supabase) {
    const updatePayload: Record<string, any> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.path !== undefined) updatePayload.path = data.path;
    if (data.kind !== undefined) updatePayload.kind = data.kind;
    if (data.body !== undefined) updatePayload.body = data.body;
    if (data.pinned !== undefined) updatePayload.pinned = data.pinned;
    if (data.deleted_at !== undefined) updatePayload.deleted_at = data.deleted_at;

    const { data: updated, error } = await supabase
      .from("snippets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateSnippet error:", error);
      throw error;
    }
    notifyChange();
    return updated;
  }

  const local = getLocalData();
  const target = local.snippets.find((s) => s.id === id);
  if (!target) throw new Error("스니펫을 찾을 수 없습니다.");

  if (data.title !== undefined) target.title = data.title;
  if (data.path !== undefined) target.path = data.path;
  if (data.kind !== undefined) target.kind = data.kind;
  if (data.body !== undefined) target.body = data.body;
  if (data.pinned !== undefined) target.pinned = data.pinned;
  if (data.deleted_at !== undefined) target.deleted_at = data.deleted_at;

  saveLocalData(local);
  notifyChange();
  return target;
}

export async function deleteSnippet(id: number, permanent = false): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    if (permanent) {
      const { error } = await supabase.from("snippets").delete().eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("snippets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    }
    notifyChange();
    return;
  }

  const local = getLocalData();
  if (permanent) {
    local.snippets = local.snippets.filter((s) => s.id !== id);
  } else {
    const target = local.snippets.find((s) => s.id === id);
    if (target) {
      target.deleted_at = new Date().toISOString();
    }
  }
  saveLocalData(local);
  notifyChange();
}

// ---------------- Commands ----------------
export async function getCommands(): Promise<Command[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("commands")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("Supabase getCommands error:", error);
      throw error;
    }
    return data || [];
  }

  const local = getLocalData();
  return local.commands
    .filter((c) => !c.deleted_at)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
        a.id - b.id
    );
}

export async function createCommand(input: {
  body: string;
  memo?: string | null;
  pinned?: boolean;
}): Promise<Command> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("명령어는 필수입니다.");

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("commands")
      .insert({
        body: trimmed,
        memo: input.memo?.trim() || null,
        pinned: input.pinned ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase createCommand error:", error);
      throw error;
    }
    notifyChange();
    return data;
  }

  const local = getLocalData();
  const newCommand: Command = {
    id: local.nextCommandId++,
    body: trimmed,
    memo: input.memo?.trim() || null,
    pinned: input.pinned ?? false,
    deleted_at: null,
    created_at: new Date().toISOString(),
  };
  local.commands.push(newCommand);
  saveLocalData(local);
  notifyChange();
  return newCommand;
}

export async function updateCommand(
  id: number,
  data: Partial<Command>
): Promise<Command> {
  const supabase = getSupabase();
  if (supabase) {
    const updatePayload: Record<string, any> = {};
    if (data.pinned !== undefined) updatePayload.pinned = data.pinned;
    if (data.memo !== undefined) updatePayload.memo = data.memo;
    if (data.body !== undefined) updatePayload.body = data.body;
    if (data.deleted_at !== undefined) updatePayload.deleted_at = data.deleted_at;

    const { data: updated, error } = await supabase
      .from("commands")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    notifyChange();
    return updated;
  }

  const local = getLocalData();
  const target = local.commands.find((c) => c.id === id);
  if (!target) throw new Error("명령어를 찾을 수 없습니다.");

  if (data.pinned !== undefined) target.pinned = data.pinned;
  if (data.memo !== undefined) target.memo = data.memo;
  if (data.body !== undefined) target.body = data.body;
  if (data.deleted_at !== undefined) target.deleted_at = data.deleted_at;

  saveLocalData(local);
  notifyChange();
  return target;
}

export async function deleteCommand(id: number, permanent = false): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    if (permanent) {
      const { error } = await supabase.from("commands").delete().eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("commands")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    }
    notifyChange();
    return;
  }

  const local = getLocalData();
  if (permanent) {
    local.commands = local.commands.filter((c) => c.id !== id);
  } else {
    const target = local.commands.find((c) => c.id === id);
    if (target) {
      target.deleted_at = new Date().toISOString();
    }
  }
  saveLocalData(local);
  notifyChange();
}

// ---------------- Shared Files ----------------
// Supabase에 shared_files 테이블이 생성되어 있는지 확인 (미존재 시 400/404 반복 쿼리 에러 방지를 위해 로컬 모드로 고정)
let isSharedFilesTableAvailable: boolean | null = null;

export async function getSharedFiles(tabId?: number): Promise<SharedFile[]> {
  const supabase = getSupabase();
  if (supabase && isSharedFilesTableAvailable !== false) {
    try {
      const [filesRes, tabsRes] = await Promise.all([
        supabase
          .from("shared_files")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase.from("tabs").select("id, name"),
      ]);

      if (filesRes.error) {
        isSharedFilesTableAvailable = false;
        console.log("[DB] Supabase shared_files 테이블이 아직 생성되지 않아 로컬 저장소 모드로 작동합니다 (Supabase 반복 호출 차단).");
      } else {
        isSharedFilesTableAvailable = true;
        const tabMap = new Map((tabsRes.data || []).map((t: any) => [t.id, t.name]));
        let files: SharedFile[] = (filesRes.data || []).map((f: any) => ({
          ...f,
          tabs: f.tab_id && tabMap.has(f.tab_id) ? { name: tabMap.get(f.tab_id)! } : null,
        }));
        if (tabId !== undefined) {
          files = files.filter((f) => f.tab_id === tabId);
        }
        return files;
      }
    } catch {
      isSharedFilesTableAvailable = false;
      console.log("[DB] Supabase shared_files 조회 실패로 로컬 저장소 모드로 전환합니다.");
    }
  }

  const local = getLocalData();
  const tabMap = new Map(local.tabs.map((t) => [t.id, t.name]));
  let result = (local.sharedFiles || [])
    .filter((f) => !f.deleted_at)
    .map((f) => ({
      ...f,
      tabs: f.tab_id && tabMap.has(f.tab_id) ? { name: tabMap.get(f.tab_id)! } : null,
    }));

  if (tabId !== undefined) {
    result = result.filter((f) => f.tab_id === tabId);
  }

  return result.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA || b.id - a.id;
  });
}

export async function getSharedFileById(id: number): Promise<SharedFile | null> {
  const supabase = getSupabase();
  if (supabase && isSharedFilesTableAvailable === true) {
    try {
      const { data, error } = await supabase
        .from("shared_files")
        .select("*, tabs(name)")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (!error && data) {
        return data as SharedFile;
      }
    } catch {
      // 로컬 조회로 진행
    }
  }

  const local = getLocalData();
  const file = (local.sharedFiles || []).find((f) => f.id === id && !f.deleted_at);
  if (!file) return null;
  const tab = local.tabs.find((t) => t.id === file.tab_id);
  return {
    ...file,
    tabs: tab ? { name: tab.name } : null,
  };
}

export async function createSharedFile(input: {
  tab_id: number | null;
  filename: string;
  original_name: string;
  size: number;
  mime_type?: string | null;
  memo?: string | null;
}): Promise<SharedFile> {
  const supabase = getSupabase();
  if (supabase && isSharedFilesTableAvailable === true) {
    try {
      const { data, error } = await supabase
        .from("shared_files")
        .insert({
          tab_id: input.tab_id,
          filename: input.filename,
          original_name: input.original_name,
          size: input.size,
          mime_type: input.mime_type || null,
          memo: input.memo?.trim() || null,
          download_count: 0,
        })
        .select("*, tabs(name)")
        .single();

      if (!error && data) {
        notifyChange();
        return data as SharedFile;
      }
    } catch {
      // 로컬 생성으로 전환
    }
  }

  const local = getLocalData();
  if (!local.sharedFiles) local.sharedFiles = [];
  if (!local.nextSharedFileId) local.nextSharedFileId = 1;

  const newFile: SharedFile = {
    id: local.nextSharedFileId++,
    tab_id: input.tab_id,
    filename: input.filename,
    original_name: input.original_name,
    size: input.size,
    mime_type: input.mime_type || null,
    memo: input.memo?.trim() || null,
    download_count: 0,
    deleted_at: null,
    created_at: new Date().toISOString(),
  };

  const tab = local.tabs.find((t) => t.id === newFile.tab_id);
  if (tab) {
    newFile.tabs = { name: tab.name };
  }

  local.sharedFiles.push(newFile);
  saveLocalData(local);
  notifyChange();
  return newFile;
}

export async function deleteSharedFile(
  id: number,
  permanent = false
): Promise<SharedFile | null> {
  let targetFile: SharedFile | null = await getSharedFileById(id);

  const supabase = getSupabase();
  if (supabase && isSharedFilesTableAvailable === true) {
    try {
      const { error } = permanent
        ? await supabase.from("shared_files").delete().eq("id", id)
        : await supabase
            .from("shared_files")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

      if (!error) {
        notifyChange();
        return targetFile;
      }
    } catch {
      // 로컬 삭제로 전환
    }
  }

  const local = getLocalData();
  if (permanent) {
    local.sharedFiles = (local.sharedFiles || []).filter((f) => f.id !== id);
  } else {
    const target = (local.sharedFiles || []).find((f) => f.id === id);
    if (target) {
      target.deleted_at = new Date().toISOString();
      targetFile = target;
    }
  }
  saveLocalData(local);
  notifyChange();
  return targetFile;
}

export async function incrementSharedFileDownloadCount(id: number): Promise<void> {
  const supabase = getSupabase();
  if (supabase && isSharedFilesTableAvailable === true) {
    try {
      const { data } = await supabase.from("shared_files").select("download_count").eq("id", id).single();
      if (data) {
        await supabase
          .from("shared_files")
          .update({ download_count: (data.download_count || 0) + 1 })
          .eq("id", id);
        return;
      }
    } catch {
      // 로컬 카운트 증가로 전환
    }
  }

  const local = getLocalData();
  const target = (local.sharedFiles || []).find((f) => f.id === id);
  if (target) {
    target.download_count = (target.download_count || 0) + 1;
    saveLocalData(local);
  }
}

// ---------------- Health / Ping ----------------
export async function pingDatabase(): Promise<{ ok: boolean; at: string }> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("tabs").select("id").limit(1);
    if (error) {
      console.error("Supabase ping error:", error);
      throw error;
    }
    return { ok: true, at: new Date().toISOString() };
  }

  return { ok: true, at: new Date().toISOString() };
}

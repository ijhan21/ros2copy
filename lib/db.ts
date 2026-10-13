import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Tab, Snippet, Command, SnippetKind } from "./types";
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

// 로컬/인메모리 Fallback 스토리지 (Supabase 미설정 시 안전 모드)
interface LocalData {
  tabs: Tab[];
  snippets: Snippet[];
  commands: Command[];
  nextTabId: number;
  nextSnippetId: number;
  nextCommandId: number;
}

const LOCAL_DB_PATH = path.join("/tmp", ".ros2copy_local_db.json");

declare global {
  // eslint-disable-next-line no-var
  var __ROS2_MEMORY_DB__: LocalData | undefined;
}

function getLocalData(): LocalData {
  if (globalThis.__ROS2_MEMORY_DB__) {
    return globalThis.__ROS2_MEMORY_DB__;
  }

  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      const parsed = JSON.parse(content);
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
    nextTabId: 3,
    nextSnippetId: 1,
    nextCommandId: 1,
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
      .order("sort", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      console.error("Supabase getTabs error:", error);
      throw error;
    }
    return data || [];
  }

  const local = getLocalData();
  return [...local.tabs].sort((a, b) => a.sort - b.sort || a.id - b.id);
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
    return data;
  }

  const local = getLocalData();
  const existing = local.tabs.find((t) => t.name === trimmed);
  if (existing) {
    throw new Error("이미 존재하는 탭 이름입니다.");
  }
  const newTab: Tab = {
    id: local.nextTabId++,
    name: trimmed,
    sort: sort ?? local.tabs.length + 1,
    created_at: new Date().toISOString(),
  };
  local.tabs.push(newTab);
  saveLocalData(local);
  return newTab;
}

export async function deleteTab(id: number): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("tabs").delete().eq("id", id);
    if (error) {
      console.error("Supabase deleteTab error:", error);
      throw error;
    }
    return;
  }

  const local = getLocalData();
  local.tabs = local.tabs.filter((t) => t.id !== id);
  local.snippets = local.snippets.filter((s) => s.tab_id !== id);
  saveLocalData(local);
}

// ---------------- Snippets ----------------
function isMissingColumnError(error: any, columnName?: string): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = (error.message || "").toLowerCase();
  if (columnName) {
    return msg.includes(columnName.toLowerCase()) && msg.includes("does not exist");
  }
  return msg.includes("does not exist");
}

export async function getSnippets(tabId?: number): Promise<Snippet[]> {
  const supabase = getSupabase();
  if (supabase) {
    // deleted_at is null 및 pinned desc, created_at desc 정렬 시도
    let snippetsRes = await supabase
      .from("snippets")
      .select("*")
      .is("deleted_at", null)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    // 컬럼(deleted_at 또는 pinned) 미존재 시 기본 조회로 fallback
    if (snippetsRes.error && isMissingColumnError(snippetsRes.error)) {
      console.warn("snippets 테이블에 deleted_at/pinned 컬럼 없음 - 기본 정렬로 fallback");
      snippetsRes = await supabase
        .from("snippets")
        .select("*")
        .order("created_at", { ascending: false });
    }

    if (snippetsRes.error) {
      console.error("Supabase getSnippets error:", snippetsRes.error);
      throw snippetsRes.error;
    }

    const tabsRes = await supabase.from("tabs").select("id, name");
    const tabMap = new Map((tabsRes.data || []).map((t) => [t.id, t.name]));
    let items = (snippetsRes.data || []).map((s) => ({
      ...s,
      pinned: s.pinned ?? false,
      deleted_at: s.deleted_at ?? null,
      tabs: s.tab_id ? { name: tabMap.get(s.tab_id) || "" } : null,
    }));

    if (tabId) {
      items = items.filter((s) => s.tab_id === tabId);
    }
    return items as Snippet[];
  }

  const local = getLocalData();
  const tabMap = new Map(local.tabs.map((t) => [t.id, t.name]));
  let result = local.snippets
    .filter((s) => !s.deleted_at)
    .map((s) => ({
      ...s,
      tabs: s.tab_id ? { name: tabMap.get(s.tab_id) || "" } : null,
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
    const payload: any = {
      tab_id: input.tab_id || null,
      title: input.title?.trim() || null,
      path: input.path?.trim() || null,
      kind: input.kind,
      body: input.body,
    };
    if (input.pinned !== undefined) {
      payload.pinned = input.pinned;
    }

    let insertResult = await supabase
      .from("snippets")
      .insert(payload)
      .select()
      .single();

    // pinned 컬럼이 DB에 없어서 실패한 경우 pinned 제외 후 재시도
    if (insertResult.error && isMissingColumnError(insertResult.error, "pinned")) {
      console.warn("snippets 테이블에 pinned 컬럼 없음 - pinned 제외하고 재시도");
      delete payload.pinned;
      insertResult = await supabase
        .from("snippets")
        .insert(payload)
        .select()
        .single();
    }

    if (insertResult.error) {
      console.error("Supabase createSnippet error:", insertResult.error);
      throw insertResult.error;
    }

    const data = insertResult.data;
    let tabName = "";
    if (data.tab_id) {
      const { data: tabData } = await supabase
        .from("tabs")
        .select("name")
        .eq("id", data.tab_id)
        .single();
      tabName = tabData?.name || "";
    }

    return {
      ...data,
      pinned: data.pinned ?? false,
      deleted_at: data.deleted_at ?? null,
      tabs: tabName ? { name: tabName } : null,
    };
  }

  const local = getLocalData();
  const tab = local.tabs.find((t) => t.id === input.tab_id);
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

    let updateRes = await supabase
      .from("snippets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateRes.error && isMissingColumnError(updateRes.error)) {
      console.warn("snippets 테이블 컬럼 부재 - fallback 처리:", updateRes.error.message);
      delete updatePayload.pinned;
      delete updatePayload.deleted_at;
      if (Object.keys(updatePayload).length > 0) {
        updateRes = await supabase
          .from("snippets")
          .update(updatePayload)
          .eq("id", id)
          .select()
          .single();
      } else {
        const fetchRes = await supabase.from("snippets").select("*").eq("id", id).single();
        return {
          ...fetchRes.data,
          pinned: fetchRes.data?.pinned ?? false,
          deleted_at: fetchRes.data?.deleted_at ?? null,
        };
      }
    }

    if (updateRes.error) {
      console.error("Supabase updateSnippet error:", updateRes.error);
      throw updateRes.error;
    }
    return {
      ...updateRes.data,
      pinned: updateRes.data.pinned ?? false,
      deleted_at: updateRes.data.deleted_at ?? null,
    };
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
  return target;
}

export async function deleteSnippet(id: number, permanent = false): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    if (permanent) {
      const { error } = await supabase.from("snippets").delete().eq("id", id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("snippets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      if (isMissingColumnError(error, "deleted_at")) {
        console.warn("deleted_at 컬럼 없음 - 영구 삭제로 fallback");
        const { error: delErr } = await supabase.from("snippets").delete().eq("id", id);
        if (delErr) throw delErr;
        return;
      }
      throw error;
    }
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
}

// ---------------- Commands ----------------
export async function getCommands(): Promise<Command[]> {
  const supabase = getSupabase();
  if (supabase) {
    // deleted_at is null 및 created_at, id 동점 처리 정렬 시도
    let res = await supabase
      .from("commands")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (res.error && isMissingColumnError(res.error, "deleted_at")) {
      console.warn("commands 테이블에 deleted_at 컬럼 없음 - 기본 정렬로 fallback");
      res = await supabase
        .from("commands")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
    }

    if (res.error) {
      console.error("Supabase getCommands error:", res.error);
      throw res.error;
    }
    return (res.data || []).map((c) => ({
      ...c,
      deleted_at: c.deleted_at ?? null,
      pinned: c.pinned ?? false,
    }));
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
    const payload: any = {
      body: trimmed,
      memo: input.memo?.trim() || null,
      pinned: input.pinned ?? false,
    };

    let insertResult = await supabase
      .from("commands")
      .insert(payload)
      .select()
      .single();

    if (insertResult.error && isMissingColumnError(insertResult.error, "pinned")) {
      delete payload.pinned;
      insertResult = await supabase
        .from("commands")
        .insert(payload)
        .select()
        .single();
    }

    if (insertResult.error) {
      console.error("Supabase createCommand error:", insertResult.error);
      throw insertResult.error;
    }
    return {
      ...insertResult.data,
      pinned: insertResult.data.pinned ?? false,
      deleted_at: insertResult.data.deleted_at ?? null,
    };
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

    let res = await supabase
      .from("commands")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (res.error && isMissingColumnError(res.error)) {
      delete updatePayload.deleted_at;
      if (Object.keys(updatePayload).length > 0) {
        res = await supabase
          .from("commands")
          .update(updatePayload)
          .eq("id", id)
          .select()
          .single();
      } else {
        const fetchRes = await supabase.from("commands").select("*").eq("id", id).single();
        return {
          ...fetchRes.data,
          pinned: fetchRes.data?.pinned ?? false,
          deleted_at: fetchRes.data?.deleted_at ?? null,
        };
      }
    }

    if (res.error) throw res.error;
    return {
      ...res.data,
      pinned: res.data.pinned ?? false,
      deleted_at: res.data.deleted_at ?? null,
    };
  }

  const local = getLocalData();
  const target = local.commands.find((c) => c.id === id);
  if (!target) throw new Error("명령어를 찾을 수 없습니다.");

  if (data.pinned !== undefined) target.pinned = data.pinned;
  if (data.memo !== undefined) target.memo = data.memo;
  if (data.body !== undefined) target.body = data.body;
  if (data.deleted_at !== undefined) target.deleted_at = data.deleted_at;

  saveLocalData(local);
  return target;
}

export async function toggleCommandPinned(id: number, pinned: boolean): Promise<Command> {
  return updateCommand(id, { pinned });
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
}

// ---------------- Ping Database (Supabase 7일 멈춤 방지) ----------------
export async function pingDatabase(): Promise<{ ok: boolean; at: string }> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("tabs").select("id").limit(1);
    if (error) {
      console.error("Supabase ping error:", error);
    }
  }
  return { ok: true, at: new Date().toISOString() };
}

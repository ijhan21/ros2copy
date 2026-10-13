import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Tab, Snippet, Command, SnippetKind } from "./types";
import fs from "fs";
import path from "path";

// Supabase 환경변수 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// 로컬 Fallback 스토리지 (Supabase 미설정 시 로컬 테스트용)
interface LocalData {
  tabs: Tab[];
  snippets: Snippet[];
  commands: Command[];
  nextTabId: number;
  nextSnippetId: number;
  nextCommandId: number;
}

const LOCAL_DB_PATH = path.join(process.cwd(), ".local_db.json");

function getLocalData(): LocalData {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
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
    } catch {
      // 읽기 전용 환경 등 예외 처리
    }
    return initial;
  }
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      tabs: [],
      snippets: [],
      commands: [],
      nextTabId: 1,
      nextSnippetId: 1,
      nextCommandId: 1,
    };
  }
}

function saveLocalData(data: LocalData): void {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to local db:", err);
  }
}

// ---------------- Tabs ----------------
export async function getTabs(): Promise<Tab[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("tabs")
      .select("*")
      .order("sort", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  const local = getLocalData();
  return [...local.tabs].sort((a, b) => a.sort - b.sort || a.id - b.id);
}

export async function createTab(name: string, sort?: number): Promise<Tab> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("탭 이름은 필수입니다.");

  if (supabase) {
    const { data, error } = await supabase
      .from("tabs")
      .insert({
        name: trimmed,
        sort: sort ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
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
  if (supabase) {
    const { error } = await supabase.from("tabs").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const local = getLocalData();
  local.tabs = local.tabs.filter((t) => t.id !== id);
  local.snippets = local.snippets.filter((s) => s.tab_id !== id);
  saveLocalData(local);
}

// ---------------- Snippets ----------------
export async function getSnippets(tabId?: number): Promise<Snippet[]> {
  if (supabase) {
    let query = supabase
      .from("snippets")
      .select("*, tabs(name)")
      .order("created_at", { ascending: false });
    if (tabId) {
      query = query.eq("tab_id", tabId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Snippet[];
  }

  const local = getLocalData();
  const tabMap = new Map(local.tabs.map((t) => [t.id, t.name]));
  let result = local.snippets.map((s) => ({
    ...s,
    tabs: s.tab_id ? { name: tabMap.get(s.tab_id) || "" } : null,
  }));
  if (tabId) {
    result = result.filter((s) => s.tab_id === tabId);
  }
  return result.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function createSnippet(input: {
  tab_id?: number | null;
  title?: string | null;
  path?: string | null;
  kind: SnippetKind;
  body: string;
}): Promise<Snippet> {
  if (!input.body || !input.body.trim()) {
    throw new Error("본문 내용은 필수입니다.");
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("snippets")
      .insert({
        tab_id: input.tab_id || null,
        title: input.title?.trim() || null,
        path: input.path?.trim() || null,
        kind: input.kind,
        body: input.body,
      })
      .select("*, tabs(name)")
      .single();
    if (error) throw error;
    return data;
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
    created_at: new Date().toISOString(),
    tabs: tab ? { name: tab.name } : null,
  };
  local.snippets.unshift(newSnippet);
  saveLocalData(local);
  return newSnippet;
}

export async function deleteSnippet(id: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("snippets").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const local = getLocalData();
  local.snippets = local.snippets.filter((s) => s.id !== id);
  saveLocalData(local);
}

// ---------------- Commands ----------------
export async function getCommands(): Promise<Command[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("commands")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  const local = getLocalData();
  return [...local.commands].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function createCommand(input: {
  body: string;
  memo?: string | null;
  pinned?: boolean;
}): Promise<Command> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("명령어는 필수입니다.");

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
    if (error) throw error;
    return data;
  }

  const local = getLocalData();
  const newCommand: Command = {
    id: local.nextCommandId++,
    body: trimmed,
    memo: input.memo?.trim() || null,
    pinned: input.pinned ?? false,
    created_at: new Date().toISOString(),
  };
  local.commands.push(newCommand);
  saveLocalData(local);
  return newCommand;
}

export async function toggleCommandPinned(id: number, pinned: boolean): Promise<Command> {
  if (supabase) {
    const { data, error } = await supabase
      .from("commands")
      .update({ pinned })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const local = getLocalData();
  const target = local.commands.find((c) => c.id === id);
  if (!target) throw new Error("명령어를 찾을 수 없습니다.");
  target.pinned = pinned;
  saveLocalData(local);
  return target;
}

export async function deleteCommand(id: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("commands").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const local = getLocalData();
  local.commands = local.commands.filter((c) => c.id !== id);
  saveLocalData(local);
}

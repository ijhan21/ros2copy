import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Tab, Snippet, Command } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (browserClient) {
    return browserClient;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return browserClient;
}

// 브라우저에서 Supabase 직접 조회 (Network 탭에 supabase.co 요청 발생)
export async function fetchTabsFromClient(): Promise<Tab[] | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tabs")
    .select("*")
    .is("deleted_at", null)
    .order("sort", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("클라이언트 Supabase tabs 조회 실패:", error);
    return null;
  }
  return data || [];
}

export async function fetchSnippetsFromClient(tabId?: number | null): Promise<Snippet[] | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

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
    console.error("클라이언트 Supabase snippets 조회 실패:", snippetsRes.error);
    return null;
  }

  const activeTabs = tabsRes.data || [];
  const activeTabMap = new Map(activeTabs.map((t) => [t.id, t.name]));
  let items = (snippetsRes.data || [])
    .filter((s) => !s.tab_id || activeTabMap.has(s.tab_id))
    .map((s) => ({
      ...s,
      tabs: s.tab_id ? { name: activeTabMap.get(s.tab_id) || "" } : null,
    }));

  if (tabId) {
    items = items.filter((s) => s.tab_id === tabId);
  }
  return items;
}

export async function fetchCommandsFromClient(): Promise<Command[] | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("commands")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("클라이언트 Supabase commands 조회 실패:", error);
    return null;
  }
  return data || [];
}

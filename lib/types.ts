export type SnippetKind = "python" | "bash" | "xml" | "yaml" | "text";

export interface Tab {
  id: number;
  name: string;
  sort: number;
  deleted_at?: string | null;
  created_at: string;
}

export interface Snippet {
  id: number;
  tab_id: number | null;
  title: string | null;
  path: string | null;
  kind: SnippetKind;
  body: string;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  tabs?: {
    name: string;
  } | null;
}

export interface Command {
  id: number;
  body: string;
  memo: string | null;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
}

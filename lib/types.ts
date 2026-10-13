export type SnippetKind = "python" | "bash" | "xml" | "yaml" | "text";

export interface Tab {
  id: number;
  name: string;
  sort: number;
  created_at: string;
}

export interface Snippet {
  id: number;
  tab_id: number | null;
  title: string | null;
  path: string | null;
  kind: SnippetKind;
  body: string;
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
  created_at: string;
}

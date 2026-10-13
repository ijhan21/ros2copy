import { NextRequest, NextResponse } from "next/server";
import { getSnippets, createSnippet } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";
import { SnippetKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tabIdParam = request.nextUrl.searchParams.get("tab_id");
    const tabId = tabIdParam ? parseInt(tabIdParam, 10) : undefined;
    const snippets = await getSnippets(isNaN(tabId as number) ? undefined : tabId);
    return NextResponse.json(snippets, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch snippets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tab_id, title, path, kind, body: codeBody } = body;

    if (!codeBody || typeof codeBody !== "string" || !codeBody.trim()) {
      return NextResponse.json({ error: "코드 내용은 필수입니다." }, { status: 400 });
    }

    const validKinds: SnippetKind[] = ["python", "bash", "xml", "yaml", "text"];
    const snippetKind: SnippetKind = validKinds.includes(kind) ? kind : "text";

    const snippet = await createSnippet({
      tab_id: tab_id ? parseInt(tab_id, 10) : null,
      title: title || null,
      path: path || null,
      kind: snippetKind,
      body: codeBody,
    });

    return NextResponse.json(snippet, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create snippet" }, { status: 400 });
  }
}

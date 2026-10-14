import { NextRequest, NextResponse } from "next/server";
import { deleteSnippet, updateSnippet, getSnippetById } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const snippetId = parseInt(id, 10);
    if (isNaN(snippetId)) {
      return NextResponse.json({ error: "올바르지 않은 스니펫 ID입니다." }, { status: 400 });
    }

    const snippet = await getSnippetById(snippetId);
    if (!snippet) {
      return NextResponse.json({ error: "스니펫을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(snippet, {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch snippet" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;
    const snippetId = parseInt(id, 10);
    if (isNaN(snippetId)) {
      return NextResponse.json({ error: "올바르지 않은 스니펫 ID입니다." }, { status: 400 });
    }

    const body = await request.json();
    const updated = await updateSnippet(snippetId, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update snippet" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;
    const snippetId = parseInt(id, 10);
    if (isNaN(snippetId)) {
      return NextResponse.json({ error: "올바르지 않은 스니펫 ID입니다." }, { status: 400 });
    }

    const permanent = request.nextUrl.searchParams.get("permanent") === "true";
    await deleteSnippet(snippetId, permanent);
    return NextResponse.json({ success: true, permanent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete snippet" }, { status: 500 });
  }
}

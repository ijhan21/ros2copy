import { NextRequest, NextResponse } from "next/server";
import { deleteSnippet } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";

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
    await deleteSnippet(snippetId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete snippet" }, { status: 500 });
  }
}

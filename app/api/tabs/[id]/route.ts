import { NextRequest, NextResponse } from "next/server";
import { deleteTab } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    const tabId = parseInt(id, 10);
    if (isNaN(tabId)) {
      return NextResponse.json({ error: "올바르지 않은 탭 ID입니다." }, { status: 400 });
    }
    await deleteTab(tabId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete tab" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { deleteTab, updateTab } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    const tabId = parseInt(id, 10);
    if (isNaN(tabId)) {
      return NextResponse.json({ error: "올바르지 않은 탭 ID입니다." }, { status: 400 });
    }

    const body = await request.json();
    const updated = await updateTab(tabId, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update tab" }, { status: 400 });
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
    const tabId = parseInt(id, 10);
    if (isNaN(tabId)) {
      return NextResponse.json({ error: "올바르지 않은 탭 ID입니다." }, { status: 400 });
    }

    const permanent = request.nextUrl.searchParams.get("permanent") === "true";
    await deleteTab(tabId, permanent);
    return NextResponse.json({ success: true, permanent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete tab" }, { status: 500 });
  }
}

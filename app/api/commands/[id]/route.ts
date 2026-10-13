import { NextRequest, NextResponse } from "next/server";
import { updateCommand, deleteCommand } from "@/lib/db";
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
    const cmdId = parseInt(id, 10);
    if (isNaN(cmdId)) {
      return NextResponse.json({ error: "올바르지 않은 명령 ID입니다." }, { status: 400 });
    }

    const body = await request.json();
    const updated = await updateCommand(cmdId, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update command" }, { status: 500 });
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
    const cmdId = parseInt(id, 10);
    if (isNaN(cmdId)) {
      return NextResponse.json({ error: "올바르지 않은 명령 ID입니다." }, { status: 400 });
    }

    const permanent = request.nextUrl.searchParams.get("permanent") === "true";
    await deleteCommand(cmdId, permanent);
    return NextResponse.json({ success: true, permanent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete command" }, { status: 500 });
  }
}

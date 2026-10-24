import { NextRequest, NextResponse } from "next/server";
import { getSharedFileById, deleteSharedFile } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: "잘못된 파일 ID입니다." }, { status: 400 });
    }

    const file = await getSharedFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(file);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "파일 정보 조회 실패" }, { status: 500 });
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
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: "잘못된 파일 ID입니다." }, { status: 400 });
    }

    const permanent = request.nextUrl.searchParams.get("permanent") === "true";
    const deleted = await deleteSharedFile(fileId, permanent);

    if (permanent && deleted?.filename) {
      const safeFileName = path.basename(deleted.filename);
      const filePath = path.join(process.cwd(), "uploads", safeFileName);
      try {
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          await fs.promises.unlink(/*turbopackIgnore: true*/ filePath);
        }
      } catch (err) {
        console.warn("디스크 파일 삭제 실패:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "파일 삭제 실패" }, { status: 500 });
  }
}

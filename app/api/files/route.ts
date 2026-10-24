import { NextRequest, NextResponse } from "next/server";
import { getSharedFiles, createSharedFile } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function GET(request: NextRequest) {
  try {
    const tabIdParam = request.nextUrl.searchParams.get("tab_id");
    const tabId = tabIdParam ? parseInt(tabIdParam, 10) : undefined;
    const files = await getSharedFiles(isNaN(tabId as number) ? undefined : tabId);
    return NextResponse.json(files, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "파일 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tabIdParam = formData.get("tab_id") as string | null;
    const memo = formData.get("memo") as string | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
    }

    const tabId = tabIdParam && tabIdParam !== "null" && tabIdParam !== "undefined"
      ? parseInt(tabIdParam, 10)
      : null;

    // 디렉터리 준비
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

    // 고유 파일명 생성
    const originalName = file.name || "download.bin";
    const ext = path.extname(originalName);
    const safeBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\uAC00-\uD7A3.-]/g, "_");
    const uniqueFileName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safeBaseName}${ext}`;
    const destinationPath = path.join(UPLOAD_DIR, uniqueFileName);

    // 파일 쓰기
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(destinationPath, buffer);

    // 메타데이터 생성
    const sharedFile = await createSharedFile({
      tab_id: isNaN(tabId as number) ? null : tabId,
      filename: uniqueFileName,
      original_name: originalName,
      size: buffer.length,
      mime_type: file.type || "application/octet-stream",
      memo: memo?.trim() || null,
    });

    return NextResponse.json(sharedFile, { status: 201 });
  } catch (err: any) {
    console.error("파일 업로드 에러:", err);
    return NextResponse.json({ error: err.message || "파일 업로드 실패" }, { status: 500 });
  }
}

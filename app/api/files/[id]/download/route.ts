import { NextRequest, NextResponse } from "next/server";
import { getSharedFileById, incrementSharedFileDownloadCount } from "@/lib/db";
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
    if (!file || file.deleted_at) {
      return NextResponse.json({ error: "존재하지 않거나 삭제된 파일입니다." }, { status: 404 });
    }

    const safeFileName = path.basename(file.filename);
    const filePath = path.join(process.cwd(), "uploads", safeFileName);
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      return NextResponse.json({ error: "서버 저장소에 파일이 존재하지 않습니다." }, { status: 404 });
    }

    // 다운로드 카운트 증가
    incrementSharedFileDownloadCount(fileId).catch(() => {});

    const stat = await fs.promises.stat(/*turbopackIgnore: true*/ filePath);
    const nodeStream = fs.createReadStream(/*turbopackIgnore: true*/ filePath);

    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
    });

    const encodedName = encodeURIComponent(file.original_name);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Length": stat.size.toString(),
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("파일 다운로드 오류:", err);
    return NextResponse.json({ error: err.message || "파일 다운로드 실패" }, { status: 500 });
  }
}

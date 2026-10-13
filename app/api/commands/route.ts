import { NextRequest, NextResponse } from "next/server";
import { getCommands, createCommand } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";

export async function GET() {
  try {
    const commands = await getCommands();
    return NextResponse.json(commands);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch commands" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { body: cmdBody, memo, pinned } = body;

    if (!cmdBody || typeof cmdBody !== "string" || !cmdBody.trim()) {
      return NextResponse.json({ error: "명령어는 필수입니다." }, { status: 400 });
    }

    const command = await createCommand({
      body: cmdBody,
      memo: memo || null,
      pinned: !!pinned,
    });

    return NextResponse.json(command, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create command" }, { status: 400 });
  }
}

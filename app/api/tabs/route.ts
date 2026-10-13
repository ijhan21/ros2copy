import { NextRequest, NextResponse } from "next/server";
import { getTabs, createTab } from "@/lib/db";
import { verifyAdminPassword } from "@/lib/auth";

export async function GET() {
  try {
    const tabs = await getTabs();
    return NextResponse.json(tabs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch tabs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, sort } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "탭 이름이 필요합니다." }, { status: 400 });
    }
    const tab = await createTab(name, sort);
    return NextResponse.json(tab, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create tab" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminPassword(request);
  if (!auth.authorized) {
    return NextResponse.json({ authorized: false, error: auth.error }, { status: 401 });
  }
  return NextResponse.json({ authorized: true });
}

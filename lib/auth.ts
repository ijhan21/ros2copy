import { NextRequest } from "next/server";

export function verifyAdminPassword(request: NextRequest): { authorized: boolean; error?: string } {
  const configuredPassword = process.env.BOARD_PASSWORD?.trim();

  // 헤더에서 암호 추출
  const headerPassword = request.headers.get("x-board-password")?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  let bearerPassword: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerPassword = authHeader.substring(7).trim();
  }

  const providedPassword = (headerPassword || bearerPassword)?.trim();

  if (!providedPassword) {
    return { authorized: false, error: "암호가 필요합니다. 상단에서 암호를 입력하십시오." };
  }

  // 환경변수가 설정되어 있다면 정확히 일치해야 함
  if (configuredPassword) {
    if (providedPassword !== configuredPassword) {
      return { authorized: false, error: "암호가 올바르지 않습니다." };
    }
    return { authorized: true };
  }

  // 환경변수가 미설정된 경우: 기본 암호 'ros2' 허용
  const devDefaultPassword = "ros2";
  if (providedPassword === devDefaultPassword) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: "암호가 올바르지 않습니다. (BOARD_PASSWORD 환경변수 확인 필요)",
  };
}

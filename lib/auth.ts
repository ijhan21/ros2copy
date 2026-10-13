import { NextRequest } from "next/server";

export function verifyAdminPassword(request: NextRequest): { authorized: boolean; error?: string } {
  const configuredPassword = process.env.BOARD_PASSWORD;
  
  // 헤더에서 암호 추출
  const headerPassword = request.headers.get("x-board-password");
  const authHeader = request.headers.get("authorization");
  let bearerPassword: string | null = null;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerPassword = authHeader.substring(7).trim();
  }
  
  const providedPassword = headerPassword || bearerPassword;

  if (!providedPassword) {
    return { authorized: false, error: "암호가 필요합니다." };
  }

  // 환경변수가 설정되어 있다면 반드시 일치해야 함
  if (configuredPassword) {
    if (providedPassword !== configuredPassword) {
      return { authorized: false, error: "암호가 올바르지 않습니다." };
    }
    return { authorized: true };
  }

  // 환경변수가 설정되지 않은 개발 환경에서의 기본 처리
  // 주의: 프로덕션 배포 시에는 BOARD_PASSWORD 환경변수가 필수임
  const devDefaultPassword = "ros2";
  if (providedPassword === devDefaultPassword) {
    return { authorized: true };
  }

  return { authorized: false, error: "암호가 올바르지 않습니다." };
}

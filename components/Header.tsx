"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  isTeacher?: boolean;
  connectionMode?: "connected" | "connecting" | "polling";
}

export default function Header({ isTeacher = false, connectionMode = "connected" }: HeaderProps) {
  return (
    <header className="w-full bg-[#FFFFFF] dark:bg-[#1A1A1E] border-b border-[#E4E4E7] dark:border-[#2E2E36] px-4 py-3 shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <Link
            href="/"
            className="text-lg sm:text-xl font-bold tracking-tight text-[#18181B] dark:text-[#F4F4F5]"
          >
            ROS2 코드 보드
          </Link>
          <span className="text-xs text-[#52525B] dark:text-[#9CA3AF]">
            수업에서 쓴 코드와 명령을 모아 둡니다. 눌러서 복사해 가십시오.
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!isTeacher && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#52525B] dark:text-[#D1D5DB] bg-[#F7F7F8] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#2E2E36] rounded-full">
              {connectionMode === "connected" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#0F766E] animate-pulse" />
                  <span>실시간 연결됨 (SSE)</span>
                </>
              )}
              {connectionMode === "connecting" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#EAB308] animate-pulse" />
                  <span>실시간 연결 중...</span>
                </>
              )}
              {connectionMode === "polling" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#F97316]" />
                  <span>30초마다 가져옵니다 (예비 연결)</span>
                </>
              )}
            </div>
          )}

          <ThemeToggle />

          {isTeacher ? (
            <Link
              href="/"
              className="min-h-[36px] px-3 inline-flex items-center text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#F4F4F5] dark:hover:bg-[#26262E] transition-colors"
            >
              학생 화면으로
            </Link>
          ) : (
            <Link
              href="/올리기"
              className="min-h-[36px] px-3 inline-flex items-center text-xs font-medium border border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6] rounded-[8px] bg-[#CCFBF1]/30 dark:bg-[#115E59]/30 hover:bg-[#CCFBF1] dark:hover:bg-[#115E59] transition-colors"
            >
              강사 올리기
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

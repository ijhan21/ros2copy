"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "@/lib/types";

interface CommandStreamProps {
  commands: Command[];
}

export default function CommandStream({ commands }: CommandStreamProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const streamBottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(commands.length);

  // pinned와 일반 명령 분리
  const pinnedCommands = commands.filter((c) => c.pinned);
  const regularCommands = commands.filter((c) => !c.pinned);
  const latestRegularId =
    regularCommands.length > 0
      ? regularCommands[regularCommands.length - 1].id
      : null;

  // 새 명령이 오면 맨 아래로 스크롤
  useEffect(() => {
    if (commands.length > prevCountRef.current) {
      streamBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = commands.length;
  }, [commands.length]);

  const handleCopy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  return (
    <aside className="w-full lg:w-[370px] shrink-0 bg-[#1C1C22] text-[#D4D7DD] border border-[#2E2E36] rounded-[13px] flex flex-col h-[650px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-4 overflow-hidden">
      {/* 패널 헤더 */}
      <div className="p-3.5 border-b border-[#2E2E36] bg-[#26262E] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#F4F4F5] tracking-tight">명령 흐름</h2>
          <p className="text-[11px] text-[#71717A]">자주 쓰는 터미널 명령어 모음</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#1C1C22] text-[#A1A1AA] border border-[#3F3F46]">
          {commands.length}개
        </span>
      </div>

      {/* 핀 고정 (지금 쓰는 것) 영역 */}
      {pinnedCommands.length > 0 && (
        <div className="p-3 border-b border-[#2E2E36] bg-[#26262E]/50 shrink-0 max-h-48 overflow-y-auto">
          <div className="text-[11px] font-semibold text-[#0F766E] dark:text-[#14B8A6] mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
            지금 쓰는 것
          </div>
          <div className="space-y-2">
            {pinnedCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-2.5 rounded-[8px] bg-[#1C1C22] border border-[#3F3F46] flex flex-col gap-1"
              >
                {cmd.memo && (
                  <div className="text-[11px] text-[#7A8290] leading-tight">
                    {cmd.memo}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-[#D4D7DD] overflow-x-auto whitespace-pre py-0.5 custom-scroll">
                    {cmd.body}
                  </div>
                  <button
                    onClick={() => handleCopy(cmd.id, cmd.body)}
                    className="min-h-[28px] px-2 text-[11px] font-semibold rounded-[6px] shrink-0 bg-[#26262E] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#3F3F46] transition-colors"
                  >
                    {copiedId === cmd.id ? "복사함" : "복사"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스크롤 가능한 본체 (채팅처럼 최신이 맨 아래) */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col justify-end custom-scroll">
        <div className="space-y-2.5 my-auto">
          {regularCommands.length === 0 && pinnedCommands.length === 0 && (
            <div className="text-center py-12 text-xs text-[#71717A]">
              아직 올라온 명령어가 없습니다.
            </div>
          )}

          {regularCommands.map((cmd) => {
            const isLatest = cmd.id === latestRegularId;

            return (
              <div
                key={cmd.id}
                className={`p-2.5 rounded-[8px] bg-[#26262E] transition-all ${
                  isLatest
                    ? "border border-[#0F766E]"
                    : "border border-[#2E2E36]"
                }`}
              >
                {cmd.memo && (
                  <div className="text-[11px] text-[#7A8290] leading-tight mb-1">
                    {cmd.memo}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-[#D4D7DD] overflow-x-auto whitespace-pre py-0.5 flex-1 custom-scroll">
                    {cmd.body}
                  </div>
                  <button
                    onClick={() => handleCopy(cmd.id, cmd.body)}
                    className="min-h-[28px] px-2 text-[11px] font-semibold rounded-[6px] shrink-0 bg-[#1C1C22] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#3F3F46] transition-colors"
                  >
                    {copiedId === cmd.id ? "복사함" : "복사"}
                  </button>
                </div>

                {isLatest && (
                  <div className="mt-1.5 text-[10px] text-[#0F766E] dark:text-[#14B8A6] font-medium">
                    방금 — 강사가 보냈습니다
                  </div>
                )}
              </div>
            );
          })}
          <div ref={streamBottomRef} />
        </div>
      </div>
    </aside>
  );
}

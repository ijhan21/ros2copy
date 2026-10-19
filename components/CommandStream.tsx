"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Command } from "@/lib/types";
import { formatRelativeTime } from "@/lib/time";

interface CommandStreamProps {
  commands: Command[];
  isTeacher?: boolean;
  onDeleteCommand?: (id: number) => Promise<boolean>;
}

export default function CommandStream({
  commands,
  isTeacher = false,
  onDeleteCommand,
}: CommandStreamProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const streamBottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);

  // pinned와 일반 명령 분리
  const pinnedCommands = commands.filter((c) => c.pinned);
  const regularCommands = commands.filter((c) => !c.pinned);
  const latestRegularCommand =
    regularCommands.length > 0
      ? regularCommands[regularCommands.length - 1]
      : null;

  // 맨 아래로 스크롤 함수
  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // 마운트 시 및 새 명령 수신 시 맨 아래로 자동 이동
  useEffect(() => {
    if (commands.length === 0) return;

    if (prevCountRef.current === 0) {
      // 최초 데이터 수신 시 즉시 맨 아래로 이동
      setTimeout(() => scrollToBottom(false), 50);
    } else if (commands.length > prevCountRef.current) {
      // 새 명령 추가 시 부드럽게 아래로 이동
      scrollToBottom(true);
    }
    prevCountRef.current = commands.length;
  }, [commands.length, scrollToBottom]);

  // 스크롤 위치 감지 (위로 스크롤했을 때 '맨 아래로' 플로팅 버튼 표시)
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 60;
    setShowScrollBottomBtn(!isNearBottom);
  };

  const handleCopy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!onDeleteCommand) return;
    const confirmed = window.confirm("이 명령어를 삭제할까요? (8초 동안 되돌릴 수 있어요)");
    if (!confirmed) return;
    await onDeleteCommand(id);
  };

  return (
    <aside className="w-full lg:w-[380px] shrink-0 bg-[#1C1C22] text-[#D4D7DD] border border-[#2E2E36] rounded-[16px] flex flex-col h-[650px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-4 overflow-hidden shadow-sm">
      {/* 1. 패널 헤더 */}
      <div className="p-3.5 border-b border-[#2E2E36] bg-[#222228] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[#F4F4F5] tracking-tight flex items-center gap-2">
            <span>터미널 명령어 흐름</span>
          </h2>
          <p className="text-[11px] text-[#A1A1AA] mt-0.5">수업 중 실행하는 명령어 모음입니다.</p>
        </div>
        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-[#1C1C22] text-[#A1A1AA] border border-[#3F3F46]">
          {commands.length}개
        </span>
      </div>

      {/* 2. 핀 고정 (주요 명령어) 영역 */}
      {pinnedCommands.length > 0 && (
        <div className="p-3 border-b border-[#2E2E36] bg-[#222228]/60 shrink-0 max-h-48 overflow-y-auto custom-scroll">
          <div className="text-[11px] font-semibold text-[#14B8A6] mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
            고정된 주요 명령어
          </div>
          <div className="space-y-2">
            {pinnedCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-2.5 rounded-[8px] bg-[#1C1C22] border border-[#3F3F46] flex flex-col gap-1 hover:border-[#14B8A6]/40 transition-colors"
              >
                {cmd.memo && (
                  <div className="text-[11px] text-[#A1A1AA] leading-tight">
                    {cmd.memo}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-[#E4E4E7] overflow-x-auto whitespace-pre py-0.5 custom-scroll flex-1">
                    {cmd.body}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopy(cmd.id, cmd.body)}
                      className="min-h-[28px] px-2.5 text-[11px] font-semibold rounded-[6px] bg-[#26262E] hover:bg-[#3F3F46] text-[#D1D5DB] hover:text-white border border-[#3F3F46] transition-colors"
                    >
                      {copiedId === cmd.id ? "복사됨!" : "복사"}
                    </button>
                    {isTeacher && onDeleteCommand && (
                      <button
                        onClick={() => handleDelete(cmd.id)}
                        title="명령 삭제"
                        className="min-h-[28px] px-1.5 text-[11px] font-semibold rounded-[6px] bg-[#26262E] text-red-400 hover:text-red-300 border border-[#3F3F46]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 명령어 전체 히스토리 스트림 (위에서 아래로 자연스러운 흐름) */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scroll"
        >
          {regularCommands.length === 0 && pinnedCommands.length === 0 && (
            <div className="text-center py-16 text-xs text-[#A1A1AA]">
              아직 등록된 명령어가 없어요.<br />수업 중 실행하는 명령어가 여기에 순서대로 나타납니다.
            </div>
          )}

          {regularCommands.map((cmd) => {
            const isLatest = cmd.id === latestRegularCommand?.id;

            return (
              <div
                key={cmd.id}
                className={`p-2.5 rounded-[10px] bg-[#26262E] transition-all ${
                  isLatest
                    ? "border border-[#0F766E] shadow-[0_0_12px_rgba(15,118,110,0.25)]"
                    : "border border-[#2E2E36] hover:border-[#3F3F46]"
                }`}
              >
                {cmd.memo && (
                  <div className="text-[11px] text-[#A1A1AA] leading-tight mb-1">
                    {cmd.memo}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-[#E4E4E7] overflow-x-auto whitespace-pre py-0.5 flex-1 custom-scroll">
                    {cmd.body}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopy(cmd.id, cmd.body)}
                      className="min-h-[28px] px-2.5 text-[11px] font-semibold rounded-[6px] bg-[#1C1C22] hover:bg-[#3F3F46] text-[#D1D5DB] hover:text-white border border-[#3F3F46] transition-colors"
                    >
                      {copiedId === cmd.id ? "복사됨!" : "복사"}
                    </button>
                    {isTeacher && onDeleteCommand && (
                      <button
                        onClick={() => handleDelete(cmd.id)}
                        title="명령 삭제"
                        className="min-h-[28px] px-1.5 text-[11px] font-semibold rounded-[6px] bg-[#1C1C22] text-red-400 hover:text-red-300 border border-[#3F3F46]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {isLatest && (
                  <div className="mt-1 text-[10px] text-[#14B8A6] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                    방금 등록된 명령
                  </div>
                )}
              </div>
            );
          })}
          <div ref={streamBottomRef} />
        </div>

        {/* 위로 스크롤했을 때 나타나는 '최신 명령으로 이동' 플로팅 버튼 */}
        {showScrollBottomBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0F766E] hover:bg-[#115E59] text-white text-[11px] font-semibold rounded-full shadow-lg border border-[#14B8A6]/40 transition-all animate-bounce"
          >
            최신 명령으로 이동 ↓
          </button>
        )}
      </div>

      {/* 4. 하단 고정 독: 가장 최근 명령어 바 (스크롤하지 않아도 항상 눈앞에 고정) */}
      {latestRegularCommand && (
        <div className="p-3 bg-[#18181B] border-t border-[#3F3F46] shrink-0">
          <div className="flex items-center justify-between text-[11px] text-[#14B8A6] font-semibold mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
              가장 최근 명령어
            </span>
            {latestRegularCommand.created_at && (
              <span className="text-[10px] text-[#A1A1AA] font-normal">
                {formatRelativeTime(latestRegularCommand.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-xs text-[#F4F4F5] bg-[#26262E] px-2.5 py-1.5 rounded-[8px] border border-[#3F3F46] overflow-x-auto whitespace-pre custom-scroll">
              {latestRegularCommand.body}
            </div>
            <button
              onClick={() => handleCopy(latestRegularCommand.id, latestRegularCommand.body)}
              className="min-h-[32px] px-3.5 text-xs font-bold rounded-[8px] bg-[#0F766E] hover:bg-[#115E59] text-white shrink-0 shadow-xs transition-colors"
            >
              {copiedId === latestRegularCommand.id ? "복사됨!" : "복사"}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

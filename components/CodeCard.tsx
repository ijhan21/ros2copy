"use client";

import { useState } from "react";
import { Snippet } from "@/lib/types";
import { formatRelativeTime, isWithinTenMinutes } from "@/lib/time";
import { tokenizeCode, getKindBadgeInfo, getTokenColor } from "@/lib/highlighter";

interface CodeCardProps {
  snippet: Snippet;
}

export default function CodeCard({ snippet }: CodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const lines = snippet.body.split("\n");
  const isLong = lines.length > 20;
  const visibleLines = isLong && !expanded ? lines.slice(0, 20) : lines;
  const hiddenCount = lines.length - 20;

  const isRecent = isWithinTenMinutes(snippet.created_at);
  const badgeInfo = getKindBadgeInfo(snippet.kind);

  // 전체 복사
  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(snippet.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
    }
  };

  // 터미널 줄 단위 복사
  const handleCopyLine = async (lineText: string, idx: number) => {
    try {
      // 프롬프트 기호 '$ '가 맨 앞에 있으면 제거 후 복사 (터미널 붙여넣기 편의)
      const cleanCmd = lineText.trim().startsWith("$ ")
        ? lineText.trim().substring(2)
        : lineText;
      await navigator.clipboard.writeText(cleanCmd);
      setCopiedLineIdx(idx);
      setTimeout(() => setCopiedLineIdx(null), 1500);
    } catch (err) {
      console.error("줄 복사 실패:", err);
    }
  };

  const tokenizedLines = tokenizeCode(visibleLines.join("\n"), snippet.kind);

  return (
    <div
      className={`rounded-[13px] bg-[#FFFFFF] dark:bg-[#1A1A1E] p-4 flex flex-col justify-between transition-shadow duration-200 ${
        isRecent
          ? "border-2 border-[#0F766E] shadow-[0_0_15px_rgba(15,118,110,0.35)]"
          : "border border-[#E4E4E7] dark:border-[#2E2E36]"
      }`}
    >
      {/* 상단 메타데이터 영역 */}
      <div>
        {/* 뱃지 줄 */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {isRecent && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-[6px] bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E]/20">
                방금 올라옴
              </span>
            )}
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-[6px]"
              style={{ backgroundColor: badgeInfo.bg, color: badgeInfo.text }}
            >
              {badgeInfo.label}
            </span>
            <span className="text-xs text-[#71717A]">
              {snippet.tabs?.name ? `${snippet.tabs.name} · ` : ""}
              {formatRelativeTime(snippet.created_at)}
            </span>
          </div>

          {/* 줄 번호 토글 및 복사 단추 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className="min-h-[36px] px-2.5 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#E4E4E7] dark:hover:bg-[#3F3F46] transition-colors"
            >
              {showLineNumbers ? "줄번호 끔" : "줄번호 켬"}
            </button>

            <button
              onClick={handleCopyAll}
              className={`min-h-[36px] px-3.5 text-xs font-semibold rounded-[8px] transition-colors ${
                copied
                  ? "bg-[#0F766E] text-white"
                  : "bg-[#0F766E] text-white hover:bg-[#115E59]"
              }`}
            >
              {copied ? "복사함" : "복사"}
            </button>
          </div>
        </div>

        {/* 제목 및 경로 */}
        <div className="mb-3">
          <h3 className="text-base font-bold text-[#18181B] dark:text-[#F4F4F5] break-words">
            {snippet.title || "코드 스니펫"}
          </h3>
          {snippet.path && (
            <div className="text-xs font-mono text-[#71717A] break-all mt-0.5">
              {snippet.path}
            </div>
          )}
        </div>
      </div>

      {/* 어두운 코드 상자 */}
      <div className="mt-1">
        <div className="bg-[#1C1C22] text-[#D4D7DD] rounded-[8px] overflow-hidden border border-[#2E2E36]">
          <div
            className={`code-container text-xs sm:text-sm font-mono overflow-x-auto p-3.5 leading-6 ${
              showLineNumbers ? "show-line-numbers" : "hide-line-numbers"
            }`}
          >
            {tokenizedLines.map((lineTokens, lineIdx) => {
              const rawLine = visibleLines[lineIdx];
              return (
                <div
                  key={lineIdx}
                  className="code-line group relative flex items-center justify-between hover:bg-[#26262E]/60 rounded-[4px] px-1"
                >
                  <div className="whitespace-pre overflow-x-visible">
                    {lineTokens.map((token, tokenIdx) => {
                      const color = getTokenColor(token.type);
                      return color ? (
                        <span key={tokenIdx} style={{ color }}>
                          {token.text}
                        </span>
                      ) : (
                        <span key={tokenIdx}>{token.text}</span>
                      );
                    })}
                  </div>

                  {/* 터미널 종류일 때 줄마다 복사 단추 */}
                  {snippet.kind === "bash" && rawLine.trim().length > 0 && (
                    <button
                      onClick={() => handleCopyLine(rawLine, lineIdx)}
                      title="이 줄 복사"
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 px-1.5 py-0.5 text-[10px] bg-[#26262E] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white rounded border border-[#3F3F46]"
                    >
                      {copiedLineIdx === lineIdx ? "복사함" : "복사"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 20줄 넘칠 때 펼치기/접기 */}
          {isLong && (
            <div className="border-t border-[#2E2E36] bg-[#26262E]/70 px-3 py-2 text-center">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-medium text-[#CCFBF1] hover:text-white transition-colors"
              >
                {expanded
                  ? "위로 접기"
                  : `아래로 ${hiddenCount}줄 더 — 펼치기`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

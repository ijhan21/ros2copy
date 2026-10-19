"use client";

import { useState, useEffect, useRef } from "react";
import { Snippet } from "@/lib/types";
import { formatRelativeTime } from "@/lib/time";
import { tokenizeCode, getKindBadgeInfo, getTokenColor } from "@/lib/highlighter";

interface CodeModalProps {
  isOpen: boolean;
  snippet: Snippet | null;
  currentIndex: number;
  totalCount: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onFetchBody?: (id: number) => Promise<string | null>;
}

export default function CodeModal({
  isOpen,
  snippet,
  currentIndex,
  totalCount,
  onClose,
  onNavigate,
  onFetchBody,
}: CodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [isLoadingBody, setIsLoadingBody] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // 256KB 초과 분리된 본문 자동 요청
  useEffect(() => {
    if (
      isOpen &&
      snippet &&
      snippet.has_body === false &&
      !snippet.body &&
      onFetchBody &&
      !isLoadingBody
    ) {
      setIsLoadingBody(true);
      onFetchBody(snippet.id).finally(() => setIsLoadingBody(false));
    }
  }, [isOpen, snippet, onFetchBody, isLoadingBody]);

  // 배경 스크롤 차단 및 포커스 관리
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // 모달 내부로 포커스 이동
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });

      return () => {
        document.body.style.overflow = originalOverflow;
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
          previousActiveElementRef.current = null;
        }
      };
    }
  }, [isOpen]);

  // 키보드 조작 (ESC: 닫기, ← / →: 이전 / 다음 코드, Tab: 포커스 가두기)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          e.preventDefault();
          onNavigate(currentIndex - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (currentIndex < totalCount - 1) {
          e.preventDefault();
          onNavigate(currentIndex + 1);
        }
      } else if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === modalRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, totalCount, onNavigate, onClose]);

  // 스니펫 전환 시 스크롤 맨 위로 초기화
  useEffect(() => {
    if (snippet?.id && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = 0;
    }
  }, [snippet?.id]);

  if (!isOpen || !snippet) return null;

  const bodyContent = snippet.body || "";
  const lines = bodyContent ? bodyContent.split("\n") : [];
  const tokenizedLines = tokenizeCode(bodyContent, snippet.kind);
  const badgeInfo = getKindBadgeInfo(snippet.kind);

  // 전체 복사 (원본 문자열 그대로 복사)
  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(bodyContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
    }
  };

  // 터미널 줄 단위 복사
  const handleCopyLine = async (lineText: string, idx: number) => {
    try {
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

  const lineNumWidth = Math.max(2, String(lines.length).length) * 9 + 16;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => {
        // 창 바깥(배경) 누르면 닫기
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-modal-title"
        tabIndex={-1}
        className="w-full max-w-6xl h-[92vh] max-h-[92vh] flex flex-col bg-[#FFFFFF] dark:bg-[#1A1A1E] text-[#18181B] dark:text-[#F4F4F5] rounded-[14px] shadow-2xl border border-[#E4E4E7] dark:border-[#2E2E36] overflow-hidden outline-none"
      >
        {/* 머리 한 줄: 제목 · 경로 · 종류 뱃지 · 탭 이름 · 올린 시각 + 단추들 */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#1A1A1E] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="px-2 py-0.5 text-xs font-semibold rounded-[6px]"
                style={{ backgroundColor: badgeInfo.bg, color: badgeInfo.text }}
              >
                {badgeInfo.label}
              </span>
              <span className="text-xs text-[#71717A] dark:text-[#9CA3AF]">
                {snippet.tabs?.name ? `${snippet.tabs.name} · ` : ""}
                {formatRelativeTime(snippet.created_at)}
              </span>
              {snippet.pinned && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-[6px] bg-[#0F766E] text-white">
                  고정됨
                </span>
              )}
            </div>

            <h2
              id="code-modal-title"
              className="text-base sm:text-lg font-bold text-[#18181B] dark:text-[#F4F4F5] truncate"
            >
              {snippet.title || "코드 스니펫"}
            </h2>

            {snippet.path && (
              <div className="text-xs font-mono text-[#52525B] dark:text-[#9CA3AF] truncate mt-0.5">
                {snippet.path}
              </div>
            )}
          </div>

          {/* 오른쪽 제어 단추들: 줄번호 토글 / 복사 / 닫기(×) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className="min-h-[36px] px-3 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#E4E4E7] dark:hover:bg-[#3F3F46] transition-colors"
            >
              {showLineNumbers ? "줄번호 끄기" : "줄번호 켜기"}
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              className={`min-h-[36px] px-4 text-xs font-semibold rounded-[8px] transition-colors ${
                copied
                  ? "bg-[#0F766E] text-white"
                  : "bg-[#0F766E] text-white hover:bg-[#115E59]"
              }`}
            >
              {copied ? "복사 완료!" : "전체 복사"}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-lg font-bold rounded-[8px] text-[#71717A] dark:text-[#9CA3AF] hover:text-[#18181B] dark:hover:text-white hover:bg-[#F7F7F8] dark:hover:bg-[#26262E] transition-colors ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 삭제 알림 띠 (실시간 삭제 시 창 유지 및 안내) */}
        {snippet.deleted_at && (
          <div className="shrink-0 px-5 py-2.5 bg-red-600/15 border-b border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between">
            <span>이 코드는 삭제되었습니다.</span>
            <span className="text-[11px] opacity-80">창을 닫으면 목록으로 돌아갑니다</span>
          </div>
        )}

        {/* 코드 본문 — 화면 높이를 거의 다 쓰며 내부에서만 세로 스크롤 */}
        <div
          ref={codeContainerRef}
          className="flex-1 min-h-0 bg-[#1C1C22] text-[#D4D7DD] overflow-y-auto overflow-x-auto p-4 sm:p-5 custom-scroll select-text"
        >
          {isLoadingBody ? (
            <div className="py-20 text-center text-sm text-[#9CA3AF] animate-pulse">
              코드 내용을 불러오는 중입니다...
            </div>
          ) : (
            <div className="font-mono text-[14.5px] leading-[23px] sm:text-[15px] sm:leading-[24px]">
              {lines.map((rawLine, lineIdx) => {
                const lineTokens = tokenizedLines[lineIdx] || [];
                return (
                  <div
                    key={lineIdx}
                    className="code-line group relative flex items-start px-1 hover:bg-[#26262E]/70 rounded-[3px]"
                  >
                    {/* 줄번호 표시: 선택 불가(select-none) */}
                    {showLineNumbers && (
                      <span
                        className="shrink-0 text-right pr-4 text-[#7A8290] select-none text-[12.5px] font-mono leading-inherit"
                        style={{ width: `${lineNumWidth}px` }}
                      >
                        {lineIdx + 1}
                      </span>
                    )}

                    {/* 코드 텍스트: 들여쓰기 100% 보존 (white-space: pre) */}
                    <div
                      className="code-line-text flex-1 min-w-0"
                      style={{ whiteSpace: "pre" }}
                    >
                      {lineTokens.map((token, tokenIdx) => {
                        const color = getTokenColor(token.type);
                        return color ? (
                          <span
                            key={tokenIdx}
                            style={{ color, whiteSpace: "pre" }}
                          >
                            {token.text}
                          </span>
                        ) : (
                          <span key={tokenIdx} style={{ whiteSpace: "pre" }}>
                            {token.text}
                          </span>
                        );
                      })}
                    </div>

                    {/* 터미널 종류일 때 줄 단위 복사 단추 */}
                    {snippet.kind === "bash" && rawLine.trim().length > 0 && (
                      <button
                        type="button"
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
          )}
        </div>

        {/* 아래: 「n / m」 및 앞뒤 넘기기 단추 */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#1A1A1E] flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="min-h-[36px] px-3.5 flex items-center gap-1.5 font-medium rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] text-[#18181B] dark:text-[#F4F4F5] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F7F7F8] dark:hover:bg-[#26262E] transition-colors"
            title="이전 코드 (←)"
          >
            <span>←</span>
            <span>이전 코드</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-[#18181B] dark:text-[#F4F4F5]">
              {totalCount > 0 ? currentIndex + 1 : 0} / {totalCount}
            </span>
            <span className="hidden sm:inline text-[11px] text-[#71717A] dark:text-[#9CA3AF]">
              (키보드 ← → 로 넘기기, ESC 로 닫기)
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(currentIndex + 1)}
            disabled={currentIndex >= totalCount - 1}
            className="min-h-[36px] px-3.5 flex items-center gap-1.5 font-medium rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] text-[#18181B] dark:text-[#F4F4F5] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F7F7F8] dark:hover:bg-[#26262E] transition-colors"
            title="다음 코드 (→)"
          >
            <span>다음 코드</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

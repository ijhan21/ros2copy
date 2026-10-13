"use client";

import { useState } from "react";
import { Snippet, SnippetKind } from "@/lib/types";
import { formatRelativeTime, isWithinThreeMinutes } from "@/lib/time";
import {
  tokenizeCode,
  getKindBadgeInfo,
  getTokenColor,
  getNextSnippetKind,
} from "@/lib/highlighter";

interface CodeCardProps {
  snippet: Snippet;
  isTeacher?: boolean;
  onUpdate?: (id: number, data: Partial<Snippet>) => Promise<boolean>;
  onDelete?: (id: number) => Promise<boolean>;
  onTogglePin?: (id: number, pinned: boolean) => Promise<boolean>;
}

export default function CodeCard({
  snippet,
  isTeacher = false,
  onUpdate,
  onDelete,
  onTogglePin,
}: CodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(snippet.title || "");
  const [editPath, setEditPath] = useState(snippet.path || "");
  const [editKind, setEditKind] = useState<SnippetKind>(snippet.kind);
  const [editBody, setEditBody] = useState(snippet.body);
  const [isSaving, setIsSaving] = useState(false);

  const lines = snippet.body.split("\n");
  const isLong = lines.length > 20;
  const visibleLines = isLong && !expanded ? lines.slice(0, 20) : lines;
  const hiddenCount = lines.length - 20;

  // 3분 이내 판별
  const isRecent = isWithinThreeMinutes(snippet.created_at);
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

  // 저장 실행
  const handleSaveEdit = async () => {
    if (!editBody.trim() || !onUpdate) return;
    setIsSaving(true);
    try {
      const ok = await onUpdate(snippet.id, {
        title: editTitle.trim() || null,
        path: editPath.trim() || null,
        kind: editKind,
        body: editBody,
      });
      if (ok) {
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제 실행 (한 번 되묻기)
  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = window.confirm("이 코드를 지우시겠습니까? (8초 안에 되돌릴 수 있습니다)");
    if (!confirmed) return;
    await onDelete(snippet.id);
  };

  const tokenizedLines = tokenizeCode(visibleLines.join("\n"), snippet.kind);

  return (
    <div
      className={`rounded-[13px] bg-[#FFFFFF] dark:bg-[#1A1A1E] p-4 flex flex-col justify-between transition-shadow duration-200 ${
        isRecent
          ? "border-2 border-[#0F766E] shadow-[0_0_15px_rgba(15,118,110,0.35)]"
          : snippet.pinned
          ? "border-2 border-[#0F766E]/60 dark:border-[#14B8A6]/60"
          : "border border-[#E4E4E7] dark:border-[#2E2E36]"
      }`}
    >
      {/* 편집 모드 폼 */}
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#E4E4E7] dark:border-[#2E2E36] pb-2">
            <span className="text-xs font-bold text-[#18181B] dark:text-[#F4F4F5]">
              코드 고치기
            </span>
            <button
              type="button"
              onClick={() => setEditKind(getNextSnippetKind(editKind))}
              className="px-2 py-0.5 text-xs font-semibold rounded-[6px]"
              style={{
                backgroundColor: getKindBadgeInfo(editKind).bg,
                color: getKindBadgeInfo(editKind).text,
              }}
            >
              {getKindBadgeInfo(editKind).label} (누르면 변경)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[#71717A] dark:text-[#9CA3AF] mb-0.5">
                제목
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-[6px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] outline-none focus:border-[#0F766E]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#71717A] dark:text-[#9CA3AF] mb-0.5">
                경로
              </label>
              <input
                type="text"
                value={editPath}
                onChange={(e) => setEditPath(e.target.value)}
                className="w-full px-2.5 py-1 text-xs font-mono rounded-[6px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] outline-none focus:border-[#0F766E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#71717A] dark:text-[#9CA3AF] mb-0.5">
              코드 내용
            </label>
            <textarea
              rows={8}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full p-2.5 text-xs font-mono rounded-[6px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#1C1C22] text-[#D4D7DD] outline-none focus:border-[#0F766E] leading-5 resize-y custom-scroll"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="min-h-[32px] px-3 text-xs font-medium rounded-[6px] border border-[#E4E4E7] dark:border-[#2E2E36] text-[#71717A] dark:text-[#9CA3AF] hover:bg-[#F7F7F8] dark:hover:bg-[#26262E]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSaving || !editBody.trim()}
              className="min-h-[32px] px-4 text-xs font-bold rounded-[6px] bg-[#0F766E] text-white hover:bg-[#115E59] disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        /* 기본 카드 뷰 */
        <>
          <div>
            {/* 뱃지 및 제어 단추 줄 */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {snippet.pinned && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-[6px] bg-[#0F766E] text-white">
                    고정됨
                  </span>
                )}
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
                <span className="text-xs text-[#71717A] dark:text-[#9CA3AF]">
                  {snippet.tabs?.name ? `${snippet.tabs.name} · ` : ""}
                  {formatRelativeTime(snippet.created_at)}
                </span>
              </div>

              {/* 강사 전용 컨트롤 (고치기 / 지우기 / 핀) & 학생 공통 (줄번호 / 복사) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {isTeacher && (
                  <>
                    {onTogglePin && (
                      <button
                        onClick={() => onTogglePin(snippet.id, !snippet.pinned)}
                        title={snippet.pinned ? "고정 해제" : "맨 위로 고정"}
                        className={`min-h-[32px] px-2 text-xs font-medium rounded-[6px] border ${
                          snippet.pinned
                            ? "bg-[#0F766E] text-white border-[#0F766E]"
                            : "border-[#E4E4E7] dark:border-[#2E2E36] bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB]"
                        }`}
                      >
                        {snippet.pinned ? "핀 해제" : "핀"}
                      </button>
                    )}
                    {onUpdate && (
                      <button
                        onClick={() => {
                          setEditTitle(snippet.title || "");
                          setEditPath(snippet.path || "");
                          setEditKind(snippet.kind);
                          setEditBody(snippet.body);
                          setIsEditing(true);
                        }}
                        className="min-h-[32px] px-2 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[6px] bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#E4E4E7] dark:hover:bg-[#3F3F46]"
                      >
                        고치기
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={handleDelete}
                        className="min-h-[32px] px-2 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[6px] bg-[#F7F7F8] dark:bg-[#26262E] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        지우기
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => setShowLineNumbers(!showLineNumbers)}
                  className="min-h-[32px] px-2.5 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#E4E4E7] dark:hover:bg-[#3F3F46] transition-colors"
                >
                  {showLineNumbers ? "줄번호 끔" : "줄번호 켬"}
                </button>

                <button
                  onClick={handleCopyAll}
                  className={`min-h-[32px] px-3.5 text-xs font-semibold rounded-[8px] transition-colors ${
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
                <div className="text-xs font-mono text-[#52525B] dark:text-[#9CA3AF] break-all mt-0.5">
                  {snippet.path}
                </div>
              )}
            </div>
          </div>

          {/* 어두운 코드 상자: 들여쓰기 뭉개짐 방지 (white-space: pre !important) */}
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
                      className="code-line group relative flex items-start justify-between hover:bg-[#26262E]/60 rounded-[4px] px-1"
                    >
                      {/* 줄머리 공백 보존 핵심: white-space: pre */}
                      <div
                        className="code-line-text flex-1 min-w-0 overflow-x-visible"
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
        </>
      )}
    </div>
  );
}

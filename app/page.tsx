"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Header from "@/components/Header";
import CodeCard from "@/components/CodeCard";
import CommandStream from "@/components/CommandStream";
import CodeModal from "@/components/CodeModal";
import SharedFilesSection from "@/components/SharedFilesSection";
import { Snippet } from "@/lib/types";
import { useSseStream } from "@/hooks/useSseStream";

interface UndoItem {
  type: "snippet" | "command";
  id: number;
  name?: string;
  expiresAt: number;
}

export default function StudentPage() {
  const {
    tabs,
    snippets,
    commands,
    files,
    setSnippets,
    setCommands,
    setFiles,
    connectionMode,
    isRefreshing,
    refreshManually,
    fetchSnippetBody,
  } = useSseStream();

  const [selectedTabId, setSelectedTabId] = useState<number | null>(null); // null = 전체
  const [tabCopied, setTabCopied] = useState(false);
  const [mobileView, setMobileView] = useState<"code" | "commands">("code");
  const loading = tabs.length === 0 && snippets.length === 0 && commands.length === 0 && files.length === 0;

  // 강사 권한 상태
  const [hasTeacherPassword, setHasTeacherPassword] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState("");

  // 8초 되돌리기 (Undo) 상태
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(8);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const undoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 크게 보기 모달 상태
  const [activeModalSnippetId, setActiveModalSnippetId] = useState<number | null>(null);
  const [lastKnownSnippet, setLastKnownSnippet] = useState<Snippet | null>(null);
  const isHistoryPushedRef = useRef(false);

  // 강사 암호 확인
  useEffect(() => {
    const saved = localStorage.getItem("BOARD_PASSWORD")?.trim();
    if (saved) {
      setHasTeacherPassword(true);
      setTeacherPassword(saved);
    }
  }, []);

  // 카드 수정 (고치기)
  const handleUpdateSnippet = async (id: number, data: Partial<Snippet>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": teacherPassword,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await refreshManually();
        return true;
      } else {
        const err = await res.json();
        alert(err.error || "수정 실패");
        return false;
      }
    } catch (err) {
      console.error(err);
      alert("수정 중 오류 발생");
      return false;
    }
  };

  // 8초 타이머 완료 후 영구 삭제 실행
  const executePermanentDelete = async (type: "snippet" | "command", id: number) => {
    try {
      const endpoint = type === "snippet" ? `/api/snippets/${id}` : `/api/commands/${id}`;
      await fetch(`${endpoint}?permanent=true`, {
        method: "DELETE",
        headers: {
          "x-board-password": teacherPassword,
        },
      });
    } catch (err) {
      console.error("영구 삭제 실패:", err);
    }
  };

  // 카드 지우기 (8초 되돌리기 띠 시작)
  const handleDeleteSnippet = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "DELETE",
        headers: {
          "x-board-password": teacherPassword,
        },
      });

      if (res.ok) {
        // 즉시 화면에서 감춤
        setSnippets((prev) => prev.filter((s) => s.id !== id));

        // 기존 되돌리기 정리
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

        const expiresAt = Date.now() + 8000;
        setUndoItem({ type: "snippet", id, expiresAt });
        setUndoSecondsLeft(8);

        undoIntervalRef.current = setInterval(() => {
          setUndoSecondsLeft((prev) => {
            if (prev <= 1) {
              if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        undoTimeoutRef.current = setTimeout(() => {
          executePermanentDelete("snippet", id);
          setUndoItem(null);
        }, 8000);

        return true;
      } else {
        const err = await res.json();
        alert(err.error || "삭제 실패");
        return false;
      }
    } catch (err) {
      console.error(err);
      alert("삭제 중 오류");
      return false;
    }
  };

  // 명령 지우기 (8초 되돌리기 연동)
  const handleDeleteCommand = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/commands/${id}`, {
        method: "DELETE",
        headers: {
          "x-board-password": teacherPassword,
        },
      });

      if (res.ok) {
        setCommands((prev) => prev.filter((c) => c.id !== id));

        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

        const expiresAt = Date.now() + 8000;
        setUndoItem({ type: "command", id, expiresAt });
        setUndoSecondsLeft(8);

        undoIntervalRef.current = setInterval(() => {
          setUndoSecondsLeft((prev) => {
            if (prev <= 1) {
              if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        undoTimeoutRef.current = setTimeout(() => {
          executePermanentDelete("command", id);
          setUndoItem(null);
        }, 8000);

        return true;
      } else {
        const err = await res.json();
        alert(err.error || "명령 삭제 실패");
        return false;
      }
    } catch (err) {
      console.error(err);
      alert("명령 삭제 중 오류");
      return false;
    }
  };

  // 파일 지우기
  const handleDeleteFile = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/files/${id}?permanent=true`, {
        method: "DELETE",
        headers: {
          "x-board-password": teacherPassword,
        },
      });

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        return true;
      } else {
        const err = await res.json();
        alert(err.error || "파일 삭제 실패");
        return false;
      }
    } catch (err) {
      console.error(err);
      alert("파일 삭제 중 오류가 발생했습니다.");
      return false;
    }
  };

  // 되돌리기 실행
  const handleUndo = async () => {
    if (!undoItem) return;

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

    const { type, id } = undoItem;
    setUndoItem(null);

    try {
      const endpoint = type === "snippet" ? `/api/snippets/${id}` : `/api/commands/${id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": teacherPassword,
        },
        body: JSON.stringify({ deleted_at: null }),
      });

      if (res.ok) {
        await refreshManually();
      } else {
        alert("되돌리기 실패");
      }
    } catch (err) {
      console.error(err);
      alert("되돌리기 중 통신 오류");
    }
  };

  // 카드 핀 토글 (맨 위로 올리기)
  const handleTogglePinSnippet = async (id: number, pinned: boolean): Promise<boolean> => {
    try {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": teacherPassword,
        },
        body: JSON.stringify({ pinned }),
      });

      if (res.ok) {
        await refreshManually();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // 현재 고른 탭에 해당하는 스니펫 필터링
  const filteredSnippets =
    selectedTabId === null
      ? snippets
      : snippets.filter((s) => s.tab_id === selectedTabId);

  // 크게 보기 모달 제어
  const handleOpenModal = useCallback((id: number) => {
    setActiveModalSnippetId(id);
    const target = snippets.find((s) => s.id === id);
    if (target) setLastKnownSnippet(target);
    if (typeof window !== "undefined") {
      window.history.pushState({ modal: "code", id }, "", `#code-${id}`);
      isHistoryPushedRef.current = true;
    }
  }, [snippets]);

  const handleCloseModal = useCallback((fromPopState = false) => {
    setActiveModalSnippetId(null);
    if (!fromPopState && typeof window !== "undefined") {
      if (window.history.state?.modal === "code" || isHistoryPushedRef.current) {
        isHistoryPushedRef.current = false;
        window.history.back();
      }
    }
  }, []);

  // 브라우저 뒤로 가기 (popstate) 시 모달 닫기
  useEffect(() => {
    const onPopState = () => {
      if (activeModalSnippetId !== null) {
        isHistoryPushedRef.current = false;
        handleCloseModal(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeModalSnippetId, handleCloseModal]);

  // 모달 내 이전 / 다음 탐색 (현재 고른 탭 기준)
  const handleNavigateModal = useCallback((newIndex: number) => {
    if (newIndex >= 0 && newIndex < filteredSnippets.length) {
      const nextSnippet = filteredSnippets[newIndex];
      setActiveModalSnippetId(nextSnippet.id);
      setLastKnownSnippet(nextSnippet);
      if (typeof window !== "undefined" && isHistoryPushedRef.current) {
        window.history.replaceState({ modal: "code", id: nextSnippet.id }, "", `#code-${nextSnippet.id}`);
      }
    }
  }, [filteredSnippets]);

  // 실시간 SSE 반영 및 삭제 시 보존 로직
  const activeModalSnippet = useMemo(() => {
    if (activeModalSnippetId === null) return null;
    const found = snippets.find((s) => s.id === activeModalSnippetId);
    if (found) return found;
    if (lastKnownSnippet && lastKnownSnippet.id === activeModalSnippetId) {
      return {
        ...lastKnownSnippet,
        deleted_at: lastKnownSnippet.deleted_at || new Date().toISOString(),
      };
    }
    return null;
  }, [activeModalSnippetId, snippets, lastKnownSnippet]);

  const currentModalIndex = useMemo(() => {
    if (activeModalSnippetId === null) return -1;
    return filteredSnippets.findIndex((s) => s.id === activeModalSnippetId);
  }, [activeModalSnippetId, filteredSnippets]);

  // 이 탭 전체 복사
  const handleCopyEntireTab = async () => {
    if (filteredSnippets.length === 0) return;
    try {
      const joinedContent = filteredSnippets
        .map((s, idx) => {
          const headerLine = `# [${idx + 1}/${filteredSnippets.length}] ${s.title || "코드"} ${s.path ? `(${s.path})` : ""}`;
          return `${headerLine}\n${s.body}`;
        })
        .join("\n\n---\n\n");

      await navigator.clipboard.writeText(joinedContent);
      setTabCopied(true);
      setTimeout(() => setTabCopied(false), 1500);
    } catch (err) {
      console.error("탭 전체 복사 실패:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5]">
      <Header connectionMode={connectionMode} />

      {/* 모바일 뷰 전환 단추 */}
      <div className="md:hidden px-4 pt-3 pb-1 border-b border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#1A1A1E]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMobileView("code")}
            className={`min-h-[36px] text-xs font-semibold rounded-[8px] transition-colors ${
              mobileView === "code"
                ? "bg-[#0F766E] text-white"
                : "bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] border border-[#E4E4E7] dark:border-[#2E2E36]"
            }`}
          >
            코드 카드 ({filteredSnippets.length})
          </button>
          <button
            onClick={() => setMobileView("commands")}
            className={`min-h-[36px] text-xs font-semibold rounded-[8px] transition-colors ${
              mobileView === "commands"
                ? "bg-[#0F766E] text-white"
                : "bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] border border-[#E4E4E7] dark:border-[#2E2E36]"
            }`}
          >
            명령 흐름 ({commands.length})
          </button>
        </div>
      </div>

      {/* 메인 레이아웃 본체 */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-5 flex-1 flex flex-col">
        <div className="flex flex-col lg:flex-row gap-5 items-start flex-1">
          {/* 왼쪽: 탭 줄 + 코드 카드 */}
          <div
            className={`flex-1 w-full flex flex-col min-w-0 ${
              mobileView === "commands" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* 탭 줄과 상단 제어 바 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#E4E4E7] dark:border-[#2E2E36]">
              {/* 탭 목록 */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scroll -mb-px">
                <button
                  onClick={() => setSelectedTabId(null)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-t-[8px] border-t border-l border-r whitespace-nowrap transition-colors ${
                    selectedTabId === null
                      ? "bg-[#F7F7F8] dark:bg-[#121214] border-[#E4E4E7] dark:border-[#2E2E36] border-b-transparent text-[#0F766E] dark:text-[#14B8A6] font-bold"
                      : "bg-[#FFFFFF] dark:bg-[#1A1A1E] border-transparent text-[#52525B] dark:text-[#D1D5DB] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
                  }`}
                >
                  전체
                </button>

                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTabId(tab.id)}
                    className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-t-[8px] border-t border-l border-r whitespace-nowrap transition-colors ${
                      selectedTabId === tab.id
                        ? "bg-[#F7F7F8] dark:bg-[#121214] border-[#E4E4E7] dark:border-[#2E2E36] border-b-transparent text-[#0F766E] dark:text-[#14B8A6] font-bold"
                        : "bg-[#FFFFFF] dark:bg-[#1A1A1E] border-transparent text-[#52525B] dark:text-[#D1D5DB] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* 우측 단추들 */}
              <div className="flex items-center gap-2 pb-2 sm:pb-0 shrink-0">
                <button
                  onClick={refreshManually}
                  disabled={isRefreshing}
                  className="min-h-[36px] px-2.5 text-xs font-medium rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] border border-[#E4E4E7] dark:border-[#2E2E36] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#F7F7F8] dark:hover:bg-[#26262E] transition-colors"
                >
                  {isRefreshing ? "가져오는 중..." : "지금 새로고침"}
                </button>

                {filteredSnippets.length > 0 && (
                  <button
                    onClick={handleCopyEntireTab}
                    className="min-h-[36px] px-3.5 text-xs font-semibold rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] border border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6] hover:bg-[#CCFBF1]/30 dark:hover:bg-[#115E59]/30 transition-colors shadow-xs"
                  >
                    {tabCopied ? "복사 완료!" : "이 탭 코드 한 번에 복사"}
                  </button>
                )}
              </div>
            </div>

            {/* 실습 공유 파일 목록 */}
            <SharedFilesSection
              files={files}
              tabs={tabs}
              selectedTabId={selectedTabId}
              isTeacher={hasTeacherPassword}
              teacherPassword={teacherPassword}
              onDeleteFile={handleDeleteFile}
              onFileUploaded={refreshManually}
            />

            {/* 코드 카드 2열 격자 (items-start로 개별 높이 유지, 공백 문제 원천 차단) */}
            {loading ? (
              <div className="p-16 text-center text-xs text-[#52525B] dark:text-[#D1D5DB] animate-pulse">
                실습 코드를 불러오는 중입니다...
              </div>
            ) : filteredSnippets.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-[#E4E4E7] dark:border-[#2E2E36] rounded-[16px] bg-[#FFFFFF] dark:bg-[#1A1A1E] shadow-xs">
                <p className="text-sm font-semibold text-[#52525B] dark:text-[#D1D5DB]">
                  아직 등록된 실습 코드가 없어요.
                </p>
                <p className="text-xs text-[#71717A] dark:text-[#9CA3AF] mt-1.5">
                  강사님이 코드를 올리면 여기에 바로 나타납니다.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {filteredSnippets.map((snippet) => (
                  <CodeCard
                    key={snippet.id}
                    snippet={snippet}
                    isTeacher={hasTeacherPassword}
                    onUpdate={handleUpdateSnippet}
                    onDelete={handleDeleteSnippet}
                    onTogglePin={handleTogglePinSnippet}
                    onFetchBody={fetchSnippetBody}
                    onOpenModal={handleOpenModal}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽: 명령 흐름 패널 */}
          <div
            className={`w-full lg:w-auto ${
              mobileView === "code" ? "hidden md:block" : "block"
            }`}
          >
            <CommandStream
              commands={commands}
              isTeacher={hasTeacherPassword}
              onDeleteCommand={handleDeleteCommand}
            />
          </div>
        </div>
      </main>

      {/* 8초 되돌리기 띠 (화면 하단 플로팅) */}
      {undoItem && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-[10px] bg-[#18181B] dark:bg-[#26262E] text-white border border-[#3F3F46] shadow-2xl animate-fade-in">
          <span className="text-xs font-medium">
            삭제되었습니다 ({undoSecondsLeft}초)
          </span>
          <button
            onClick={handleUndo}
            className="px-3 py-1 text-xs font-bold rounded-[6px] bg-[#0F766E] text-white hover:bg-[#115E59] transition-colors"
          >
            되돌리기
          </button>
        </div>
      )}

      {/* 코드 크게 보기 모달 */}
      <CodeModal
        isOpen={activeModalSnippetId !== null}
        snippet={activeModalSnippet}
        currentIndex={currentModalIndex >= 0 ? currentModalIndex : 0}
        totalCount={filteredSnippets.length}
        onClose={() => handleCloseModal(false)}
        onNavigate={handleNavigateModal}
        onFetchBody={fetchSnippetBody}
      />
    </div>
  );
}

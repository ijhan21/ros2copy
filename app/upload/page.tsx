"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/Header";
import { Tab, Snippet, Command, SnippetKind } from "@/lib/types";
import {
  detectSnippetKind,
  getNextSnippetKind,
  getKindBadgeInfo,
} from "@/lib/highlighter";

export default function TeacherPage() {
  // 암호 관련
  const [password, setPassword] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  // 탭 목록 & 선택
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  // 코드 올리기 폼 상태
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("");
  const [codeBody, setCodeBody] = useState("");
  const [detectedKind, setDetectedKind] = useState<SnippetKind>("text");
  const [userOverriddenKind, setUserOverriddenKind] = useState<SnippetKind | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingSnippet, setIsSubmittingSnippet] = useState(false);

  // 최근 스니펫 목록
  const [allSnippets, setAllSnippets] = useState<Snippet[]>([]);

  // 명령 한 줄 보내기 상태
  const [commands, setCommands] = useState<Command[]>([]);
  const [cmdBody, setCmdBody] = useState("");
  const [cmdMemo, setCmdMemo] = useState("");
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. 암호 로드
  useEffect(() => {
    const saved = localStorage.getItem("BOARD_PASSWORD")?.trim();
    if (saved) {
      setPassword(saved);
    } else {
      setIsAuthModalOpen(true);
    }
  }, []);

  // 2. 전체 데이터 실시간 가져오기 (캐시 방지 타임스탬프)
  const refreshAllData = useCallback(async () => {
    try {
      const now = Date.now();
      const [tabsRes, snippetsRes, commandsRes] = await Promise.all([
        fetch(`/api/tabs?t=${now}`, { cache: "no-store" }),
        fetch(`/api/snippets?t=${now}`, { cache: "no-store" }),
        fetch(`/api/commands?t=${now}`, { cache: "no-store" }),
      ]);

      if (tabsRes.ok) {
        const tabsData: Tab[] = await tabsRes.json();
        setTabs(tabsData);

        // 로컬스토리지 기억 탭 복원
        const storedTabId = localStorage.getItem("selectedTeacherTabId");
        if (storedTabId) {
          const parsed = parseInt(storedTabId, 10);
          if (tabsData.some((t) => t.id === parsed)) {
            setSelectedTabId(parsed);
          } else if (tabsData.length > 0) {
            setSelectedTabId(tabsData[0].id);
          }
        } else if (tabsData.length > 0 && selectedTabId === null) {
          setSelectedTabId(tabsData[0].id);
        }
      }

      if (snippetsRes.ok) {
        const snips: Snippet[] = await snippetsRes.json();
        setAllSnippets(snips);
      }

      if (commandsRes.ok) {
        const cmds: Command[] = await commandsRes.json();
        setCommands(cmds);
      }
    } catch (err) {
      console.error("데이터 로드 오류:", err);
    }
  }, [selectedTabId]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // 알림 및 에러 배너 헬퍼
  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // 암호 검증 및 저장
  const handleVerifyPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError("");
    const inputPwd = tempPassword.trim();
    if (!inputPwd) {
      setAuthError("암호를 입력하십시오.");
      return;
    }

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": inputPwd,
        },
      });

      if (res.ok) {
        setPassword(inputPwd);
        localStorage.setItem("BOARD_PASSWORD", inputPwd);
        setIsAuthModalOpen(false);
        setTempPassword("");
        showNotice("암호가 인증되었습니다.");
        refreshAllData();
      } else {
        const data = await res.json();
        setAuthError(data.error || "암호가 올바르지 않습니다.");
      }
    } catch {
      setAuthError("서버와 통신할 수 없습니다.");
    }
  };

  // 암호 입력 확인 가드
  const requirePassword = (): boolean => {
    if (!password) {
      setIsAuthModalOpen(true);
      showError("먼저 강사 암호를 입력하십시오.");
      return false;
    }
    return true;
  };

  // 탭 선택 핸들러
  const handleSelectTab = (tabId: number) => {
    setSelectedTabId(tabId);
    localStorage.setItem("selectedTeacherTabId", tabId.toString());
  };

  // 새 탭 생성
  const handleCreateTab = async () => {
    if (!requirePassword()) return;
    const name = newTabName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/tabs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": password,
        },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        const createdTab: Tab = await res.json();
        setTabs((prev) => [...prev, createdTab]);
        handleSelectTab(createdTab.id);
        setNewTabName("");
        setIsCreatingTab(false);
        showNotice(`'${createdTab.name}' 탭을 만들었습니다.`);
        refreshAllData();
      } else {
        const err = await res.json();
        if (res.status === 401) {
          setIsAuthModalOpen(true);
        }
        showError(err.error || "탭 생성 실패");
      }
    } catch (err) {
      console.error(err);
      showError("탭 생성 중 통신 오류가 발생했습니다.");
    }
  };

  // 탭 삭제
  const handleDeleteTab = async (tab: Tab) => {
    if (!requirePassword()) return;

    const snippetCount = allSnippets.filter((s) => s.tab_id === tab.id).length;
    if (snippetCount > 0) {
      const confirmed = window.confirm(
        `'${tab.name}' 탭에 코드가 ${snippetCount}개 들어 있습니다. 정말 삭제하시겠습니까?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(`'${tab.name}' 탭을 삭제하시겠습니까?`);
      if (!confirmed) return;
    }

    try {
      const res = await fetch(`/api/tabs/${tab.id}`, {
        method: "DELETE",
        headers: {
          "x-board-password": password,
        },
      });

      if (res.ok) {
        setTabs((prev) => prev.filter((t) => t.id !== tab.id));
        if (selectedTabId === tab.id) {
          const remaining = tabs.filter((t) => t.id !== tab.id);
          const nextId = remaining.length > 0 ? remaining[0].id : null;
          setSelectedTabId(nextId);
          if (nextId) localStorage.setItem("selectedTeacherTabId", nextId.toString());
        }
        showNotice(`'${tab.name}' 탭을 삭제했습니다.`);
        refreshAllData();
      } else {
        const err = await res.json();
        if (res.status === 401) {
          setIsAuthModalOpen(true);
        }
        showError(err.error || "탭 삭제 실패");
      }
    } catch (err) {
      console.error(err);
      showError("탭 삭제 중 오류 발생");
    }
  };

  // 코드 본문 변경 시 자동 종류 판별
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCodeBody(val);
    if (!userOverriddenKind) {
      setDetectedKind(detectSnippetKind(val));
    }
  };

  // 뱃지 클릭 시 다음 종류로 순환
  const handleCycleKind = () => {
    const current = userOverriddenKind || detectedKind;
    const next = getNextSnippetKind(current);
    setUserOverriddenKind(next);
  };

  const currentKind = userOverriddenKind || detectedKind;
  const kindBadge = getKindBadgeInfo(currentKind);

  // 코드 올리기 실행
  const handleSubmitSnippet = async () => {
    if (!requirePassword()) return;
    if (!codeBody.trim() || isSubmittingSnippet) return;

    // 제목이 비어있으면 자동 생성: "{선택된탭이름} · {순번}번째"
    let finalTitle = title.trim();
    if (!finalTitle) {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      const tabName = currentTab ? currentTab.name : "실습";
      const countInTab = allSnippets.filter((s) => s.tab_id === selectedTabId).length;
      finalTitle = `${tabName} · ${countInTab + 1}번째`;
    }

    setIsSubmittingSnippet(true);
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": password,
        },
        body: JSON.stringify({
          tab_id: selectedTabId,
          title: finalTitle,
          path: filePath.trim() || null,
          kind: currentKind,
          body: codeBody,
        }),
      });

      if (res.ok) {
        const created: Snippet = await res.json();
        setAllSnippets((prev) => [created, ...prev]);

        // 글상자 및 폼 초기화 (페이지와 선택된 탭은 그대로 유지)
        setCodeBody("");
        setTitle("");
        setFilePath("");
        setUserOverriddenKind(null);
        setDetectedKind("text");

        showNotice("코드를 올렸습니다.");
        refreshAllData();
        textareaRef.current?.focus();
      } else {
        const err = await res.json();
        if (res.status === 401) {
          setIsAuthModalOpen(true);
        }
        showError(err.error || "코드 올리기 실패");
      }
    } catch (err) {
      console.error(err);
      showError("코드 올리기 중 네트워크 오류");
    } finally {
      setIsSubmittingSnippet(false);
    }
  };

  // Ctrl + Enter 로 코드 올리기
  const handleKeyDownInTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmitSnippet();
    }
  };

  // 명령 한 줄 보내기 실행 (Enter 시 바로 전송)
  const handleSubmitCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!requirePassword()) return;
    if (!cmdBody.trim() || isSubmittingCommand) return;

    setIsSubmittingCommand(true);
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": password,
        },
        body: JSON.stringify({
          body: cmdBody.trim(),
          memo: cmdMemo.trim() || null,
        }),
      });

      if (res.ok) {
        const created: Command = await res.json();
        setCommands((prev) => [...prev, created]);
        setCmdBody("");
        setCmdMemo("");
        showNotice("명령어를 보냈습니다.");
        refreshAllData();
      } else {
        const err = await res.json();
        if (res.status === 401) {
          setIsAuthModalOpen(true);
        }
        showError(err.error || "명령 보내기 실패");
      }
    } catch (err) {
      console.error(err);
      showError("명령 전송 중 네트워크 오류");
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  // 명령 핀 토글
  const handleTogglePin = async (cmd: Command) => {
    if (!requirePassword()) return;
    try {
      const res = await fetch(`/api/commands/${cmd.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-board-password": password,
        },
        body: JSON.stringify({ pinned: !cmd.pinned }),
      });

      if (res.ok) {
        const updated: Command = await res.json();
        setCommands((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        refreshAllData();
      } else {
        const err = await res.json();
        if (res.status === 401) setIsAuthModalOpen(true);
        showError(err.error || "핀 설정 실패");
      }
    } catch (err) {
      console.error("핀 토글 오류:", err);
      showError("핀 설정 오류");
    }
  };

  // 명령 삭제
  const handleDeleteCommand = async (id: number) => {
    if (!requirePassword()) return;
    try {
      const res = await fetch(`/api/commands/${id}`, {
        method: "DELETE",
        headers: {
          "x-board-password": password,
        },
      });

      if (res.ok) {
        setCommands((prev) => prev.filter((c) => c.id !== id));
        refreshAllData();
      } else {
        const err = await res.json();
        if (res.status === 401) setIsAuthModalOpen(true);
        showError(err.error || "명령 삭제 실패");
      }
    } catch (err) {
      console.error("명령 삭제 오류:", err);
      showError("명령 삭제 오류");
    }
  };

  // 최근 보낸 명령 5개
  const recentCommands = [...commands].slice(-5).reverse();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] pb-48">
      <Header isTeacher />

      {/* 상단 알림 띠 (성공) */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-[8px] bg-[#0F766E] text-white text-sm font-semibold shadow-lg transition-all">
          {notification}
        </div>
      )}

      {/* 상단 에러 배너 (실패 피드백) */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-[8px] bg-red-600 text-white text-sm font-semibold shadow-lg transition-all">
          {errorMessage}
        </div>
      )}

      {/* 메인 작업 영역 */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col gap-5">
        {/* 암호 상태 바 */}
        <div className="flex items-center justify-between p-3 rounded-[8px] border text-xs bg-[#FFFFFF] dark:bg-[#1A1A1E] border-[#E4E4E7] dark:border-[#2E2E36]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                password ? "bg-[#0F766E]" : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="font-medium text-[#52525B] dark:text-[#A1A1AA]">
              {password
                ? "강사 암호가 등록되어 있습니다."
                : "강사 암호가 입력되지 않았습니다. 암호가 없으면 작업이 거부됩니다."}
            </span>
          </div>
          <button
            onClick={() => {
              setTempPassword(password);
              setAuthError("");
              setIsAuthModalOpen(true);
            }}
            className="min-h-[30px] px-2.5 font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[6px] hover:bg-[#F7F7F8] dark:hover:bg-[#26262E]"
          >
            {password ? "암호 변경" : "암호 입력"}
          </button>
        </div>

        {/* 1. 탭 관리 줄 (맨 위) */}
        <section className="bg-[#FFFFFF] dark:bg-[#1A1A1E] p-4 rounded-[13px] border border-[#E4E4E7] dark:border-[#2E2E36]">
          <div className="text-xs font-semibold text-[#71717A] mb-2.5 flex items-center justify-between">
            <span>탭 관리 — 코드를 올릴 탭을 선택하십시오</span>
            <span className="text-[11px] text-[#A1A1AA]">
              선택된 탭: {tabs.find((t) => t.id === selectedTabId)?.name || "없음"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((tab) => {
              const isSelected = selectedTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  className={`inline-flex items-center rounded-full text-xs transition-colors pl-3 pr-1.5 py-1 ${
                    isSelected
                      ? "bg-[#0F766E] text-white"
                      : "bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#A1A1AA] border border-[#E4E4E7] dark:border-[#2E2E36] hover:bg-[#E4E4E7]"
                  }`}
                >
                  <button
                    onClick={() => handleSelectTab(tab.id)}
                    className="font-medium mr-1.5"
                  >
                    {tab.name}
                  </button>
                  <button
                    onClick={() => handleDeleteTab(tab)}
                    title="탭 삭제"
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      isSelected
                        ? "text-white/80 hover:text-white hover:bg-black/20"
                        : "text-[#71717A] hover:text-[#18181B] hover:bg-[#E4E4E7]"
                    }`}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* "+ 새 탭" 버튼 또는 탭 생성 입력칸 */}
            {isCreatingTab ? (
              <div className="inline-flex items-center gap-1.5 p-1 rounded-full border border-[#0F766E] bg-[#FFFFFF] dark:bg-[#1A1A1E]">
                <input
                  type="text"
                  placeholder="새 탭 이름 (예: 실습 3차시)"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTab()}
                  autoFocus
                  className="px-2.5 py-0.5 text-xs bg-transparent outline-none text-[#18181B] dark:text-[#F4F4F5] w-36"
                />
                <button
                  onClick={handleCreateTab}
                  className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#0F766E] text-white hover:bg-[#115E59]"
                >
                  만들기
                </button>
                <button
                  onClick={() => setIsCreatingTab(false)}
                  className="px-2 py-1 text-xs text-[#71717A] hover:text-[#18181B]"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingTab(true)}
                className="min-h-[32px] px-3 text-xs font-medium border border-dashed border-[#71717A] text-[#52525B] dark:text-[#A1A1AA] hover:text-[#0F766E] hover:border-[#0F766E] rounded-full transition-colors"
              >
                + 새 탭
              </button>
            )}
          </div>
        </section>

        {/* 2. 코드 올리기 (가운데) */}
        <section className="bg-[#FFFFFF] dark:bg-[#1A1A1E] p-5 rounded-[13px] border border-[#E4E4E7] dark:border-[#2E2E36] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#18181B] dark:text-[#F4F4F5]">
              코드 올리기
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717A]">종류 자동 판별:</span>
              <button
                type="button"
                onClick={handleCycleKind}
                title="클릭하면 다음 종류로 변경됩니다"
                className="px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-transform active:scale-95"
                style={{ backgroundColor: kindBadge.bg, color: kindBadge.text }}
              >
                {kindBadge.label} (누르면 변경)
              </button>
            </div>
          </div>

          {/* 제목 및 경로 입력 칸 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#71717A] mb-1">
                제목 (선택 — 비우면 차시 순번 자동 부여)
              </label>
              <input
                type="text"
                placeholder="예: topic_publisher.py"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[36px] px-3 text-xs sm:text-sm rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] outline-none focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#71717A] mb-1">
                경로 (선택)
              </label>
              <input
                type="text"
                placeholder="예: ~/ros2_ws/src/my_py_pkg/my_py_pkg/"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="w-full min-h-[36px] px-3 text-xs sm:text-sm font-mono rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] outline-none focus:border-[#0F766E]"
              />
            </div>
          </div>

          {/* 큰 글상자 (textarea) */}
          <div>
            <label className="block text-xs text-[#71717A] mb-1">
              코드 내용 (Ctrl+Enter 로 즉시 올리기)
            </label>
            <textarea
              ref={textareaRef}
              rows={12}
              placeholder="여기에 코드를 붙여넣으십시오..."
              value={codeBody}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDownInTextarea}
              className="w-full p-3 text-xs sm:text-sm font-mono rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#1C1C22] text-[#D4D7DD] outline-none focus:border-[#0F766E] leading-6 resize-y custom-scroll"
            />
          </div>

          {/* 올리기 단추 */}
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-[#71717A]">
              Ctrl + Enter 로도 등록됩니다
            </span>
            <button
              onClick={handleSubmitSnippet}
              disabled={isSubmittingSnippet || !codeBody.trim()}
              className="min-h-[44px] px-6 text-sm font-bold rounded-[8px] bg-[#0F766E] hover:bg-[#115E59] text-white disabled:opacity-40 disabled:hover:bg-[#0F766E] transition-colors"
            >
              {isSubmittingSnippet ? "올리는 중..." : "올리기"}
            </button>
          </div>
        </section>
      </main>

      {/* 3. 명령 한 줄 보내기 (화면 맨 아래 붙박이, 어두운 띠) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#1C1C22] border-t border-[#2E2E36] text-[#D4D7DD] shadow-2xl">
        <div className="max-w-4xl mx-auto w-full p-3 sm:p-4">
          {/* 방금 보낸 줄 몇 개 */}
          {recentCommands.length > 0 && (
            <div className="mb-3 max-h-32 overflow-y-auto space-y-1.5 custom-scroll pr-1">
              <div className="text-[11px] text-[#71717A] mb-1">방금 보낸 명령 ({commands.length}개)</div>
              {recentCommands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-[6px] bg-[#26262E] border border-[#3F3F46] text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {cmd.memo && (
                      <span className="text-[11px] text-[#7A8290] shrink-0">
                        [{cmd.memo}]
                      </span>
                    )}
                    <span className="font-mono text-xs text-[#D4D7DD] truncate">
                      {cmd.body}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleTogglePin(cmd)}
                      className={`px-2 py-0.5 text-[11px] rounded-[4px] border ${
                        cmd.pinned
                          ? "bg-[#0F766E] text-white border-[#0F766E]"
                          : "bg-[#1C1C22] text-[#A1A1AA] border-[#3F3F46] hover:text-white"
                      }`}
                    >
                      {cmd.pinned ? "핀 해제" : "핀"}
                    </button>
                    <button
                      onClick={() => handleDeleteCommand(cmd.id)}
                      className="px-2 py-0.5 text-[11px] rounded-[4px] bg-[#1C1C22] text-[#71717A] hover:text-red-400 border border-[#3F3F46]"
                    >
                      지우기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 한 줄 입력 폼 */}
          <form
            onSubmit={handleSubmitCommand}
            className="flex items-center gap-2 flex-wrap sm:flex-nowrap"
          >
            <div className="flex items-center gap-2 flex-1 bg-[#26262E] rounded-[8px] border border-[#3F3F46] px-3 focus-within:border-[#0F766E]">
              <span className="text-[#0F766E] font-mono font-bold text-base select-none">
                $
              </span>
              <input
                type="text"
                placeholder="터미널 명령어를 입력하고 Enter를 치십시오"
                value={cmdBody}
                onChange={(e) => setCmdBody(e.target.value)}
                className="w-full min-h-[44px] bg-transparent font-mono text-xs sm:text-sm text-[#D4D7DD] outline-none"
              />
            </div>

            <input
              type="text"
              placeholder="설명 (선택)"
              value={cmdMemo}
              onChange={(e) => setCmdMemo(e.target.value)}
              className="w-full sm:w-44 min-h-[44px] px-3 text-xs bg-[#26262E] rounded-[8px] border border-[#3F3F46] text-[#D4D7DD] outline-none focus:border-[#0F766E]"
            />

            <button
              type="submit"
              disabled={isSubmittingCommand || !cmdBody.trim()}
              className="min-h-[44px] px-5 text-xs sm:text-sm font-semibold rounded-[8px] bg-[#0F766E] hover:bg-[#115E59] text-white disabled:opacity-40 disabled:hover:bg-[#0F766E] transition-colors whitespace-nowrap shrink-0"
            >
              보내기
            </button>
          </form>
        </div>
      </footer>

      {/* 암호 입력 모달 */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#1A1A1E] p-6 rounded-[13px] border border-[#E4E4E7] dark:border-[#2E2E36] max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-[#18181B] dark:text-[#F4F4F5] mb-2">
              강사 암호 입력
            </h3>
            <p className="text-xs text-[#71717A] mb-4">
              코드를 올리고 관리하려면 Vercel 환경변수(BOARD_PASSWORD)에 설정된 암호를 입력하십시오. (기본값: ros2)
            </p>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <input
                type="password"
                placeholder="암호"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                autoFocus
                className="w-full min-h-[44px] px-3 text-sm rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#F7F7F8] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] outline-none focus:border-[#0F766E]"
              />

              {authError && (
                <div className="text-xs text-red-500 font-medium">
                  {authError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] font-semibold text-sm rounded-[8px] bg-[#0F766E] text-white hover:bg-[#115E59] transition-colors"
                >
                  확인
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 min-h-[44px] text-xs text-[#71717A] border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] hover:bg-[#F7F7F8] dark:hover:bg-[#26262E]"
                >
                  닫기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import CodeCard from "@/components/CodeCard";
import CommandStream from "@/components/CommandStream";
import { Tab, Snippet, Command } from "@/lib/types";
import {
  fetchTabsFromClient,
  fetchSnippetsFromClient,
  fetchCommandsFromClient,
} from "@/lib/supabaseClient";

export default function StudentPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null); // null = 전체
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [tabCopied, setTabCopied] = useState(false);
  const [mobileView, setMobileView] = useState<"code" | "commands">("code");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 데이터 가져오기: 브라우저 Supabase 직접 조회 1순위 (Network 탭에 supabase.co 요청 발생)
  const fetchData = useCallback(async () => {
    try {
      // 1. 브라우저 Supabase 클라이언트로 직접 조회 시도
      const [clientTabs, clientSnippets, clientCommands] = await Promise.all([
        fetchTabsFromClient(),
        fetchSnippetsFromClient(),
        fetchCommandsFromClient(),
      ]);

      if (clientTabs !== null) {
        setTabs(clientTabs);
      }
      if (clientSnippets !== null) {
        setSnippets(clientSnippets);
      }
      if (clientCommands !== null) {
        setCommands(clientCommands);
      }

      // 만약 브라우저 Supabase 클라이언트가 환경변수 부재 등으로 null인 경우 서버 API로 fallback
      if (clientTabs === null || clientSnippets === null || clientCommands === null) {
        const now = Date.now();
        const [tabsRes, snippetsRes, commandsRes] = await Promise.all([
          fetch(`/api/tabs?t=${now}`, { cache: "no-store" }),
          fetch(`/api/snippets?t=${now}`, { cache: "no-store" }),
          fetch(`/api/commands?t=${now}`, { cache: "no-store" }),
        ]);

        if (clientTabs === null && tabsRes.ok) {
          const tabsData = await tabsRes.json();
          setTabs(tabsData);
        }
        if (clientSnippets === null && snippetsRes.ok) {
          const snippetsData = await snippetsRes.json();
          setSnippets(snippetsData);
        }
        if (clientCommands === null && commandsRes.ok) {
          const commandsData = await commandsRes.json();
          setCommands(commandsData);
        }
      }
    } catch (err) {
      console.error("데이터 갱신 중 오류:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // 초기 로드 및 10초 주기 폴링
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 현재 고른 탭에 해당하는 스니펫 필터링
  const filteredSnippets =
    selectedTabId === null
      ? snippets
      : snippets.filter((s) => s.tab_id === selectedTabId);

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
      <Header />

      {/* 모바일 뷰 전환 단추 (화면 폭 < 768px 일 때만 노출) */}
      <div className="md:hidden px-4 pt-3 pb-1 border-b border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#1A1A1E]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMobileView("code")}
            className={`min-h-[36px] text-xs font-semibold rounded-[8px] transition-colors ${
              mobileView === "code"
                ? "bg-[#0F766E] text-white"
                : "bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#A1A1AA] border border-[#E4E4E7] dark:border-[#2E2E36]"
            }`}
          >
            코드 카드 ({filteredSnippets.length})
          </button>
          <button
            onClick={() => setMobileView("commands")}
            className={`min-h-[36px] text-xs font-semibold rounded-[8px] transition-colors ${
              mobileView === "commands"
                ? "bg-[#0F766E] text-white"
                : "bg-[#F7F7F8] dark:bg-[#26262E] text-[#52525B] dark:text-[#A1A1AA] border border-[#E4E4E7] dark:border-[#2E2E36]"
            }`}
          >
            명령 흐름 ({commands.length})
          </button>
        </div>
      </div>

      {/* 메인 레이아웃 본체 */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-5 flex-1 flex flex-col">
        <div className="flex flex-col lg:flex-row gap-5 items-start flex-1">
          {/* 왼쪽: 탭 줄 + 코드 카드 (모바일에서는 mobileView === 'code' 일 때 노출) */}
          <div
            className={`flex-1 w-full flex flex-col min-w-0 ${
              mobileView === "commands" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* 탭 줄과 '이 탭 전체 복사' / 수동 새로고침 컨트롤 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#E4E4E7] dark:border-[#2E2E36]">
              {/* 탭 목록 (스크롤 가능, 트인 탭 디자인) */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scroll -mb-px">
                <button
                  onClick={() => setSelectedTabId(null)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-t-[8px] border-t border-l border-r whitespace-nowrap transition-colors ${
                    selectedTabId === null
                      ? "bg-[#F7F7F8] dark:bg-[#121214] border-[#E4E4E7] dark:border-[#2E2E36] border-b-transparent text-[#0F766E] dark:text-[#14B8A6] font-bold"
                      : "bg-[#FFFFFF] dark:bg-[#1A1A1E] border-transparent text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
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
                        : "bg-[#FFFFFF] dark:bg-[#1A1A1E] border-transparent text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* 우측 단추들: 지금 새로고침 & 탭 전체 복사 */}
              <div className="flex items-center gap-2 pb-2 sm:pb-0 shrink-0">
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="min-h-[36px] px-2.5 text-xs font-medium rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] border border-[#E4E4E7] dark:border-[#2E2E36] text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#F4F4F5] dark:hover:bg-[#26262E] transition-colors"
                >
                  {isRefreshing ? "가져오는 중..." : "지금 새로고침"}
                </button>

                {filteredSnippets.length > 0 && (
                  <button
                    onClick={handleCopyEntireTab}
                    className="min-h-[36px] px-3 text-xs font-semibold rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] border border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6] hover:bg-[#CCFBF1]/30 dark:hover:bg-[#115E59]/30 transition-colors"
                  >
                    {tabCopied ? "전체 복사함" : "이 탭 전체 복사"}
                  </button>
                )}
              </div>
            </div>

            {/* 코드 카드 2열 격자 */}
            {loading ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                코드를 불러오고 있습니다...
              </div>
            ) : filteredSnippets.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-[#E4E4E7] dark:border-[#2E2E36] rounded-[13px] bg-[#FFFFFF] dark:bg-[#1A1A1E]">
                <p className="text-sm font-medium text-[#71717A]">
                  아직 등록된 코드가 없습니다.
                </p>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  강사가 코드를 올리면 10초 안에 자동으로 나타납니다.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSnippets.map((snippet) => (
                  <CodeCard key={snippet.id} snippet={snippet} />
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽: 명령 흐름 패널 (모바일에서는 mobileView === 'commands' 일 때 노출) */}
          <div
            className={`w-full lg:w-auto ${
              mobileView === "code" ? "hidden md:block" : "block"
            }`}
          >
            <CommandStream commands={commands} />
          </div>
        </div>
      </main>
    </div>
  );
}

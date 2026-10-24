"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Tab, Snippet, Command, SharedFile } from "@/lib/types";

export type ConnectionMode = "connected" | "connecting" | "polling";

interface UseSseStreamOptions {
  onInitialLoad?: () => void;
}

export function useSseStream(options?: UseSseStreamOptions) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("connecting");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const failureCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // 예비 폴링 (SSE 3회 연속 실패 시 30초마다 호출)
  const pollFallback = useCallback(async () => {
    try {
      const now = Date.now();
      const [tabsRes, snipsRes, cmdsRes, filesRes] = await Promise.all([
        fetch(`/api/tabs?t=${now}`, { cache: "no-store" }),
        fetch(`/api/snippets?t=${now}`, { cache: "no-store" }),
        fetch(`/api/commands?t=${now}`, { cache: "no-store" }),
        fetch(`/api/files?t=${now}`, { cache: "no-store" }),
      ]);

      if (tabsRes.ok) {
        const tData = await tabsRes.json();
        setTabs(tData);
      }
      if (snipsRes.ok) {
        const sData = await snipsRes.json();
        setSnippets(sData);
      }
      if (cmdsRes.ok) {
        const cData = await cmdsRes.json();
        setCommands(cData);
      }
      if (filesRes.ok) {
        const fData = await filesRes.json();
        setFiles(fData);
      }
    } catch (err) {
      console.warn("[Poll Fallback] 데이터 가져오기 실패:", err);
    }
  }, []);

  // 256KB 초과로 본문이 비워진 스니펫 본문 별도 로드
  const fetchSnippetBody = useCallback(async (snippetId: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/snippets/${snippetId}`);
      if (!res.ok) return null;
      const data: Snippet = await res.json();
      if (data && typeof data.body === "string") {
        setSnippets((prev) =>
          prev.map((s) => (s.id === snippetId ? { ...s, body: data.body, has_body: true } : s))
        );
        return data.body;
      }
      return null;
    } catch (err) {
      console.error("[fetchSnippetBody] 본문 조회 실패:", err);
      return null;
    }
  }, []);

  // SSE 연결 함수
  const connectSse = useCallback(() => {
    if (!isMountedRef.current) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionMode("connecting");

    const es = new EventSource("/api/stream");
    eventSourceRef.current = es;

    const handlePayload = (dataStr: string) => {
      try {
        const payload = JSON.parse(dataStr);
        if (payload.tabs) setTabs(payload.tabs);
        if (payload.snippets) {
          setSnippets((prev) => {
            // 이미 개별 fetch로 본문을 받아둔 스니펫이 있다면 보존
            const bodyCache = new Map(
              prev.filter((p) => p.has_body && p.body).map((p) => [p.id, p.body])
            );
            return (payload.snippets as Snippet[]).map((s) => {
              if (s.has_body === false && bodyCache.has(s.id)) {
                return { ...s, body: bodyCache.get(s.id)!, has_body: true };
              }
              return s;
            });
          });
        }
        if (payload.commands) setCommands(payload.commands);
        if (payload.files) setFiles(payload.files);

        failureCountRef.current = 0;
        setConnectionMode("connected");
        options?.onInitialLoad?.();
      } catch (err) {
        console.error("[SSE] 페이로드 파싱 오류:", err);
      }
    };

    es.addEventListener("init", (event: MessageEvent) => {
      handlePayload(event.data);
    });

    es.addEventListener("update", (event: MessageEvent) => {
      handlePayload(event.data);
    });

    es.onopen = () => {
      failureCountRef.current = 0;
      setConnectionMode("connected");
      // 폴링 타이머가 돌고 있었다면 해제
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      failureCountRef.current += 1;
      const count = failureCountRef.current;

      if (count >= 3) {
        // 3회 연달아 실패 시 30초 폴링으로 전환
        console.warn("[SSE] 3회 연속 실패로 30초 폴링으로 전환합니다.");
        setConnectionMode("polling");
        pollFallback();
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(pollFallback, 30000);
        }
      } else {
        // 지수 백오프: 1초, 2초, 4초... 최대 30초
        const delay = Math.min(1000 * Math.pow(2, count - 1), 30000);
        console.log(`[SSE] ${delay / 1000}초 후 재연결 시도 (${count}회차)`);
        setConnectionMode("connecting");
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSse();
        }, delay);
      }
    };
  }, [options, pollFallback]);

  // 수동 새로고침
  const refreshManually = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await pollFallback();
      // 폴링 모드였는데 수동 새로고침 시 SSE 재시도도 병행
      if (connectionMode === "polling") {
        failureCountRef.current = 0;
        connectSse();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [pollFallback, connectionMode, connectSse]);

  useEffect(() => {
    isMountedRef.current = true;
    connectSse();

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [connectSse]);

  return {
    tabs,
    snippets,
    commands,
    files,
    setTabs,
    setSnippets,
    setCommands,
    setFiles,
    connectionMode,
    isRefreshing,
    refreshManually,
    fetchSnippetBody,
  };
}

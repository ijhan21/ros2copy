import { NextRequest } from "next/server";
import { subscribeClient } from "@/lib/serverState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          if (event === "keepalive") {
            // 15초마다 Nginx 및 브라우저 연결 유지용 주석 한 줄
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } else {
            const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }
        } catch {
          // 전송 실패 시 무시 (스트림 닫힘)
        }
      };

      try {
        unsubscribe = await subscribeClient(clientId, send);
      } catch (err) {
        console.error("[SSE Stream] 구독 등록 실패:", err);
        controller.close();
      }
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  });

  request.signal.addEventListener("abort", () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Nginx Proxy Manager 앞단 버퍼링 방지 필수
    },
  });
}

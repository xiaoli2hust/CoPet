import { joinNianLunUrl } from "./config";
import { NianLunError } from "./errors";
import { nianLunHeaders } from "./http-adapter";
import {
  extractAnswerCandidate,
  normalizeAgentResponse,
  normalizeEvidence,
  responseField,
} from "./normalizer";
import type {
  AgentChatRequest,
  AgentChatResponse,
  NianLunConfig,
  StreamHandlers,
} from "./types";

function statusFrom(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  if (status.includes("understand")) return "正在理解问题" as const;
  if (status.includes("query") || status.includes("data") || status.includes("search")) {
    return "正在查询经营数据" as const;
  }
  if (status.includes("complete") || status.includes("done")) return "回答完成" as const;
  if (status.includes("error") || status.includes("fail")) return "请求失败" as const;
  return "正在生成回答" as const;
}

function eventPayload(block: string): unknown {
  const data = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return { type: "completed" };
  try {
    return JSON.parse(data);
  } catch {
    return { type: "delta", delta: data };
  }
}

export class StreamNianLunAdapter {
  constructor(
    private readonly config: NianLunConfig,
    private readonly token = "",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async streamMessage(
    request: AgentChatRequest,
    handlers: StreamHandlers,
  ): Promise<AbortController> {
    const operation = this.startStream(request, handlers);
    void operation.result.catch((error) => {
      handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
    });
    return operation.controller;
  }

  startStream(
    request: AgentChatRequest,
    handlers: StreamHandlers,
    controller = new AbortController(),
  ): { controller: AbortController; result: Promise<AgentChatResponse> } {
    return {
      controller,
      result: this.consume(request, handlers, controller),
    };
  }

  private async consume(
    request: AgentChatRequest,
    handlers: StreamHandlers,
    controller: AbortController,
  ): Promise<AgentChatResponse> {
    let timedOut = false;
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);
    let answer = "";
    let evidence: import("./types").AgentEvidence[] = [];

    try {
      const response = await this.fetchImpl(
        joinNianLunUrl(this.config.baseUrl, this.config.chatPath),
        {
          body: JSON.stringify(request),
          headers: {
            ...nianLunHeaders(this.token),
            Accept: "text/event-stream",
          },
          method: "POST",
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        const fallbackStatuses = new Set([404, 405, 406, 415, 501]);
        throw new NianLunError(
          fallbackStatuses.has(response.status) ? "stream_unavailable" : "http_error",
          "流式接口返回 HTTP " + response.status,
        );
      }
      if (!(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
        throw new NianLunError("stream_unavailable", "后台未提供 SSE 流式响应");
      }
      if (!response.body) {
        throw new NianLunError("stream_unavailable", "SSE 响应没有可读取的数据流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed: AgentChatResponse | null = null;

      const handleBlock = (block: string) => {
        const payload = eventPayload(block);
        const type = String(
          responseField(payload, "type") ??
            responseField(payload, "event") ??
            responseField(payload, "status") ??
            "",
        ).toLowerCase();
        if (type.includes("error")) {
          throw new NianLunError(
            "invalid_response",
            String(responseField(payload, "message") ?? "流式响应中断"),
          );
        }
        if (type.includes("status")) {
          handlers.onStatus?.(statusFrom(responseField(payload, "status")));
        }
        const delta = extractAnswerCandidate(payload);
        if (delta) {
          answer += delta;
          handlers.onStatus?.("正在生成回答");
          handlers.onDelta?.(delta, answer);
        }
        const nextEvidence = normalizeEvidence(responseField(payload, "evidence"));
        if (nextEvidence.length) {
          evidence = nextEvidence;
          handlers.onEvidence?.(nextEvidence);
        }
        if (type.includes("complete") || responseField(payload, "completed") === true) {
          completed = normalizeAgentResponse(
            {
              ...(payload as Record<string, unknown>),
              answer: String(responseField(payload, "answer") ?? answer),
              evidence:
                responseField(payload, "evidence") ?? evidence,
            },
            request.conversationId,
          );
        }
      };

      while (!completed) {
        const next = await reader.read();
        buffer += decoder.decode(next.value, { stream: !next.done }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (block.trim()) handleBlock(block);
          if (completed) break;
          boundary = buffer.indexOf("\n\n");
        }
        if (next.done) break;
      }
      if (!completed && buffer.trim()) handleBlock(buffer);
      const result =
        completed ??
        normalizeAgentResponse(
          { answer, evidence, status: "completed" },
          request.conversationId,
        );
      handlers.onStatus?.("回答完成");
      handlers.onCompleted?.(result);
      return result;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new NianLunError(
          timedOut ? "timeout" : "cancelled",
          timedOut ? "请求超时，请稍后重试" : "请求已停止",
          timedOut,
        );
      }
      if (error instanceof NianLunError) throw error;
      throw new NianLunError("offline", "SSE 连接中断或后台离线");
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}

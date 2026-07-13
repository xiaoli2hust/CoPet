import { joinNianLunUrl } from "./config";
import { NianLunError, redactSensitive } from "./errors";
import { normalizeAgentResponse } from "./normalizer";
import type {
  AgentChatRequest,
  AgentChatResponse,
  HealthCheckResult,
  NianLunAgentAdapter,
  NianLunConfig,
} from "./types";

export function nianLunHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-Type": "nianlun-desktop-pet",
    "X-Permission-Mode": "super-readonly",
  };
  if (token.trim()) {
    headers.Authorization = "Bearer " + token.trim();
  }
  return headers;
}

export class HttpNianLunAdapter implements NianLunAgentAdapter {
  constructor(
    private readonly config: NianLunConfig,
    private readonly token = "",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async healthCheck(): Promise<HealthCheckResult> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(
        joinNianLunUrl(this.config.baseUrl, this.config.healthPath),
        {
          headers: nianLunHeaders(this.token),
          method: "GET",
          signal: controller.signal,
        },
      );
      return {
        ok: response.ok,
        mode: "http",
        message: response.ok ? "连接成功" : "健康检查返回 HTTP " + response.status,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "http",
        message:
          error instanceof DOMException && error.name === "AbortError"
            ? "连接超时"
            : "后台离线或网络不可达",
      };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  sendMessage(request: AgentChatRequest): Promise<AgentChatResponse> {
    return this.sendMessageWithSignal(request);
  }

  async sendMessageWithSignal(
    request: AgentChatRequest,
    signal?: AbortSignal,
  ): Promise<AgentChatResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(
        joinNianLunUrl(this.config.baseUrl, this.config.chatPath),
        {
          body: JSON.stringify(request),
          headers: nianLunHeaders(this.token),
          method: "POST",
          signal: controller.signal,
        },
      );
      const text = await response.text();
      if (!response.ok) {
        throw new NianLunError(
          "http_error",
          "年轮后台返回 HTTP " +
            response.status +
            (text ? "：" + redactSensitive(text.slice(0, 300), this.token) : ""),
        );
      }
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new NianLunError("invalid_json", "年轮后台返回了非 JSON 内容");
      }
      return normalizeAgentResponse(payload, request.conversationId);
    } catch (error) {
      if (signal?.aborted) {
        throw new NianLunError("cancelled", "请求已停止", false);
      }
      if (timedOut) {
        throw new NianLunError("timeout", "请求超时，请稍后重试");
      }
      if (error instanceof NianLunError) throw error;
      throw new NianLunError("offline", "年轮后台离线或网络不可达");
    } finally {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

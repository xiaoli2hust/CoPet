import { HttpNianLunAdapter } from "./http-adapter";
import { MockNianLunAdapter } from "./mock-adapter";
import { NianLunError } from "./errors";
import { StreamNianLunAdapter } from "./stream-adapter";
import type {
  AgentChatRequest,
  AgentOperation,
  HealthCheckResult,
  NianLunConfig,
  StreamHandlers,
} from "./types";

export class NianLunClient {
  private readonly http: HttpNianLunAdapter;
  private readonly stream: StreamNianLunAdapter;
  private readonly mock: MockNianLunAdapter;

  constructor(
    private readonly config: NianLunConfig,
    token = "",
    fetchImpl: typeof fetch = fetch,
  ) {
    this.http = new HttpNianLunAdapter(config, token, fetchImpl);
    this.stream = new StreamNianLunAdapter(config, token, fetchImpl);
    this.mock = new MockNianLunAdapter();
  }

  healthCheck(): Promise<HealthCheckResult> {
    return this.config.mockMode ? this.mock.healthCheck() : this.http.healthCheck();
  }

  send(request: AgentChatRequest, handlers: StreamHandlers = {}): AgentOperation {
    if (this.config.mockMode) {
      return this.mock.start(request, handlers);
    }

    const controller = new AbortController();
    const result = (async () => {
      handlers.onStatus?.("正在理解问题");
      handlers.onStatus?.("正在查询经营数据");
      try {
        if (this.config.enableStreaming) {
          try {
            return await this.stream.startStream(request, handlers, controller).result;
          } catch (error) {
            if (controller.signal.aborted) throw error;
            if (
              !(error instanceof NianLunError) ||
              !["stream_unavailable", "offline"].includes(error.code)
            ) {
              throw error;
            }
          }
        }
        handlers.onStatus?.("正在生成回答");
        const response = await this.http.sendMessageWithSignal(
          request,
          controller.signal,
        );
        handlers.onStatus?.("回答完成");
        handlers.onCompleted?.(response);
        return response;
      } catch (error) {
        if (!(error instanceof NianLunError && error.code === "cancelled")) {
          handlers.onStatus?.("请求失败");
        }
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    })();
    return { controller, result };
  }
}

export function createNianLunClient(
  config: NianLunConfig,
  token = "",
  fetchImpl: typeof fetch = fetch,
): NianLunClient {
  return new NianLunClient(config, token, fetchImpl);
}

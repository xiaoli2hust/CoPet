import { expect, test } from "@playwright/test";

import * as configModule from "../services/nianlun/config";
import * as errorsModule from "../services/nianlun/errors";
import * as normalizerModule from "../services/nianlun/normalizer";
import * as mockModule from "../services/nianlun/mock-adapter";
import * as httpModule from "../services/nianlun/http-adapter";
import * as streamModule from "../services/nianlun/stream-adapter";
import * as sessionModule from "../services/nianlun/session-store";
import type {
  AgentChatRequest,
  AgentChatResponse,
  NianLunAgentAdapter,
  NianLunConfig,
  StreamHandlers,
} from "../services/nianlun/types";

type UnknownModule = Record<string, unknown>;

function exported<T>(module: UnknownModule, ...names: string[]): T {
  for (const name of names) {
    if (name in module) return module[name] as T;
  }
  throw new Error(`Expected one of these exports: ${names.join(", ")}`);
}

const request: AgentChatRequest = {
  conversationId: "conv_test",
  message: "华东区本月签单为什么下降？",
  client: "nianlun-desktop-pet",
  context: {
    permissionMode: "super_readonly",
    responseMode: "desktop_compact",
  },
};

const defaultConfig: NianLunConfig = {
  baseUrl: "http://localhost:8000",
  chatPath: "/api/agent/chat",
  healthPath: "/api/health",
  enableStreaming: true,
  timeoutMs: 1_000,
  mockMode: false,
  saveHistory: true,
};

test("NianLun URL settings prefer user values and normalize slashes", () => {
  const resolveConfig = exported<
    (user?: Partial<NianLunConfig>, env?: Record<string, string | undefined>) => NianLunConfig
  >(configModule, "resolveNianLunConfig", "resolveConfig");
  const joinUrl = exported<(baseUrl: string, path: string) => string>(
    configModule,
    "joinNianLunUrl",
    "joinUrl",
    "buildUrl",
  );

  const config = resolveConfig(
    { ...defaultConfig, baseUrl: "https://user.example/", chatPath: "custom/chat" },
    { NIANLUN_AGENT_BASE_URL: "https://env.example" },
  );

  expect(config.baseUrl).toBe("https://user.example");
  expect(joinUrl(config.baseUrl, config.chatPath)).toBe("https://user.example/custom/chat");
});

test("backend response variants normalize into the desktop schema", () => {
  const normalize = exported<
    (payload: unknown, conversationId: string) => AgentChatResponse
  >(normalizerModule, "normalizeAgentResponse", "normalizeResponse");
  const response = normalize(
    {
      request_id: "req_variant",
      conversation_id: "conv_server",
      answer: "经营结论",
      summary: "核心结论",
      sources: [{ name: "经营月报", system: "CRM", updated_at: "2026-07-13" }],
    },
    "conv_fallback",
  );

  expect(response.requestId).toBe("req_variant");
  expect(response.conversationId).toBe("conv_server");
  expect(response.answer).toContain("经营结论");
});

test("empty answers and invalid schemas are rejected", () => {
  const normalize = exported<
    (payload: unknown, conversationId: string) => AgentChatResponse
  >(normalizerModule, "normalizeAgentResponse", "normalizeResponse");

  expect(() => normalize({ answer: "   " }, "conv_empty")).toThrow();
  expect(() => normalize(null, "conv_invalid")).toThrow();
});

test("tokens are redacted from user-facing errors", () => {
  const redact = exported<(value: string, token?: string) => string>(
    errorsModule,
    "redactSensitiveText",
    "redactSecrets",
    "sanitizeErrorMessage",
  );
  const token = "secret-token-123";
  const safe = redact(`Authorization: Bearer ${token}; token=${token}`, token);

  expect(safe).not.toContain(token);
  expect(safe).toContain("[REDACTED]");
});

test("built-in Mock adapter supports a same-conversation follow-up", async () => {
  const MockAdapter = exported<new () => NianLunAgentAdapter>(
    mockModule,
    "MockNianLunAdapter",
    "MockAdapter",
  );
  const adapter = new MockAdapter();
  const first = await adapter.sendMessage(request);
  const followUp = await adapter.sendMessage({
    ...request,
    message: "主要是哪几个项目？",
  });

  expect(first.answer).toContain("模拟数据");
  expect(first.evidence.length).toBeGreaterThan(0);
  expect(followUp.conversationId).toBe(request.conversationId);
  expect(followUp.answer).toContain("模拟数据");
});

test("ordinary HTTP sends the readonly headers and normalizes JSON", async () => {
  const HttpAdapter = exported<
    new (config: NianLunConfig, token?: string) => NianLunAgentAdapter
  >(httpModule, "HttpNianLunAdapter", "HttpAdapter");
  const originalFetch = globalThis.fetch;
  let receivedHeaders: Headers | undefined;
  globalThis.fetch = async (_input, init) => {
    receivedHeaders = new Headers(init?.headers);
    return new Response(
      JSON.stringify({
        requestId: "req_http",
        conversationId: request.conversationId,
        answer: "HTTP 经营回答",
        status: "completed",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const adapter = new HttpAdapter(defaultConfig, "http-secret");
    const response = await adapter.sendMessage(request);
    expect(response.answer).toBe("HTTP 经营回答");
    expect(receivedHeaders?.get("x-client-type")).toBe("nianlun-desktop-pet");
    expect(receivedHeaders?.get("x-permission-mode")).toBe("super-readonly");
    expect(receivedHeaders?.get("authorization")).toBe("Bearer http-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("HTTP reports offline, invalid JSON, and timeout failures", async () => {
  const HttpAdapter = exported<
    new (config: NianLunConfig, token?: string) => NianLunAgentAdapter
  >(httpModule, "HttpNianLunAdapter", "HttpAdapter");
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(new HttpAdapter(defaultConfig).sendMessage(request)).rejects.toThrow();

    globalThis.fetch = async () =>
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await expect(new HttpAdapter(defaultConfig).sendMessage(request)).rejects.toThrow();

    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    await expect(
      new HttpAdapter({ ...defaultConfig, timeoutMs: 10 }).sendMessage(request),
    ).rejects.toThrow();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SSE streams status, deltas, evidence, and completion", async () => {
  const StreamAdapter = exported<
    new (config: NianLunConfig, token?: string) => {
      streamMessage(request: AgentChatRequest, handlers: StreamHandlers): Promise<AbortController>;
    }
  >(streamModule, "StreamNianLunAdapter", "StreamAdapter");
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"status","status":"working"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"delta","delta":"流式"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"delta","delta":"回答"}\n\n'));
          controller.enqueue(
            encoder.encode(
              'data: {"type":"evidence","evidence":[{"title":"月报","source":"CRM","time":"2026-07-13"}]}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              `data: {"type":"completed","requestId":"req_sse","conversationId":"${request.conversationId}"}\n\n`,
            ),
          );
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  const deltas: string[] = [];
  let completed: AgentChatResponse | undefined;

  try {
    const adapter = new StreamAdapter(defaultConfig);
    await adapter.streamMessage(request, {
      onStatus: () => undefined,
      onDelta: (delta) => deltas.push(delta),
      onEvidence: () => undefined,
      onCompleted: (response) => {
        completed = response;
      },
      onError: (error) => {
        throw error;
      },
    });
    await expect.poll(() => completed).toBeTruthy();
    expect(deltas.join("")).toBe("流式回答");
    expect(completed?.evidence).toHaveLength(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SSE operation can be interrupted", async () => {
  const StreamAdapter = exported<
    new (config: NianLunConfig, token?: string) => {
      streamMessage(request: AgentChatRequest, handlers: StreamHandlers): Promise<AbortController>;
    }
  >(streamModule, "StreamNianLunAdapter", "StreamAdapter");
  const originalFetch = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = async (_input, init) => {
    aborted = init?.signal?.aborted ?? false;
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
    });
    return new Response(new ReadableStream({ start() {} }), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };

  try {
    const controller = await new StreamAdapter(defaultConfig).streamMessage(request, {
      onStatus: () => undefined,
      onDelta: () => undefined,
      onEvidence: () => undefined,
      onCompleted: () => undefined,
      onError: () => undefined,
    });
    controller.abort();
    await expect.poll(() => aborted).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local sessions keep ten records, recover from corruption, and clear", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  const load = exported<() => unknown[]>(sessionModule, "loadSessions", "loadConversationHistory");
  const save = exported<(session: unknown, enabled?: boolean) => void>(
    sessionModule,
    "saveSession",
    "saveConversation",
  );
  const clear = exported<() => void>(sessionModule, "clearSessions", "clearConversationHistory");

  for (let index = 0; index < 12; index += 1) {
    save({
      conversationId: `conv_${index}`,
      messages: [],
      createdAt: new Date(2026, 0, index + 1).toISOString(),
      updatedAt: new Date(2026, 0, index + 1).toISOString(),
    }, true);
  }
  expect(load()).toHaveLength(10);
  values.set([...values.keys()][0], "{broken json");
  expect(load()).toEqual([]);
  clear();
  expect(load()).toEqual([]);
});

test("Markdown rendering escapes XSS and only links safe HTTP URLs", async ({ page }) => {
  const content =
    '[安全链接](https://example.com) [危险链接](javascript:alert(1)) <img src=x onerror="alert(1)">';
  await page.goto(`/src/tests/fixtures/nianlun-markdown.html?content=${encodeURIComponent(content)}`);

  await expect(page.getByText("安全链接")).toBeVisible();
  await expect(page.getByText("安全链接")).toHaveAttribute(
    "href",
    /^https:\/\/example\.com\/?$/,
  );
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.locator("[onerror]")).toHaveCount(0);
});

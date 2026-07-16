import { NianLunError } from "./errors";
import type { NianLunConfig } from "./types";

export const DEFAULT_NIANLUN_CONFIG: NianLunConfig = {
  baseUrl: "http://localhost:8000",
  chatPath: "/api/agent/chat",
  healthPath: "/api/health",
  enableStreaming: true,
  timeoutMs: 30_000,
  mockMode: true,
  saveHistory: true,
};

type NianLunEnv = {
  NIANLUN_AGENT_BASE_URL?: string;
  NIANLUN_AGENT_CHAT_PATH?: string;
  NIANLUN_AGENT_HEALTH_PATH?: string;
  NIANLUN_AGENT_STREAM_ENABLED?: string;
  NIANLUN_AGENT_TIMEOUT_MS?: string;
  NIANLUN_AGENT_MOCK_MODE?: string;
};

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function normalizedPath(value: string, fallback: string): string {
  const path = value.trim() || fallback;
  return path.startsWith("/") ? path : "/" + path;
}

export function normalizeNianLunConfig(config: NianLunConfig): NianLunConfig {
  return {
    baseUrl: config.baseUrl.trim().replace(/\/+$/, "") || DEFAULT_NIANLUN_CONFIG.baseUrl,
    chatPath: normalizedPath(config.chatPath, DEFAULT_NIANLUN_CONFIG.chatPath),
    healthPath: normalizedPath(config.healthPath, DEFAULT_NIANLUN_CONFIG.healthPath),
    enableStreaming: Boolean(config.enableStreaming),
    timeoutMs: Math.min(120_000, Math.max(50, Math.round(config.timeoutMs || 30_000))),
    mockMode: Boolean(config.mockMode),
    saveHistory: Boolean(config.saveHistory),
  };
}

export function resolveNianLunConfig(
  stored: NianLunConfig | null | undefined,
  userConfigured: boolean,
  env: NianLunEnv = import.meta.env,
): NianLunConfig {
  if (stored && userConfigured) {
    return normalizeNianLunConfig(stored);
  }

  const base = stored ?? DEFAULT_NIANLUN_CONFIG;
  const timeout = Number(env.NIANLUN_AGENT_TIMEOUT_MS);
  return normalizeNianLunConfig({
    ...base,
    baseUrl: env.NIANLUN_AGENT_BASE_URL ?? base.baseUrl,
    chatPath: env.NIANLUN_AGENT_CHAT_PATH ?? base.chatPath,
    healthPath: env.NIANLUN_AGENT_HEALTH_PATH ?? base.healthPath,
    enableStreaming: envBoolean(
      env.NIANLUN_AGENT_STREAM_ENABLED,
      base.enableStreaming,
    ),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : base.timeoutMs,
    mockMode: envBoolean(env.NIANLUN_AGENT_MOCK_MODE, base.mockMode),
  });
}

export function joinNianLunUrl(baseUrl: string, path: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new NianLunError("invalid_url", "后台地址不是有效 URL", false);
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new NianLunError(
      "invalid_url",
      "后台地址必须使用 HTTP/HTTPS，且不能包含账号或密码",
      false,
    );
  }
  return new URL(normalizedPath(path, "/"), base.origin).toString();
}

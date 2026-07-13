import { NianLunError } from "./errors";
import type { AgentChatResponse, AgentEvidence } from "./types";

const MAX_ANSWER_LENGTH = 200_000;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringAt(value: Record<string, unknown> | null, key: string): string {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizeEvidence(value: unknown): AgentEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = object(item);
      if (!record) return null;
      const title = firstString(record.title, record.name, record.label, "经营数据证据");
      const source = firstString(record.source, record.dataset, record.origin, "年轮后台");
      const time = firstString(record.time, record.updatedAt, record.date, "时间未提供");
      return { title, source, time };
    })
    .filter((item): item is AgentEvidence => item !== null);
}

export function normalizeAgentResponse(
  payload: unknown,
  fallbackConversationId: string,
): AgentChatResponse {
  if (typeof payload === "string") {
    payload = { answer: payload };
  }
  const root = object(payload);
  if (!root) {
    throw new NianLunError("invalid_response", "后台返回的数据结构无效");
  }
  const data = object(root.data);
  const result = object(root.result);
  const message = object(root.message);
  const output = object(root.output);

  let answer = firstString(
    root.answer,
    root.output_text,
    root.outputText,
    data?.answer,
    data?.output,
    result?.answer,
    result?.output,
    output?.text,
    message?.content,
  );
  if (!answer) {
    throw new NianLunError("empty_answer", "年轮后台返回了空回答");
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    answer = answer.slice(0, MAX_ANSWER_LENGTH) + "\n\n[回答过长，已截断]";
  }

  const evidence = normalizeEvidence(
    root.evidence ?? data?.evidence ?? result?.evidence,
  );
  return {
    requestId: firstString(
      root.requestId,
      root.request_id,
      data?.requestId,
      "req_" + crypto.randomUUID(),
    ),
    conversationId: firstString(
      root.conversationId,
      root.conversation_id,
      data?.conversationId,
      fallbackConversationId,
    ),
    answer,
    summary: firstString(root.summary, data?.summary, result?.summary, answer.slice(0, 180)),
    status: "completed",
    evidence,
    actions: Array.isArray(root.actions) ? root.actions : [],
    mock: root.mock === true,
  };
}

export function extractAnswerCandidate(payload: unknown): string {
  const record = object(payload);
  return firstString(
    record?.delta,
    record?.content,
    record?.token,
    record?.text,
  );
}

export function responseField(payload: unknown, key: string): unknown {
  return object(payload)?.[key];
}

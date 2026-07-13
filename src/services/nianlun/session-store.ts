import type { AgentEvidence } from "./types";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  evidence?: AgentEvidence[];
  mock?: boolean;
};

export type NianLunSession = {
  conversationId: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "nianlun-desktop-pet:sessions:v1";
const MAX_SESSIONS = 10;

function validSession(value: unknown): value is NianLunSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<NianLunSession>;
  return (
    typeof session.conversationId === "string" &&
    typeof session.createdAt === "string" &&
    typeof session.updatedAt === "string" &&
    Array.isArray(session.messages)
  );
}

export function loadSessions(storage: Storage = globalThis.localStorage): NianLunSession[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validSession)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

export function latestSession(
  storage: Storage = globalThis.localStorage,
): NianLunSession | null {
  return loadSessions(storage)[0] ?? null;
}

export function saveSession(
  session: NianLunSession,
  enabled: boolean,
  storage: Storage = globalThis.localStorage,
): void {
  if (!enabled || !validSession(session)) return;
  try {
    const next = [
      session,
      ...loadSessions(storage).filter(
        (item) => item.conversationId !== session.conversationId,
      ),
    ]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SESSIONS);
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage quota/private mode must never crash the desktop app.
  }
}

export function removeSession(
  conversationId: string,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    const next = loadSessions(storage).filter(
      (session) => session.conversationId !== conversationId,
    );
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best effort only.
  }
}

export function clearSessions(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

export function newConversationId(): string {
  return "conv_" + crypto.randomUUID();
}

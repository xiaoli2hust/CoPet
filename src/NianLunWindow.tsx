import {
  Check,
  ChevronDown,
  Clipboard,
  RotateCcw,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NianLunMarkdown } from "./components/NianLunMarkdown";
import { useAppState } from "./hooks/useAppStore";
import {
  getNianLunAccessToken,
  setNianLunPetStatus,
} from "./lib/appCommands";
import { collapseCurrentWindow, startCurrentWindowDrag } from "./platform";
import {
  createNianLunClient,
  latestSession,
  newConversationId,
  removeSession,
  resolveNianLunConfig,
  safeErrorMessage,
  saveSession,
} from "./services/nianlun";
import type {
  AgentOperation,
  NianLunProcessStatus,
  StoredChatMessage,
} from "./services/nianlun";

const suggestions = [
  "本月签单金额是多少？",
  "华东区本月签单为什么下降？",
  "有哪些商机存在延期风险？",
  "公安行业目前经营情况怎么样？",
  "昆山项目最近发生了什么？",
];

export function NianLunWindow() {
  const appState = useAppState();
  const config = useMemo(
    () =>
      resolveNianLunConfig(
        appState?.nianlun,
        Boolean(appState?.nianlunUserConfigured),
      ),
    [appState?.nianlun, appState?.nianlunUserConfigured],
  );
  const [token, setToken] = useState("");
  const [conversationId, setConversationId] = useState(newConversationId);
  const conversationRef = useRef(conversationId);
  const sessionCreatedAtRef = useRef(new Date().toISOString());
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [processStatus, setProcessStatus] =
    useState<NianLunProcessStatus | null>(null);
  const [connection, setConnection] = useState<
    "checking" | "connected" | "offline" | "mock"
  >("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const activeOperationRef = useRef<AgentOperation | null>(null);
  const restoredRef = useRef(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    void getNianLunAccessToken().then(setToken);
  }, []);

  useEffect(() => {
    if (restoredRef.current || !appState) return;
    restoredRef.current = true;
    if (!config.saveHistory) return;
    const latest = latestSession();
    if (!latest) return;
    setConversationId(latest.conversationId);
    conversationRef.current = latest.conversationId;
    sessionCreatedAtRef.current = latest.createdAt;
    setMessages(latest.messages);
  }, [appState, config.saveHistory]);

  useEffect(() => {
    let cancelled = false;
    setConnection("checking");
    void createNianLunClient(config, token)
      .healthCheck()
      .then((result) => {
        if (!cancelled) {
          setConnection(
            result.ok
              ? result.mode === "mock"
                ? "mock"
                : "connected"
              : "offline",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config, token]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, processStatus, errorMessage]);

  useEffect(() => {
    if (busy) return;
    void setNianLunPetStatus(input.trim() ? "listening" : "idle");
  }, [busy, input]);

  useEffect(
    () => () => {
      activeOperationRef.current?.controller.abort();
      void setNianLunPetStatus("idle");
    },
    [],
  );

  const replaceMessages = useCallback(
    (
      updater: (current: StoredChatMessage[]) => StoredChatMessage[],
      targetConversationId = conversationRef.current,
    ) => {
      setMessages((current) => {
        const next = updater(current);
        saveSession(
          {
            conversationId: targetConversationId,
            messages: next.filter((message) => message.content.trim()),
            createdAt: sessionCreatedAtRef.current,
            updatedAt: new Date().toISOString(),
          },
          config.saveHistory,
        );
        return next;
      });
    },
    [config.saveHistory],
  );

  const sendQuestion = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || busy) return;
      const requestConversationId = conversationRef.current;
      const userMessage: StoredChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      };
      const assistantId = crypto.randomUUID();
      const assistantMessage: StoredChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      replaceMessages(
        (current) => [...current, userMessage, assistantMessage],
        requestConversationId,
      );
      setInput("");
      setBusy(true);
      setErrorMessage(null);
      setFailedQuestion(null);
      setProcessStatus("正在理解问题");
      void setNianLunPetStatus("thinking");

      const operation = createNianLunClient(config, token).send(
        {
          conversationId: requestConversationId,
          message: question,
          client: "nianlun-desktop-pet",
          context: {
            permissionMode: "super_readonly",
            responseMode: "desktop_compact",
          },
        },
        {
          onStatus: (status) => {
            setProcessStatus(status);
            if (
              status === "正在查询经营数据" ||
              status === "正在生成回答"
            ) {
              void setNianLunPetStatus("working");
            }
          },
          onDelta: (_delta, answer) => {
            replaceMessages(
              (current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: answer }
                    : message,
                ),
              requestConversationId,
            );
          },
        },
      );
      activeOperationRef.current = operation;

      try {
        const response = await operation.result;
        const nextConversationId =
          response.conversationId || requestConversationId;
        setConversationId(nextConversationId);
        conversationRef.current = nextConversationId;
        replaceMessages(
          (current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: response.answer,
                    evidence: response.evidence,
                    mock: response.mock,
                  }
                : message,
            ),
          nextConversationId,
        );
        setProcessStatus("回答完成");
        setConnection(config.mockMode ? "mock" : "connected");
        void setNianLunPetStatus("success");
        window.setTimeout(() => void setNianLunPetStatus("idle"), 1_000);
      } catch (error) {
        const message = safeErrorMessage(error, token);
        replaceMessages(
          (current) => current.filter((item) => item.id !== assistantId),
          requestConversationId,
        );
        if (message === "请求已停止") {
          setProcessStatus(null);
          setErrorMessage("已停止当前请求");
          void setNianLunPetStatus("idle");
        } else {
          setProcessStatus("请求失败");
          setErrorMessage(message);
          setFailedQuestion(question);
          setConnection("offline");
          void setNianLunPetStatus("error");
        }
      } finally {
        activeOperationRef.current = null;
        setBusy(false);
      }
    },
    [busy, config, replaceMessages, token],
  );

  const clearConversation = () => {
    activeOperationRef.current?.controller.abort();
    removeSession(conversationRef.current);
    const next = newConversationId();
    conversationRef.current = next;
    sessionCreatedAtRef.current = new Date().toISOString();
    setConversationId(next);
    setMessages([]);
    setErrorMessage(null);
    setFailedQuestion(null);
    setProcessStatus(null);
    void setNianLunPetStatus("idle");
  };

  const connectionLabel = {
    checking: "连接检查中",
    connected: "已连接",
    offline: "离线",
    mock: "Mock 已连接",
  }[connection];

  return (
    <main className="nianlun-window">
      <header
        className="nianlun-titlebar"
        data-tauri-drag-region
        onPointerDown={(event) => {
          if (
            event.button === 0 &&
            !(event.target as Element).closest("button")
          ) {
            startCurrentWindowDrag();
          }
        }}
      >
        <div>
          <h1>问年轮</h1>
          <span className={"nianlun-connection " + connection}>
            <i aria-hidden="true" />
            {connectionLabel}
          </span>
        </div>
        <div className="nianlun-title-actions">
          <button
            aria-label="清空对话"
            onClick={clearConversation}
            type="button"
          >
            <Trash2 aria-hidden="true" />
          </button>
          <button
            aria-label="收起"
            onClick={() => {
              void setNianLunPetStatus("idle");
              collapseCurrentWindow();
            }}
            type="button"
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </header>

      <section aria-live="polite" className="nianlun-messages">
        {messages.length === 0 ? (
          <div className="nianlun-empty">
            <p>我可以帮你查询经营情况、项目进展和风险线索。</p>
            <div className="nianlun-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void sendQuestion(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <article
            className={"nianlun-message " + message.role}
            key={message.id}
          >
            <span className="nianlun-message-author">
              {message.role === "user" ? "你" : "年轮"}
            </span>
            {message.content ? (
              message.role === "assistant" ? (
                <NianLunMarkdown content={message.content} />
              ) : (
                <p>{message.content}</p>
              )
            ) : busy ? (
              <div className="nianlun-answer-loading">
                <i />
                <i />
                <i />
              </div>
            ) : null}
            {message.evidence?.length ? (
              <details className="nianlun-evidence">
                <summary>证据摘要（{message.evidence.length}）</summary>
                {message.evidence.map((evidence, index) => (
                  <div key={evidence.title + index}>
                    <strong>{evidence.title}</strong>
                    <span>
                      {evidence.source} · {evidence.time}
                    </span>
                  </div>
                ))}
              </details>
            ) : null}
            {message.role === "assistant" && message.content ? (
              <button
                aria-label="复制回答"
                className="nianlun-copy"
                onClick={() => {
                  void navigator.clipboard.writeText(message.content);
                  setCopiedId(message.id);
                  window.setTimeout(() => setCopiedId(null), 1_200);
                }}
                type="button"
              >
                {copiedId === message.id ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Clipboard aria-hidden="true" />
                )}
                {copiedId === message.id ? "已复制" : "复制"}
              </button>
            ) : null}
          </article>
        ))}

        {processStatus ? (
          <div
            className={
              "nianlun-process " +
              (processStatus === "请求失败" ? "error" : "")
            }
          >
            <i aria-hidden="true" />
            {processStatus}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="nianlun-error" role="alert">
            <span>{errorMessage}</span>
            {failedQuestion ? (
              <button
                onClick={() => void sendQuestion(failedQuestion)}
                type="button"
              >
                <RotateCcw aria-hidden="true" />
                重试
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={messageEndRef} />
      </section>

      <footer className="nianlun-composer">
        <textarea
          aria-label="经营问题"
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendQuestion(input);
            }
          }}
          placeholder="输入经营问题，Enter 发送，Shift+Enter 换行"
          rows={3}
          value={input}
        />
        <div>
          <span>只读查询 · 不直接连接数据库</span>
          {busy ? (
            <button
              className="stop"
              onClick={() => activeOperationRef.current?.controller.abort()}
              type="button"
            >
              <Square aria-hidden="true" />
              停止
            </button>
          ) : (
            <button
              disabled={!input.trim()}
              onClick={() => void sendQuestion(input)}
              type="button"
            >
              <Send aria-hidden="true" />
              发送
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}
import "./nianlun.css";

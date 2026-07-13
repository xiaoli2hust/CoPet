export type NianLunProcessStatus =
  | "正在理解问题"
  | "正在查询经营数据"
  | "正在生成回答"
  | "回答完成"
  | "请求失败";

export type NianLunConfig = {
  baseUrl: string;
  chatPath: string;
  healthPath: string;
  enableStreaming: boolean;
  timeoutMs: number;
  mockMode: boolean;
  saveHistory: boolean;
};

export type AgentChatRequest = {
  conversationId: string;
  message: string;
  client: "nianlun-desktop-pet";
  context: {
    permissionMode: "super_readonly";
    responseMode: "desktop_compact";
  };
};

export type AgentEvidence = {
  title: string;
  source: string;
  time: string;
};

export type AgentChatResponse = {
  requestId: string;
  conversationId: string;
  answer: string;
  summary: string;
  status: "completed";
  evidence: AgentEvidence[];
  actions: unknown[];
  mock?: boolean;
};

export type HealthCheckResult = {
  ok: boolean;
  mode: "mock" | "http";
  message: string;
};

export type StreamHandlers = {
  onStatus?: (status: NianLunProcessStatus) => void;
  onDelta?: (delta: string, answer: string) => void;
  onEvidence?: (evidence: AgentEvidence[]) => void;
  onCompleted?: (response: AgentChatResponse) => void;
  onError?: (error: Error) => void;
};

export interface NianLunAgentAdapter {
  healthCheck(): Promise<HealthCheckResult>;
  sendMessage(request: AgentChatRequest): Promise<AgentChatResponse>;
  streamMessage?(
    request: AgentChatRequest,
    handlers: StreamHandlers,
  ): Promise<AbortController>;
}

export type AgentOperation = {
  controller: AbortController;
  result: Promise<AgentChatResponse>;
};

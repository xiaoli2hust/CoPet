import { NianLunError } from "./errors";
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentOperation,
  HealthCheckResult,
  NianLunAgentAdapter,
  StreamHandlers,
} from "./types";

const answers: Record<string, { answer: string; evidence: string }> = {
  "本月签单金额是多少？": {
    answer:
      "本月累计签单金额 **1,286 万元**，完成月度目标的 **78%**。华东区 462 万元、华北区 338 万元，较上月同期增长 6.2%。",
    evidence: "月度签单经营看板",
  },
  "华东区本月签单为什么下降？": {
    answer:
      "华东区本月签单同比下降 **12.4%**，预计影响约 **218 万元**。主要原因是昆山公安项目验收顺延、苏州园区项目商务条款复核，以及两个重点商机决策周期延长。",
    evidence: "华东区商机与合同进度快照",
  },
  "有哪些商机存在延期风险？": {
    answer:
      "当前有 **3 个高风险商机**：昆山公安项目、苏州园区数据治理项目、南京应急指挥项目，合计预计金额 **560 万元**。主要风险是验收材料、商务条款和预算批复。",
    evidence: "商机风险清单",
  },
  "公安行业目前经营情况怎么样？": {
    answer:
      "公安行业本月新增商机 **9 个**、签单 **376 万元**，在手商机 **2,140 万元**。整体平稳，风险集中在验收周期和财政预算释放节奏。",
    evidence: "公安行业经营月报",
  },
  "昆山项目最近发生了什么？": {
    answer:
      "昆山项目上周完成技术方案复审，但客户要求补充等保测评材料，原定验收日期顺延约 **两周**。责任人已提交材料，下一检查点为本周五。",
    evidence: "昆山项目周报",
  },
  "主要是哪几个项目？": {
    answer:
      "主要是昆山公安项目（约 **96 万元**）、苏州园区数据治理项目（约 **72 万元**）和无锡政务云扩容项目（约 **50 万元**）。",
    evidence: "华东区项目影响拆解",
  },
};

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer);
        reject(new NianLunError("cancelled", "请求已停止", false));
      },
      { once: true },
    );
  });
}

export class MockNianLunAdapter implements NianLunAgentAdapter {
  constructor(private readonly delayMs = 120) {}

  async healthCheck(): Promise<HealthCheckResult> {
    return { ok: true, mode: "mock", message: "内置 Mock 已连接" };
  }

  sendMessage(request: AgentChatRequest): Promise<AgentChatResponse> {
    return this.start(request, {}).result;
  }

  start(request: AgentChatRequest, handlers: StreamHandlers): AgentOperation {
    const controller = new AbortController();
    const result = (async () => {
      handlers.onStatus?.("正在理解问题");
      await wait(this.delayMs, controller.signal);
      handlers.onStatus?.("正在查询经营数据");
      await wait(this.delayMs, controller.signal);
      handlers.onStatus?.("正在生成回答");
      const matched = answers[request.message] ?? {
        answer:
          "已收到这个经营问题。当前内置 Mock 没有对应业务口径，真实模式下会由年轮后台结合经营数据回答。",
        evidence: "内置 Mock 通用回答",
      };
      const answer =
        "> **模拟数据**\n\n" +
        matched.answer +
        "\n\n数据更新时间：今天 09:30。";
      handlers.onDelta?.(answer, answer);
      const response: AgentChatResponse = {
        requestId: "req_mock_" + crypto.randomUUID(),
        conversationId: request.conversationId,
        answer,
        summary: matched.answer.split("。")[0],
        status: "completed",
        evidence: [
          {
            title: matched.evidence,
            source: "内置 Mock Adapter",
            time: "今天 09:30",
          },
        ],
        actions: [],
        mock: true,
      };
      handlers.onEvidence?.(response.evidence);
      handlers.onStatus?.("回答完成");
      handlers.onCompleted?.(response);
      return response;
    })();
    return { controller, result };
  }
}

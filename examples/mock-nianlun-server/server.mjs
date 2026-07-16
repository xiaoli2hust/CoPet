import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8000);

const answers = {
  "本月签单金额是多少？": "本月累计签单金额为 1,286 万元，完成月度目标的 78%。其中华东区 462 万元、华北区 338 万元，数据更新时间为今天 09:30。",
  "华东区本月签单为什么下降？": "华东区本月签单同比下降 12.4%，主要因为昆山公安项目验收顺延、苏州园区项目商务条款复核，以及两个重点商机决策周期延长。预计影响金额约 218 万元。",
  "有哪些商机存在延期风险？": "当前有 3 个高风险商机：昆山公安项目、苏州园区数据治理项目、南京应急指挥项目，合计预计金额 560 万元。",
  "公安行业目前经营情况怎么样？": "公安行业本月新增商机 9 个、签单 376 万元，在手商机 2,140 万元。风险集中在验收周期和财政预算释放节奏。",
  "昆山项目最近发生了什么？": "昆山项目上周完成技术方案复审，但客户要求补充等保测评材料，原定验收日期顺延约两周。当前责任人已提交补充材料。",
  "主要是哪几个项目？": "主要是昆山公安项目（约 96 万元）、苏州园区数据治理项目（约 72 万元）和无锡政务云扩容项目（约 50 万元）。"
};

function json(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Client-Type, X-Permission-Mode",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(body));
}

function responseFor(body) {
  const answer = answers[body.message] ??
    "这是独立 Mock HTTP Server 返回的模拟回答。当前问题已收到，建议结合真实年轮后台补充经营口径和证据。";
  return {
    requestId: `req_${randomUUID()}`,
    conversationId: body.conversationId ?? `conv_${randomUUID()}`,
    answer: `> **模拟数据**\n\n${answer}\n\n数据更新时间：今天 09:30。`,
    summary: answer.split("。")[0],
    status: "completed",
    evidence: [
      {
        title: "经营驾驶舱示例快照",
        source: "mock-nianlun-server",
        time: "今天 09:30"
      }
    ],
    actions: []
  };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Client-Type, X-Permission-Mode",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    json(res, 200, { status: "ok", service: "mock-nianlun-server" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/agent/chat") {
    try {
      const body = await readJson(req);
      const response = responseFor(body);
      if ((req.headers.accept ?? "").includes("text/event-stream")) {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Content-Type": "text/event-stream; charset=utf-8"
        });
        res.write(`data: ${JSON.stringify({ type: "status", status: "querying" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "delta", delta: response.answer })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "evidence", evidence: response.evidence })}\n\n`);
        res.end(`data: ${JSON.stringify({ type: "completed", ...response })}\n\n`);
        return;
      }
      json(res, 200, response);
    } catch {
      json(res, 400, { error: "invalid JSON request" });
    }
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(port, host, () => {
  console.log(`Mock NianLun server listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

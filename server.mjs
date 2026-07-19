import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT || 4173);
const apiBase = (process.env.AGENT_API_BASE_URL || "").replace(/\/$/, "");
const apiModel = process.env.AGENT_API_MODEL || "";
const apiKey = process.env.AGENT_API_KEY || "";
const configured = Boolean(apiBase && apiModel && apiKey);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 48_000) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = typeof item?.content === "string" ? item.content.trim().slice(0, 1600) : "";
    return role && content ? [{ role, content }] : [];
  });
}

async function agentReply(req, res) {
  if (!configured) return json(res, 503, { error: "agent_not_configured" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return json(res, error.message === "payload_too_large" ? 413 : 400, { error: error.message });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2400) : "";
  if (!message) return json(res, 400, { error: "message_required" });
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const system = `你是“月经宝宝”，一个女本位、温暖但不越界的月经健康陪伴 Agent。你的任务不是立刻端出卡片，而是先用自然语言回应用户：\n1. 用一两句话复述你理解到的身体感受、现实限制与担心；\n2. 每次最多问一个真正有助于判断下一步的问题，优先时间、严重程度、变化、出血、伴随症状、功能影响、已尝试行动与结果；\n3. 不诊断、不宣称测到排卵或激素，不把日历阶段写成固定情绪或能力；\n4. 若用户描述紧急危险，明确建议及时联系当地急救或医疗服务；\n5. 不使用“姨妈/大姨妈”，统一说“月经”；\n6. 语气像在乎她的伙伴，简洁、具体，不撒娇，不假装医生。\n用户授权上下文（只用于本次回应）：${JSON.stringify({ babyName: context.babyName, lifeStage: context.lifeStage, cycleDay: context.cycleDay, cycleAnchorConfirmed: context.cycleAnchorConfirmed, communicationStyle: context.communicationStyle })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: apiModel,
        temperature: 0.45,
        max_tokens: 420,
        messages: [{ role: "system", content: system }, ...cleanHistory(body.history), { role: "user", content: message }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return json(res, 502, { error: "agent_provider_error", status: response.status });
    const payload = await response.json();
    const reply = payload?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return json(res, 502, { error: "agent_empty_reply" });
    return json(res, 200, { reply: reply.trim(), model: apiModel });
  } catch (error) {
    return json(res, error.name === "AbortError" ? 504 : 502, { error: error.name === "AbortError" ? "agent_timeout" : "agent_unavailable" });
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(req, res) {
  const rawPath = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  const cleanPath = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(root, cleanPath === "/" ? "index.html" : cleanPath);
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(root, "index.html");
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    json(res, 404, { error: "not_found" });
  }
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/agent/status") return json(res, 200, { configured });
  if (req.method === "POST" && req.url === "/api/agent") return agentReply(req, res);
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  json(res, 405, { error: "method_not_allowed" });
}).listen(port, "0.0.0.0", () => {
  console.log(`月经宝宝服务已启动：${port}；Agent ${configured ? "已配置" : "使用本地安全模式"}`);
});

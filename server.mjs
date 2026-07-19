import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { selectEvidencePackets } from "./src/agentKnowledge.js";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const systemPrompt = readFileSync(fileURLToPath(new URL("./prompts/menstrual-baby-system-v1.md", import.meta.url)), "utf8");
const port = Number(process.env.PORT || 4173);
const apiBase = (process.env.AGENT_API_BASE_URL || "").replace(/\/$/, "");
const apiModel = process.env.AGENT_API_MODEL || "";
const apiKey = process.env.AGENT_API_KEY || "";
const configured = Boolean(apiBase && apiModel && apiKey);
let knowledgeCache = null;

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

function beginJsonStream(res) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  res.write(" ");
  res.flushHeaders?.();
}

function endJsonStream(res, value) {
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

async function loadKnowledgeClaims() {
  if (knowledgeCache) return knowledgeCache;
  try {
    const release = JSON.parse(await readFile(join(root, "data/knowledge-claims.json"), "utf8"));
    knowledgeCache = Array.isArray(release) ? release : release.records || [];
  } catch {
    knowledgeCache = [];
  }
  return knowledgeCache;
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
  const evidence = selectEvidencePackets(await loadKnowledgeClaims(), message);
  const requestedTurnKind = ["question", "answer", "action", "assessment", "conversation"].includes(context.requestedTurnKind) ? context.requestedTurnKind : "conversation";
  const system = `${systemPrompt}\n\n## 本轮产品上下文\n${JSON.stringify({ babyName: context.babyName, lifeStage: context.lifeStage, cycleDay: context.cycleDay, cycleAnchorConfirmed: context.cycleAnchorConfirmed, communicationStyle: context.communicationStyle, needs: context.needs })}\n\n## 本轮唯一任务\n${requestedTurnKind}。如果任务是 question，只问一个问题，不提前给行动；如果是 action，只自然引出一个行动，不再追加问题；如果是 assessment，清楚说明为什么普通照护还不够，不弹普通行动。\n\n## 本轮专业资料包\n${evidence.length ? JSON.stringify(evidence) : "本轮没有检索到适合直接引用的已定位资料。不要编造专业结论或来源。"}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  beginJsonStream(res);
  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: apiModel,
        temperature: 0.35,
        // step-3.5-flash includes reasoning tokens in this budget. A small cap can
        // exhaust the budget before any user-visible content is produced.
        max_tokens: 1024,
        messages: [{ role: "system", content: system }, ...cleanHistory(body.history), { role: "user", content: message }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`Agent provider error: ${response.status}`);
      return endJsonStream(res, { error: "agent_provider_error", status: response.status, retryable: response.status >= 500 });
    }
    const payload = await response.json();
    const reply = payload?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.warn("Agent provider returned an empty reply");
      return endJsonStream(res, { error: "agent_empty_reply", retryable: true });
    }
    const actualKind = /[？?]/.test(reply) && requestedTurnKind === "action" ? "question" : requestedTurnKind;
    return endJsonStream(res, { reply: reply.trim(), kind: actualKind, model: apiModel, evidence });
  } catch (error) {
    console.warn(`Agent request failed: ${error.name || "unknown"}`);
    return endJsonStream(res, { error: error.name === "AbortError" ? "agent_timeout" : "agent_unavailable", retryable: true });
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

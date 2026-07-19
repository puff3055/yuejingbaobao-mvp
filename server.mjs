import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { selectEvidencePackets } from "./src/agentKnowledge.js";
import { AGENT_RESPONSE_SCHEMA, validateAgentResponse } from "./src/agentProtocol.js";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const systemPrompt = readFileSync(fileURLToPath(new URL("./prompts/menstrual-baby-system-v2.md", import.meta.url)), "utf8");
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

function cleanText(value, max = 320) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringList(value, maxItems = 12, maxLength = 160) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).flatMap((item) => {
      const cleaned = cleanText(item, maxLength);
      return cleaned ? [cleaned] : [];
    })
    : [];
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = typeof item?.content === "string" ? item.content.trim().slice(0, 1600) : "";
    return role && content ? [{ role, content }] : [];
  });
}

function cleanMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory.slice(0, 8).map((item) => ({
    id: cleanText(item?.id, 96),
    situation: cleanText(item?.situation || item?.rawText, 480),
    tags: cleanStringList(item?.tags, 10, 80),
    actionId: cleanText(item?.actionId, 80),
    actionTitle: cleanText(item?.actionTitle, 120),
    outcome: ["helped", "some", "none"].includes(item?.effect) ? item.effect : null,
    functionalImpact: cleanText(item?.functionalImpact, 240) || null,
    differenceFromUsual: cleanText(item?.differenceFromUsual, 240) || null,
    currentConstraint: cleanText(item?.currentConstraint || item?.taskDetail, 240) || null,
    cycleDay: Number.isInteger(item?.cycleDay) ? item.cycleDay : null,
  })).filter((item) => item.id && item.situation);
}

function cleanActionCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates.slice(0, 12).flatMap((item) => {
    const id = cleanText(item?.id, 80);
    const title = cleanText(item?.title, 100);
    if (!id || !title) return [];
    return [{
      id,
      title,
      why: cleanText(item?.why || item?.kind, 240),
      how: cleanText(item?.how, 320),
      stopWhen: cleanText(item?.stopWhen || item?.caution, 240),
      evidenceIds: cleanStringList(item?.evidenceIds, 6, 96),
    }];
  });
}

function cleanContext(context) {
  return {
    babyName: cleanText(context?.babyName, 24),
    lifeStage: "cycle",
    cycleDay: Number.isInteger(context?.cycleDay) ? context.cycleDay : null,
    cycleAnchorConfirmed: context?.cycleAnchorConfirmed === true,
    needs: cleanStringList(context?.needs, 8, 80),
  };
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
  const context = cleanContext(body.context);
  const memory = cleanMemory(body.memory);
  const actionCandidates = cleanActionCandidates(body.actionCandidates);
  const blockedActionIds = cleanStringList(body.blockedActionIds, 12, 80).filter((id) => actionCandidates.some((item) => item.id === id));
  const evidence = selectEvidencePackets(await loadKnowledgeClaims(), message);
  const allowedEvidenceIds = evidence.map((item) => item.claimId);
  const system = `${systemPrompt}\n\n## 本轮产品上下文\n${JSON.stringify(context)}\n\n## 已确认的个人记忆（可为空）\n${memory.length ? JSON.stringify(memory) : "[]"}\n\n## 本轮可选行动白名单\n${actionCandidates.length ? JSON.stringify(actionCandidates) : "[]。没有白名单行动时，action 必须是 null。"}\n\n## 因本人负向结果被阻止的行动\n${JSON.stringify(blockedActionIds)}\n\n## 本轮专业资料包\n${evidence.length ? JSON.stringify(evidence) : "[]。没有资料时，不得凭模型记忆补充医学主张或来源。"}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: apiModel,
        temperature: 0.25,
        max_tokens: 1800,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "menstrual_baby_turn",
            description: "月经宝宝单轮联网回应与候选记录",
            strict: true,
            schema: AGENT_RESPONSE_SCHEMA,
          },
        },
        messages: [{ role: "system", content: system }, ...cleanHistory(body.history), { role: "user", content: message }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`Agent provider error: ${response.status}`);
      return json(res, 502, { error: "agent_provider_error" });
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      console.warn("Agent provider returned invalid JSON envelope");
      return json(res, 502, { error: "agent_invalid_json" });
    }
    const reply = payload?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.warn("Agent provider returned an empty reply");
      return json(res, 502, { error: "agent_empty_reply" });
    }
    let structured;
    try {
      structured = JSON.parse(reply);
    } catch {
      console.warn("Agent response was not valid structured JSON");
      return json(res, 502, { error: "agent_invalid_json" });
    }
    const validation = validateAgentResponse(structured, {
      evidenceIds: allowedEvidenceIds,
      actionIds: actionCandidates.map((item) => item.id),
      blockedActionIds,
    });
    if (!validation.ok) {
      console.warn(`Agent response failed schema validation: ${validation.errors.join(",")}`);
      return json(res, 502, { error: "agent_invalid_schema" });
    }
    const citedEvidence = evidence.filter((item) => structured.evidenceIds.includes(item.claimId) || structured.action?.evidenceIds?.includes(item.claimId));
    return json(res, 200, { ...structured, reply: structured.reply.trim(), model: apiModel, evidence: citedEvidence });
  } catch (error) {
    console.warn(`Agent request failed: ${error.name || "unknown"}`);
    return json(res, error.name === "AbortError" ? 504 : 503, { error: error.name === "AbortError" ? "agent_timeout" : "agent_unavailable" });
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
  console.log(`月经宝宝服务已启动：${port}；联网 Agent ${configured ? "已配置" : "尚未配置"}`);
});

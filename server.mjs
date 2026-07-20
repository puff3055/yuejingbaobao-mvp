import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { setDefaultResultOrder } from "node:dns";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { orchestrateAgentTurn, AgentPipelineError } from "./src/agentOrchestrator.js";
import { analyzeInput } from "./src/agent.js";
import { CARE_GIFTS } from "./src/data.js";
import { normalizeSourceUrl } from "./src/professionalSources.js";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const systemPrompt = readFileSync(fileURLToPath(new URL("./prompts/menstrual-baby-system-v3.md", import.meta.url)), "utf8");
const port = Number(process.env.PORT || 4173);
const apiBase = (process.env.AGENT_API_BASE_URL || "").replace(/\/$/, "");
const apiModel = process.env.AGENT_API_MODEL || "";
const apiKey = process.env.AGENT_API_KEY || "";
const searchEndpoint = process.env.AGENT_SEARCH_URL || (apiBase ? `${apiBase}/search` : "");
const configured = Boolean(apiBase && apiModel && apiKey);
let knowledgeCache = null;

// The production cluster has IPv4 egress but may still receive an IPv6 DNS
// answer first. Prefer IPv4 so an otherwise healthy Agent request is not
// reported as unavailable merely because that route cannot leave the cluster.
setDefaultResultOrder("ipv4first");

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
  const requested = new Set(Array.isArray(candidates) ? candidates.map((item) => cleanText(item?.id, 80)).filter(Boolean) : []);
  return CARE_GIFTS.filter((item) => requested.has(item.id)).slice(0, 12).map((item) => ({
    id: item.id,
    title: item.title,
    why: item.kind,
    how: item.how,
    stopWhen: item.caution,
    sources: item.sourceUrl && normalizeSourceUrl(item.sourceUrl) ? [{
      title: item.source,
      publisherOrAuthors: "",
      publishedAt: null,
      url: normalizeSourceUrl(item.sourceUrl),
    }] : [],
  }));
}

function cleanContext(context) {
  return {
    babyName: cleanText(context?.babyName, 24),
    lifeStage: "cycle",
    cycleDay: Number.isInteger(context?.cycleDay) ? context.cycleDay : null,
    cycleAnchorConfirmed: context?.cycleAnchorConfirmed === true,
    needs: cleanStringList(context?.needs, 8, 80),
    fastCompanionAllowed: context?.fastCompanionAllowed === true,
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
  if (analyzeInput(message).redFlag) return json(res, 422, { error: "safety_intercepted" });
  const context = cleanContext(body.context);
  const memory = cleanMemory(body.memory);
  const actionCandidates = cleanActionCandidates(body.actionCandidates);
  const blockedActionIds = cleanStringList(body.blockedActionIds, 12, 80).filter((id) => actionCandidates.some((item) => item.id === id));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const result = await orchestrateAgentTurn({
      apiBase,
      apiModel,
      apiKey,
      searchEndpoint,
      systemPrompt,
      message,
      history: cleanHistory(body.history),
      context,
      memories: memory,
      actionCandidates,
      blockedActionIds,
      knowledgeRecords: await loadKnowledgeClaims(),
      fetchImpl: fetch,
      signal: controller.signal,
    });
    return json(res, 200, { ...result, model: apiModel });
  } catch (error) {
    const code = error.name === "AbortError" ? "agent_timeout" : error instanceof AgentPipelineError ? error.code : "agent_unavailable";
    const stage = error instanceof AgentPipelineError && error.stage ? `:${error.stage}` : "";
    const validation = error instanceof AgentPipelineError && error.validationErrors.length
      ? `:${error.validationErrors.join(",")}`
      : "";
    console.warn(`Agent request failed: ${code}${stage}${validation}`);
    const status = code === "agent_provider_error" || code === "agent_invalid_json" || code === "agent_invalid_schema" || code === "agent_empty_reply" ? 502 : 503;
    return json(res, status, { error: code });
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

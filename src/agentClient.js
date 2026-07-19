import { getAgentErrorCopy, validateAgentResponse } from "./agentProtocol.js";

const DEFAULT_TIMEOUT_MS = 36000;

export class AgentRequestError extends Error {
  constructor(code, options = {}) {
    super(getAgentErrorCopy(code), options);
    this.name = "AgentRequestError";
    this.code = code;
  }
}

function cleanHistory(history) {
  return history.slice(-10).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = typeof item?.content === "string" ? item.content.trim() : "";
    return role && content ? [{ role, content }]: [];
  });
}

function cleanMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory.slice(0, 8).map((item) => ({
    id: item.id,
    rawText: item.rawText,
    tags: item.tags,
    actionId: item.actionId,
    actionTitle: item.actionTitle,
    effect: item.effect,
    functionalImpact: item.functionalImpact,
    differenceFromUsual: item.differenceFromUsual,
    currentConstraint: item.currentConstraint || item.taskDetail,
    cycleDay: item.cycleDay,
  }));
}

function responseShape(payload) {
  return {
    reply: payload?.reply,
    turnKind: payload?.turnKind,
    confirmedFactsCandidate: payload?.confirmedFactsCandidate,
    missingField: payload?.missingField,
    action: payload?.action,
    memoryDraft: payload?.memoryDraft,
    knowledgeCard: payload?.knowledgeCard,
    risk: payload?.risk,
    visualState: payload?.visualState,
  };
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    throw new AgentRequestError("agent_invalid_json");
  }
}

export async function fetchAgentStatus({ signal } = {}) {
  try {
    const response = await fetch("/api/agent/status", { headers: { Accept: "application/json" }, signal });
    const payload = await readPayload(response);
    return { configured: response.ok && payload?.configured === true };
  } catch (error) {
    if (error instanceof AgentRequestError) throw error;
    throw new AgentRequestError(error?.name === "AbortError" ? "agent_timeout" : "agent_unavailable", { cause: error });
  }
}

export async function requestAgentReply({
  message,
  history = [],
  context = {},
  memories = [],
  actionCandidates = [],
  blockedActionIds = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (context.allowRemote !== true) throw new AgentRequestError("agent_not_authorized");
  const cleanMessage = typeof message === "string" ? message.trim() : "";
  if (!cleanMessage) throw new AgentRequestError("message_required");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message: cleanMessage,
        history: cleanHistory(history),
        context,
        memory: cleanMemory(memories),
        actionCandidates,
        blockedActionIds,
      }),
      signal: controller.signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new AgentRequestError(typeof payload?.error === "string" ? payload.error : "agent_provider_error");

    const sourceUrls = [
      ...(payload?.knowledgeCard?.sources || []),
      ...(payload?.action?.sources || []),
    ].map((source) => source?.url).filter(Boolean);
    const validation = validateAgentResponse(responseShape(payload), {
      actionIds: actionCandidates.map((item) => item.id),
      blockedActionIds,
      sourceUrls,
    });
    if (!validation.ok) throw new AgentRequestError("agent_invalid_schema");
    return {
      ...responseShape(payload),
      reply: payload.reply.trim(),
      model: typeof payload.model === "string" ? payload.model : null,
    };
  } catch (error) {
    if (error instanceof AgentRequestError) throw error;
    throw new AgentRequestError(error?.name === "AbortError" ? "agent_timeout" : "agent_unavailable", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

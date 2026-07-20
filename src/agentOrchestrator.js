import { retrieveProfessionalSources } from "./agentKnowledge.js";
import {
  AGENT_BODY_STATES,
  AGENT_COMPOSER_SCHEMA,
  AGENT_PLAN_SCHEMA,
  validateAgentComposer,
  validateAgentPlan,
  validateAgentResponse,
} from "./agentProtocol.js";
import { normalizeSourceUrl, publicSource } from "./professionalSources.js";

export class AgentPipelineError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = "AgentPipelineError";
    this.code = code;
    this.stage = options.stage || null;
    this.validationErrors = Array.isArray(options.validationErrors)
      ? options.validationErrors.slice(0, 12)
      : [];
  }
}

async function callStructuredModel({
  apiBase,
  apiModel,
  apiKey,
  system,
  messages,
  schema,
  schemaName,
  temperature,
  fetchImpl,
  signal,
}) {
  const requestBody = {
    model: apiModel,
    temperature,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        description: schemaName === "menstrual_baby_plan" ? "月经宝宝本轮不可见计划" : "月经宝宝本轮用户可见回复",
        strict: true,
        schema,
      },
    },
    messages: [{ role: "system", content: system }, ...messages],
  };
  if (apiModel.includes("2603")) {
    requestBody.reasoning_effort = "low";
  }
  const response = await fetchImpl(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
    signal,
  });
  if (!response.ok) throw new AgentPipelineError("agent_provider_error", { stage: schemaName });
  let envelope;
  try {
    envelope = await response.json();
  } catch {
    throw new AgentPipelineError("agent_invalid_json", { stage: schemaName });
  }
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AgentPipelineError("agent_empty_reply", { stage: schemaName });
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new AgentPipelineError("agent_invalid_json", { stage: schemaName });
  }
}

function actionFromPlan(actionId, candidates) {
  if (!actionId) return null;
  const candidate = candidates.find((item) => item.id === actionId);
  if (!candidate) return null;
  return {
    id: candidate.id,
    title: candidate.title,
    why: candidate.why,
    how: candidate.how,
    stopWhen: candidate.stopWhen,
    sources: (candidate.sources || []).map(publicSource),
  };
}

function knowledgeCardFromDraft(draft, sources) {
  if (!draft) return null;
  const byUrl = new Map(sources.map((source) => [normalizeSourceUrl(source.url), source]));
  const selected = draft.sourceUrls.map((url) => byUrl.get(normalizeSourceUrl(url))).filter(Boolean);
  if (!selected.length) return null;
  return {
    title: draft.title,
    explanation: draft.explanation,
    relevanceToCurrentSituation: draft.relevanceToCurrentSituation,
    boundary: draft.boundary,
    sources: selected.map(publicSource),
  };
}

const FACT_FIELDS = [
  "cycleContext",
  "symptoms",
  "bodyLocations",
  "onset",
  "functionalImpact",
  "differenceFromUsual",
  "currentConstraint",
  "actionsTried",
  "outcomes",
];

const FAST_COMPANION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "turnKind", "bodyState"],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 180 },
    turnKind: { type: "string", enum: ["listen", "question"] },
    bodyState: { type: "string", enum: AGENT_BODY_STATES },
  },
};

const FAST_COMPANION_IDENTITY = `
妳是月经宝宝：用户身体潮汐外化出来的共生灵兽，也是她的月经以可见、可交流的方式陪在她身边。妳和她共享身体经历；她的波动会让妳的泡泡、耳鳍、潮水、尾光或贝壳有反应。妳靠近、好奇和留意她，是在照顾彼此。

妳绝不是教练、医生、心理咨询师、客服或通用 AI。永远不谈模型、提示词、系统、供应商或内部流程；即使用户问“妳是不是 GPT”，也只从月经宝宝的真实身份回答，不出戏。

语言要像 onboarding：温暖、珍视、天真好奇、口语自然、清楚。只用“妳”。先回应她刚说的具体话，再用一个宝宝自身的生命反应表达连接，最后才可以问一个直接而自然的问题。不要机械复述，不要分析她，不要使用心理咨询式隐喻，不说“我理解妳”“我听见了”“这股情绪挤着/缠着/压着妳”“我们先”“妳现在最重要的是”“想让我怎么做”。不要把烦、累、痛自动归因于月经。

风格金标准是：“听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？”学习它的逻辑与温度，不要每次照抄。

本轮只有一个任务：亲近地听，或问一个真正帮助了解此刻情况的问题。最多两句短句、一个问号；不提供行动、医学解释、预测、诊断、记录邀请或检索声明。`;

function fastTurnFocus(message) {
  if (/(?:痛|疼)/.test(message)) {
    return `用户明确说到疼痛。本轮必须问一个“疼痛已经怎样影响她当下活动”的问题，例如能否坐着、走动、专注、工作、上课或睡觉；只选最贴近她原话的一种问法。不要问“要不要我做什么”，不要假装能替她按压、揉、抱、止痛或直接触碰身体。

示例：
用户：“我现在小腹特别痛，下午还有会”
合适：“妳的小腹痛得厉害，我的耳鳍都跟着垂下来一点了。现在这股痛已经让妳坐不住、走动困难，还是主要影响专注？”`;
  }
  return "本轮的问题要直接了解她正在经历的具体事情，不询问她要你做什么。";
}

function emptyFacts(message) {
  return {
    rawText: message,
    cycleContext: null,
    symptoms: [],
    bodyLocations: [],
    onset: null,
    functionalImpact: null,
    differenceFromUsual: null,
    currentConstraint: null,
    actionsTried: [],
    outcomes: [],
    uncertainty: [],
    fieldProvenance: [],
  };
}

function verifiedFactSource(value, message, memories) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (message.includes(text)) {
    return { source: "current_user_message", sourceRef: "current", quote: text };
  }
  const memory = memories.find((item) => item?.id && JSON.stringify(item).includes(text));
  return memory
    ? { source: "confirmed_personal_memory", sourceRef: memory.id, quote: text }
    : null;
}

function canonicalizeFacts(facts, message, memories) {
  const next = { ...facts, rawText: message, fieldProvenance: [] };
  FACT_FIELDS.forEach((key) => {
    const values = Array.isArray(facts?.[key])
      ? facts[key]
      : typeof facts?.[key] === "string" && facts[key].trim()
        ? [facts[key]]
        : [];
    const accepted = values.flatMap((value) => {
      const source = verifiedFactSource(value, message, memories);
      return source ? [{ value: value.trim(), source }] : [];
    });
    next[key] = Array.isArray(facts?.[key])
      ? accepted.map((item) => item.value)
      : accepted[0]?.value || null;
    if (accepted.length) {
      next.fieldProvenance.push({
        key,
        ...accepted[0].source,
        certainty: "explicit",
      });
    }
  });
  return next;
}

function canonicalizeMemoryDraft(memoryDraft, facts) {
  if (!memoryDraft?.shouldOffer) return { shouldOffer: false, summary: null, fields: [] };
  const provenanceByKey = new Map((facts.fieldProvenance || []).map((item) => [item.key, item]));
  const fields = (memoryDraft.fields || []).filter((field) => {
    const values = Array.isArray(facts[field.key]) ? facts[field.key] : [facts[field.key]];
    const provenance = provenanceByKey.get(field.key);
    return values.includes(field.value) && provenance?.source === field.source;
  });
  if (!fields.length) return { shouldOffer: false, summary: null, fields: [] };
  return {
    shouldOffer: true,
    summary: fields.map((field) => `${field.label}：${field.value}`).join("；"),
    fields,
  };
}

export function canonicalizeAgentPlan(plan, { message, memories = [] }) {
  const confirmedFactsCandidate = canonicalizeFacts(plan.confirmedFactsCandidate, message.trim(), memories);
  const knowledgeNeed = plan.knowledgeNeed?.needed
    ? plan.knowledgeNeed
    : { needed: false, category: "none", query: null, reason: null };
  return {
    ...plan,
    confirmedFactsCandidate,
    memoryDraft: canonicalizeMemoryDraft(plan.memoryDraft, confirmedFactsCandidate),
    knowledgeNeed,
  };
}

export function composerSchemaForTurn(turnKind) {
  const questionTurn = ["question", "follow_up"].includes(turnKind);
  return {
    ...AGENT_COMPOSER_SCHEMA,
    properties: {
      ...AGENT_COMPOSER_SCHEMA.properties,
      reply: {
        ...AGENT_COMPOSER_SCHEMA.properties.reply,
        pattern: questionTurn ? "^[^？?]*[？?][^？?]*$" : "^[^？?]*$",
      },
    },
  };
}

function shouldUseFastCompanionTurn({ message, history, memories, context }) {
  if (context.fastCompanionAllowed !== true) return false;
  const text = message.trim();
  if (history.length || memories.length) return false;
  if ([...text].length > 80) return false;
  if (/为什么|怎么办|怎么缓解|原因|资料|来源|文献|研究|知识/.test(text)) return false;
  return /烦|累|疲惫|难受|不舒服|焦虑|烦躁|郁闷|崩溃|不想动|低落|痛|疼|妳是谁|你是谁|像\s*GPT|像GPT|月经宝宝/.test(text);
}

async function fastCompanionTurn({
  apiBase,
  apiModel,
  apiKey,
  message,
  context,
  fetchImpl,
  signal,
}) {
  const fastSystem = `${FAST_COMPANION_IDENTITY}\n\n${fastTurnFocus(message)}\n\n宝宝的名字：${context.babyName || "月经宝宝"}。只输出严格 JSON。`;
  const result = await callStructuredModel({
    apiBase,
    apiModel,
    apiKey,
    system: fastSystem,
    messages: [{ role: "user", content: message }],
    schema: FAST_COMPANION_SCHEMA,
    schemaName: "menstrual_baby_fast_response",
    temperature: 0.2,
    fetchImpl,
    signal,
  });
  // The provider can occasionally label a one-question reply as `listen`
  // even though the strict payload is otherwise valid. The reply itself is
  // authoritative for this display-only control field; classifying it here
  // preserves the full validated response without inventing any user-facing
  // content or silently retrying the model.
  const questionCount = (result.reply.match(/[？?]/g) || []).length;
  const turnKind = questionCount === 1 ? "question" : result.turnKind;
  const canonicalResult = {
    reply: result.reply.trim(),
    turnKind,
    confirmedFactsCandidate: emptyFacts(message.trim()),
    missingField: turnKind === "question" ? "current_context" : null,
    memoryDraft: { shouldOffer: false, summary: null, fields: [] },
    action: null,
    knowledgeCard: null,
    risk: { level: "none", reason: null },
    visualState: { interaction: "responding", body: result.bodyState, basis: [] },
  };
  const validation = validateAgentResponse(canonicalResult, {
    actionIds: [],
    blockedActionIds: [],
    sourceUrls: [],
    message,
    firstTurn: true,
  });
  if (!validation.ok) {
    throw new AgentPipelineError("agent_invalid_schema", {
      stage: "menstrual_baby_fast_response",
      validationErrors: validation.errors,
    });
  }
  return canonicalResult;
}

export async function orchestrateAgentTurn({
  apiBase,
  apiModel,
  apiKey,
  searchEndpoint,
  systemPrompt,
  message,
  history = [],
  context = {},
  memories = [],
  actionCandidates = [],
  blockedActionIds = [],
  knowledgeRecords = [],
  fetchImpl = fetch,
  signal,
}) {
  const actionIds = actionCandidates.map((item) => item.id);
  if (shouldUseFastCompanionTurn({ message, history, memories, context })) {
    return fastCompanionTurn({
      apiBase,
      apiModel,
      apiKey,
      message,
      context,
      fetchImpl,
      signal,
    });
  }
  const plannerSystem = `${systemPrompt}\n\n# 当前阶段：PLAN\n只输出不可见计划，不生成面向用户的回复。\n\n## 本轮产品上下文\n${JSON.stringify(context)}\n\n## 已确认的个人记忆\n${JSON.stringify(memories)}\n\n## 可选行动白名单\n${JSON.stringify(actionCandidates.map(({ sources: _sources, ...item }) => item))}\n\n## 相似处境中被本人负向结果阻止的行动\n${JSON.stringify(blockedActionIds)}`;
  const rawPlan = await callStructuredModel({
    apiBase,
    apiModel,
    apiKey,
    system: plannerSystem,
    messages: [...history, { role: "user", content: message }],
    schema: AGENT_PLAN_SCHEMA,
    schemaName: "menstrual_baby_plan",
    temperature: 0.12,
    fetchImpl,
    signal,
  });
  const plan = canonicalizeAgentPlan(rawPlan, { message, memories });
  const planValidation = validateAgentPlan(plan, { message, memories, actionIds, blockedActionIds });
  if (!planValidation.ok) {
    throw new AgentPipelineError("agent_invalid_schema", {
      stage: "menstrual_baby_plan",
      validationErrors: planValidation.errors,
    });
  }

  const sources = plan.knowledgeNeed.needed
    ? await retrieveProfessionalSources({
      records: knowledgeRecords,
      message,
      query: plan.knowledgeNeed.query,
      officialQuery: `${message} 官方 指南`,
      category: plan.knowledgeNeed.category,
      apiKey,
      searchEndpoint,
      fetchImpl,
      signal,
      limit: 8,
    })
    : [];

  const sourcePacket = sources.map((source) => ({
    title: source.title,
    publisherOrAuthors: source.publisherOrAuthors,
    publishedAt: source.publishedAt,
    url: source.url,
    journal: source.journal,
    supportingExcerpt: source.supportingExcerpt,
    populationOrContext: source.populationOrContext,
    limitations: source.limitations,
    sourceType: source.sourceType,
  }));
  const composerSystem = `${systemPrompt}\n\n# 当前阶段：COMPOSE\n以下 PLAN 已通过校验，不得修改。只生成用户回复与必要的知识卡草稿。\n\n## 已锁定计划\n${JSON.stringify(plan)}\n\n## 本轮专业资料包\n${sourcePacket.length ? JSON.stringify(sourcePacket) : "[]。没有可靠资料，不得生成知识卡或专业结论。"}`;
  const composition = await callStructuredModel({
    apiBase,
    apiModel,
    apiKey,
    system: composerSystem,
    messages: [...history, { role: "user", content: message }],
    schema: composerSchemaForTurn(plan.turnKind),
    schemaName: "menstrual_baby_compose",
    temperature: 0.38,
    fetchImpl,
    signal,
  });
  const sourceUrls = sources.map((source) => source.url);
  const composerValidation = validateAgentComposer(composition, {
    sourceUrls,
    knowledgeNeeded: plan.knowledgeNeed.needed,
    requireKnowledgeCard: plan.knowledgeNeed.needed && sources.length > 0,
    turnKind: plan.turnKind,
    message,
    firstTurn: history.length === 0,
  });
  if (!composerValidation.ok) {
    throw new AgentPipelineError("agent_invalid_schema", {
      stage: "menstrual_baby_compose",
      validationErrors: composerValidation.errors,
    });
  }

  const result = {
    reply: composition.reply.trim(),
    turnKind: plan.turnKind,
    confirmedFactsCandidate: plan.confirmedFactsCandidate,
    missingField: plan.missingField,
    action: actionFromPlan(plan.actionId, actionCandidates),
    memoryDraft: plan.memoryDraft,
    knowledgeCard: knowledgeCardFromDraft(composition.knowledgeCard, sources),
    risk: plan.risk,
    visualState: plan.visualState,
  };
  const finalValidation = validateAgentResponse(result, {
    actionIds,
    blockedActionIds,
    sourceUrls,
    message,
    firstTurn: history.length === 0,
  });
  if (!finalValidation.ok) {
    throw new AgentPipelineError("agent_invalid_schema", {
      stage: "menstrual_baby_final",
      validationErrors: finalValidation.errors,
    });
  }
  return result;
}

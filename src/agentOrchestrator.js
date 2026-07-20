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
  maxTokens,
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
  if (Number.isInteger(maxTokens) && maxTokens > 0) {
    requestBody.max_tokens = maxTokens;
  }
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

const CORE_COMPANION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "turnKind", "bodyState", "actionId", "facts"],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 320 },
    turnKind: { type: "string", enum: ["listen", "question", "action", "follow_up"] },
    bodyState: { type: "string", enum: AGENT_BODY_STATES },
    actionId: { type: ["string", "null"] },
    facts: {
      type: "object",
      additionalProperties: false,
      required: ["symptoms", "bodyLocations", "functionalImpact", "currentConstraint"],
      properties: {
        symptoms: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
        bodyLocations: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
        functionalImpact: { type: ["string", "null"], maxLength: 180 },
        currentConstraint: { type: ["string", "null"], maxLength: 180 },
      },
    },
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

const BODY_LOCATION_PATTERN = /小腹|下腹|腹部|肚子|盆腔|外阴|阴道|乳房|胸部|胸|头部|头|太阳穴|颈部|脖子|肩部|肩|腰部|腰|背部|背|臀部|臀|大腿|小腿|腿|膝盖|脚|全身/g;
const BODY_LOCATION_VALUE_PATTERN = /小腹|下腹|腹部|肚子|盆腔|外阴|阴道|乳房|胸部|胸|头部|头|太阳穴|颈部|脖子|肩部|肩|腰部|腰|背部|背|臀部|臀|大腿|小腿|腿|膝盖|脚|全身/;
const SYMPTOM_PATTERN = /痛经|腹痛|头痛|腰痛|背痛|乳房胀痛|胀痛|坠痛|坠胀|痉挛|剧痛|特别痛|很痛|疼痛|头晕|恶心|呕吐|腹泻|乏力|疲乏|出冷汗|便秘|水肿|腹胀|发热|发烧|异常出血|大量出血|漏血|烦躁|焦虑|低落|失眠|睡不好/g;
const SYMPTOM_VALUE_PATTERN = /痛经|腹痛|头痛|腰痛|背痛|乳房胀痛|胀痛|坠痛|坠胀|痉挛|剧痛|特别痛|很痛|疼痛|头晕|恶心|呕吐|腹泻|乏力|疲乏|出冷汗|便秘|水肿|腹胀|发热|发烧|异常出血|大量出血|漏血|烦躁|焦虑|低落|失眠|睡不好/;
const FUNCTIONAL_IMPACT_PATTERN = /坐不住|站不住|走不动|难(?:以)?专注|很难专注|无法专注|没法专注|注意力不集中|不能集中|无法集中|没法集中|不能(?:工作|上课|睡觉|走路|坐着|活动)|影响(?:工作|上课|睡眠|走路|活动|专注)/;
const CONSTRAINT_PATTERN = /(?:今天|明天|上午|下午|晚上|今晚|明早)?[^，。！？]{0,5}(?:有会|开会|会议|汇报|上班|工作|考试|答辩|出差|旅行|高铁)/;

function exactMatches(message, pattern) {
  return [...new Set(message.match(pattern) || [])];
}

function normalizeExactFacts(message, supplied = {}) {
  const text = message.trim();
  const suppliedLocations = Array.isArray(supplied.bodyLocations) ? supplied.bodyLocations : [];
  const suppliedSymptoms = Array.isArray(supplied.symptoms) ? supplied.symptoms : [];
  const explicitConstraint = text.match(CONSTRAINT_PATTERN)?.[0]?.trim() || null;
  const suppliedConstraint = typeof supplied.currentConstraint === "string"
    && CONSTRAINT_PATTERN.test(supplied.currentConstraint)
    ? supplied.currentConstraint.trim()
    : null;
  const functionalImpact = FUNCTIONAL_IMPACT_PATTERN.test(text)
    ? text
    : typeof supplied.functionalImpact === "string"
      && FUNCTIONAL_IMPACT_PATTERN.test(supplied.functionalImpact)
      ? supplied.functionalImpact.trim()
      : null;
  return {
    ...emptyFacts(text),
    ...supplied,
    bodyLocations: [...new Set([
      ...exactMatches(text, BODY_LOCATION_PATTERN),
      ...suppliedLocations.filter((value) => BODY_LOCATION_VALUE_PATTERN.test(value)),
    ])].slice(0, 4),
    symptoms: [...new Set([
      ...exactMatches(text, SYMPTOM_PATTERN),
      ...suppliedSymptoms.filter((value) => SYMPTOM_VALUE_PATTERN.test(value)),
    ])].slice(0, 4),
    functionalImpact,
    currentConstraint: explicitConstraint || suppliedConstraint,
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

function shouldUseCoreCompanionTurn({ message, history }) {
  if (!history.length) return false;
  const text = message.trim();
  if ([...text].length > 320) return false;
  return !/为什么|什么原因|怎么办|怎么缓解|资料|来源|文献|研究|知识|指南|论文/.test(text);
}

async function coreCompanionTurn({
  apiBase,
  apiModel,
  apiKey,
  message,
  history,
  context,
  memories,
  actionCandidates,
  blockedActionIds,
  fetchImpl,
  signal,
}) {
  const allowedActions = actionCandidates.filter((item) => !blockedActionIds.includes(item.id));
  const actionPacket = allowedActions.map((item) => ({ id: item.id, title: item.title, useWhen: item.why }));
  const coreSystem = `${FAST_COMPANION_IDENTITY}

# 当前任务
延续刚才的真实对话。妳可以亲近地回应、问一个会改变下一步的问题，或在信息已经足够时选择一个可选照护行动。不要重新采访已经回答过的内容。

- 如果上一轮刚问了一个关键问题，而用户已经明确回答，并且下面有合适行动，优先进入 action；action 回复不再提问。
- question / follow_up 必须只有一个问号；listen / action 不得有问号。
- actionId 只能从可选行动中选择；不用行动时必须为 null。被本人确认无效的行动已从列表移除，绝不能补回。
- facts 只能逐字摘取用户这一条消息中明确说出的内容；没有就用 null 或空数组，绝不推断。
- 不诊断、不预测、不提供个体用药剂量，不假装能触碰或直接感觉她的身体。

# 共生宝宝表达约束
每一轮都必须仍像同一只月经宝宝在说话：先用泡泡、耳鳍、潮水、尾光或贝壳中的一个微小反应靠近妳，再完成本轮唯一任务。不要突然变成说明书、教练或通用助手。

如果用户刚回答“已经痛得坐不住，也很难专注”，且本轮有适合的行动，action 回复可以像：
“我的耳鳍都垂下来啦。刚才妳说下午还有会，我想把一份能在会前试试的小准备放到妳手边。”
只学习这种自然、共生、简短的气质，不得照抄用户没有提供的事实。

绝对不要出现这些字面表达：“我理解妳”“我听见了”“我们先”“妳现在最重要的是”“想让我怎么做”“AI”“GPT”“Agent”“教练”“疗愈师”“心理咨询师”。

宝宝的名字：${context.babyName || "月经宝宝"}
已确认的个人经验：${JSON.stringify(memories)}
本轮可选行动：${JSON.stringify(actionPacket)}
只输出严格 JSON。`;
  const payload = await callStructuredModel({
    apiBase,
    apiModel,
    apiKey,
    system: coreSystem,
    messages: [...history, { role: "user", content: message }],
    schema: CORE_COMPANION_SCHEMA,
    schemaName: "menstrual_baby_core_response",
    temperature: 0,
    maxTokens: 1600,
    fetchImpl,
    signal,
  });
  const questionCount = (payload.reply.match(/[？?]/g) || []).length;
  if (questionCount > 1
    || (["question", "follow_up"].includes(payload.turnKind) && questionCount !== 1)
    || (["listen", "action"].includes(payload.turnKind) && questionCount !== 0)
    || (payload.turnKind === "action" && !payload.actionId)
    || (payload.turnKind !== "action" && payload.actionId !== null)
    || (payload.actionId && !allowedActions.some((item) => item.id === payload.actionId))) {
    throw new AgentPipelineError("agent_invalid_schema", {
      stage: "menstrual_baby_core_response",
      validationErrors: ["core_turn_contract"],
    });
  }
  const rawFacts = normalizeExactFacts(message, payload.facts);
  const confirmedFactsCandidate = canonicalizeFacts(rawFacts, message.trim(), memories);
  const action = actionFromPlan(payload.actionId, allowedActions);
  const result = {
    reply: payload.reply.trim(),
    turnKind: payload.turnKind,
    confirmedFactsCandidate,
    missingField: ["question", "follow_up"].includes(payload.turnKind) ? "current_context" : null,
    action,
    memoryDraft: { shouldOffer: false, summary: null, fields: [] },
    knowledgeCard: null,
    risk: { level: "none", reason: null },
    visualState: { interaction: "responding", body: payload.bodyState, basis: [] },
  };
  const sourceUrls = action?.sources?.map((source) => source.url) || [];
  const validation = validateAgentResponse(result, {
    actionIds: actionCandidates.map((item) => item.id),
    blockedActionIds,
    sourceUrls,
    message,
    memories,
  });
  if (!validation.ok) {
    throw new AgentPipelineError("agent_invalid_schema", {
      stage: "menstrual_baby_core_response",
      validationErrors: validation.errors,
    });
  }
  return result;
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
    maxTokens: 640,
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
    confirmedFactsCandidate: canonicalizeFacts(normalizeExactFacts(message), message.trim(), []),
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
  if (shouldUseCoreCompanionTurn({ message, history })) {
    return coreCompanionTurn({
      apiBase,
      apiModel,
      apiKey,
      message,
      history,
      context,
      memories,
      actionCandidates,
      blockedActionIds,
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
    maxTokens: 1400,
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
    maxTokens: 800,
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

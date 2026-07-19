import { normalizeSourceUrl } from "./professionalSources.js";

export const AGENT_TURN_KINDS = ["listen", "question", "answer", "action", "follow_up"];
export const AGENT_VISUAL_STATES = ["idle", "listening", "thinking", "retrieving", "responding", "remembering", "offline", "safety"];
export const AGENT_BODY_STATES = ["calm", "rising_tide", "pain", "low_energy", "unsettled"];
export const KNOWLEDGE_CATEGORIES = ["none", "mechanism", "action_effectiveness", "safety", "population", "basic"];

export const AGENT_ERROR_COPY = {
  agent_not_authorized: "需要妳同意将这条消息发送给联网服务。消息还留在输入框里，没有发送。",
  agent_not_configured: "月经宝宝暂时还不能联网。这条消息没有发送，也没有生成回复。",
  agent_timeout: "这次连接超时了。妳的消息还在，本轮没有生成或保存任何内容。",
  agent_empty_reply: "联网服务没有返回可用内容。本轮没有生成或保存任何内容。",
  agent_invalid_json: "返回内容未通过格式检查。本轮没有显示或保存。",
  agent_invalid_schema: "返回内容未通过安全检查。本轮没有显示或保存。",
  agent_provider_error: "联网服务暂时不可用。本轮没有生成或保存任何内容。",
  agent_unavailable: "联网服务暂时不可用。本轮没有生成或保存任何内容。",
  safety_intercepted: "这条消息触发了产品安全提示，没有发送给联网服务。",
  message_required: "请先写下一句话，再发送给月经宝宝。",
  invalid_request: "这条消息没有通过发送检查，请修改后再试。",
};

const NULLABLE_STRING = { type: ["string", "null"] };
const STRING_ARRAY = { type: "array", items: { type: "string" }, maxItems: 12 };
const FACT_KEYS = ["cycleContext", "symptoms", "bodyLocations", "onset", "functionalImpact", "differenceFromUsual", "currentConstraint", "actionsTried", "outcomes"];

const FACTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rawText", ...FACT_KEYS, "uncertainty", "fieldProvenance"],
  properties: {
    rawText: { type: "string", maxLength: 2400 },
    cycleContext: NULLABLE_STRING,
    symptoms: STRING_ARRAY,
    bodyLocations: STRING_ARRAY,
    onset: NULLABLE_STRING,
    functionalImpact: NULLABLE_STRING,
    differenceFromUsual: NULLABLE_STRING,
    currentConstraint: NULLABLE_STRING,
    actionsTried: STRING_ARRAY,
    outcomes: STRING_ARRAY,
    uncertainty: STRING_ARRAY,
    fieldProvenance: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "source", "sourceRef", "quote", "certainty"],
        properties: {
          key: { type: "string", enum: FACT_KEYS },
          source: { type: "string", enum: ["current_user_message", "confirmed_personal_memory", "confirmed_page_record"] },
          sourceRef: { type: "string", minLength: 1, maxLength: 96 },
          quote: { type: "string", minLength: 1, maxLength: 320 },
          certainty: { type: "string", enum: ["explicit", "uncertain"] },
        },
      },
    },
  },
};

const MEMORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shouldOffer", "summary", "fields"],
  properties: {
    shouldOffer: { type: "boolean" },
    summary: NULLABLE_STRING,
    fields: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "value", "source", "certainty"],
        properties: {
          key: { type: "string", minLength: 1, maxLength: 80 },
          label: { type: "string", minLength: 1, maxLength: 80 },
          value: { type: "string", maxLength: 320 },
          source: { type: "string", enum: ["current_user_message", "confirmed_personal_memory", "confirmed_page_record"] },
          certainty: { type: "string", enum: ["explicit", "uncertain"] },
        },
      },
    },
  },
};

const RISK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["level", "reason"],
  properties: {
    level: { type: "string", enum: ["none", "attention", "urgent"] },
    reason: NULLABLE_STRING,
  },
};

const VISUAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["interaction", "body", "basis"],
  properties: {
    interaction: { type: "string", enum: ["responding", "retrieving", "safety", "idle"] },
    body: { type: "string", enum: AGENT_BODY_STATES },
    basis: STRING_ARRAY,
  },
};

const PUBLIC_SOURCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "publisherOrAuthors", "publishedAt", "url"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 600 },
    publisherOrAuthors: { type: "string", maxLength: 480 },
    publishedAt: NULLABLE_STRING,
    url: { type: "string", minLength: 8, maxLength: 1600 },
  },
};

export const AGENT_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["turnKind", "confirmedFactsCandidate", "missingField", "actionId", "memoryDraft", "knowledgeNeed", "risk", "visualState"],
  properties: {
    turnKind: { type: "string", enum: AGENT_TURN_KINDS },
    confirmedFactsCandidate: FACTS_SCHEMA,
    missingField: NULLABLE_STRING,
    actionId: NULLABLE_STRING,
    memoryDraft: MEMORY_SCHEMA,
    knowledgeNeed: {
      type: "object",
      additionalProperties: false,
      required: ["needed", "category", "query", "reason"],
      properties: {
        needed: { type: "boolean" },
        category: { type: "string", enum: KNOWLEDGE_CATEGORIES },
        query: NULLABLE_STRING,
        reason: NULLABLE_STRING,
      },
    },
    risk: RISK_SCHEMA,
    visualState: VISUAL_SCHEMA,
  },
};

export const AGENT_COMPOSER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "knowledgeCard"],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 600 },
    knowledgeCard: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "explanation", "relevanceToCurrentSituation", "boundary", "sourceUrls"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 140 },
            explanation: { type: "string", minLength: 1, maxLength: 900 },
            relevanceToCurrentSituation: { type: "string", minLength: 1, maxLength: 520 },
            boundary: NULLABLE_STRING,
            sourceUrls: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 8, maxLength: 1600 } },
          },
        },
      ],
    },
  },
};

export const AGENT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "turnKind", "confirmedFactsCandidate", "missingField", "action", "memoryDraft", "knowledgeCard", "risk", "visualState"],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 600 },
    turnKind: { type: "string", enum: AGENT_TURN_KINDS },
    confirmedFactsCandidate: FACTS_SCHEMA,
    missingField: NULLABLE_STRING,
    action: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "why", "how", "stopWhen", "sources"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            title: { type: "string", minLength: 1, maxLength: 100 },
            why: { type: "string", minLength: 1, maxLength: 240 },
            how: { type: "string", minLength: 1, maxLength: 320 },
            stopWhen: { type: "string", minLength: 1, maxLength: 240 },
            sources: { type: "array", maxItems: 4, items: PUBLIC_SOURCE_SCHEMA },
          },
        },
      ],
    },
    memoryDraft: MEMORY_SCHEMA,
    knowledgeCard: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "explanation", "relevanceToCurrentSituation", "boundary", "sources"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 140 },
            explanation: { type: "string", minLength: 1, maxLength: 900 },
            relevanceToCurrentSituation: { type: "string", minLength: 1, maxLength: 520 },
            boundary: NULLABLE_STRING,
            sources: { type: "array", minItems: 1, maxItems: 4, items: PUBLIC_SOURCE_SCHEMA },
          },
        },
      ],
    },
    risk: RISK_SCHEMA,
    visualState: VISUAL_SCHEMA,
  },
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isStringArray(value, max = 12) {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string");
}

function hasOnlyKeys(value, keys) {
  return isObject(value) && Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key));
}

function hasFactValue(facts, key) {
  const value = facts[key];
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
}

function validateFacts(facts, errors, { message = null, memories = [] } = {}) {
  const factKeys = ["rawText", ...FACT_KEYS, "uncertainty", "fieldProvenance"];
  if (!hasOnlyKeys(facts, factKeys)) {
    errors.push("facts_shape");
    return;
  }
  if (typeof facts.rawText !== "string" || facts.rawText.length > 2400) errors.push("facts_rawText");
  if (typeof message === "string" && facts.rawText.trim() !== message.trim()) errors.push("facts_rawText_mismatch");
  ["cycleContext", "onset", "functionalImpact", "differenceFromUsual", "currentConstraint"].forEach((key) => {
    if (!isNullableString(facts[key])) errors.push(`facts_${key}`);
  });
  ["symptoms", "bodyLocations", "actionsTried", "outcomes", "uncertainty"].forEach((key) => {
    if (!isStringArray(facts[key])) errors.push(`facts_${key}`);
  });
  if (!Array.isArray(facts.fieldProvenance) || facts.fieldProvenance.length > 20) {
    errors.push("facts_provenance");
    return;
  }
  const memoryById = new Map(memories.map((item) => [item.id, JSON.stringify(item)]));
  facts.fieldProvenance.forEach((item) => {
    if (!hasOnlyKeys(item, ["key", "source", "sourceRef", "quote", "certainty"])) return errors.push("facts_provenance_shape");
    if (!FACT_KEYS.includes(item.key) || !["current_user_message", "confirmed_personal_memory", "confirmed_page_record"].includes(item.source) || !["explicit", "uncertain"].includes(item.certainty)) errors.push("facts_provenance_value");
    if (typeof item.quote !== "string" || !item.quote.trim() || typeof item.sourceRef !== "string" || !item.sourceRef.trim()) errors.push("facts_provenance_value");
    if (item.source === "current_user_message" && (item.sourceRef !== "current" || (typeof message === "string" && !message.includes(item.quote)))) errors.push("facts_provenance_unverified");
    if (item.source === "confirmed_personal_memory" && (!memoryById.has(item.sourceRef) || !memoryById.get(item.sourceRef).includes(item.quote))) errors.push("facts_provenance_unverified");
  });
  FACT_KEYS.filter((key) => hasFactValue(facts, key)).forEach((key) => {
    if (!facts.fieldProvenance.some((item) => item.key === key)) errors.push(`facts_missing_provenance_${key}`);
  });
}

function validateMemory(memory, errors) {
  if (!hasOnlyKeys(memory, ["shouldOffer", "summary", "fields"])) return errors.push("memory_shape");
  if (typeof memory.shouldOffer !== "boolean" || !isNullableString(memory.summary) || !Array.isArray(memory.fields) || memory.fields.length > 12) return errors.push("memory_fields");
  memory.fields.forEach((field) => {
    if (!hasOnlyKeys(field, ["key", "label", "value", "source", "certainty"])) errors.push("memory_field_shape");
    else if (typeof field.key !== "string" || typeof field.label !== "string" || typeof field.value !== "string" || !["current_user_message", "confirmed_personal_memory", "confirmed_page_record"].includes(field.source) || !["explicit", "uncertain"].includes(field.certainty)) errors.push("memory_field_value");
  });
}

function validateRiskAndVisual(value, errors) {
  if (!hasOnlyKeys(value.risk, ["level", "reason"]) || !["none", "attention", "urgent"].includes(value.risk?.level) || !isNullableString(value.risk?.reason)) errors.push("risk");
  if (!hasOnlyKeys(value.visualState, ["interaction", "body", "basis"]) || !["responding", "retrieving", "safety", "idle"].includes(value.visualState?.interaction) || !AGENT_BODY_STATES.includes(value.visualState?.body) || !isStringArray(value.visualState?.basis)) errors.push("visualState");
}

function validatePublicSource(source, errors) {
  if (!hasOnlyKeys(source, ["title", "publisherOrAuthors", "publishedAt", "url"])) return errors.push("source_shape");
  if (typeof source.title !== "string" || !source.title.trim() || typeof source.publisherOrAuthors !== "string" || !isNullableString(source.publishedAt) || !normalizeSourceUrl(source.url)) errors.push("source_value");
}

export function countQuestions(value = "") {
  return (String(value).match(/[？?]/g) || []).length;
}

const OUT_OF_CHARACTER_PATTERNS = [
  /(?:我是|作为)(?:一个)?(?:AI|人工智能|模型|助手|Agent)/i,
  /(?:AI|GPT|Agent|语言模型|系统提示|提示词|供应商|内部流程|Life\s*Coach|教练|疗愈师|心理咨询师|客服)/i,
  /(?:我理解妳|我听见了|妳现在最重要的是|我们先|现在想让我怎么做|想让我怎么做)/,
  /这股[^。！？!?]{0,30}(?:挤着|缠着|压着)妳/,
];

function validatePersonaReply(reply, errors, { message = "", firstTurn = false } = {}) {
  if (OUT_OF_CHARACTER_PATTERNS.some((pattern) => pattern.test(reply))) errors.push("reply_out_of_character");
  if (reply.includes("你")) errors.push("reply_wrong_second_person");
  if (firstTurn && [...reply].length > 120) errors.push("first_turn_too_long");
  if (/^(?:我)?(?:好|很|特别)?(?:烦|累|疲惫|难受|不舒服)[。！!？?]*$/.test(message.trim())) {
    if (!/(?:泡泡|耳鳍|潮水|尾光|贝壳|靠近|贴着)/.test(reply)) errors.push("vague_distress_missing_shared_body_connection");
    if (countQuestions(reply) !== 1) errors.push("vague_distress_requires_one_curious_question");
  }
}

export function validateAgentPlan(value, { message = "", memories = [], actionIds = [], blockedActionIds = [] } = {}) {
  const errors = [];
  const keys = ["turnKind", "confirmedFactsCandidate", "missingField", "actionId", "memoryDraft", "knowledgeNeed", "risk", "visualState"];
  if (!hasOnlyKeys(value, keys)) return { ok: false, errors: ["root_shape"] };
  if (!AGENT_TURN_KINDS.includes(value.turnKind)) errors.push("turnKind");
  validateFacts(value.confirmedFactsCandidate, errors, { message, memories });
  if (!isNullableString(value.missingField)) errors.push("missingField");
  if (!isNullableString(value.actionId)) errors.push("actionId");
  if (value.actionId && actionIds.length && !actionIds.includes(value.actionId)) errors.push("action_not_allowed");
  if (value.actionId && blockedActionIds.includes(value.actionId)) errors.push("action_blocked_by_personal_outcome");
  if (value.turnKind === "action" && !value.actionId) errors.push("action_turn_requires_action");
  if (value.turnKind !== "action" && value.actionId !== null) errors.push("action_wrong_turn");
  validateMemory(value.memoryDraft, errors);
  if (!hasOnlyKeys(value.knowledgeNeed, ["needed", "category", "query", "reason"])) errors.push("knowledge_need_shape");
  else {
    if (typeof value.knowledgeNeed.needed !== "boolean" || !KNOWLEDGE_CATEGORIES.includes(value.knowledgeNeed.category) || !isNullableString(value.knowledgeNeed.query) || !isNullableString(value.knowledgeNeed.reason)) errors.push("knowledge_need_value");
    if (value.knowledgeNeed.needed && (!value.knowledgeNeed.query?.trim() || value.knowledgeNeed.category === "none")) errors.push("knowledge_query_required");
    if (!value.knowledgeNeed.needed && (value.knowledgeNeed.query !== null || value.knowledgeNeed.category !== "none")) errors.push("knowledge_query_wrong_state");
    if (value.knowledgeNeed.needed && value.turnKind !== "answer") errors.push("knowledge_wrong_turn");
  }
  validateRiskAndVisual(value, errors);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateAgentComposer(value, {
  sourceUrls = [],
  knowledgeNeeded = false,
  requireKnowledgeCard = false,
  turnKind = null,
  message = "",
  firstTurn = false,
} = {}) {
  const errors = [];
  if (!hasOnlyKeys(value, ["reply", "knowledgeCard"])) return { ok: false, errors: ["root_shape"] };
  if (typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 600) errors.push("reply");
  const questionCount = countQuestions(value.reply);
  if (questionCount > 1) errors.push("too_many_questions");
  if (["question", "follow_up"].includes(turnKind) && questionCount !== 1) errors.push("turn_requires_one_question");
  if (["listen", "answer", "action"].includes(turnKind) && questionCount !== 0) errors.push("turn_must_not_ask_question");
  validatePersonaReply(value.reply, errors, { message, firstTurn });
  if (value.knowledgeCard !== null) {
    const card = value.knowledgeCard;
    if (!hasOnlyKeys(card, ["title", "explanation", "relevanceToCurrentSituation", "boundary", "sourceUrls"])) errors.push("knowledge_card_shape");
    else {
      if (![card.title, card.explanation, card.relevanceToCurrentSituation].every((item) => typeof item === "string" && item.trim()) || !isNullableString(card.boundary) || !isStringArray(card.sourceUrls, 4) || !card.sourceUrls.length) errors.push("knowledge_card_value");
      const allowed = new Set(sourceUrls.map(normalizeSourceUrl).filter(Boolean));
      card.sourceUrls.forEach((url) => { if (!allowed.has(normalizeSourceUrl(url))) errors.push("unknown_source_url"); });
    }
    if (!knowledgeNeeded) errors.push("knowledge_card_not_requested");
  }
  if (requireKnowledgeCard && value.knowledgeCard === null) errors.push("knowledge_card_required");
  if (value.knowledgeCard !== null && turnKind && turnKind !== "answer") errors.push("knowledge_card_wrong_turn");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateAgentResponse(value, {
  actionIds = [],
  blockedActionIds = [],
  sourceUrls = [],
  message = "",
  firstTurn = false,
} = {}) {
  const errors = [];
  const keys = ["reply", "turnKind", "confirmedFactsCandidate", "missingField", "action", "memoryDraft", "knowledgeCard", "risk", "visualState"];
  if (!hasOnlyKeys(value, keys)) return { ok: false, errors: ["root_shape"] };
  if (typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 600) errors.push("reply");
  validatePersonaReply(value.reply, errors, { message, firstTurn });
  if (!AGENT_TURN_KINDS.includes(value.turnKind)) errors.push("turnKind");
  if (countQuestions(value.reply) > 1) errors.push("too_many_questions");
  validateFacts(value.confirmedFactsCandidate, errors);
  if (!isNullableString(value.missingField)) errors.push("missingField");
  if (value.action !== null) {
    if (!hasOnlyKeys(value.action, ["id", "title", "why", "how", "stopWhen", "sources"])) errors.push("action_shape");
    else {
      ["id", "title", "why", "how", "stopWhen"].forEach((key) => { if (typeof value.action[key] !== "string" || !value.action[key].trim()) errors.push(`action_${key}`); });
      if (!Array.isArray(value.action.sources) || value.action.sources.length > 4) errors.push("action_sources");
      else value.action.sources.forEach((source) => validatePublicSource(source, errors));
      if (actionIds.length && !actionIds.includes(value.action.id)) errors.push("action_not_allowed");
      if (blockedActionIds.includes(value.action.id)) errors.push("action_blocked_by_personal_outcome");
    }
  }
  validateMemory(value.memoryDraft, errors);
  if (value.knowledgeCard !== null) {
    const card = value.knowledgeCard;
    if (!hasOnlyKeys(card, ["title", "explanation", "relevanceToCurrentSituation", "boundary", "sources"])) errors.push("knowledge_card_shape");
    else {
      if (![card.title, card.explanation, card.relevanceToCurrentSituation].every((item) => typeof item === "string" && item.trim()) || !isNullableString(card.boundary) || !Array.isArray(card.sources) || !card.sources.length || card.sources.length > 4) errors.push("knowledge_card_value");
      else {
        const allowed = new Set(sourceUrls.map(normalizeSourceUrl).filter(Boolean));
        card.sources.forEach((source) => {
          validatePublicSource(source, errors);
          if (allowed.size && !allowed.has(normalizeSourceUrl(source.url))) errors.push("unknown_source_url");
        });
      }
    }
  }
  validateRiskAndVisual(value, errors);
  if (value.turnKind === "question" && countQuestions(value.reply) !== 1) errors.push("question_turn_requires_one_question");
  if (value.turnKind === "follow_up" && countQuestions(value.reply) !== 1) errors.push("follow_up_turn_requires_one_question");
  if (["listen", "answer", "action"].includes(value.turnKind) && countQuestions(value.reply) !== 0) errors.push("non_question_turn_must_not_ask");
  if (value.turnKind === "action" && value.action === null) errors.push("action_turn_requires_action");
  if (value.turnKind !== "action" && value.action !== null) errors.push("action_wrong_turn");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function getAgentErrorCopy(code) {
  return AGENT_ERROR_COPY[code] || AGENT_ERROR_COPY.agent_unavailable;
}

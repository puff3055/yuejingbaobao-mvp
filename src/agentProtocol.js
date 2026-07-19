export const AGENT_TURN_KINDS = ["listen", "question", "answer", "action", "follow_up"];

export const AGENT_VISUAL_STATES = ["idle", "listening", "thinking", "retrieving", "responding", "remembering", "offline", "safety"];

export const AGENT_BODY_STATES = ["calm", "rising_tide", "pain", "low_energy", "unsettled"];

export const AGENT_ERROR_COPY = {
  agent_not_authorized: "需要妳同意将这条消息发送给联网 Agent。消息还留在输入框里，没有发送。",
  agent_not_configured: "联网 Agent 尚未接通。这条消息没有发送，也没有生成回复。",
  agent_timeout: "联网 Agent 没有在规定时间内回复。本轮没有生成或保存任何内容。",
  agent_empty_reply: "联网 Agent 没有返回可用内容。本轮没有生成或保存任何内容。",
  agent_invalid_json: "返回内容未通过格式检查。本轮没有显示或保存。",
  agent_invalid_schema: "返回内容未通过安全检查。本轮没有显示或保存。",
  agent_provider_error: "联网 Agent 暂时不可用。本轮没有生成或保存任何内容。",
  agent_unavailable: "联网 Agent 暂时不可用。本轮没有生成或保存任何内容。",
  message_required: "请先写下一句话，再发送给月经宝宝。",
  invalid_request: "这条消息没有通过发送检查，请修改后再试。",
};

const NULLABLE_STRING = { type: ["string", "null"] };
const STRING_ARRAY = { type: "array", items: { type: "string" }, maxItems: 12 };

export const AGENT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply",
    "turnKind",
    "confirmedFactsCandidate",
    "missingField",
    "action",
    "memoryDraft",
    "evidenceIds",
    "risk",
    "visualState",
  ],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 600 },
    turnKind: { type: "string", enum: AGENT_TURN_KINDS },
    confirmedFactsCandidate: {
      type: "object",
      additionalProperties: false,
      required: [
        "rawText",
        "cycleContext",
        "symptoms",
        "bodyLocations",
        "onset",
        "functionalImpact",
        "differenceFromUsual",
        "currentConstraint",
        "actionsTried",
        "outcomes",
        "uncertainty",
      ],
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
      },
    },
    missingField: NULLABLE_STRING,
    action: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "why", "how", "stopWhen", "evidenceIds"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            title: { type: "string", minLength: 1, maxLength: 80 },
            why: { type: "string", minLength: 1, maxLength: 240 },
            how: { type: "string", minLength: 1, maxLength: 320 },
            stopWhen: { type: "string", minLength: 1, maxLength: 240 },
            evidenceIds: STRING_ARRAY,
          },
        },
      ],
    },
    memoryDraft: {
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
    },
    evidenceIds: STRING_ARRAY,
    risk: {
      type: "object",
      additionalProperties: false,
      required: ["level", "reason"],
      properties: {
        level: { type: "string", enum: ["none", "attention", "urgent"] },
        reason: NULLABLE_STRING,
      },
    },
    visualState: {
      type: "object",
      additionalProperties: false,
      required: ["interaction", "body", "basis"],
      properties: {
        interaction: { type: "string", enum: ["responding", "retrieving", "safety", "idle"] },
        body: { type: "string", enum: AGENT_BODY_STATES },
        basis: STRING_ARRAY,
      },
    },
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

export function countQuestions(value = "") {
  return (String(value).match(/[？?]/g) || []).length;
}

export function validateAgentResponse(value, { evidenceIds = [], actionIds = [], blockedActionIds = [] } = {}) {
  const errors = [];
  const rootKeys = ["reply", "turnKind", "confirmedFactsCandidate", "missingField", "action", "memoryDraft", "evidenceIds", "risk", "visualState"];
  if (!hasOnlyKeys(value, rootKeys)) return { ok: false, errors: ["root_shape"] };
  if (typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 600) errors.push("reply");
  if (!AGENT_TURN_KINDS.includes(value.turnKind)) errors.push("turnKind");
  if (countQuestions(value.reply) > 1) errors.push("too_many_questions");

  const facts = value.confirmedFactsCandidate;
  const factKeys = ["rawText", "cycleContext", "symptoms", "bodyLocations", "onset", "functionalImpact", "differenceFromUsual", "currentConstraint", "actionsTried", "outcomes", "uncertainty"];
  if (!hasOnlyKeys(facts, factKeys)) errors.push("facts_shape");
  else {
    if (typeof facts.rawText !== "string" || facts.rawText.length > 2400) errors.push("facts_rawText");
    ["cycleContext", "onset", "functionalImpact", "differenceFromUsual", "currentConstraint"].forEach((key) => {
      if (!isNullableString(facts[key])) errors.push(`facts_${key}`);
    });
    ["symptoms", "bodyLocations", "actionsTried", "outcomes", "uncertainty"].forEach((key) => {
      if (!isStringArray(facts[key])) errors.push(`facts_${key}`);
    });
  }
  if (!isNullableString(value.missingField)) errors.push("missingField");

  if (value.action !== null) {
    const actionKeys = ["id", "title", "why", "how", "stopWhen", "evidenceIds"];
    if (!hasOnlyKeys(value.action, actionKeys)) errors.push("action_shape");
    else {
      ["id", "title", "why", "how", "stopWhen"].forEach((key) => {
        if (typeof value.action[key] !== "string" || !value.action[key].trim()) errors.push(`action_${key}`);
      });
      if (!isStringArray(value.action.evidenceIds)) errors.push("action_evidenceIds");
      if (actionIds.length && !actionIds.includes(value.action.id)) errors.push("action_not_allowed");
      if (blockedActionIds.includes(value.action.id)) errors.push("action_blocked_by_personal_outcome");
    }
  }

  const memory = value.memoryDraft;
  if (!hasOnlyKeys(memory, ["shouldOffer", "summary", "fields"])) errors.push("memory_shape");
  else {
    if (typeof memory.shouldOffer !== "boolean" || !isNullableString(memory.summary) || !Array.isArray(memory.fields) || memory.fields.length > 12) errors.push("memory_fields");
    else memory.fields.forEach((field) => {
      if (!hasOnlyKeys(field, ["key", "label", "value", "source", "certainty"])) errors.push("memory_field_shape");
      else if (typeof field.key !== "string" || typeof field.label !== "string" || typeof field.value !== "string" || !["current_user_message", "confirmed_personal_memory", "confirmed_page_record"].includes(field.source) || !["explicit", "uncertain"].includes(field.certainty)) errors.push("memory_field_value");
    });
  }

  if (!isStringArray(value.evidenceIds)) errors.push("evidenceIds");
  const requestedEvidence = new Set([...(value.evidenceIds || []), ...(value.action?.evidenceIds || [])]);
  requestedEvidence.forEach((id) => { if (!evidenceIds.includes(id)) errors.push("unknown_evidence_id"); });

  if (!hasOnlyKeys(value.risk, ["level", "reason"]) || !["none", "attention", "urgent"].includes(value.risk?.level) || !isNullableString(value.risk?.reason)) errors.push("risk");
  if (!hasOnlyKeys(value.visualState, ["interaction", "body", "basis"]) || !["responding", "retrieving", "safety", "idle"].includes(value.visualState?.interaction) || !AGENT_BODY_STATES.includes(value.visualState?.body) || !isStringArray(value.visualState?.basis)) errors.push("visualState");

  if (value.turnKind === "question" && countQuestions(value.reply) !== 1) errors.push("question_turn_requires_one_question");
  if (value.turnKind !== "action" && value.action !== null) errors.push("action_wrong_turn");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function getAgentErrorCopy(code) {
  return AGENT_ERROR_COPY[code] || AGENT_ERROR_COPY.agent_unavailable;
}

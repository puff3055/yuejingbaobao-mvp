import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_COMPOSER_SCHEMA,
  AGENT_PLAN_SCHEMA,
  AGENT_RESPONSE_SCHEMA,
  validateAgentComposer,
  validateAgentPlan,
  validateAgentResponse,
} from "./agentProtocol.js";

const facts = (rawText = "我现在小腹特别痛，下午还有会") => ({
  rawText,
  cycleContext: null,
  symptoms: ["小腹痛"],
  bodyLocations: ["小腹"],
  onset: null,
  functionalImpact: null,
  differenceFromUsual: null,
  currentConstraint: "下午还有会",
  actionsTried: [],
  outcomes: [],
  uncertainty: [],
  fieldProvenance: [
    { key: "symptoms", source: "current_user_message", sourceRef: "current", quote: "小腹特别痛", certainty: "explicit" },
    { key: "bodyLocations", source: "current_user_message", sourceRef: "current", quote: "小腹", certainty: "explicit" },
    { key: "currentConstraint", source: "current_user_message", sourceRef: "current", quote: "下午还有会", certainty: "explicit" },
  ],
});

function response(overrides = {}) {
  return {
    reply: "这次的痛，会让妳很难坐着或集中注意吗？",
    turnKind: "question",
    confirmedFactsCandidate: facts(),
    missingField: "functionalImpact",
    action: null,
    memoryDraft: { shouldOffer: false, summary: null, fields: [] },
    knowledgeCard: null,
    risk: { level: "none", reason: null },
    visualState: { interaction: "responding", body: "calm", basis: [] },
    ...overrides,
  };
}

function plan(overrides = {}) {
  return {
    turnKind: "question",
    confirmedFactsCandidate: facts(),
    missingField: "functionalImpact",
    actionId: null,
    memoryDraft: { shouldOffer: false, summary: null, fields: [] },
    knowledgeNeed: { needed: false, category: "none", query: null, reason: null },
    risk: { level: "none", reason: null },
    visualState: { interaction: "responding", body: "calm", basis: [] },
    ...overrides,
  };
}

test("planner, composer and final provider schemas are strict at every object layer", () => {
  assert.equal(AGENT_PLAN_SCHEMA.additionalProperties, false);
  assert.equal(AGENT_PLAN_SCHEMA.properties.confirmedFactsCandidate.additionalProperties, false);
  assert.equal(AGENT_COMPOSER_SCHEMA.additionalProperties, false);
  assert.equal(AGENT_RESPONSE_SCHEMA.additionalProperties, false);
  assert.equal(AGENT_RESPONSE_SCHEMA.properties.memoryDraft.additionalProperties, false);
});

test("a question turn accepts exactly one decision-changing question", () => {
  assert.deepEqual(validateAgentResponse(response()), { ok: true, errors: [] });
  const invalid = validateAgentResponse(response({ reply: "什么时候开始？现在多痛？" }));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("too_many_questions"));
});

test("the plan rejects facts whose quoted provenance is not in the user message", () => {
  assert.deepEqual(validateAgentPlan(plan(), { message: facts().rawText }), { ok: true, errors: [] });
  const invented = plan({ confirmedFactsCandidate: { ...facts(), onset: "下午三点", fieldProvenance: [...facts().fieldProvenance, { key: "onset", source: "current_user_message", sourceRef: "current", quote: "下午三点", certainty: "explicit" }] } });
  const validation = validateAgentPlan(invented, { message: facts().rawText });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("facts_provenance_unverified"));
});

test("memory drafts can only copy source-verified candidate facts", () => {
  const valid = plan({
    memoryDraft: {
      shouldOffer: true,
      summary: "下午还有会",
      fields: [{ key: "currentConstraint", label: "现实限制", value: "下午还有会", source: "current_user_message", certainty: "explicit" }],
    },
  });
  assert.deepEqual(validateAgentPlan(valid, { message: facts().rawText }), { ok: true, errors: [] });

  const invented = plan({
    memoryDraft: {
      shouldOffer: true,
      summary: "下午三点必须汇报",
      fields: [{ key: "currentConstraint", label: "现实限制", value: "下午三点必须汇报", source: "current_user_message", certainty: "explicit" }],
    },
  });
  const validation = validateAgentPlan(invented, { message: facts().rawText });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("memory_field_unverified"));
});

test("final response validation keeps raw user text provenance bound to this turn", () => {
  const validation = validateAgentResponse(response(), { message: "我只是有点累" });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("facts_rawText_mismatch"));
});

test("unknown knowledge-card URLs and blocked actions fail closed", () => {
  const card = {
    title: "痛经为什么会影响活动",
    explanation: "资料解释",
    relevanceToCurrentSituation: "与小腹痛有关",
    boundary: "不能据此诊断",
    sourceUrls: ["https://example.com/invented"],
  };
  const unknownSource = validateAgentComposer({ reply: "我找到了一张和此刻有关的卡。", knowledgeCard: card }, { knowledgeNeeded: true, sourceUrls: ["https://pubmed.ncbi.nlm.nih.gov/1/"] });
  assert.equal(unknownSource.ok, false);
  assert.ok(unknownSource.errors.includes("unknown_source_url"));

  const blocked = validateAgentPlan(plan({ turnKind: "action", actionId: "heat" }), { message: facts().rawText, actionIds: ["heat"], blockedActionIds: ["heat"] });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.errors.includes("action_blocked_by_personal_outcome"));
});

test("an action cannot leak into a question turn", () => {
  const action = { id: "meeting", title: "任务前缓冲", why: "降低负担", how: "留出十分钟", stopWhen: "不适加重时停止", sources: [] };
  const validation = validateAgentResponse(response({ action }), { actionIds: ["meeting"] });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("action_wrong_turn"));
});

test("vague distress must keep the shared-body voice and reject coach or therapy templates", () => {
  const gold = validateAgentComposer({
    reply: "听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？",
    knowledgeCard: null,
  }, { turnKind: "question", message: "我好烦", firstTurn: true });
  assert.deepEqual(gold, { ok: true, errors: [] });

  const therapy = validateAgentComposer({
    reply: "我理解妳。这股烦一直缠着妳吗？",
    knowledgeCard: null,
  }, { turnKind: "question", message: "我好烦", firstTurn: true });
  assert.equal(therapy.ok, false);
  assert.ok(therapy.errors.includes("reply_out_of_character"));
  assert.ok(therapy.errors.includes("vague_distress_missing_shared_body_connection"));

  const coach = validateAgentComposer({
    reply: "我们先列出重点，现在想让我怎么做？",
    knowledgeCard: null,
  }, { turnKind: "question", message: "我好烦", firstTurn: true });
  assert.equal(coach.ok, false);
  assert.ok(coach.errors.includes("reply_out_of_character"));
});

test("a successful professional retrieval must produce a source-bound card", () => {
  const validation = validateAgentComposer({
    reply: "我在月之海里找到了和妳此刻有关的资料。",
    knowledgeCard: null,
  }, {
    turnKind: "answer",
    knowledgeNeeded: true,
    requireKnowledgeCard: true,
    sourceUrls: ["https://pubmed.ncbi.nlm.nih.gov/1/"],
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("knowledge_card_required"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_RESPONSE_SCHEMA, validateAgentResponse } from "./agentProtocol.js";

function response(overrides = {}) {
  return {
    reply: "这次的痛会影响妳走动、坐着或集中注意吗？",
    turnKind: "question",
    confirmedFactsCandidate: {
      rawText: "我现在小腹特别痛，下午还有会",
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
    },
    missingField: "functionalImpact",
    action: null,
    memoryDraft: { shouldOffer: false, summary: null, fields: [] },
    evidenceIds: [],
    risk: { level: "none", reason: null },
    visualState: { interaction: "responding", body: "calm", basis: [] },
    ...overrides,
  };
}

test("the provider schema is strict at every object layer", () => {
  assert.equal(AGENT_RESPONSE_SCHEMA.additionalProperties, false);
  assert.equal(AGENT_RESPONSE_SCHEMA.properties.confirmedFactsCandidate.additionalProperties, false);
  assert.equal(AGENT_RESPONSE_SCHEMA.properties.memoryDraft.additionalProperties, false);
  assert.equal(AGENT_RESPONSE_SCHEMA.properties.risk.additionalProperties, false);
  assert.equal(AGENT_RESPONSE_SCHEMA.properties.visualState.additionalProperties, false);
});

test("a question turn accepts exactly one decision-changing question", () => {
  assert.deepEqual(validateAgentResponse(response()), { ok: true, errors: [] });
  const invalid = validateAgentResponse(response({ reply: "什么时候开始？现在多痛？" }));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("too_many_questions"));
});

test("unknown evidence IDs and blocked actions fail closed", () => {
  const unknownEvidence = validateAgentResponse(response({ turnKind: "answer", reply: "资料能说明这一点。", evidenceIds: ["made-up"] }), { evidenceIds: [] });
  assert.equal(unknownEvidence.ok, false);
  assert.ok(unknownEvidence.errors.includes("unknown_evidence_id"));

  const action = {
    id: "heat",
    title: "温热下腹",
    why: "可能降低当下负担",
    how: "使用温热而不烫的热源",
    stopWhen: "刺痛或灼热时停止",
    evidenceIds: [],
  };
  const blocked = validateAgentResponse(response({ turnKind: "action", reply: "贝壳边放着一个可撤回的办法。", action }), { actionIds: ["heat"], blockedActionIds: ["heat"] });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.errors.includes("action_blocked_by_personal_outcome"));
});

test("an action cannot leak into a question turn", () => {
  const action = { id: "meeting", title: "任务前缓冲", why: "降低负担", how: "留出十分钟", stopWhen: "不适加重时停止", evidenceIds: [] };
  const validation = validateAgentResponse(response({ action }), { actionIds: ["meeting"] });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("action_wrong_turn"));
});

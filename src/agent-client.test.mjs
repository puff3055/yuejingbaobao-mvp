import assert from "node:assert/strict";
import test from "node:test";
import { AgentRequestError, fetchAgentStatus, requestAgentReply } from "./agentClient.js";

const validPayload = {
  reply: "听到妳说累，我的耳鳍也垂下来一点了。我想靠妳近一点，看看今天发生了什么呀？",
  turnKind: "question",
  confirmedFactsCandidate: {
    rawText: "我好累",
    cycleContext: null,
    symptoms: ["疲惫"],
    bodyLocations: [],
    onset: null,
    functionalImpact: null,
    differenceFromUsual: null,
    currentConstraint: null,
    actionsTried: [],
    outcomes: [],
    uncertainty: ["是否与月经有关尚不明确"],
    fieldProvenance: [{ key: "symptoms", source: "current_user_message", sourceRef: "current", quote: "累", certainty: "explicit" }],
  },
  missingField: "onset",
  action: null,
  memoryDraft: { shouldOffer: false, summary: null, fields: [] },
  knowledgeCard: null,
  risk: { level: "none", reason: null },
  visualState: { interaction: "responding", body: "calm", basis: [] },
  model: "step-3.5-flash",
};

async function withMockFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function request(overrides = {}) {
  return requestAgentReply({
    message: "我好累",
    history: [],
    memories: [],
    actionCandidates: [],
    blockedActionIds: [],
    context: { allowRemote: true },
    ...overrides,
  });
}

test("an unauthorized message never reaches fetch and never gets a local reply", async () => {
  let calls = 0;
  await withMockFetch(async () => { calls += 1; throw new Error("must not fetch"); }, async () => {
    await assert.rejects(request({ context: { allowRemote: false } }), (error) => error instanceof AgentRequestError && error.code === "agent_not_authorized");
  });
  assert.equal(calls, 0);
});

test("one valid strict response is returned without a silent retry", async () => {
  let calls = 0;
  const result = await withMockFetch(async () => {
    calls += 1;
    return new Response(JSON.stringify(validPayload), { status: 200, headers: { "Content-Type": "application/json" } });
  }, () => request());
  assert.equal(calls, 1);
  assert.equal(result.reply, validPayload.reply);
  assert.equal(result.turnKind, "question");
});

test("invalid JSON is rejected and never converted into a baby reply", async () => {
  await withMockFetch(async () => new Response("not-json", { status: 200 }), async () => {
    await assert.rejects(request(), (error) => error.code === "agent_invalid_json" && !Object.hasOwn(error, "reply"));
  });
});

test("an invalid schema is rejected whole instead of displaying partial text", async () => {
  await withMockFetch(async () => new Response(JSON.stringify({ ...validPayload, turnKind: "unsafe", extra: "unsafe" }), { status: 200 }), async () => {
    await assert.rejects(request(), (error) => error.code === "agent_invalid_schema");
  });
});

test("an empty reply keeps its dedicated error instead of being folded into schema failure", async () => {
  await withMockFetch(async () => new Response(JSON.stringify({ ...validPayload, reply: "   " }), { status: 200, headers: { "Content-Type": "application/json" } }), async () => {
    await assert.rejects(request(), (error) => error.code === "agent_empty_reply");
  });
});

test("provider errors remain system errors and are not retried", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: "agent_provider_error" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }, async () => {
    await assert.rejects(request(), (error) => error.code === "agent_provider_error");
  });
  assert.equal(calls, 1);
});

test("timeouts fail explicitly without an automatic retry", async () => {
  let calls = 0;
  await withMockFetch((_url, options) => new Promise((_resolve, reject) => {
    calls += 1;
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }), async () => {
    await assert.rejects(request({ timeoutMs: 5 }), (error) => error.code === "agent_timeout");
  });
  assert.equal(calls, 1);
});

test("status preflight distinguishes configured from unconfigured", async () => {
  const status = await withMockFetch(async () => new Response(JSON.stringify({ configured: true }), { status: 200, headers: { "Content-Type": "application/json" } }), () => fetchAgentStatus());
  assert.deepEqual(status, { configured: true });
});

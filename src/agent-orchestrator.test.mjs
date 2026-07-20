import assert from "node:assert/strict";
import test from "node:test";
import { AgentPipelineError, canonicalizeAgentPlan, composerSchemaForTurn, orchestrateAgentTurn } from "./agentOrchestrator.js";

function facts(rawText) {
  return {
    rawText,
    cycleContext: null,
    symptoms: rawText.includes("痛经") ? ["痛经"] : [],
    bodyLocations: [],
    onset: null,
    functionalImpact: null,
    differenceFromUsual: null,
    currentConstraint: null,
    actionsTried: [],
    outcomes: [],
    uncertainty: [],
    fieldProvenance: rawText.includes("痛经") ? [{ key: "symptoms", source: "current_user_message", sourceRef: "current", quote: "痛经", certainty: "explicit" }] : [],
  };
}

function plan(message, overrides = {}) {
  return {
    turnKind: "question",
    confirmedFactsCandidate: facts(message),
    missingField: "functionalImpact",
    actionId: null,
    memoryDraft: { shouldOffer: false, summary: null, fields: [] },
    knowledgeNeed: { needed: false, category: "none", query: null, reason: null },
    risk: { level: "none", reason: null },
    visualState: { interaction: "responding", body: "calm", basis: [] },
    ...overrides,
  };
}

function providerResponse(value) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function input(overrides = {}) {
  return {
    apiBase: "https://api.stepfun.test/v1",
    apiModel: "step-3.5-flash",
    apiKey: "test-key",
    searchEndpoint: "https://api.stepfun.test/v1/search",
    systemPrompt: "system prompt",
    message: "我好烦",
    history: [],
    context: {},
    memories: [],
    actionCandidates: [],
    blockedActionIds: [],
    knowledgeRecords: [],
    ...overrides,
  };
}

test("a successful turn always uses a hidden planner before the user-facing composer", async () => {
  const stages = [];
  const requestBodies = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requestBodies.push(body);
    const name = body.response_format.json_schema.name;
    stages.push(name);
    if (name === "menstrual_baby_plan") return providerResponse(plan("我好烦"));
    return providerResponse({ reply: "听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？", knowledgeCard: null });
  };
  const result = await orchestrateAgentTurn(input({ fetchImpl }));
  assert.deepEqual(stages, ["menstrual_baby_plan", "menstrual_baby_compose"]);
  assert.deepEqual(requestBodies.map((body) => body.max_tokens), [1400, 800]);
  assert.equal(result.reply, "听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？");
  assert.equal(result.action, null);
});

test("step 2603 requests use low reasoning effort to stay inside the mobile reply budget", async () => {
  const requestBodies = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requestBodies.push(body);
    return providerResponse({
      reply: "听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？",
      turnKind: "question",
      bodyState: "unsettled",
    });
  };

  await orchestrateAgentTurn(input({
    apiModel: "step-3.5-flash-2603",
    context: { fastCompanionAllowed: true },
    fetchImpl,
  }));

  assert.equal(requestBodies.length, 1);
  assert.equal(requestBodies[0].reasoning_effort, "low");
  assert.equal(requestBodies[0].max_tokens, 640);
  assert.deepEqual(Object.keys(requestBodies[0].response_format.json_schema.schema.properties), ["reply", "turnKind", "bodyState"]);
  assert.equal(requestBodies[0].messages[0].content.includes("system prompt"), false);
});

test("fast companion turns canonicalize model facts instead of failing on loose provenance", async () => {
  const fetchImpl = async () => providerResponse({
    reply: "听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？",
    turnKind: "question",
    bodyState: "unsettled",
  });

  const result = await orchestrateAgentTurn(input({
    context: { fastCompanionAllowed: true },
    fetchImpl,
  }));

  assert.deepEqual(result.confirmedFactsCandidate.symptoms, []);
  assert.equal(result.memoryDraft.shouldOffer, false);
  assert.equal(result.action, null);
  assert.equal(result.knowledgeCard, null);
});

test("fast companion turns classify a single visible question even when provider metadata says listen", async () => {
  const fetchImpl = async () => providerResponse({
    reply: "妳说小腹特别痛，我的耳鳍也垂下来一点了。现在坐着也痛，还是走动时更痛？",
    turnKind: "listen",
    bodyState: "unsettled",
  });

  const result = await orchestrateAgentTurn(input({
    message: "我现在小腹特别痛，下午还有会",
    context: { fastCompanionAllowed: true },
    fetchImpl,
  }));

  assert.equal(result.turnKind, "question");
  assert.equal(result.missingField, "current_context");
});

test("first-turn pain with a real-world constraint uses one online companion question before deeper planning", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.response_format.json_schema.name);
    return providerResponse({
      reply: "妳说小腹特别痛，我的耳鳍也垂下来一点了。我想靠近妳看看：现在是坐着也痛，还是走动时更痛？",
      turnKind: "question",
      bodyState: "calm",
    });
  };

  const result = await orchestrateAgentTurn(input({
    message: "我现在小腹特别痛，下午还有会",
    context: { fastCompanionAllowed: true },
    fetchImpl,
  }));

  assert.deepEqual(calls, ["menstrual_baby_fast_response"]);
  assert.equal(result.reply.includes("下午三点"), false);
  assert.equal(result.action, null);
});

test("first-turn pain rejects imaginary touching instead of treating it as a decision-changing question", async () => {
  const fetchImpl = async () => providerResponse({
    reply: "我身上的泡泡都急得乱蹦啦！要不要我贴贴妳的小腹，帮妳压压那股疼呀？",
    turnKind: "question",
    bodyState: "pain",
  });

  await assert.rejects(orchestrateAgentTurn(input({
    message: "我现在小腹特别痛，下午还有会",
    context: { fastCompanionAllowed: true },
    fetchImpl,
  })), (error) => error instanceof AgentPipelineError
    && error.code === "agent_invalid_schema"
    && error.validationErrors.includes("pain_turn_missing_functional_impact_question"));
});

test("non-2603 models keep the existing request body", async () => {
  const requestBodies = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requestBodies.push(body);
    const name = body.response_format.json_schema.name;
    if (name === "menstrual_baby_plan") return providerResponse(plan("我好烦"));
    return providerResponse({ reply: "听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？", knowledgeCard: null });
  };

  await orchestrateAgentTurn(input({ fetchImpl }));

  assert.equal(requestBodies.every((body) => !Object.hasOwn(body, "reasoning_effort")), true);
});

test("a planner schema failure closes the whole turn before composing", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return providerResponse({ bad: true });
  };
  await assert.rejects(orchestrateAgentTurn(input({ fetchImpl })), (error) => error instanceof AgentPipelineError && error.code === "agent_invalid_schema");
  assert.equal(calls, 1);
});

test("planner facts and empty retrieval fields are canonicalized only from exact user evidence", () => {
  const raw = plan("我现在小腹特别痛，下午还有会", {
    confirmedFactsCandidate: {
      ...facts("我现在小腹特别痛，下午还有会"),
      symptoms: ["严重疼痛"],
      bodyLocations: ["小腹"],
      currentConstraint: "下午有会",
      fieldProvenance: [
        { key: "symptoms", source: "current_user_message", sourceRef: "current", quote: "特别痛", certainty: "explicit" },
        { key: "bodyLocations", source: "current_user_message", sourceRef: "current", quote: "小腹特别痛", certainty: "explicit" },
        { key: "currentConstraint", source: "current_user_message", sourceRef: "current", quote: "下午还有会", certainty: "explicit" },
      ],
    },
    knowledgeNeed: { needed: false, category: "none", query: "", reason: "" },
  });
  const result = canonicalizeAgentPlan(raw, { message: "我现在小腹特别痛，下午还有会", memories: [] });
  assert.deepEqual(result.confirmedFactsCandidate.symptoms, []);
  assert.deepEqual(result.confirmedFactsCandidate.bodyLocations, ["小腹"]);
  assert.equal(result.confirmedFactsCandidate.currentConstraint, null);
  assert.deepEqual(result.confirmedFactsCandidate.fieldProvenance, [{
    key: "bodyLocations",
    source: "current_user_message",
    sourceRef: "current",
    quote: "小腹",
    certainty: "explicit",
  }]);
  assert.deepEqual(result.knowledgeNeed, { needed: false, category: "none", query: null, reason: null });
});

test("the provider schema enforces exactly one question only on question turns", () => {
  const questionPattern = new RegExp(composerSchemaForTurn("question").properties.reply.pattern);
  const answerPattern = new RegExp(composerSchemaForTurn("answer").properties.reply.pattern);
  assert.equal(questionPattern.test("我想看看，这会儿是坐着也痛吗？"), true);
  assert.equal(questionPattern.test("妳现在还能坐着吗？走动会更痛吗？"), false);
  assert.equal(answerPattern.test("这张知识卡在解释疼痛可能涉及的机制。"), true);
  assert.equal(answerPattern.test("要不要再看看？"), false);
});

test("a knowledge card can only use a URL returned by the actual PubMed retrieval", async () => {
  const message = "为什么痛经会影响工作？";
  let providerStage = 0;
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith("/chat/completions")) {
      providerStage += 1;
      if (providerStage === 1) return providerResponse(plan(message, {
        turnKind: "answer",
        missingField: null,
        knowledgeNeed: { needed: true, category: "mechanism", query: "dysmenorrhea work productivity functional impairment", reason: "解释当前困惑" },
        visualState: { interaction: "retrieving", body: "calm", basis: [] },
      }));
      return providerResponse({
        reply: "我在月之海里找到了一条和这个问题贴得很近的线索。疼痛本身和功能受影响要分开看。",
        knowledgeCard: {
          title: "疼痛与日常功能是两条线",
          explanation: "研究会分别观察疼痛和工作、学习等功能影响。",
          relevanceToCurrentSituation: "这能帮助妳描述痛经实际影响了什么。",
          boundary: "这不能单独判断疼痛原因。",
          sourceUrls: ["https://pubmed.ncbi.nlm.nih.gov/123/"],
        },
      });
    }
    if (value.includes("esearch.fcgi")) return new Response(JSON.stringify({ esearchresult: { idlist: ["123"] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (value.includes("efetch.fcgi")) return new Response(`<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>Dysmenorrhea and work productivity</ArticleTitle><Abstract><AbstractText>The study measured menstrual pain and work productivity as separate outcomes.</AbstractText></Abstract><Journal><Title>Human Reproduction</Title><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue></Journal><AuthorList><Author><LastName>Chen</LastName><Initials>L</Initials></Author></AuthorList></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>`, { status: 200 });
    throw new Error(`unexpected fetch: ${value}`);
  };
  const result = await orchestrateAgentTurn(input({ message, fetchImpl }));
  assert.equal(providerStage, 2);
  assert.equal(result.knowledgeCard.sources.length, 1);
  assert.equal(result.knowledgeCard.sources[0].title, "Dysmenorrhea and work productivity");
  assert.equal(result.knowledgeCard.sources[0].url, "https://pubmed.ncbi.nlm.nih.gov/123/");
});

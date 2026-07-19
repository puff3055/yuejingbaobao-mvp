import { retrieveProfessionalSources } from "./agentKnowledge.js";
import {
  AGENT_COMPOSER_SCHEMA,
  AGENT_PLAN_SCHEMA,
  AGENT_RESPONSE_SCHEMA,
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
  maxTokens,
  temperature,
  fetchImpl,
  signal,
}) {
  const response = await fetchImpl(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: apiModel,
      temperature,
      max_tokens: maxTokens,
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
    }),
    signal,
  });
  if (!response.ok) throw new AgentPipelineError("agent_provider_error");
  let envelope;
  try {
    envelope = await response.json();
  } catch {
    throw new AgentPipelineError("agent_invalid_json");
  }
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new AgentPipelineError("agent_empty_reply");
  try {
    return JSON.parse(content);
  } catch {
    throw new AgentPipelineError("agent_invalid_json");
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

function shouldUseFastCompanionTurn({ message, history, memories, context }) {
  if (context.fastCompanionAllowed !== true) return false;
  const text = message.trim();
  if (history.length || memories.length) return false;
  if ([...text].length > 80) return false;
  if (/[？?]|为什么|怎么办|怎么缓解|原因|资料|来源|文献|研究|知识|痛经|小腹痛|腹痛|出血|血量|发烧|呕吐|晕|怀孕|绝经/.test(text)) return false;
  return /烦|累|疲惫|难受|不舒服|焦虑|烦躁|郁闷|崩溃|不想动|低落/.test(text);
}

async function fastCompanionTurn({
  apiBase,
  apiModel,
  apiKey,
  systemPrompt,
  message,
  context,
  fetchImpl,
  signal,
}) {
  const fastSystem = `${systemPrompt}\n\n# 当前阶段：FAST_COMPANION\n这是一次普通首轮陪伴/好奇回应。为了在手机端及时回应，只进行一次联网结构化生成。\n\n硬约束：\n- 仍然必须严格遵守月经宝宝共生人格；\n- 只允许 turnKind 为 listen 或 question；\n- action 必须为 null；knowledgeCard 必须为 null；\n- 不能提供专业结论、行动建议、保存记忆或声称已经检索；\n- 如果要问，只问一个自然、直接、会帮助理解她此刻状态的问题；\n- confirmedFactsCandidate 只提取用户原话中明确说出的内容。\n\n## 本轮产品上下文\n${JSON.stringify(context)}`;
  const result = await callStructuredModel({
    apiBase,
    apiModel,
    apiKey,
    system: fastSystem,
    messages: [{ role: "user", content: message }],
    schema: AGENT_RESPONSE_SCHEMA,
    schemaName: "menstrual_baby_fast_response",
    maxTokens: 900,
    temperature: 0.42,
    fetchImpl,
    signal,
  });
  const validation = validateAgentResponse(result, {
    actionIds: [],
    blockedActionIds: [],
    sourceUrls: [],
    message,
    firstTurn: true,
  });
  if (!validation.ok) throw new AgentPipelineError("agent_invalid_schema");
  return result;
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
      systemPrompt,
      message,
      context,
      fetchImpl,
      signal,
    });
  }
  const plannerSystem = `${systemPrompt}\n\n# 当前阶段：PLAN\n只输出不可见计划，不生成面向用户的回复。\n\n## 本轮产品上下文\n${JSON.stringify(context)}\n\n## 已确认的个人记忆\n${JSON.stringify(memories)}\n\n## 可选行动白名单\n${JSON.stringify(actionCandidates.map(({ sources: _sources, ...item }) => item))}\n\n## 相似处境中被本人负向结果阻止的行动\n${JSON.stringify(blockedActionIds)}`;
  const plan = await callStructuredModel({
    apiBase,
    apiModel,
    apiKey,
    system: plannerSystem,
    messages: [...history, { role: "user", content: message }],
    schema: AGENT_PLAN_SCHEMA,
    schemaName: "menstrual_baby_plan",
    maxTokens: 1800,
    temperature: 0.12,
    fetchImpl,
    signal,
  });
  const planValidation = validateAgentPlan(plan, { message, memories, actionIds, blockedActionIds });
  if (!planValidation.ok) throw new AgentPipelineError("agent_invalid_schema");

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
    schema: AGENT_COMPOSER_SCHEMA,
    schemaName: "menstrual_baby_compose",
    maxTokens: 1500,
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
  if (!composerValidation.ok) throw new AgentPipelineError("agent_invalid_schema");

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
  if (!finalValidation.ok) throw new AgentPipelineError("agent_invalid_schema");
  return result;
}

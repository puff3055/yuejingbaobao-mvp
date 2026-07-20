import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
const agentSource = await readFile(new URL("./agentClient.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const orchestratorSource = await readFile(new URL("./agentOrchestrator.js", import.meta.url), "utf8");
const promptSource = await readFile(new URL("../prompts/menstrual-baby-system-v3.md", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./styles.css", import.meta.url), "utf8");

test("keeps free text and natural-language Agent replies in the core loop", () => {
  assert.ok(appSource.includes("月经宝宝正趴在这里听妳说"));
  assert.ok(appSource.includes("continueConversation"));
  assert.equal(appSource.includes("联网 Agent 已接通"), false);
  assert.ok(appSource.includes("agent-pending-message"));
  assert.ok(appSource.includes("pearl-thinking-dots"));
  assert.ok(appSource.includes("本轮没有生成回复"));
  assert.ok(appSource.includes("系统状态 · 不是宝宝回复"));
  assert.ok(agentSource.includes('fetch("/api/agent"'));
  assert.ok(serverSource.includes('setDefaultResultOrder("ipv4first")'));
  assert.ok(agentSource.includes("throw new AgentRequestError(\"agent_not_authorized\")"));
  assert.equal(agentSource.includes("return fallback"), false);
  assert.equal(agentSource.includes("设备里先接住"), false);
  assert.equal(appSource.includes("设备内回应"), false);
  assert.ok(serverSource.includes('req.url === "/api/agent"'));
  assert.ok(orchestratorSource.includes('response_format: {'));
  assert.ok(orchestratorSource.includes('strict: true'));
  assert.ok(orchestratorSource.includes("menstrual_baby_plan"));
  assert.ok(orchestratorSource.includes("menstrual_baby_compose"));
  assert.ok(promptSource.includes("用户身体潮汐外化出来的“月经宝宝”"));
  assert.ok(promptSource.includes("听到妳说烦，我身上的泡泡也乱套了！我想靠妳近一点，看看妳在烦什么呀？"));
  assert.equal(/Life Coach|教练|疗愈师/.test(promptSource), false);
  assert.ok(promptSource.includes("每轮只完成一个任务"));
  assert.equal(appSource.includes("宝宝目前理解到"), false);
  assert.equal(appSource.includes("我和妳一起理清"), false);
});

test("renders one unified knowledge card with whole-row clickable sources", () => {
  ["AgentKnowledgeCard", "relevanceToCurrentSituation", "agent-source-list", 'target="_blank"', 'rel="noopener noreferrer"'].forEach((label) => assert.ok(appSource.includes(label), `missing knowledge-card contract: ${label}`));
  assert.equal(appSource.includes("message.evidence"), false);
  assert.equal(appSource.includes("联网 Agent 正在理解这一刻"), false);
  assert.equal(appSource.includes("正在核对可引用的专业资料"), false);
});

test("renders exactly one active baby at the composer instead of reply avatars", () => {
  assert.ok(appSource.includes("<ComposerCompanion"));
  assert.ok(appSource.includes("composer-companion"));
  assert.equal(appSource.includes("mini-baby"), false);
  assert.ok(styleSource.includes(".composer-companion"));
  assert.ok(styleSource.includes("top: -16px"));
  assert.ok(styleSource.includes("interaction-offline"));
});

test("saves feedback plainly and makes later sharing optional", () => {
  ["很有帮助", "有一点帮助", "没有帮助 / 更不舒服", "已保存到我的照护记录", "查看我的照护记录", "先留在我的记录里", "避雷卡"].forEach((label) => {
    assert.ok(appSource.includes(label), `missing plain feedback label: ${label}`);
  });
  assert.equal(appSource.includes("把结果轻轻抱住"), false);
  assert.equal(appSource.includes("收进贝壳"), false);
});

test("lets the user correct a saved record and feeds the corrected outcome back into memory", () => {
  assert.ok(appSource.includes("修改这一条照护记录"));
  assert.ok(appSource.includes("user_corrected_after_save"));
  assert.ok(appSource.includes("user_corrected_feedback"));
  assert.ok(appSource.includes("保存妳的纠正"));
  assert.ok(appSource.includes("旧的内容已经被替换"));
  assert.ok(appSource.includes("episode.effect === filter"));
});

test("uses a cautious five-in five-out breathing cue rather than promising a treatment effect", () => {
  assert.ok(appSource.includes("约 5 秒吸气、5 秒呼气"));
  assert.ok(appSource.includes("觉得不舒服就回到自然呼吸"));
  assert.ok(styleSource.includes("animation: baby-breathe 10s"));
  assert.equal(appSource.includes("治疗焦虑"), false);
});

test("makes onboarding choices visible and truthful", () => {
  ["妳的身体出生时", "还记得妳的第一次月经时间吗？", "记录宝宝的破壳日", "哪些东西被允许留下？", "允许宝宝在需要时联网回应"].forEach((label) => {
    assert.ok(appSource.includes(label), `missing onboarding choice: ${label}`);
  });
  assert.ok(appSource.includes("SUPPORT_EXPLANATIONS[need]"));
  assert.ok(appSource.includes("menarchePrecision: precision"));
  assert.ok(appSource.includes("maxLength={12}"));
  assert.equal(appSource.includes("onKeyDown={handleHomeComposerKeyDown}"), false);
  assert.equal(appSource.includes("onKeyDown={handleChatKeyDown}"), false);
});

test("organizes the baby square in a novice-readable order", () => {
  const birthday = appSource.indexOf("生日区");
  const gifts = appSource.indexOf("礼物区");
  const community = appSource.indexOf("宝宝社区");
  assert.ok(birthday >= 0 && gifts > birthday && community > gifts);
  ["baby-birthday-party-v2.png", "很有帮助礼物卡", "有一点帮助礼物卡", "避雷卡", "COMMUNITY_POSTS"].forEach((label) => assert.ok(appSource.includes(label)));
});

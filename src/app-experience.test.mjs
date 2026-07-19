import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
const agentSource = await readFile(new URL("./agentClient.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./styles.css", import.meta.url), "utf8");

test("keeps free text and natural-language Agent replies in the core loop", () => {
  assert.ok(appSource.includes("直接打字或说给月经宝宝听"));
  assert.ok(appSource.includes("continueConversation"));
  assert.ok(appSource.includes("联网 Agent 已连接"));
  assert.ok(appSource.includes("设备内陪伴模式 · 当前消息不会上传"));
  assert.ok(agentSource.includes('fetch("/api/agent"'));
  assert.ok(agentSource.includes("if (!context.allowRemote) return fallback"));
  assert.ok(serverSource.includes('req.url === "/api/agent"'));
  assert.ok(serverSource.includes("不诊断、不宣称测到排卵或激素"));
});

test("saves feedback plainly and makes later sharing optional", () => {
  ["很有帮助", "有一点帮助", "没有帮助 / 更不舒服", "已保存到我的照护记录", "查看我的照护记录", "先留在我的记录里", "避雷卡"].forEach((label) => {
    assert.ok(appSource.includes(label), `missing plain feedback label: ${label}`);
  });
  assert.equal(appSource.includes("把结果轻轻抱住"), false);
  assert.equal(appSource.includes("收进贝壳"), false);
});

test("uses a cautious five-in five-out breathing cue rather than promising a treatment effect", () => {
  assert.ok(appSource.includes("约 5 秒吸气、5 秒呼气"));
  assert.ok(appSource.includes("觉得不舒服就回到自然呼吸"));
  assert.ok(styleSource.includes("animation: baby-breathe 10s"));
  assert.equal(appSource.includes("治疗焦虑"), false);
});

test("makes onboarding choices visible and truthful", () => {
  ["妳的身体出生时", "还记得妳的第一次月经时间吗？", "记录宝宝的破壳日", "哪些东西被允许留下？", "允许把当前消息发给联网 Agent"].forEach((label) => {
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

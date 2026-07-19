import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
const agentSource = await readFile(new URL("./agentClient.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./styles.css", import.meta.url), "utf8");

test("keeps free text and natural-language Agent replies in the core loop", () => {
  assert.ok(appSource.includes("直接打字给它"));
  assert.ok(appSource.includes("continueConversation"));
  assert.ok(appSource.includes("在线 Agent 已连接"));
  assert.ok(appSource.includes("本地安全梳理 · 模型服务暂未连接"));
  assert.ok(agentSource.includes('fetch("/api/agent"'));
  assert.ok(serverSource.includes('req.url === "/api/agent"'));
  assert.ok(serverSource.includes("不诊断、不宣称测到排卵或激素"));
});

test("saves feedback plainly and makes later sharing optional", () => {
  ["很有帮助", "有一点帮助", "没有帮助 / 更不舒服", "已保存到我的照护记录", "查看我的照护记录", "暂时不分享"].forEach((label) => {
    assert.ok(appSource.includes(label), `missing plain feedback label: ${label}`);
  });
  assert.equal(appSource.includes("把结果轻轻抱住"), false);
  assert.equal(appSource.includes("收进贝壳"), false);
});

test("uses a cautious ten-second breathing cue rather than promising a treatment effect", () => {
  assert.ok(appSource.includes("约 10 秒一次"));
  assert.ok(appSource.includes("不舒服就回到自然呼吸"));
  assert.ok(styleSource.includes("animation: baby-breathe 10s"));
  assert.equal(appSource.includes("治疗焦虑"), false);
});

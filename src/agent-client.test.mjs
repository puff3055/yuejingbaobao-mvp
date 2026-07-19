import assert from "node:assert/strict";
import test from "node:test";
import { localReply, requestAgentReply } from "./agentClient.js";
import { analyzeInput } from "./agent.js";

const analysis = {
  tags: ["下腹疼痛", "现实任务不能取消"],
  context: "妳需要在身体不舒服时面对下午的会议。",
  followUp: "这次和以往相似吗？",
};

const bannedTemplate = /我听见了|我理解妳|我先记下了|我抓到.{0,6}重点|先不管记录|——小潮/;

test("first pain reply cares about the real constraint and asks only one useful question", () => {
  const realAnalysis = analyzeInput("我现在小腹特别痛，下午还有会。");
  const reply = localReply({ analysis: realAnalysis, message: "我现在小腹特别痛，下午还有会。" });
  assert.match(reply, /偏偏下午还有会/);
  assert.match(reply, /走动、坐着或集中注意/);
  assert.ok(realAnalysis.tags.includes("现实任务不能取消"));
  assert.equal(realAnalysis.taskDetail, "下午的会议");
  assert.equal((reply.match(/？/g) || []).length, 1);
  assert.doesNotMatch(reply, bannedTemplate);
});

test("a follow-up question never reveals an action card before the user answers", async () => {
  const realAnalysis = analyzeInput("我现在小腹特别痛，下午还有会。\n用户补充：主要很难集中");
  const result = await requestAgentReply({
    analysis: realAnalysis,
    message: "主要很难集中",
    history: [{ role: "user", content: "我现在小腹特别痛，下午还有会。" }, { role: "assistant", content: "这次的痛会影响妳集中注意吗？" }],
    context: { allowRemote: false },
  });
  assert.equal(result.kind, "question");
  assert.deepEqual(result.quickReplies, ["和以前差不多", "明显不一样"]);
  assert.match(result.reply, /熟悉的那种痛/);
});

test("an ordinary action appears only after function impact and change are answered", async () => {
  const realAnalysis = analyzeInput("我现在小腹特别痛，下午还有会。\n用户补充：主要很难集中\n用户补充：和以前差不多");
  const result = await requestAgentReply({
    analysis: realAnalysis,
    message: "和以前差不多",
    history: [
      { role: "user", content: "我现在小腹特别痛，下午还有会。" },
      { role: "assistant", content: "这次的痛会影响妳集中注意吗？" },
      { role: "user", content: "主要很难集中" },
      { role: "assistant", content: "这次和妳熟悉的痛相似吗？" },
    ],
    context: { allowRemote: false },
  });
  assert.equal(result.kind, "action");
  assert.equal(result.quickReplies.length, 0);
});

test("follow-up does not repeat a summary or ask the same safety bundle again", () => {
  const reply = localReply({
    analysis,
    message: "和以前差不多，没有头晕、发热或异常出血，但站着讲会更难受。",
    history: [{ role: "user", content: "小腹疼" }, { role: "assistant", content: "这次的痛会影响走动吗？" }],
  });
  assert.match(reply, /熟悉的疼法/);
  assert.match(reply, /合不合此刻/);
  assert.doesNotMatch(reply, /头晕、发热、异常出血/);
  assert.doesNotMatch(reply, bannedTemplate);
});

test("a failed remembered action is actively kept out of the next default", () => {
  const reply = localReply({
    analysis,
    message: "和以前差不多",
    history: [{ role: "user", content: "小腹疼" }],
    memory: { actionTitle: "温热下腹", effect: "none" },
  });
  assert.match(reply, /不会再把它放在前面/);
  assert.doesNotMatch(reply, /再试一次/);
});

test("a helpful remembered action returns as a choice, not a command", () => {
  const reply = localReply({
    analysis,
    message: "和以前差不多",
    history: [{ role: "user", content: "小腹疼" }],
    memory: { actionTitle: "温热下腹", effect: "helped" },
  });
  assert.match(reply, /确实让妳轻了一点/);
  assert.match(reply, /今天还方便用它吗/);
  assert.doesNotMatch(reply, /妳应该|妳必须/);
});

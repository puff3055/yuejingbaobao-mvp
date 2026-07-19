import assert from "node:assert/strict";
import test from "node:test";
import { localReply } from "./agentClient.js";

const analysis = {
  tags: ["下腹疼痛", "现实任务不能取消"],
  context: "你需要在身体不舒服时面对下午三点的汇报。",
  followUp: "这次和以往相似吗？有没有突然加重、异常出血、头晕或发热？",
};

test("local first reply reflects the situation and asks one useful follow-up", () => {
  const reply = localReply({ analysis, message: "小腹疼但下午必须汇报", babyName: "小潮" });
  assert.match(reply, /下午三点的汇报/);
  assert.match(reply, /这次和以往相似吗/);
});

test("local follow-up reply acknowledges new negatives and functional limits without repeating itself", () => {
  const reply = localReply({
    analysis,
    message: "和以前差不多，没有头晕、发热或异常出血，但站着讲会更难受。",
    babyName: "小潮",
    history: [{ role: "user", content: "小腹疼" }, { role: "assistant", content: "我先听你说" }],
  });
  assert.match(reply, /和以往的模式相似/);
  assert.match(reply, /头晕、发热、异常出血/);
  assert.match(reply, /站着讲会更难受/);
  assert.doesNotMatch(reply, /这次和以往相似吗/);
});

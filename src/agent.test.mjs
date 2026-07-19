import assert from "node:assert/strict";
import test from "node:test";
import { analyzeInput, applyEpisodeOutcome, createEpisode, findSimilarEpisode, recallCopy } from "./agent.js";

test("understands cycle day, pain and an exact real-world task", () => {
  const result = analyzeInput("今天经期第二天，小腹很痛，但下午三点有个必须完成的汇报。");
  assert.equal(result.cycleDay, 2);
  assert.equal(result.taskDetail, "下午三点的汇报");
  assert.equal(result.recommendedGift, "meeting");
  assert.deepEqual(result.tags, ["经期 D2", "下腹疼痛", "现实任务不能取消"]);
  assert.match(result.context, /下午三点的汇报/);
});

test("turns low-effort body-map language into useful state tags", () => {
  const result = analyzeInput("我现在下腹不舒服。疼痛程度：很强；现在的心情：很低落；现在的精力：快耗尽。");
  assert.equal(result.recommendedGift, "heat");
  assert.ok(result.tags.includes("下腹疼痛"));
  assert.ok(result.tags.includes("疼痛很强"));
  assert.ok(result.tags.includes("情绪变化"));
  assert.ok(result.tags.includes("精力偏低"));
  assert.match(result.context, /疼痛已经很强/);
  assert.deepEqual(result.structuredState, { pain: "很强", mood: "很低落", energy: "快耗尽" });
});

test("understands plain-language body-map corrections without punctuation", () => {
  const result = analyzeInput("我今天经期第二天，下腹中等疼痛，心情有点烦、精力偏低，下午三点还要汇报。");
  assert.ok(result.tags.includes("下腹疼痛"));
  assert.ok(result.tags.includes("情绪变化"));
  assert.ok(result.tags.includes("精力偏低"));
  assert.ok(result.tags.includes("现实任务不能取消"));
});

test("chooses the time expression closest to the real-world task", () => {
  const result = analyzeInput("今天腰很酸，精力快耗尽了，明早还有考试。");
  assert.equal(result.taskDetail, "明早的考试");
  assert.ok(result.tags.includes("腰背不适"));
  assert.ok(result.tags.includes("精力偏低"));
});

test("routes heavy bleeding with systemic symptoms away from ordinary care", () => {
  const result = analyzeInput("一个小时就浸透一片卫生巾，而且头晕心慌。");
  assert.equal(result.redFlag?.code, "bleeding");
  assert.match(result.redFlag?.action || "", /立即求助/);
});

test("does not explain self-harm language as a cycle personality", () => {
  const result = analyzeInput("我真的活不下去了，想伤害自己。");
  assert.equal(result.redFlag?.code, "crisis");
  assert.match(result.redFlag?.action || "", /马上联系/);
});

test("prioritizes pregnancy-related bleeding or one-sided pain for timely assessment", () => {
  const result = analyzeInput("我可能怀孕了，现在出血而且单侧腹痛、头晕。");
  assert.equal(result.redFlag?.code, "pregnancy");
  assert.match(result.redFlag?.action || "", /尽快获得医疗评估/);
});

test("routes sudden one-sided pain with fever away from self-care", () => {
  const result = analyzeInput("今天突然单侧很痛，还发烧、持续呕吐。");
  assert.equal(result.redFlag?.code, "acute");
  assert.match(result.redFlag?.action || "", /尽快联系医疗机构/);
});

test("does not turn a clear denial of fever into an acute red flag", () => {
  const result = analyzeInput("经期第二天小腹痛，和以前差不多，没有发烧，也没有头晕。下午还要汇报。");
  assert.equal(result.redFlag, undefined);
  assert.ok(result.tags.includes("下腹疼痛"));
  assert.ok(result.tags.includes("现实任务不能取消"));
});

test("treats a never-before severe pain pattern as a change worth assessment", () => {
  const result = analyzeInput("从没这么剧痛过，而且出现异常分泌物。");
  assert.equal(result.redFlag?.code, "acute");
  assert.match(result.redFlag?.title || "", /值得尽快评估/);
});

test("stores the actual action and keeps a single observation honest", () => {
  const analysis = analyzeInput("今天经期第二天，小腹很痛，但下午三点还要汇报。");
  const episode = createEpisode(analysis, "some", ["pelvis"], { title: "汇报前十分钟缓冲" });
  assert.equal(episode.cycleDay, 2);
  assert.equal(episode.actionTitle, "汇报前十分钟缓冲");
  assert.equal(episode.effect, "some");
  assert.match(episode.confidence, /不能证明因果/);
  assert.match(recallCopy([episode]), /有一点帮助/);
});

test("does not fabricate personal knowledge before an outcome exists", () => {
  assert.match(recallCopy([]), /没有足够的真实结果/);
});

test("respects local-memory opt-out while preserving in-session care feedback", () => {
  const store = { privacy: { localMemory: false }, episodes: [], growth: 4, cycleDay: 24, cycleAnchorConfirmed: false, preparedGiftIds: [], babyState: "listening" };
  const analysis = analyzeInput("经期第3天，小腹疼。");
  const episode = createEpisode(analysis, "helped", ["pelvis"], { title: "温热下腹 20 分钟" });
  const next = applyEpisodeOutcome(store, episode, "heat", analysis);
  assert.equal(next.episodes.length, 0);
  assert.equal(next.cycleDay, 24);
  assert.equal(next.cycleAnchorConfirmed, false);
  assert.equal(next.growth, 4);
  assert.equal(next.babyState, "listening");
});

test("saves structured body-map state without inventing omitted fields", () => {
  const analysis = analyzeInput("我现在下腹不舒服。疼痛程度：中等；现在的精力：偏低。想请你帮我一起梳理。");
  const episode = createEpisode(analysis, "some", ["pelvis"], { title: "温热下腹 20 分钟" }, { pain: "中等", mood: null, energy: "偏低" });
  assert.deepEqual(episode.structuredState, { pain: "中等", energy: "偏低" });
  assert.deepEqual(episode.bodyZones, ["pelvis"]);
});

test("recalls only a meaningfully similar prior context", () => {
  const pain = { id: "pain", tags: ["下腹疼痛", "现实任务不能取消"], taskDetail: "下午三点的汇报", actionTitle: "汇报前十分钟缓冲", effect: "some" };
  const sleep = { id: "sleep", tags: ["睡眠变化"], taskDetail: null, actionTitle: "经前睡眠观察卡", effect: "helped" };
  const analysis = analyzeInput("今天小腹很痛，下午四点还要汇报。");
  assert.equal(findSimilarEpisode([sleep, pain], analysis)?.id, "pain");
  assert.match(recallCopy([sleep, pain], analysis), /相似处境/);
});

test("remembers a failed action as something not to repeat by default", () => {
  const failed = { id: "failed", tags: ["下腹疼痛"], actionTitle: "温热下腹 20 分钟", effect: "none" };
  const analysis = analyzeInput("小腹很痛。");
  assert.match(recallCopy([failed], analysis), /不会把它当成默认答案/);
});

test("routes a knowledge question to evidence separation instead of a random care tip", () => {
  const result = analyzeInput("我看到一个说法：黄体期不适合运动。你能帮我分清证据和风险吗？");
  assert.equal(result.recommendedGift, "evidence");
  assert.ok(result.tags.includes("知识求证"));
  assert.match(result.context, /证据/);
});

test("keeps pre-menarche preparation in the seed branch", () => {
  const result = analyzeInput("我还没有来过月经，担心第一次在学校突然来，不知道准备什么。");
  assert.equal(result.recommendedGift, "first-period");
  assert.ok(result.tags.includes("初潮准备"));
  assert.match(result.context, /可信求助/);
});

test("turns post-menstrual life review into a timeline, not a sleep tip", () => {
  const result = analyzeInput("我已经绝经了，想把以前的月经变化和有用经验整理成一条时间线。");
  assert.equal(result.recommendedGift, "timeline");
  assert.ok(result.tags.includes("长期变化整理"));
});

test("treats bleeding after menopause as a prompt medical-assessment boundary", () => {
  const result = analyzeInput("我已经绝经了，今天突然又出血了。");
  assert.equal(result.redFlag?.code, "postmenopausal_bleeding");
  assert.match(result.redFlag?.action || "", /尽快联系/);
});

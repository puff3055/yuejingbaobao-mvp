import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicPracticeClusters, normalizeMenstrualLanguage, prepareProfessionalCards } from "./knowledge.js";

test("normalizes euphemisms and removes social hashtags", () => {
  const result = normalizeMenstrualLanguage("大姨妈痛 #女生必看 #缓解痛经");
  assert.equal(result, "月经痛");
  assert.doesNotMatch(result, /姨妈|#/);
});

test("clusters public excerpts without treating engagement as people or proof", () => {
  const clusters = buildPublicPracticeClusters([
    { candidateId: "1", title: "姨妈痛热敷", excerpt: "亲测有效", sourceUrl: "https://example.com/1", platform: "公开平台", visibleEngagement: { likes: 999 } },
    { candidateId: "2", title: "经期瑜伽", excerpt: "排瘀变美", sourceUrl: "https://example.com/2", platform: "公开平台", visibleEngagement: { likes: 888 } },
  ]);
  const warmth = clusters.find((item) => item.id === "pain-warmth");
  assert.equal(warmth.candidateCount, 1);
  assert.match(warmth.sourceLabel, /1 条候选摘要/);
  assert.match(warmth.examples[0].excerpt, /下腹热敷/);
  assert.doesNotMatch(warmth.examples[0].excerpt, /亲测有效|女生必看/);
  assert.doesNotMatch(JSON.stringify(clusters), /999|888|人推荐|有效人数/);
  assert.doesNotMatch(JSON.stringify(clusters), /姨妈/);
});

test("professional cards receive readable categories and normalized wording", () => {
  const cards = prepareProfessionalCards([], [{ myth_id: "m1", theme: "APP预测", myth_statement: "姨妈 App 能确认排卵", accurate_correction: "不能。" }]);
  assert.equal(cards[0]._category, "记录与预测");
  assert.equal(cards[0]._title, "月经 App 能确认排卵");
});

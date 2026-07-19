import assert from "node:assert/strict";
import test from "node:test";
import { deriveCycleDayFromStart, getCycleMoment, localDateValue, upsertRhythmLog } from "./cycle.js";

test("derives a locally reported cycle day without UTC date drift", () => {
  assert.equal(deriveCycleDayFromStart("2026-07-18", new Date(2026, 6, 19, 23, 30)), 2);
  assert.equal(deriveCycleDayFromStart("2026-07-20", new Date(2026, 6, 19)), null);
  assert.equal(localDateValue(new Date(2026, 6, 9)), "2026-07-09");
});

test("explains that menstruation and the ovarian follicular phase overlap", () => {
  const moment = getCycleMoment({ profile: { lifeStage: "cycle" }, cycleAnchorConfirmed: true, cycleDay: 2 });
  assert.equal(moment.available, true);
  assert.match(moment.phaseLabel, /月经 \/ 脱落.*卵泡期/);
  assert.match(moment.next, /排卵时点仍不能由日历确认/);
  assert.match(moment.description, /真实记录为准/);
});

test("does not fabricate a current phase without an authorized position", () => {
  const moment = getCycleMoment({ profile: { lifeStage: "cycle" }, cycleAnchorConfirmed: false, cycleDay: 24 });
  assert.equal(moment.available, false);
  assert.match(moment.title, /还没有你的当前位置/);
  assert.equal(moment.ovarian, null);
});

test("does not create a menstrual-cycle day for seed or phoenix stages", () => {
  for (const lifeStage of ["seed", "phoenix"]) {
    const moment = getCycleMoment({ profile: { lifeStage }, cycleAnchorConfirmed: true, cycleDay: 8 });
    assert.equal(moment.available, false);
    assert.equal(moment.withinPanorama, false);
  }
});

test("keeps a self-reported long cycle outside the D1-D30 teaching canvas", () => {
  const moment = getCycleMoment({ profile: { lifeStage: "cycle" }, cycleAnchorConfirmed: true, cycleDay: 36 });
  assert.equal(moment.available, true);
  assert.equal(moment.withinPanorama, false);
  assert.match(moment.phaseLabel, /超出 D1–D30/);
});

test("creates and edits a rhythm log without duplicating it", () => {
  const now = new Date("2026-07-19T08:00:00.000Z");
  const created = upsertRhythmLog([], { cycleDay: 2, sleep: "没睡够", pain: "有一点" }, now, () => "rhythm-1");
  assert.equal(created.length, 1);
  assert.equal(created[0].id, "rhythm-1");
  const edited = upsertRhythmLog(created, { ...created[0], pain: "很影响我" }, new Date("2026-07-19T09:00:00.000Z"));
  assert.equal(edited.length, 1);
  assert.equal(edited[0].pain, "很影响我");
  assert.equal(edited[0].sleep, "没睡够");
});

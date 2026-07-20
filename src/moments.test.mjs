import assert from "node:assert/strict";
import test from "node:test";
import { buildClinicianSummary, calendarTone, deleteMomentStore, momentsForDate, selectMoments, updateMomentStore } from "./moments.js";

const store = {
  cycleAnchorConfirmed: true,
  cycleStartDate: "2026-07-18",
  cycleEndDate: "2026-07-20",
  cycleOngoing: false,
  cycleUpdatedAt: "2026-07-20T08:00:00.000Z",
  episodes: [{
    id: "episode-a",
    createdAt: "2026-07-19T06:00:00.000Z",
    rawText: "小腹痛，下午还有会",
    bodyZones: ["lower-abdomen"],
    symptoms: "小腹痛",
    functionalImpact: "很难集中",
    actionTitle: "短暂休息",
    effect: "none",
    structuredState: { pain: "很强", mood: "有点烦" },
    missingness: { onset: "unknown" },
  }],
  rhythmLogs: [{ id: "rhythm-a", recordedAt: "2026-07-19T10:00:00.000Z", updatedAt: "2026-07-19T10:00:00.000Z", pain: "有一点", sleep: null, energy: "偏低", mood: null, note: "午后" }],
};

test("adapts every source without deduplicating two observations on the same day", () => {
  const moments = selectMoments(store, "2026-07-20");
  assert.equal(momentsForDate(moments, "2026-07-19").filter((item) => item.sourceType !== "period").length, 2);
  assert.equal(moments.find((item) => item.id === "episode:episode-a").fields.bodyZones[0], "lower-abdomen");
  assert.equal(moments.find((item) => item.id === "episode:episode-a").fieldStates.onset, "unknown");
  assert.equal(moments.find((item) => item.id === "rhythm:rhythm-a").fieldStates.sleep, "not_recorded");
});

test("writes corrections back to the original source while preserving stable identity and timestamps", () => {
  const next = updateMomentStore(store, "episode:episode-a", { rawText: "已纠正", structuredState: { pain: "中等" } }, new Date("2026-07-20T12:00:00.000Z"));
  assert.equal(next.episodes[0].id, "episode-a");
  assert.equal(next.episodes[0].createdAt, store.episodes[0].createdAt);
  assert.equal(next.episodes[0].rawText, "已纠正");
  assert.equal(next.episodes[0].structuredState.mood, "有点烦");
  assert.equal(next.episodes[0].structuredState.pain, "中等");
  assert.equal(next.episodes[0].effect, "none");
  assert.equal(next.episodes[0].provenance.correction, "user_corrected_after_save");
});

test("clearing a corrected field changes recorded to not_recorded without flattening explicit none", () => {
  const episodeStore = {
    ...store,
    episodes: [{ ...store.episodes[0], symptoms: "小腹痛", functionalImpact: "明确没有影响", missingness: { symptoms: "recorded", functionalImpact: "explicit_none", onset: "unknown" } }],
  };
  const next = updateMomentStore(episodeStore, "episode:episode-a", { symptoms: "", functionalImpact: "明确没有影响", missingness: { functionalImpact: "explicit_none" } });
  assert.equal(next.episodes[0].missingness.symptoms, "not_recorded");
  assert.equal(next.episodes[0].missingness.functionalImpact, "explicit_none");
  assert.equal(next.episodes[0].missingness.onset, "unknown");
});

test("editing another field preserves unknown and declined semantics", () => {
  const episodeStore = {
    ...store,
    episodes: [{ ...store.episodes[0], onset: "", currentConstraint: "", missingness: { onset: "unknown", currentConstraint: "declined" } }],
  };
  const next = updateMomentStore(episodeStore, "episode:episode-a", {
    rawText: "只修改这一句",
    onset: "",
    currentConstraint: "",
  });
  assert.equal(next.episodes[0].missingness.onset, "unknown");
  assert.equal(next.episodes[0].missingness.currentConstraint, "declined");
});

test("clearing a rhythm value updates its missingness while preserving unrelated dimensions", () => {
  const rhythmStore = { ...store, rhythmLogs: [{ ...store.rhythmLogs[0], missingness: { pain: "recorded", sleep: "declined" } }] };
  const next = updateMomentStore(rhythmStore, "rhythm:rhythm-a", { pain: null });
  assert.equal(next.rhythmLogs[0].missingness.pain, "not_recorded");
  assert.equal(next.rhythmLogs[0].missingness.sleep, "declined");
});

test("deletes only the selected source and keeps the other observation", () => {
  const next = deleteMomentStore(store, "rhythm:rhythm-a");
  assert.equal(next.rhythmLogs.length, 0);
  assert.equal(next.episodes.length, 1);
});

test("calendar layers stay blank when a dimension was not recorded", () => {
  const moments = selectMoments(store, "2026-07-20");
  const day = momentsForDate(moments, "2026-07-19");
  assert.equal(calendarTone(day, "sleep"), "empty");
  assert.equal(calendarTone(day, "pain"), "high");
  assert.equal(calendarTone(day, "period"), "period");
});

test("clinician summary only contains confirmed records and keeps failed outcomes", () => {
  const summary = buildClinicianSummary(store);
  assert.deepEqual(summary.concern, ["小腹痛，下午还有会"]);
  assert.equal(summary.actions[0].effect, "none");
  assert.equal(summary.period.positionBasis, "user_confirmed_dates");
  assert.match(summary.boundary, /不提供诊断/);
});

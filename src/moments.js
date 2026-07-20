const DAY_MS = 24 * 60 * 60 * 1000;

const FIELD_KEYS = [
  "cycleContext",
  "symptoms",
  "bodyLocations",
  "onset",
  "functionalImpact",
  "differenceFromUsual",
  "currentConstraint",
];

function localDateFromTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(value, amount) {
  const date = parseLocalDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + amount);
  return localDateFromTimestamp(date);
}

function daysBetween(startValue, endValue) {
  const start = parseLocalDate(startValue);
  const end = parseLocalDate(endValue);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function fieldState(value, explicitState) {
  if (explicitState) return explicitState;
  return value === null || value === undefined || value === "" ? "not_recorded" : "recorded";
}

function nextMissingness(current, patch, directKeys, structuredKeys = [], sourceRecord = {}) {
  const result = { ...(current || {}), ...(patch.missingness || {}) };
  directKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(patch, key) || Object.prototype.hasOwnProperty.call(patch.missingness || {}, key)) return;
    if (patch[key] === sourceRecord[key] && result[key]) return;
    result[key] = fieldState(patch[key]);
  });
  structuredKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(patch.structuredState || {}, key) || Object.prototype.hasOwnProperty.call(patch.missingness || {}, key)) return;
    if (patch.structuredState[key] === sourceRecord.structuredState?.[key] && result[key]) return;
    result[key] = fieldState(patch.structuredState[key]);
  });
  return result;
}

function episodeMoment(episode) {
  const occurredAt = episode.occurredAt || episode.createdAt || episode.updatedAt;
  const structured = episode.structuredState || {};
  const fields = {
    cycleContext: episode.cycleContext || "",
    symptoms: episode.symptoms || "",
    bodyLocations: episode.bodyLocations || "",
    bodyZones: Array.isArray(episode.bodyZones) ? episode.bodyZones : [],
    onset: episode.onset || "",
    functionalImpact: episode.functionalImpact || "",
    differenceFromUsual: episode.differenceFromUsual || "",
    currentConstraint: episode.currentConstraint || "",
    pain: structured.pain ?? null,
    sleep: structured.sleep ?? null,
    mood: structured.mood ?? null,
    energy: structured.energy ?? null,
    actionTitle: episode.actionTitle || "",
    effect: episode.effect || null,
  };
  return {
    id: `episode:${episode.id}`,
    sourceType: "episode",
    sourceId: episode.id,
    occurredAt,
    updatedAt: episode.updatedAt || episode.createdAt || occurredAt,
    date: localDateFromTimestamp(occurredAt),
    cycleId: episode.cycleId || null,
    cycleDay: Number.isFinite(Number(episode.cycleDay)) ? Number(episode.cycleDay) : null,
    rawText: episode.rawText || "",
    confirmation: "user_confirmed",
    fields,
    fieldStates: Object.fromEntries([
      ...FIELD_KEYS.map((key) => [key, fieldState(fields[key], episode.missingness?.[key])]),
      ...["pain", "sleep", "mood", "energy"].map((key) => [key, fieldState(fields[key], episode.missingness?.[key])]),
    ]),
    provenance: episode.provenance || { situation: episode.source || "user_confirmed" },
    sourceRecord: episode,
  };
}

function rhythmMoment(log) {
  const occurredAt = log.recordedAt || log.updatedAt;
  const fields = {
    sleep: log.sleep ?? null,
    pain: log.pain ?? null,
    energy: log.energy ?? null,
    mood: log.mood ?? null,
    note: log.note || "",
  };
  return {
    id: `rhythm:${log.id}`,
    sourceType: "rhythm",
    sourceId: log.id,
    occurredAt,
    updatedAt: log.updatedAt || occurredAt,
    date: localDateFromTimestamp(occurredAt),
    cycleId: log.cycleId || null,
    cycleDay: Number.isFinite(Number(log.cycleDay)) ? Number(log.cycleDay) : null,
    rawText: log.note || "",
    confirmation: "user_confirmed",
    fields,
    fieldStates: Object.fromEntries(["sleep", "pain", "energy", "mood", "note"].map((key) => [key, fieldState(fields[key], log.missingness?.[key])])),
    provenance: log.provenance || { values: "user_page_entry" },
    sourceRecord: log,
  };
}

function periodMoments(store, today) {
  const start = store?.cycleStartDate;
  if (!store?.cycleAnchorConfirmed || !start) return [];
  const confirmedEnd = store.cycleEndDate || (store.cycleOngoing ? today : start);
  const duration = daysBetween(start, confirmedEnd);
  if (duration === null || duration < 0) return [];
  return Array.from({ length: Math.min(duration + 1, 31) }, (_, index) => {
    const date = addDays(start, index);
    return {
      id: `period:${date}`,
      sourceType: "period",
      sourceId: "confirmed-cycle-range",
      occurredAt: `${date}T12:00:00`,
      updatedAt: store.cycleUpdatedAt || `${date}T12:00:00`,
      date,
      cycleId: start,
      cycleDay: index + 1,
      rawText: index === 0 ? "妳确认这一天月经开始" : "妳确认这一天仍在月经期",
      confirmation: "user_confirmed",
      fields: { bleeding: index === 0 ? "月经开始" : "月经期" },
      fieldStates: { bleeding: "recorded" },
      provenance: { bleeding: "user_confirmed_period_date" },
      sourceRecord: null,
    };
  });
}

export function selectMoments(store, today = localDateFromTimestamp(new Date())) {
  const seen = new Set();
  const normalized = [
    ...(store?.episodes || []).map(episodeMoment),
    ...(store?.rhythmLogs || []).map(rhythmMoment),
    ...periodMoments(store, today),
  ].filter((moment) => {
    if (!moment.date || seen.has(moment.id)) return false;
    seen.add(moment.id);
    return true;
  });
  return normalized.sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
}

export function momentsForDate(moments, date) {
  return (moments || []).filter((moment) => moment.date === date);
}

export function updateMomentStore(store, momentId, patch, now = new Date()) {
  const [sourceType, sourceId] = String(momentId).split(":");
  const updatedAt = now.toISOString();
  if (sourceType === "episode") {
    return {
      ...store,
      episodes: (store.episodes || []).map((episode) => episode.id === sourceId ? {
        ...episode,
        ...patch,
        structuredState: patch.structuredState ? { ...(episode.structuredState || {}), ...patch.structuredState } : episode.structuredState,
        bodyZones: patch.bodyZones === undefined ? episode.bodyZones : patch.bodyZones,
        createdAt: episode.createdAt,
        updatedAt,
        missingness: nextMissingness(episode.missingness, patch, FIELD_KEYS, ["pain", "sleep", "mood", "energy"], episode),
        provenance: { ...(episode.provenance || {}), ...(patch.provenance || {}), correction: "user_corrected_after_save" },
      } : episode),
    };
  }
  if (sourceType === "rhythm") {
    return {
      ...store,
      rhythmLogs: (store.rhythmLogs || []).map((log) => log.id === sourceId ? {
        ...log,
        ...patch,
        id: log.id,
        recordedAt: log.recordedAt,
        updatedAt,
        missingness: nextMissingness(log.missingness, patch, ["sleep", "pain", "energy", "mood", "note"], [], log),
        provenance: { ...(log.provenance || {}), ...(patch.provenance || {}), correction: "user_corrected_after_save" },
      } : log),
    };
  }
  return store;
}

export function deleteMomentStore(store, momentId) {
  const [sourceType, sourceId] = String(momentId).split(":");
  if (sourceType === "episode") return { ...store, episodes: (store.episodes || []).filter((episode) => episode.id !== sourceId) };
  if (sourceType === "rhythm") return { ...store, rhythmLogs: (store.rhythmLogs || []).filter((log) => log.id !== sourceId) };
  return store;
}

export function calendarTone(moments, layer) {
  const records = (moments || []).filter((moment) => moment.sourceType !== "period");
  if (layer === "overview") return records.length ? "recorded" : moments.some((moment) => moment.sourceType === "period") ? "period" : "empty";
  if (layer === "period") return moments.some((moment) => moment.sourceType === "period") ? "period" : "empty";
  const values = records.map((moment) => moment.fields?.[layer]).filter((value) => value !== null && value !== undefined && value !== "");
  if (!values.length) return "empty";
  const joined = values.join(" ");
  if (/很影响|很强|快耗尽|很低落|没睡够|剧烈/.test(joined)) return "high";
  if (/有一点|中等|偏低|有点烦|一般/.test(joined)) return "medium";
  return "low";
}

export function buildClinicianSummary(store) {
  const moments = selectMoments(store).filter((moment) => moment.sourceType !== "period");
  const episodes = moments.filter((moment) => moment.sourceType === "episode");
  const rhythms = moments.filter((moment) => moment.sourceType === "rhythm");
  const values = (key) => [...new Set(moments.map((moment) => moment.fields?.[key]).filter(Boolean))];
  const coverageDates = [...new Set(moments.map((moment) => moment.date))].sort();
  const questions = [];
  if (values("functionalImpact").length) questions.push("这些变化与功能受影响是否需要进一步评估？");
  if (episodes.some((moment) => moment.fields.effect === "none")) questions.push("已经尝试但没有帮助或更不舒服的做法，下一步如何调整？");
  if (!questions.length) questions.push("这些周期记录中，哪些变化值得继续观察或检查？");
  return {
    generatedAt: new Date().toISOString(),
    concern: episodes.map((moment) => moment.rawText).filter(Boolean),
    period: {
      start: store.cycleStartDate || null,
      end: store.cycleEndDate || null,
      ongoing: Boolean(store.cycleOngoing),
      positionBasis: store.cycleStartDate ? "user_confirmed_dates" : store.cycleAnchorConfirmed ? "user_reported_cycle_day" : "not_recorded",
    },
    symptoms: values("symptoms"),
    bodyLocations: values("bodyLocations"),
    functionalImpact: values("functionalImpact"),
    onset: values("onset"),
    differenceFromUsual: values("differenceFromUsual"),
    context: values("currentConstraint"),
    actions: episodes.map((moment) => ({ action: moment.fields.actionTitle || "没有记录", effect: moment.fields.effect || "not_recorded", date: moment.date, sourceMomentId: moment.id })),
    rhythm: {
      days: rhythms.length,
      sleep: values("sleep"),
      pain: values("pain"),
      mood: values("mood"),
      energy: values("energy"),
      entries: rhythms.map((moment) => ({
        date: moment.date,
        sourceMomentId: moment.id,
        sleep: moment.fields.sleep,
        pain: moment.fields.pain,
        mood: moment.fields.mood,
        energy: moment.fields.energy,
        note: moment.fields.note,
      })),
    },
    coverage: { recordCount: moments.length, dates: coverageDates, from: coverageDates[0] || null, to: coverageDates.at(-1) || null },
    questions,
    boundary: "这份锦囊只整理妳确认过的记录，不提供诊断，也不替代专业评估。",
  };
}

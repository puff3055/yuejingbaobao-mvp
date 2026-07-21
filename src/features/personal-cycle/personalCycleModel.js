export const STATE_VALUES = {
  VALUE: 'value',
  NONE: 'none',
  UNKNOWN: 'unknown',
  DECLINED: 'declined',
  NOT_RECORDED: 'not_recorded'
};

export const OUTCOME_VALUES = {
  HELPED: 'helped',
  SOME: 'some',
  NOT_HELPED: 'not_helped',
  WORSE: 'worse',
  PENDING: 'pending'
};

export const OUTCOME_LABELS = {
  [OUTCOME_VALUES.HELPED]: '很有帮助',
  [OUTCOME_VALUES.SOME]: '有一点帮助',
  [OUTCOME_VALUES.NOT_HELPED]: '没有帮助',
  [OUTCOME_VALUES.WORSE]: '更不舒服',
  [OUTCOME_VALUES.PENDING]: '尚未反馈'
};

export const STATE_LABELS = {
  [STATE_VALUES.VALUE]: '有值',
  [STATE_VALUES.NONE]: '没有',
  [STATE_VALUES.UNKNOWN]: '不知道',
  [STATE_VALUES.DECLINED]: '不愿回答',
  [STATE_VALUES.NOT_RECORDED]: '未记录'
};

export function createEmptyRecord(occurredAt = new Date().toISOString()) {
  return {
    id: `record-${Date.now()}`,
    occurredAt,
    cycle: {
      cycleId: `cycle-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      day: null,
      positionSource: null
    },
    rawUserText: '',
    confirmationStatus: 'confirmed',
    fields: {
      bleeding: { state: STATE_VALUES.NOT_RECORDED, level: null },
      pain: { state: STATE_VALUES.NOT_RECORDED, intensity: null, locations: [] },
      symptoms: { state: STATE_VALUES.NOT_RECORDED, values: [] },
      sleep: { state: STATE_VALUES.NOT_RECORDED, hours: null, quality: null },
      mood: { state: STATE_VALUES.NOT_RECORDED, value: null },
      energy: { state: STATE_VALUES.NOT_RECORDED, value: null },
      concentration: { state: STATE_VALUES.NOT_RECORDED, value: null },
      functionalImpact: { state: STATE_VALUES.NOT_RECORDED, values: [] },
      context: { state: STATE_VALUES.NOT_RECORDED, values: [] }
    },
    actions: [],
    provenance: {
      origin: 'agent_conversation',
      fieldSources: {}
    }
  };
}

export function groupRecordsByCycle(records) {
  const groups = {};
  records.forEach(record => {
    const cycleId = record.cycle?.cycleId || 'unknown';
    if (!groups[cycleId]) {
      groups[cycleId] = [];
    }
    groups[cycleId].push(record);
  });
  return Object.entries(groups)
    .map(([cycleId, cycleRecords]) => ({
      cycleId,
      records: cycleRecords.sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt))
    }))
    .sort((a, b) => b.cycleId.localeCompare(a.cycleId));
}

export function getCycleDayLabel(cycleDay) {
  if (cycleDay === null || cycleDay === undefined) return '未记录';
  if (cycleDay <= 7) return `第 ${cycleDay} 天（月经初期）`;
  if (cycleDay <= 14) return `第 ${cycleDay} 天（卵泡期）`;
  if (cycleDay <= 21) return `第 ${cycleDay} 天（排卵期/黄体早期）`;
  return `第 ${cycleDay} 天（黄体晚期/经前期）`;
}

export function groupActionsByOutcome(records) {
  const groups = {
    [OUTCOME_VALUES.HELPED]: [],
    [OUTCOME_VALUES.SOME]: [],
    [OUTCOME_VALUES.NOT_HELPED]: [],
    [OUTCOME_VALUES.WORSE]: [],
    [OUTCOME_VALUES.PENDING]: []
  };

  records.forEach(record => {
    record.actions?.forEach(action => {
      const outcome = action.outcome || OUTCOME_VALUES.PENDING;
      groups[outcome].push({
        ...action,
        recordContext: {
          rawUserText: record.rawUserText,
          cycleDay: record.cycle?.day,
          occurredAt: record.occurredAt,
          pain: record.fields?.pain,
          mood: record.fields?.mood,
          energy: record.fields?.energy,
          symptoms: record.fields?.symptoms
        }
      });
    });
  });

  return groups;
}

export function findSimilarRecords(records, targetRecord) {
  const targetDay = targetRecord.cycle?.day;
  if (!targetDay) return [];

  const dayRange = 3;
  return records
    .filter(record => {
      if (record.id === targetRecord.id) return false;
      const recordDay = record.cycle?.day;
      if (!recordDay) return false;
      return Math.abs(recordDay - targetDay) <= dayRange;
    })
    .sort((a, b) => Math.abs(a.cycle.day - targetDay) - Math.abs(b.cycle.day - targetDay));
}

export function generateMedicalSummary(records) {
  const confirmedRecords = records.filter(r => r.confirmationStatus === 'confirmed');
  if (confirmedRecords.length === 0) return null;

  const sortedRecords = [...confirmedRecords].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const latestRecord = sortedRecords[0];

  const painIntensities = confirmedRecords
    .map(r => r.fields?.pain?.state === STATE_VALUES.VALUE ? r.fields.pain.intensity : null)
    .filter(v => v !== null);
  const avgPainIntensity = painIntensities.length > 0
    ? Math.round(painIntensities.reduce((a, b) => a + b, 0) / painIntensities.length)
    : null;

  const painLocations = [...new Set(
    confirmedRecords
      .flatMap(r => r.fields?.pain?.state === STATE_VALUES.VALUE ? r.fields.pain.locations : [])
  )];

  const symptoms = [...new Set(
    confirmedRecords
      .flatMap(r => r.fields?.symptoms?.state === STATE_VALUES.VALUE ? r.fields.symptoms.values : [])
  )];

  const functionalImpacts = [...new Set(
    confirmedRecords
      .flatMap(r => r.fields?.functionalImpact?.state === STATE_VALUES.VALUE ? r.fields.functionalImpact.values : [])
  )];

  const actionsTaken = confirmedRecords.flatMap(record =>
    record.actions?.map(action => ({
      action: action.label,
      outcome: OUTCOME_LABELS[action.outcome] || '未反馈'
    })) || []
  );

  return {
    userConcerns: latestRecord.rawUserText || '用户未描述具体困扰',
    latestDate: latestRecord.occurredAt,
    cyclePosition: latestRecord.cycle?.day ? `周期第 ${latestRecord.cycle.day} 天` : '周期位置未记录',
    bleedingChanges: confirmedRecords.filter(r => r.fields?.bleeding?.state === STATE_VALUES.VALUE).length > 0 ? '有记录出血情况变化' : '出血情况未记录',
    painIntensity: avgPainIntensity !== null ? `${avgPainIntensity}/10` : '未记录',
    painLocations: painLocations.length > 0 ? painLocations.join('、') : '未记录',
    symptoms: symptoms.length > 0 ? symptoms.join('、') : '未记录',
    functionalImpact: functionalImpacts.length > 0 ? functionalImpacts.join('、') : '未记录',
    actionsTaken: actionsTaken.length > 0 ? actionsTaken : null,
    changesFromPast: '与个人以往相比的变化需要结合长期记录观察',
    questionsForDoctor: '用户尚未记录想向医生提问的内容'
  };
}

export function formatDateTime(dateTimeStr) {
  try {
    const date = new Date(dateTimeStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  } catch {
    return dateTimeStr;
  }
}

export function formatDuration(start, end) {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMinutes = Math.round((endDate - startDate) / 60000);
    if (diffMinutes < 60) return `${diffMinutes}分钟`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  } catch {
    return '';
  }
}

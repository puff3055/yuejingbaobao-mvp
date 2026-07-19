const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function deriveCycleDayFromStart(startDate, today = new Date()) {
  const start = parseLocalDate(startDate);
  if (!start || !(today instanceof Date) || Number.isNaN(today.getTime())) return null;
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const difference = Math.round((todayLocal.getTime() - start.getTime()) / DAY_MS);
  return difference < 0 ? null : difference + 1;
}

const unavailableMoment = (title, description) => ({
  available: false,
  title,
  description,
  ovarian: null,
  uterine: null,
  next: "先让身体自己的时间发生，不生成一个并不存在的当前周期日。",
  preparations: ["可以继续记录真实感受和问题", "需要时向可信的人或专业人员求助"],
  withinPanorama: false,
});

export function getCycleMoment(store) {
  const lifeStage = store?.profile?.lifeStage;
  if (lifeStage === "seed") {
    return unavailableMoment("月之种子还没有破壳", "初潮前没有当前月经周期日；D1–D30 只作为以后认识身体的教学坐标。");
  }
  if (lifeStage === "phoenix") {
    return unavailableMoment("现在不生成月经周期位置", "绝经后可以回看过去的身体旅程，但不会把今天放进一个仍在发生的月经周期。");
  }
  const day = Number(store?.cycleDay);
  if (!store?.cycleAnchorConfirmed || !Number.isFinite(day) || day < 1) {
    return unavailableMoment("还没有妳的当前位置", "告诉宝宝这次月经从哪天开始，或直接填写今天是第几天，就能把妳的记录放到教学图上。");
  }

  if (day <= 5) {
    return {
      available: true,
      title: `妳主动记录在 D${day}`,
      phaseLabel: "月经 / 脱落 · 同时处于卵泡期",
      description: "教学模型里，子宫内膜正在脱落与修复；卵巢的卵泡期已经同时开始。妳自己的疼痛、睡眠、精力和心情只以真实记录为准。",
      ovarian: "卵泡期已经开始",
      uterine: "月经 / 脱落阶段",
      next: "出血常会逐渐减少，随后教学模型进入内膜增殖阶段；排卵时点仍不能由日历确认。",
      preparations: ["记下今天真实的疼痛、睡眠、精力或心情", "把过去确实对妳有帮助的照护与用品放在手边"],
      withinPanorama: true,
    };
  }
  if (day <= 12) {
    return {
      available: true,
      title: `妳主动记录在 D${day}`,
      phaseLabel: "卵泡期 · 内膜增殖阶段",
      description: "教学模型里，卵泡可能继续发育，子宫内膜进入增殖阶段。这里是相对顺序，不代表妳的卵泡、内膜或激素实测值。",
      ovarian: "卵泡期",
      uterine: "增殖阶段",
      next: "接下来可能接近一个会变化的排卵事件窗口；只凭日期不能确认是否或何时排卵。",
      preparations: ["继续记录妳实际观察到的分泌物或身体变化", "给接下来的安排保留可调整空间，不用服从阶段标签"],
      withinPanorama: true,
    };
  }
  if (day <= 16) {
    return {
      available: true,
      title: `妳主动记录在 D${day}`,
      phaseLabel: "教学模型的可变排卵窗口附近",
      description: "这是 D1–D30 生理事件示意中的相对位置。日历不能证明排卵已经发生，也不能据此推算妳的激素、情绪或能力。",
      ovarian: "排卵事件可能发生的可变窗口",
      uterine: "增殖阶段",
      next: "如果排卵发生，之后才进入黄体期与内膜分泌阶段；具体时点和长度因人而异。",
      preparations: ["继续记录身体线索，但不把单一线索当成排卵确认", "按今天的症状、睡眠和现实任务安排，而不是按阶段下命令"],
      withinPanorama: true,
    };
  }
  if (day <= 24) {
    return {
      available: true,
      title: `妳主动记录在 D${day}`,
      phaseLabel: "黄体期 · 内膜分泌阶段（教学模型）",
      description: "生理事件示意在这里进入黄体期和内膜分泌阶段，但不代表妳一定会出现 PMS、情绪或精力变化。",
      ovarian: "黄体期",
      uterine: "分泌阶段",
      next: "下一次来潮时间仍取决于妳的真实周期；一个日历位置不能给出准确倒计时。",
      preparations: ["如果过去来潮前会不适，把已验证有帮助的照护放在手边", "同时记录睡眠、压力、生病和生活安排等其他影响"],
      withinPanorama: true,
    };
  }
  if (day <= 30) {
    return {
      available: true,
      title: `妳主动记录在 D${day}`,
      phaseLabel: "黄体晚段 · 内膜分泌阶段（教学模型）",
      description: "这个位置接近 D1–D30 示意图的末段，但不能据此断言妳正在 PMS 或哪一天一定来月经。",
      ovarian: "黄体晚段教学区间",
      uterine: "分泌阶段",
      next: "如果之后真实来潮，再把那一天确认为新的 D1；周期较长或较短都可能发生。",
      preparations: ["补齐用品、衣物或出行兜底", "回看上次哪些照护有用、哪些没有，不盲目重复"],
      withinPanorama: true,
    };
  }
  return {
    available: true,
    title: `妳主动记录在 D${day}`,
    phaseLabel: "已经超出 D1–D30 教学画布",
    description: "真实周期不都在 30 天结束。这里保留妳的自述天数，不把它硬塞进一张示意图，也不据此判断原因。",
    ovarian: "仅凭日期无法判断",
    uterine: "仅凭日期无法判断",
    next: "下一次真实来潮时再确认新的 D1；如果这是明显变化、持续让妳担心或伴随严重不适，可考虑专业评估。",
    preparations: ["先核对本次月经开始日期是否记录正确", "继续留下真实症状和生活背景，避免只看周期日"],
    withinPanorama: false,
  };
}

export function upsertRhythmLog(logs, draft, now = new Date(), idFactory = () => `rhythm-${Date.now()}`) {
  const current = Array.isArray(logs) ? logs : [];
  const clean = {
    ...draft,
    id: draft.id || idFactory(),
    recordedAt: draft.recordedAt || now.toISOString(),
    updatedAt: now.toISOString(),
    cycleDay: Number.isFinite(Number(draft.cycleDay)) && Number(draft.cycleDay) > 0 ? Number(draft.cycleDay) : null,
    note: typeof draft.note === "string" ? draft.note.trim().slice(0, 80) : "",
  };
  const index = current.findIndex((item) => item.id === clean.id);
  if (index < 0) return [clean, ...current];
  return current.map((item, itemIndex) => itemIndex === index ? { ...item, ...clean } : item);
}

const RED_FLAGS = [
  { test: /(可能|怀疑|也许).{0,6}(怀孕|妊娠)|验孕.{0,4}(阳性|两条)/, code: "pregnancy", title: "先排除需要及时处理的妊娠相关风险", action: "如果有妊娠可能并伴随出血、单侧或突然加重的腹痛，请尽快获得医疗评估；头晕、晕厥或明显虚弱时立即求助。" },
  { test: /(绝经后|已经绝经).{0,12}(出血|流血)|(?:出血|流血).{0,12}(绝经后|已经绝经)/, code: "postmenopausal_bleeding", title: "绝经后再次出血值得尽快评估", action: "绝经后出现新的阴道出血时，请尽快联系妇科或合适的医疗专业人员进行评估；不要只等待它自己消失或把它当作普通月经。" },
  { test: /(一(?:个)?小时|每小时).{0,8}(一片|一张|浸透)|血崩|大量出血.{0,8}(头晕|晕|心慌|喘)/, code: "bleeding", title: "这次出血情况不适合只在家观察", action: "快速大量出血并伴头晕、晕厥、心悸或呼吸不适时，请立即求助急诊或当地紧急医疗服务。" },
  { test: /(突然|从没).{0,8}(剧痛|很痛)|单侧.{0,5}(痛|疼)|发烧|持续呕吐|异常分泌物/, code: "acute", title: "这次疼痛模式值得尽快评估", action: "突然、单侧、持续加重的疼痛，或伴发热、呕吐、异常分泌物时，请尽快联系医疗机构，不要等待宝宝的普通照护流程。" },
  { test: /(不想活|想死|自杀|伤害自己|活不下去)/, code: "crisis", title: "妳现在的安全比判断周期原因更重要", action: "请马上联系妳信任的人陪在身边，并联系当地急救或危机支持。宝宝不会把它简单归因于激素，也不会要求妳等到记录满两个周期。" },
];

const TAG_RULES = [
  [/(经期|月经).{0,3}(第二天|2天|D2)|第二天/, "经期 D2"],
  [/(痛经|肚子.{0,2}(?:痛|疼)|腹部?(?:痛|疼)|小腹.{0,3}(?:痛|疼)|下腹.{0,4}(?:不舒服|痛|疼|坠胀|痉挛)|疼痛程度[:：]\s*(?:中等|很强)|痉挛)/, "下腹疼痛"],
  [/疼痛程度[:：]\s*很强/, "疼痛很强"],
  [/(头痛|偏头痛)/, "头痛"],
  [/(腰.{0,3}(?:酸|痛|疼)|背.{0,2}(?:痛|疼))/, "腰背不适"],
  [/(量大|出血多|漏血|浸透)/, "出血/漏血"],
  [/(很累|乏力|没力气|快耗尽|精力.{0,4}(?:低|差|不够|耗尽))/, "精力偏低"],
  [/(烦躁|有点烦|焦虑|想哭|低落|情绪|心情[:：]\s*(?:有点烦|很低落))/, "情绪变化"],
  [/(汇报|会议|上班|工作|考试|答辩|出差|旅行|高铁)/, "现实任务不能取消"],
  [/(睡不好|失眠|熬夜|早醒)/, "睡眠变化"],
  [/(乳房|胸胀|胸痛)/, "乳房胀痛"],
  [/(初潮|还没有来过月经|还没来过月经|第一次(?:来)?月经)/, "初潮准备"],
  [/(已经绝经|围绝经|多年变化|整理.{0,6}(?:时间线|给医生|经验))/, "长期变化整理"],
  [/(解释|说法|证据|靠谱吗|适合我|分清)/, "知识求证"],
];

const NEGATED_RED_FLAG_PATTERN = /(?:没有|没|无|否认)(?:出现|伴随|发生|明显)?(?:突然加重|突然剧痛|单侧(?:腹|下腹)?(?:痛|疼)|大量出血|异常出血|头晕|晕厥|发烧|发热|持续呕吐|呕吐|异常分泌物)/g;

export function analyzeInput(text) {
  const normalized = text.trim();
  const safetyText = normalized.replace(NEGATED_RED_FLAG_PATTERN, "");
  const redFlag = RED_FLAGS.find((rule) => rule.test.test(safetyText));
  const digitDay = normalized.match(/(?:经期|月经).{0,4}(?:第)?(\d{1,2})天/i)?.[1] || normalized.match(/\bD(\d{1,2})\b/i)?.[1];
  const chineseDayToken = normalized.match(/(?:经期|月经).{0,4}(?:第)?([一二三四五六七八九十]+)天/)?.[1];
  const chineseDayMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const parsedChineseDay = chineseDayToken ? (chineseDayToken === "十" ? 10 : chineseDayToken.startsWith("十") ? 10 + (chineseDayMap[chineseDayToken[1]] || 0) : chineseDayToken.endsWith("十") ? (chineseDayMap[chineseDayToken[0]] || 0) * 10 : chineseDayMap[chineseDayToken]) : null;
  const cycleDay = Number(digitDay || parsedChineseDay) || null;
  const tags = TAG_RULES.filter(([test]) => test.test(normalized)).map(([, tag]) => tag);
  const structuredState = {
    pain: normalized.match(/疼痛程度[:：]\s*(轻微|中等|很强)/)?.[1] || null,
    mood: normalized.match(/(?:现在的)?心情[:：]\s*(平稳|有点烦|很低落)/)?.[1] || null,
    energy: normalized.match(/(?:现在的)?精力[:：]\s*(还可以|偏低|快耗尽)/)?.[1] || null,
  };
  if (cycleDay && !tags.some((tag) => tag.startsWith("经期 D"))) tags.unshift(`经期 D${cycleDay}`);
  const hasConstraint = tags.includes("现实任务不能取消");
  const hasPain = tags.includes("下腹疼痛") || tags.includes("头痛") || tags.includes("腰背不适");
  const knowledgeIntent = tags.includes("知识求证");
  const firstPeriodIntent = tags.includes("初潮准备");
  const lifeReviewIntent = tags.includes("长期变化整理");
  const stateSummary = [
    tags.includes("疼痛很强") ? "疼痛已经很强" : null,
    tags.includes("情绪变化") ? "心情正在变化" : null,
    tags.includes("精力偏低") ? "精力快要耗尽" : null,
  ].filter(Boolean).join("、");
  const taskMatch = normalized.match(/汇报|会议|上班|工作|考试|答辩|出差|旅行|高铁/);
  const task = taskMatch?.[0];
  const timeMatches = [...normalized.matchAll(/(?:明早|明晚|今晚|今天|明天(?:上午|下午|晚上)?|(?:上午|下午|晚上)?(?:[一二三四五六七八九十]|\d{1,2})点(?:半|\d{1,2}分)?)/g)];
  const time = timeMatches.filter((match) => !taskMatch || match.index <= taskMatch.index).at(-1)?.[0];
  const taskDetail = [time, task].filter(Boolean).join("的");
  const context = hasConstraint
    ? `妳需要在身体不舒服时${taskDetail ? `面对${taskDetail}` : "完成今天不能取消的事"}。我会把现实限制和身体感受放在一起。`
    : firstPeriodIntent
      ? "妳担心第一次月经可能在学校突然发生，自己不知道该准备什么或找谁。我们先把可控的准备和可信求助放在一起。"
      : lifeReviewIntent
        ? "妳想整理多年身体变化、尝试和效果。宝宝会把回忆写成时间线，同时保留不确定和需要专业确认的地方。"
    : knowledgeIntent
      ? "妳想知道这条说法有什么证据、不能推出什么，以及怎样放回妳的真实情况里。"
    : stateSummary
      ? `妳已经用很少的操作告诉我：${stateSummary}。我先确认这次有没有危险变化，再和妳一起选一个负担最小的下一步。`
      : "我先把妳此刻身体发生的事整理清楚，再和妳一起选一个负担最小的下一步。";
  return {
    text: normalized,
    intent: knowledgeIntent ? "knowledge" : "care",
    tags: tags.length ? tags : ["需要进一步了解"],
    redFlag,
    cycleDay,
    taskDetail,
    structuredState,
    context,
    followUp: hasPain
      ? "这次和妳以往相似吗？有没有突然加重、明显异常出血、头晕或发热？"
      : firstPeriodIntent
        ? "如果第一次月经在学校发生，妳最担心的是用品、弄脏衣服，还是不知道向谁求助？"
      : lifeReviewIntent
        ? "妳想先从哪一段变化开始：出血模式、疼痛与身体感受，还是尝试过但有效或无效的办法？"
      : knowledgeIntent
        ? "妳是在什么处境下看到这条说法的？现在最想用它解决什么问题？"
      : "这件事从什么时候开始？和妳过去的周期相比，有什么明显不同吗？",
    recommendedGift: hasConstraint ? "meeting" : hasPain ? "heat" : firstPeriodIntent ? "first-period" : lifeReviewIntent ? "timeline" : knowledgeIntent ? "evidence" : "sleep",
  };
}

export function createEpisode(analysis, effect, zones = [], gift = null, snapshot = null) {
  const structuredState = Object.fromEntries(
    Object.entries({ ...(snapshot || {}), ...(analysis.structuredState || {}) }).filter(([, value]) => value),
  );
  return {
    id: `episode-${Date.now()}`,
    createdAt: new Date().toISOString(),
    cycleDay: analysis.cycleDay,
    phaseLabel: analysis.cycleDay ? "经期记录" : "周期位置未确认",
    rawText: analysis.text,
    tags: analysis.tags,
    bodyZones: zones,
    structuredState,
    actionId: analysis.recommendedGift,
    actionTitle: gift?.title || analysis.recommendedGift,
    taskDetail: analysis.taskDetail || null,
    effect,
    source: "用户主动记录",
    confidence: "一次真实反馈；不能证明因果",
  };
}

export function applyEpisodeOutcome(store, episode, giftId, analysis) {
  const remember = store.privacy?.localMemory !== false;
  if (!remember) return store;
  return {
    ...store,
    episodes: remember ? [episode, ...store.episodes] : store.episodes,
    growth: store.growth + 2,
    babyState: episode.effect === "none" ? "serious" : "cared",
    cycleDay: analysis.cycleDay || store.cycleDay,
    cycleAnchorConfirmed: Boolean(analysis.cycleDay) || Boolean(store.cycleAnchorConfirmed),
    preparedGiftIds: [...new Set([...store.preparedGiftIds, giftId])],
  };
}

export function findSimilarEpisode(episodes, analysis) {
  if (!analysis) return episodes[0] || null;
  const currentTags = new Set(analysis.tags.filter((tag) => tag !== "需要进一步了解" && !tag.startsWith("经期 D")));
  const ranked = episodes.map((episode, index) => {
    const commonTags = (episode.tags || []).filter((tag) => currentTags.has(tag)).length;
    const sameTask = analysis.taskDetail && episode.taskDetail && analysis.taskDetail.split("的").at(-1) === episode.taskDetail.split("的").at(-1);
    return { episode, score: commonTags * 2 + (sameTask ? 2 : 0) - index * 0.01 };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return ranked[0]?.episode || null;
}

export function recallCopy(episodes, analysis = null) {
  const remembered = analysis ? findSimilarEpisode(episodes, analysis) : episodes[0];
  if (!remembered) return "我还没有足够的真实结果，会从今天的一次小实验开始慢慢了解妳。";
  const effect = remembered.effect === "helped" ? "很有帮助" : remembered.effect === "some" ? "有一点帮助" : "没有帮助或更不舒服";
  const prefix = analysis ? "上次相似处境里" : "最近一次记录里";
  const ending = remembered.effect === "none" ? "这次我不会把它当成默认答案。" : "这次仍会先确认处境，不会自动照搬。";
  return `${prefix}，妳试过「${remembered.actionTitle || (remembered.actionId === "heat" ? "温热下腹 20 分钟" : "汇报前十分钟缓冲")}」，反馈「${effect}」。${ending}`;
}

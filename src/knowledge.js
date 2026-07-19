const PUBLIC_CLUSTER_DEFINITIONS = [
  {
    id: "pain-warmth",
    title: "热敷、泡脚与保暖说法",
    category: "疼痛与不适",
    test: /热敷|暖宝宝|泡脚|保暖|热水袋|温热/,
    summary: "公开搜索摘要里，有人把热敷、暖宝宝、泡脚或保暖与缓解月经疼痛联系在一起。这里先把相似说法放在一起，尚不能据此判断对谁有效。",
    boundary: "需要继续核对具体温度、时长、皮肤与感觉状态；明显加重、晕厥、发热或异常大量出血不应只靠自我照护。",
  },
  {
    id: "movement",
    title: "经期拉伸、瑜伽与轻运动说法",
    category: "运动与活动",
    test: /瑜伽|拉伸|开髋|运动|跟练|体式|动作|排瘀操|排淤操/,
    summary: "公开搜索摘要里，常见把拉伸、瑜伽、散步或轻运动与舒缓不适联系在一起，也夹杂“排瘀、清理子宫、变美”等未经核实的解释。",
    boundary: "动作本身与营销解释必须分开核验；疼痛明显、头晕、出血异常或运动后更不舒服时应停止并重新评估。",
  },
  {
    id: "food-drink",
    title: "冰、辣、咖啡与经期饮食说法",
    category: "饮食与日常",
    test: /喝冰|冰的|冷饮|吃辣|辣的|咖啡|饮食|红糖|姜茶|忌口|食物/,
    summary: "公开搜索摘要对冰、辣、咖啡、红糖或姜茶的说法并不一致。这里记录的是讨论主题，不把任何一种饮食规则写成所有人的禁忌。",
    boundary: "需要区分个人既往反应、基础疾病、药物和摄入量；不能用一条公开经验替代个体医疗建议。",
  },
  {
    id: "pms-pmdd",
    title: "经前情绪、睡眠与 PMS/PMDD 说法",
    category: "经前变化",
    test: /PMS|PMDD|经前|月经前|黄体期|烦躁|低落|情绪|睡眠/,
    summary: "公开搜索摘要中，有人描述月经前的情绪、睡眠或身体变化，也有人直接套用 PMS/PMDD 标签。相似经历可以被看见，但诊断不能来自一条帖子或单次感受。",
    boundary: "需要跨至少两个周期记录时间关系、严重程度和功能影响；出现自伤念头或无法保证安全时应立即求助。",
  },
  {
    id: "flow-leak-products",
    title: "经量、渗漏与月经用品经验",
    category: "经量与用品",
    test: /经量|量多|量少|漏|渗漏|月经杯|卫生巾|卫生棉条|安睡裤|换.{0,3}(巾|棉)/,
    summary: "公开搜索摘要里，有人分享经量观察、渗漏处境和月经杯等用品的试错。这些经验更适合按“处境—尝试—结果—失败点”整理，而不是做用品排行榜。",
    boundary: "可见互动不代表适用人数；持续大量出血、头晕心慌或日常活动明显受影响时需要医疗评估。",
  },
  {
    id: "delay-induction",
    title: "月经推迟与“催经”说法",
    category: "周期变化",
    test: /催经|催月经|接月经|月经推迟|月经不来|推迟|迟来/,
    summary: "公开搜索摘要里，有大量穴位、动作、饮品或“亲测”催经说法；它们常常没有说明妊娠可能、推迟原因、适用人群和失败结果。",
    boundary: "这是高风险待核实说法簇，不能自动转成行动建议；先排除妊娠可能并结合持续时间、疼痛、出血与其他症状判断是否就医。",
  },
  {
    id: "first-period",
    title: "初潮准备与成长仪式经验",
    category: "初潮与成长",
    test: /初潮|第一次月经|第一次生理期|女儿.{0,8}(月经|生理期)|成长仪式/,
    summary: "公开搜索摘要里，初潮既被描述为慌张、羞耻或不知如何求助，也有人分享用品准备和成长仪式。产品更关注如何让第一次发生时可理解、可求助。",
    boundary: "仪式感应由本人选择，不能把月经包装成必须庆祝的女性气质考试，也不能替代异常症状评估。",
  },
  {
    id: "menopause",
    title: "围绝经与绝经后的经验说法",
    category: "全生命周期",
    test: /绝经|围绝经|更年期/,
    summary: "公开搜索摘要里，围绝经与绝经常被混入“长寿、调理、年轻化”等承诺。更有用的整理方式是分开记录身体变化、生活影响、尝试与真实结果。",
    boundary: "绝经后出血等情况不能用普通周期经验解释；疗效、年轻化或长寿承诺需要单独的专业证据审查。",
  },
];

export function normalizeMenstrualLanguage(value = "") {
  return String(value)
    .replace(/大姨妈|姨妈/g, "月经")
    .replace(/生理期/g, "月经期")
    .replace(/姨母/g, "月经")
    .replace(/([#＃])[^#＃\s]+/g, " ")
    .replace(/[‼❗❕⚠️🔥💥✨🩸㊙️]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeCandidate(record, clusterId) {
  const text = normalizeMenstrualLanguage(`${record.title || ""} ${record.excerpt || ""}`);
  if (clusterId === "pain-warmth") {
    if (/泡脚/.test(text)) return "有人描述自己尝试泡脚后，觉得月经疼痛有所变化；摘要没有提供可核验的水温、频率或失败结果。";
    if (/热敷|热水袋|暖宝宝/.test(text)) return "有人把下腹热敷或低温热源列为疼痛时的尝试之一；具体温度、时长和不适反应仍需核对。";
    return "有人把保暖与月经疼痛变化联系在一起；这仍是待核实的个人说法。";
  }
  if (clusterId === "movement") return /排瘀|排淤|变美|减肥/.test(text)
    ? "有人分享月经期间拉伸、瑜伽或轻运动的主观感受，同时夹带“排瘀、变美或减肥”等未经核验的解释。"
    : "有人分享月经期间做拉伸、瑜伽或轻运动后觉得身体有所变化；动作、强度和失败结果仍不完整。";
  if (clusterId === "food-drink") return "有人把冰、辣、咖啡、红糖或姜茶与自己的月经感受联系起来；公开摘要里的结论彼此冲突，不能整理成统一忌口表。";
  if (clusterId === "pms-pmdd") return "有人描述月经前的睡眠、情绪或身体变化，也有人直接套用 PMS/PMDD 标签；单次自述不能确认诊断。";
  if (clusterId === "flow-leak-products") return "有人分享经量观察、渗漏处境或月经用品试错；摘要通常缺少完整处境、使用方法和失败结果。";
  if (clusterId === "delay-induction") return "有人声称某种动作、饮品或穴位可以“催经”；摘要常未说明妊娠可能、月经推迟原因或无效案例。";
  if (clusterId === "first-period") return "有人回忆初潮时的慌张、羞耻或求助困难，也有人分享用品准备和成长仪式；是否庆祝应由本人选择。";
  if (clusterId === "menopause") return "有人把围绝经或绝经变化与调理、年轻化或长寿承诺联系起来；这些承诺尚未经过专业证据核验。";
  return "这条公开摘要提出了一种月经相关说法；当前只保留为待核实候选，不转成行动建议。";
}

export function buildPublicPracticeClusters(records = []) {
  return PUBLIC_CLUSTER_DEFINITIONS.map((definition) => {
    const matches = records.filter((record) => definition.test.test(normalizeMenstrualLanguage(`${record.title || ""} ${record.excerpt || ""}`)));
    const sourceUrls = [...new Set(matches.map((record) => record.sourceUrl).filter(Boolean))];
    const platforms = [...new Set(matches.map((record) => record.platform).filter(Boolean))];
    return {
      ...definition,
      candidateCount: matches.length,
      sourceCount: sourceUrls.length,
      platforms,
      examples: matches.slice(0, 3).map((record) => ({
        id: record.candidateId,
        excerpt: summarizeCandidate(record, definition.id),
        sourceUrl: record.sourceUrl,
        readStatus: record.readStatus,
      })),
      searchText: normalizeMenstrualLanguage(`${definition.category} ${definition.title} ${definition.summary}`),
      sourceLabel: `固定公开查询样本中的 ${matches.length} 条候选摘要`,
    };
  }).filter((cluster) => cluster.candidateCount > 0);
}

export const PROFESSIONAL_CATEGORIES = ["全部", "周期机制", "疼痛与出血", "经前变化", "记录与预测", "生命阶段", "日常照护", "研究与权利"];

export function professionalCategory(item = {}) {
  const text = normalizeMenstrualLanguage(`${item.theme || ""} ${item.node_labels || ""} ${item.myth_statement || ""} ${item.claim_text_plain || ""}`);
  if (/痛经|疼痛|出血|经量|贫血|内膜异位|腺肌|急诊/.test(text)) return "疼痛与出血";
  if (/PMS|PMDD|经前|情绪|睡眠|自伤|精神/.test(text)) return "经前变化";
  if (/预测|APP|排卵日|记录|隐私|数据|算法/.test(text)) return "记录与预测";
  if (/初潮|青春期|绝经|围绝经|哺乳|产后/.test(text)) return "生命阶段";
  if (/用品|运动|饮食|咖啡|月经杯|卫生巾/.test(text)) return "日常照护";
  if (/月经周期|卵巢|内膜|激素|黄体|卵泡|宫颈|排卵|GnRH/.test(text)) return "周期机制";
  return "研究与权利";
}

export function prepareProfessionalCards(claims = [], myths = []) {
  return [
    ...myths.map((item) => ({ ...item, _kind: "myth", _title: normalizeMenstrualLanguage(item.myth_statement), _body: normalizeMenstrualLanguage(item.accurate_correction), _category: professionalCategory(item) })),
    ...claims.map((item) => ({ ...item, _kind: "claim", _title: normalizeMenstrualLanguage(item.node_labels || item.claim_id), _body: normalizeMenstrualLanguage(item.claim_text_plain), _category: professionalCategory(item) })),
  ];
}

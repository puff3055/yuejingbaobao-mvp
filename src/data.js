export const LIFE_STAGES = [
  { id: "seed", title: "还没有迎来第一次月经", subtitle: "月之种子还没有破壳，先一起认识身体" },
  { id: "cycle", title: "已经来过月经", subtitle: "找回那只早已陪伴你的月经宝宝" },
  { id: "irregular", title: "来过月经，但现在不规律或情况特殊", subtitle: "宝宝不会强套标准周期，只记真实发生" },
  { id: "peri", title: "正在经历围绝经变化", subtitle: "宝宝仍在，陪你记录变化与准备沟通" },
  { id: "phoenix", title: "已经绝经", subtitle: "宝宝化作血月凤凰，经验没有消失" },
];

export const SUPPORT_NEEDS = [
  "更轻松地记录身体",
  "缓解经期困扰",
  "为 PMS 提前准备",
  "安排睡眠、运动和工作",
  "理解周期里发生了什么",
  "减少对月经的压力和羞耻",
];

export const COMMUNICATION_STYLES = [
  { id: "quiet", title: "安静温柔", copy: "少一点话，先陪我慢下来" },
  { id: "clear", title: "直接可靠", copy: "帮我抓重点，给清楚的下一步" },
  { id: "playful", title: "活泼好奇", copy: "像朋友一样，让记录有一点惊喜" },
];

export const BODY_ZONES = [
  { id: "head", label: "头部", detail: "头痛、头晕、脑雾", top: 8, left: 50 },
  { id: "chest", label: "胸部", detail: "乳房胀痛、心悸", top: 29, left: 50 },
  { id: "gut", label: "腹部", detail: "腹胀、肠胃变化", top: 46, left: 50 },
  { id: "pelvis", label: "下腹", detail: "痉挛、坠胀、单侧痛", top: 61, left: 50 },
  { id: "back", label: "腰背", detail: "腰酸、放射痛", top: 47, left: 24 },
  { id: "whole", label: "全身", detail: "乏力、发冷、精力变化", top: 79, left: 50 },
];

export const BABY_FRIENDS = [
  { id: "mianmian", name: "绵绵", owner: "匿名岛民", state: "经期 D1", mood: "今天想安静一点", gift: "汇报前的十分钟呼吸卡", route: "相似场景：必须继续工作" },
  { id: "lulu", name: "露露", owner: "匿名岛民", state: "经期 D3", mood: "暖暖地窝着", gift: "办公室隐形热敷清单", route: "相似场景：腰腹不适" },
  { id: "xingxing", name: "星星", owner: "匿名岛民", state: "经前记录", mood: "正在准备生日", gift: "旅行不慌张小包", route: "相似场景：出差与漏血担心" },
  { id: "beike", name: "贝可", owner: "匿名岛民", state: "围绝经记录", mood: "把变化写成信", gift: "就医前变化时间线", route: "相似场景：周期变化" },
  { id: "xiaoman", name: "小满", owner: "匿名岛民", state: "经期 D2", mood: "收到了新的月信", gift: "夜间兜底用品卡", route: "相似场景：重流量夜晚" },
  { id: "yueya", name: "月芽", owner: "匿名岛民", state: "初潮准备", mood: "第一次不再慌张", gift: "书包里的初潮准备袋", route: "相似场景：校园" },
];

export const BIRTHDAYS = [
  { id: "b1", baby: "星星", day: "今天", wish: "主人明天要坐高铁，希望旅途顺利", prepared: "旅行不慌张小包" },
  { id: "b2", baby: "小满", day: "今天", wish: "这是我们一起度过的第 11 个周期", prepared: "夜间安心礼盒" },
  { id: "b3", baby: "绵绵", day: "明天", wish: "想在工作日里也被温柔照顾", prepared: "会议间隙呼吸卡" },
];

export const CARE_GIFTS = [
  { id: "first-period", title: "书包里的第一次月潮小包", kind: "初潮准备 + 可信求助", how: "放入自己能使用的月经用品、备用内裤和密封袋，再写下一位在学校可以求助的可信成人；准备不代表催促身体来月经。", feedbackAfter: "准备好并真正需要使用后", source: "ACOG 初潮科普 + 校园场景准备；不是身体成熟度判断", sourceUrl: "https://www.acog.org/womens-health/faqs/your-first-period", caution: "如果已经出现出血并伴剧痛、头晕或明显不适，要及时告诉可信成人并获得医疗帮助。", icon: "bag" },
  { id: "timeline", title: "把多年变化整理成一条时间线", kind: "就医沟通 + 经验传承", how: "只列事实：大致年份、出血或症状变化、尝试过的行动、实际效果和最想问的问题；不把回忆写成诊断。", feedbackAfter: "整理完时间线后", source: "你的长期回忆与本地记录；用于沟通，不是自动诊断", caution: "绝经后再次出现阴道出血值得尽快联系医疗专业人员，不要只把它封成经验礼物。", icon: "time" },
  { id: "heat", title: "温热下腹 20 分钟", kind: "专业背景 + 可撤回的个人实验", how: "用温热而不烫的热源，隔着衣物放在下腹约 20 分钟；中途检查皮肤。20 分钟是本次反馈默认，不是指南处方。", feedbackAfter: "约 20 分钟后", source: "ACOG 痛经科普；系统综述提示热疗可能减轻原发性痛经，但人群与研究质量有限", sourceUrl: "https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods", caution: "刺痛、麻木或灼热时立即停止；突然、单侧、持续加重或模式明显改变的疼痛不要只靠热敷。", icon: "warm" },
  { id: "meeting", title: "汇报前十分钟缓冲", kind: "根据你的现实任务生成", how: "如果条件允许，在汇报前留出 10 分钟：坐下、喝几口温水、调整衣物或低温热源，并准备一句需要暂停时的说明。", feedbackAfter: "汇报结束后", source: "你的“下午三点必须汇报”这一处境；不是群体周期处方", caution: "它只降低当下负担，不要求你硬撑，也不替代对持续、加重或异常疼痛的评估。", icon: "time" },
  { id: "travel", title: "旅行不慌张小包", kind: "社区经验 + 用品准备", how: "按自己的用品习惯准备一套正在使用的用品、一套备用、密封袋和可更换内裤，并记录是否真的减少了焦虑或渗漏。", feedbackAfter: "这次出行结束后", source: "匿名礼物海经验候选；尚需个人验证", caution: "突然明显增多、头晕或频繁浸透用品时不要只靠增加用品。", icon: "bag" },
  { id: "sleep", title: "经前睡眠观察卡", kind: "个人模式实验", how: "今晚只记入睡时间、醒来次数、压力和咖啡因；先观察，不把一次睡不好归因给周期。", feedbackAfter: "明早醒来后", source: "Menstrual Cycle Effects on Sleep 综述；群体证据只作背景", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/30098748/", caution: "同时记录压力、生病和环境等其他因素；连续严重失眠或情绪风险需要专业支持。", icon: "moon" },
  { id: "evidence", title: "把这条说法拆成三层", kind: "知识求证行动", how: "先分别看：专业证据目前能说什么、公开经验里发生过什么、你的记录里有没有重复结果；三层不混成一个结论。", feedbackAfter: "看完这张拆解后", source: "月经知识 SQLite + R006 公开经验候选 + 你的授权记录", caution: "公开热帖和单次个人经验不能证明普遍有效；没有你的实际处境时，不生成“适合你”的结论。", icon: "book" },
];

export const LIFECYCLE = [
  { id: "seed", title: "月之种子", subtitle: "尚未孵化的月亮珍珠", personality: "好奇、谨慎、先学习再靠近", unlock: "认识月经、完成第一次身体记录" },
  { id: "baby", title: "月经宝宝", subtitle: "住在贝壳里的潮汐精灵", personality: "温暖、灵动、会主动准备礼物", unlock: "建立跨周期记忆、完成真实照护反馈" },
  { id: "phoenix", title: "血月凤凰", subtitle: "带着经验飞向更广阔的生命阶段", personality: "沉稳、有力量、把经验传给后来者", unlock: "生命阶段变化与长期经验沉淀；不是积分兑换" },
];

export const EVIDENCE_LABELS = {
  mixed: ["证据不一", "需要结合人群与做法"],
  unknown: ["尚不确定", "个人经验不能证明普遍有效"],
  unsupported: ["缺少支持", "不要变成周期指令"],
  risky: ["需谨慎", "存在风险或误导"],
  experience: ["真实经验", "不是医学证据"],
};

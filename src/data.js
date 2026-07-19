export const LIFE_STAGES = [
  { id: "seed", title: "我的月之种子还没有破壳", subtitle: "和它一起认识身体、准备第一次月经", support: "月之种子会用简单的身体知识和初潮准备清单陪着妳，也会提醒妳可以向谁求助。" },
  { id: "cycle", title: "我已经来过月经", subtitle: "认领一直陪伴妳的月经宝宝", support: "月经宝宝会陪妳记录当下状态、尝试一次照护，并记住它是否真的有帮助。" },
  { id: "irregular", title: "来过月经，但现在不规律或情况特殊", subtitle: "让宝宝跟着每一次真实变化陪伴妳", support: "宝宝会按妳每次确认的日期和身体记录回应，保留不确定性，并帮助妳整理值得继续观察或沟通的变化。" },
  { id: "peri", title: "我正在经历围绝经变化", subtitle: "让宝宝陪妳看见变化、整理沟通线索", support: "宝宝会帮妳记录出血、睡眠和身体感受的变化，整理成可回看的时间线与就医沟通材料。" },
  { id: "phoenix", title: "我已经绝经", subtitle: "让血月凤凰继续陪伴妳", support: "同一只宝宝已经化作血月凤凰，会陪妳整理多年身体经验；绝经后再次出血时会明确提醒妳及时求助。" },
];

export const SUPPORT_NEEDS = [
  "更轻松地记录身体",
  "缓解经期困扰",
  "为 PMS 提前准备",
  "安排睡眠、运动和工作",
  "理解周期里发生了什么",
  "减少对月经的压力和羞耻",
];

export const SUPPORT_EXPLANATIONS = {
  "更轻松地记录身体": "宝宝会把妳的自然语言和身体点选整理成清楚记录，妳不必先学会表格或医学术语。",
  "缓解经期困扰": "宝宝会先确认安全边界，再结合妳此刻的处境只给一个可以选择的小行动，并回来询问效果。",
  "为 PMS 提前准备": "宝宝会比较妳亲自保存的多周期记录，只在出现重复线索时准备提醒，不凭阶段标签预言情绪。",
  "安排睡眠、运动和工作": "宝宝会把当前感受、现实安排和有来源的研究分开呈现，帮助妳做可调整的选择。",
  "理解周期里发生了什么": "宝宝会把卵巢、子宫内膜、宫颈黏液与妳记录的感受放在同一时间点解释。",
  "减少对月经的压力和羞耻": "宝宝会直接使用“月经”这个词，用不责备的方式陪妳认识身体，也不会把受孕设为默认目标。",
};

export const COMMUNICATION_STYLES = [
  { id: "quiet", title: "安静温柔", copy: "少一点话，先陪妳慢下来", response: "它会先轻轻回应妳的感受，再慢慢问一个必要的问题。" },
  { id: "clear", title: "直接可靠", copy: "帮妳抓重点，给清楚的下一步", response: "它会先说重点、风险边界和一个下一步，减少绕弯。" },
  { id: "playful", title: "活泼好奇", copy: "像朋友一样，让记录有一点惊喜", response: "它会更主动地回应妳的发现，但仍然保持专业边界。" },
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

export const COMMUNITY_POSTS = [
  { id: "p1", babyId: "mianmian", time: "刚刚", text: "绵绵今天收到了一张“有一点帮助”礼物卡。它把卡片放进贝壳，准备先问问主人是否想试。", action: "摸摸绵绵" },
  { id: "p2", babyId: "lulu", time: "8 分钟前", text: "露露发现主人愿意诚实记录“没有帮助”，觉得这也是很勇敢的身体经验。", action: "给露露一个拥抱" },
  { id: "p3", babyId: "xingxing", time: "今天", text: "星星正在为月潮生日准备小帽子，也想认识一位喜欢安静陪伴的新朋友。", action: "派宝宝打招呼" },
  { id: "p4", babyId: "beike", time: "今天", text: "贝可把一段多年变化整理成了时间线，今天长出了一小片更明亮的贝纹。", action: "为贝可鼓掌" },
];

export const BIRTHDAYS = [
  { id: "b1", type: "seed", badge: "种子认领日", baby: "月芽", day: "今天", wish: "今天，它第一次被主人温柔地接回小窝", prepared: "认识身体的第一张小卡" },
  { id: "b2", type: "baby", badge: "月潮生日", baby: "小满", day: "今天", wish: "这是我们一起度过的第 11 个周期", prepared: "夜间安心礼盒" },
  { id: "b3", type: "phoenix", badge: "凤凰重逢日", baby: "贝可", day: "今天", wish: "从月经宝宝化作血月凤凰，继续带着经验同行", prepared: "多年身体经验时间线" },
];

export const CARE_GIFTS = [
  { id: "first-period", title: "书包里的第一次月潮小包", kind: "初潮准备 + 可信求助", how: "放入自己能使用的月经用品、备用内裤和密封袋，再写下一位在学校可以求助的可信成人；准备不代表催促身体来月经。", feedbackAfter: "准备好并真正需要使用后", source: "ACOG 初潮科普 + 校园场景准备；不是身体成熟度判断", sourceUrl: "https://www.acog.org/womens-health/faqs/your-first-period", caution: "如果已经出现出血并伴剧痛、头晕或明显不适，要及时告诉可信成人并获得医疗帮助。", icon: "bag" },
  { id: "timeline", title: "把多年变化整理成一条时间线", kind: "就医沟通 + 经验传承", how: "只列事实：大致年份、出血或症状变化、尝试过的行动、实际效果和最想问的问题；不把回忆写成诊断。", feedbackAfter: "整理完时间线后", source: "妳的长期回忆与本地记录；用于沟通，不是自动诊断", caution: "绝经后再次出现阴道出血值得尽快联系医疗专业人员，不要只把它封成经验礼物。", icon: "time" },
  { id: "heat", title: "温热下腹 20 分钟", kind: "专业背景 + 可撤回的个人实验", how: "用温热而不烫的热源，隔着衣物放在下腹约 20 分钟；中途检查皮肤。20 分钟是本次反馈默认，不是指南处方。", feedbackAfter: "约 20 分钟后", source: "ACOG 痛经科普；系统综述提示热疗可能减轻原发性痛经，但人群与研究质量有限", sourceUrl: "https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods", caution: "刺痛、麻木或灼热时立即停止；突然、单侧、持续加重或模式明显改变的疼痛不要只靠热敷。", icon: "warm" },
  { id: "meeting", title: "现实任务前十分钟缓冲", kind: "根据妳主动提到的现实任务生成", how: "如果条件允许，在任务开始前留出 10 分钟：坐下、喝几口温水、调整衣物或低温热源，并准备一句需要暂停时的说明。", feedbackAfter: "任务结束后", source: "妳主动提到的现实任务；不是群体周期处方", caution: "它只降低当下负担，不要求妳硬撑，也不替代对持续、加重或异常疼痛的评估。", icon: "time" },
  { id: "travel", title: "旅行不慌张小包", kind: "社区经验 + 用品准备", how: "按自己的用品习惯准备一套正在使用的用品、一套备用、密封袋和可更换内裤，并记录是否真的减少了焦虑或渗漏。", feedbackAfter: "这次出行结束后", source: "匿名礼物海经验候选；尚需个人验证", caution: "突然明显增多、头晕或频繁浸透用品时不要只靠增加用品。", icon: "bag" },
  { id: "sleep", title: "经前睡眠观察卡", kind: "个人模式实验", how: "今晚只记入睡时间、醒来次数、压力和咖啡因；先观察，不把一次睡不好归因给周期。", feedbackAfter: "明早醒来后", source: "Menstrual Cycle Effects on Sleep 综述；群体证据只作背景", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/30098748/", caution: "同时记录压力、生病和环境等其他因素；连续严重失眠或情绪风险需要专业支持。", icon: "moon" },
  { id: "evidence", title: "把这条说法拆成三层", kind: "知识求证行动", how: "先分别看：专业证据目前能说什么、公开经验里发生过什么、妳的记录里有没有重复结果；三层不混成一个结论。", feedbackAfter: "看完这张拆解后", source: "月经知识 SQLite + R006 公开经验候选 + 妳的授权记录", caution: "公开热帖和单次个人经验不能证明普遍有效；没有妳的实际处境时，不生成“适合妳”的结论。", icon: "book" },
];

export const LIFECYCLE = [
  { id: "seed", title: "月之种子", subtitle: "它曾经的样子", personality: "从身体出生起就属于妳，静静等待第一次月经到来。", unlock: "回望：妳们从月之种子开始" },
  { id: "baby", title: "月经宝宝", subtitle: "现在陪伴妳的它", personality: "住在贝壳小窝里，陪妳记录、照护、反馈和准备。", unlock: "现在：妳们正在一起积累身体经验" },
  { id: "phoenix", title: "血月凤凰", subtitle: "未来可能成为的它", personality: "月经结束后，同一只宝宝带着经验化作有力量的神鸟。", unlock: "展望：陪伴不会因为绝经而消失" },
];

export const EVIDENCE_LABELS = {
  mixed: ["证据不一", "需要结合人群与做法"],
  unknown: ["尚不确定", "个人经验不能证明普遍有效"],
  unsupported: ["缺少支持", "不要变成周期指令"],
  risky: ["需谨慎", "存在风险或误导"],
  experience: ["真实经验", "不是医学证据"],
};

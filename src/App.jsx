import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Bell,
  BookOpenText,
  CalendarDots,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Check,
  Clock,
  DownloadSimple,
  EnvelopeOpen,
  Gift,
  HandHeart,
  Heart,
  House,
  Info,
  Lock,
  MagnifyingGlass,
  Moon,
  Package,
  PaperPlaneTilt,
  PersonArmsSpread,
  Plus,
  ShieldCheck,
  Sparkle,
  Trash,
  User,
  UsersThree,
  WarningCircle,
  Waves,
  X,
} from "@phosphor-icons/react";
import {
  BABY_FRIENDS,
  BIRTHDAYS,
  BODY_ZONES,
  CARE_GIFTS,
  COMMUNICATION_STYLES,
  EVIDENCE_LABELS,
  LIFE_STAGES,
  LIFECYCLE,
  SUPPORT_NEEDS,
} from "./data.js";
import { analyzeInput, applyEpisodeOutcome, createEpisode, findSimilarEpisode, recallCopy } from "./agent.js";

const STORAGE_KEY = "yuejing-baby-complete-universe-v2";

const initialStore = {
  onboarded: false,
  profile: {
    name: "岛屿旅人",
    babyName: "小潮",
    lifeStage: "cycle",
    needs: [],
    communicationStyle: "quiet",
    menarcheDate: "",
    menarchePrecision: "unknown",
    localMemory: true,
    communityConsent: false,
  },
  cycleDay: 24,
  cycleAnchorConfirmed: false,
  growth: 3,
  babyState: "curious",
  lifecycleCare: { seed: 0, baby: 0, phoenix: 0 },
  episodes: [],
  preparedGiftIds: ["travel"],
  receivedGifts: [],
  sentGifts: [],
  friends: [],
  blessings: [],
  privacy: { localMemory: true, communityConsent: false },
};

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return initialStore;
    const hydrated = {
      ...initialStore,
      ...saved,
      profile: { ...initialStore.profile, ...saved.profile },
      privacy: { ...initialStore.privacy, ...saved.privacy },
      lifecycleCare: { ...initialStore.lifecycleCare, ...saved.lifecycleCare },
    };
    if (hydrated.babyState === "listening") hydrated.babyState = hydrated.profile.lifeStage === "seed" ? "curious" : "awake";
    return hydrated;
  } catch {
    return initialStore;
  }
}

function usePersistentStore() {
  const [store, setStore] = useState(loadStore);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);
  const update = (recipe) => setStore((current) => (typeof recipe === "function" ? recipe(current) : { ...current, ...recipe }));
  return [store, update];
}

const NAV_ITEMS = [
  ["nest", "小窝", House],
  ["cycle", "周期", Waves],
  ["knowledge", "知识海", BookOpenText],
  ["gifts", "礼物海", Gift],
  ["journey", "我的", User],
];

const CYCLE_SOURCES = {
  S02: { label: "S02 · Endotext 正常月经周期", url: "https://www.ncbi.nlm.nih.gov/books/NBK279054/" },
  S03: { label: "S03 · 周期阶段判定方法研究", url: "https://pubmed.ncbi.nlm.nih.gov/37666081/" },
  S04: { label: "S04 · 超过 60 万个周期的时长研究", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244/" },
  S13A: { label: "S13 · 子宫出血与内膜生理综述", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9098793/" },
  S13B: { label: "S13 · 月经期内膜修复综述", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9580638/" },
  S14: { label: "S14 · 宫颈阴道黏液屏障综述", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7663572/" },
};

const CYCLE_TRACKS = [
  {
    id: "ovary",
    title: "卵巢发生什么",
    image: "/assets/cycle-v2/ovary-sequence.png",
    stages: [
      { label: "多枚卵泡开始发育", weight: 20 },
      { label: "优势卵泡继续生长", weight: 24 },
      { label: "排卵事件\n时点会变化", weight: 14 },
      { label: "黄体形成并发挥作用", weight: 25 },
      { label: "未妊娠时黄体逐渐退化", weight: 17 },
    ],
    sources: ["S02", "S03", "S04"],
    boundary: "这是自然排卵周期的相对顺序教学。日历位置不能生成你的卵泡大小、确认排卵，或证明你此刻处于某种黄体状态。",
  },
  {
    id: "endometrium",
    title: "子宫内膜发生什么",
    image: "/assets/cycle-v2/endometrium-sequence.png",
    stages: [
      { label: "功能层脱落与出血", weight: 17 },
      { label: "脱落尚在发生\n表面已开始修复", weight: 20 },
      { label: "雌二醇相关的增殖与增厚", weight: 25 },
      { label: "孕酮相关的分泌性改变", weight: 25 },
      { label: "激素撤退后进入下一次月经", weight: 13 },
    ],
    sources: ["S02", "S13A", "S13B"],
    boundary: "脱落与表面修复并不是完全前后分开的动作；图中的高低只是艺术化相对变化，不是你的实时内膜厚度或医学影像。",
  },
  {
    id: "mucus",
    title: "宫颈黏液 / 分泌物观察",
    image: "/assets/cycle-v2/mucus-sequence.png",
    stages: [
      { label: "经后通常较少、较黏", weight: 27 },
      { label: "接近排卵时可更清、更滑、更易拉丝", weight: 38 },
      { label: "排卵后通常重新变稠、减少", weight: 35 },
    ],
    sources: ["S02", "S14"],
    boundary: "日常看到的分泌物不全等于宫颈黏液。感染、激素避孕、哺乳和其他状态也会改变它；异常气味、瘙痒、颜色或疼痛不能只用周期解释。",
  },
];

export function App() {
  const [store, setStore] = usePersistentStore();
  const [screen, setScreen] = useState("nest");
  const [bodyMapOpen, setBodyMapOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [agentSeedText, setAgentSeedText] = useState("");
  const [selectedZones, setSelectedZones] = useState([]);
  const [recordSnapshot, setRecordSnapshot] = useState(null);
  const [moment, setMoment] = useState(null);
  const [knowledge, setKnowledge] = useState({ claims: [], myths: [], monid: [], claimsMeta: null, mythsMeta: null, provenance: null });

  useEffect(() => {
    Promise.all([
      fetch("/data/knowledge-claims.json").then((r) => r.json()),
      fetch("/data/myth-cards.json").then((r) => r.json()),
      fetch("/data/public-practice-atlas.json").then((r) => r.json()).catch(() => ({ records: [] })),
      fetch("/data/research-provenance.json").then((r) => r.json()).catch(() => null),
    ]).then(([claimsRelease, mythsRelease, publicAtlas, provenance]) => {
      const claims = Array.isArray(claimsRelease) ? claimsRelease : claimsRelease.records || [];
      const myths = Array.isArray(mythsRelease) ? mythsRelease : mythsRelease.records || [];
      setKnowledge({
        claims,
        myths,
        monid: publicAtlas.records || [],
        claimsMeta: Array.isArray(claimsRelease) ? null : claimsRelease.metadata,
        mythsMeta: Array.isArray(mythsRelease) ? null : mythsRelease.metadata,
        provenance,
      });
    });
  }, []);

  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

  const showMoment = (type, title, copy, growth = 0) => {
    setMoment({ type, title, copy });
    if (growth) setStore((s) => ({ ...s, growth: s.growth + growth }));
  };

  const startAgent = (text = draft, { preserveZones = false, snapshot = null, allowEmpty = false } = {}) => {
    const cleanText = text.trim();
    if (!cleanText && !allowEmpty) return;
    if (!preserveZones) setSelectedZones([]);
    setRecordSnapshot(snapshot);
    setAgentSeedText(cleanText);
    setDraft("");
    setStore((s) => ({ ...s, babyState: "listening" }));
    setAgentOpen(true);
  };
  const closeAgent = () => {
    setAgentOpen(false);
    setRecordSnapshot(null);
    setStore((s) => s.babyState === "listening" ? { ...s, babyState: s.profile.lifeStage === "seed" ? "curious" : "awake" } : s);
  };

  if (!store.onboarded) {
    return <Onboarding store={store} setStore={setStore} />;
  }

  return (
    <div className="app-shell">
      <div className="mobile-prototype">
        <AppHeader screen={screen} store={store} onBell={() => setScreen("gifts")} />
        <main className="screen-scroll" id="main-content">
          {screen === "nest" && (
            <NestScreen
              store={store}
              setStore={setStore}
              draft={draft}
              setDraft={setDraft}
              startAgent={startAgent}
              openAgent={() => startAgent("", { allowEmpty: true })}
              openBodyMap={() => setBodyMapOpen(true)}
              goTo={setScreen}
              showMoment={showMoment}
            />
          )}
          {screen === "cycle" && <CycleScreen store={store} goTo={setScreen} />}
          {screen === "knowledge" && (
            <KnowledgeScreen
              knowledge={knowledge}
              store={store}
              setStore={setStore}
              showMoment={showMoment}
              startAgent={startAgent}
            />
          )}
          {screen === "gifts" && (
            <GiftSeaScreen store={store} setStore={setStore} showMoment={showMoment} />
          )}
          {screen === "journey" && (
            <JourneyScreen store={store} setStore={setStore} showMoment={showMoment} />
          )}
        </main>
        <BottomNav screen={screen} setScreen={setScreen} />
        {bodyMapOpen && (
          <BodyMapModal
            selected={selectedZones}
            setSelected={setSelectedZones}
            onClose={() => setBodyMapOpen(false)}
            onContinue={({ text, snapshot }) => {
              setBodyMapOpen(false);
              setDraft(text);
              startAgent(text, { preserveZones: true, snapshot });
            }}
          />
        )}
        {agentOpen && (
          <AgentPanel
            text={agentSeedText}
            zones={selectedZones}
            recordSnapshot={recordSnapshot}
            store={store}
            setStore={setStore}
            onClose={closeAgent}
            showMoment={showMoment}
          />
        )}
        {moment && <BabyMoment {...moment} onClose={() => setMoment(null)} />}
      </div>
    </div>
  );
}

function Onboarding({ store, setStore }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(store.profile);
  const next = () => setStep((s) => Math.min(s + 1, 6));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const toggleNeed = (need) => setProfile((p) => ({ ...p, needs: p.needs.includes(need) ? p.needs.filter((n) => n !== need) : [...p.needs, need] }));
  const isSeed = profile.lifeStage === "seed";
  const isPhoenix = profile.lifeStage === "phoenix";
  const revealVisual = isSeed ? "/assets/lifecycle/moon-seed.png" : isPhoenix ? "/assets/lifecycle/blood-moon-phoenix.png" : "/assets/moon-sea-hero.png";
  const finish = () => setStore((s) => ({ ...s, onboarded: true, profile, privacy: { localMemory: profile.localMemory, communityConsent: profile.communityConsent }, growth: 4, babyState: isSeed ? "curious" : "awake" }));
  return (
    <div className="app-shell onboarding-shell">
      <div className="mobile-prototype onboarding">
        <div className="onboarding-progress"><span style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>
        {step > 0 && <button className="icon-button onboarding-back" onClick={back} aria-label="返回"><ArrowLeft /></button>}
        {step === 0 && (
          <section className="onboarding-hero">
            <img src="/assets/lifecycle/moon-seed.png" alt="月之种子像一颗带月亮呆毛的珍珠蛋，窝在月光贝壳里" />
            <div className="onboarding-wash" />
            <div className="onboarding-copy">
              <p className="eyebrow">月经宝宝 · 认领序章</p>
              <h1>让月经，不再只是<br />日历上的一个红点</h1>
              <p>它会听懂你、记得你，也陪你把每一次身体经验变成下一次更从容的准备。</p>
              <button className="primary-button" onClick={next}>找回我的月之种子 <CaretRight /></button>
              <span className="microcopy">为女性的身体而设计，不以受孕为默认目标</span>
            </div>
          </section>
        )}
        {step === 1 && (
          <OnboardingStep eyebrow="第一缕潮汐" title="你已经迎来第一次月经了吗？" copy="每个人都有月之种子；第一次月经到来时，它才会破壳成为月经宝宝。">
            <div className="choice-stack">
              {LIFE_STAGES.map((item) => <ChoiceCard key={item.id} selected={profile.lifeStage === item.id} onClick={() => setProfile((p) => ({ ...p, lifeStage: item.id, ...(item.id === "seed" ? { menarcheDate: "", menarchePrecision: "not_yet" } : p.menarchePrecision === "not_yet" ? { menarchePrecision: "unknown" } : {}) }))} title={item.title} copy={item.subtitle} />)}
            </div>
            <button className="primary-button" onClick={next}>继续</button>
          </OnboardingStep>
        )}
        {step === 2 && (
          isSeed ? (
            <OnboardingStep eyebrow="它还没有破壳" title="月之种子会先陪你准备" copy="没有来月经，不代表少了什么。它会用月之种子的形态陪你提问、认识身体和准备初潮。">
              <img className="seed-companion-image" src="/assets/lifecycle/moon-seed.png" alt="月之种子在贝壳里等待破壳" />
              <div className="boundary-note"><Moon weight="fill" /> 月之种子没有生日。它一直属于你；真正有日期的是未来第一次月经到来的“破壳日”。</div>
              <button className="primary-button" onClick={next}>让种子继续陪我</button>
            </OnboardingStep>
          ) : (
            <OnboardingStep eyebrow="破壳记忆" title="它大约什么时候第一次醒来？" copy="初潮是月经宝宝的破壳日，不是月之种子的生日。记得大概年月就够了，也可以跳过。">
              <label className="field-label menarche-field">初潮大约年月<input type="month" max={new Date().toISOString().slice(0, 7)} value={profile.menarcheDate || ""} onInput={(e) => { const value = e.currentTarget.value; setProfile((p) => ({ ...p, menarcheDate: value, menarchePrecision: value ? "month" : "unknown" })); }} /></label>
              {profile.menarcheDate && <div className="age-preview"><Moon weight="fill" /><div><small>宝宝的破壳记忆</small><strong>{menarcheStory(profile)}</strong></div></div>}
              <button className={profile.menarchePrecision === "unknown" ? "memory-skip selected" : "memory-skip"} onClick={() => setProfile((p) => ({ ...p, menarcheDate: "", menarchePrecision: "unknown" }))}>我不记得具体时间，也可以继续</button>
              <div className="boundary-note"><Lock /> 这段记忆默认只保存在本地。它只用来讲述陪伴时长，不会被解释成疾病、排卵或生育能力。</div>
              <button className="primary-button" onClick={next}>记住这段破壳时光</button>
            </OnboardingStep>
          )
        )}
        {step === 3 && (
          <OnboardingStep eyebrow="不是例行问卷" title="你希望它先帮你什么？" copy="可多选。宝宝以后会在对话里慢慢了解你，不需要今晚一次填完。">
            <div className="chip-grid">
              {SUPPORT_NEEDS.map((need) => <button key={need} className={profile.needs.includes(need) ? "choice-chip selected" : "choice-chip"} onClick={() => toggleNeed(need)}>{profile.needs.includes(need) && <Check />} {need}</button>)}
            </div>
            <button className="primary-button" onClick={next}>这些已经够了</button>
          </OnboardingStep>
        )}
        {step === 4 && (
          <OnboardingStep eyebrow="它会长出自己的性格" title="你更喜欢怎样被陪伴？" copy="同一只宝宝，不同的说话节奏。你以后可以随时改变。">
            <div className="choice-stack">
              {COMMUNICATION_STYLES.map((item) => <ChoiceCard key={item.id} selected={profile.communicationStyle === item.id} onClick={() => setProfile((p) => ({ ...p, communicationStyle: item.id }))} title={item.title} copy={item.copy} />)}
            </div>
            <label className="field-label">给宝宝起个名字<input value={profile.babyName} onChange={(e) => setProfile((p) => ({ ...p, babyName: e.target.value.slice(0, 8) }))} /></label>
            <button className="primary-button" onClick={next}>让它记住</button>
          </OnboardingStep>
        )}
        {step === 5 && (
          <OnboardingStep eyebrow="记忆由你决定" title="哪些东西可以留下？" copy="默认本地保存。私人记录不会因为你加入社区就自动分享。">
            <PrivacyRow icon={Lock} title="在这台设备保存周期记忆" copy="可查看、导出和清除" checked={profile.localMemory} onChange={(v) => setProfile((p) => ({ ...p, localMemory: v }))} />
            <PrivacyRow icon={EnvelopeOpen} title="允许我主动选择分享月信" copy="每次仍需单独确认；默认匿名" checked={profile.communityConsent} onChange={(v) => setProfile((p) => ({ ...p, communityConsent: v }))} />
            <div className="boundary-note"><ShieldCheck /> 宝宝不会根据日期宣称测到排卵、激素或疾病，也不会把公开经验冒充医学建议。</div>
            <button className="primary-button" onClick={next}>我明白了</button>
          </OnboardingStep>
        )}
        {step === 6 && (
          <section className={`hatch-screen reveal-${isSeed ? "seed" : isPhoenix ? "phoenix" : "baby"}`}>
            <div className="hatch-halo" />
            <img src={revealVisual} alt={isSeed ? "月之种子继续在贝壳里陪伴" : isPhoenix ? "血月凤凰从月蚀光中归来" : "月经宝宝回到月光贝壳小窝"} />
            <p className="eyebrow">{isSeed ? "它会等身体自己的时间" : isPhoenix ? "关系没有随月经结束" : profile.menarcheDate ? "那一天，它第一次破壳" : "它早已在你的潮汐里"}</p>
            <h1>{profile.babyName || "小潮"}，{isSeed ? "继续陪着你" : "回到你身边了"}</h1>
            <p>{isSeed ? `“我还没有破壳，但我已经属于你。我们可以先从${profile.needs.slice(0, 1)[0] || "认识身体"}开始。”` : isPhoenix ? `“我曾是你的月经宝宝，如今带着这些经验飞得更高。${menarcheStory(profile)}，都没有消失。”` : `“${menarcheStory(profile)}。今天不是我第一次出生，而是你终于把一直陪着你的我接回了小窝。”`}</p>
            <button className="primary-button" onClick={finish}>{isSeed ? "把种子接回小窝" : isPhoenix ? "与凤凰继续同行" : "把宝宝接回小窝"} <Heart weight="fill" /></button>
          </section>
        )}
      </div>
    </div>
  );
}

function OnboardingStep({ eyebrow, title, copy, children }) {
  return <section className="onboarding-step"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="step-copy">{copy}</p>{children}</section>;
}

function menarcheStory(profile) {
  if (!profile.menarcheDate) return "即使不记得具体破壳日，它也已经陪你走过许多真实潮汐";
  const [year, month] = profile.menarcheDate.split("-").map(Number);
  const now = new Date();
  const totalMonths = Math.max(0, (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const duration = years ? `约 ${years} 年${months ? ` ${months} 个月` : ""}` : `约 ${Math.max(1, months)} 个月`;
  return `它在 ${year} 年 ${month} 月第一次破壳，已经陪你走过${duration}`;
}

function ChoiceCard({ selected, onClick, title, copy }) {
  return <button className={selected ? "choice-card selected" : "choice-card"} onClick={onClick}><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot">{selected && <Check />}</span></button>;
}

function PrivacyRow({ icon: Icon, title, copy, checked, onChange }) {
  return <label className="privacy-row"><Icon /><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="switch" /></label>;
}

function AppHeader({ screen, store, onBell }) {
  const titles = { nest: "小窝", cycle: "周期宇宙", knowledge: "知识海", gifts: "礼物海", journey: "我的旅程" };
  return <header className="app-header"><div className="brand-mark"><Moon weight="fill" /><span>月经宝宝</span></div><div className="header-center">{titles[screen]}</div><button className="icon-button" onClick={onBell} aria-label="查看消息"><Bell /><span className="notification-dot" /></button></header>;
}

function NestScreen({ store, setStore, draft, setDraft, startAgent, openAgent, openBodyMap, goTo, showMoment }) {
  const [differenceOpen, setDifferenceOpen] = useState(false);
  const homeComposerRef = useRef(null);
  const statePresentation = {
    curious: ["breathe", "刚刚认识你 · 好奇地靠近"],
    awake: ["breathe", "刚刚醒来 · 正在认识你的节律"],
    listening: ["listen", "正在听 · 把你的话放进贝壳"],
    cared: ["glow", "被真实结果照亮了"],
    serious: ["rest", "没有帮助，也是一条重要线索"],
    nesting: ["rest", "把潮汐札记收进了贝壳"],
    voyaging: ["voyage", "带着月信穿过月之海峡"],
    preparing: ["listen", "正在把担心叠成一份照护礼物"],
    receiving: ["glow", "抱住了刚刚抵达的发光贝壳"],
    befriending: ["voyage", "一条新的月潮航线亮了起来"],
    celebrating: ["glow", "从月宴回来，耳鳍还沾着星光"],
    opening: ["listen", "先替你查看月信的来源与边界"],
  };
  const defaultStageStatus = store.profile.lifeStage === "seed" ? "月之种子 · 安静等待身体自己的时间" : store.profile.lifeStage === "phoenix" ? "血月凤凰 · 带着经验继续同行" : !store.cycleAnchorConfirmed ? "正在认识你 · 不从空白数据猜周期" : store.cycleDay <= 5 ? "经期 · 想靠近你一点" : "月潮准备中 · 正在挑礼物";
  const [babyMode, stateStatus] = statePresentation[store.babyState] || ["breathe", defaultStageStatus];
  const babyStatus = ["curious", "awake"].includes(store.babyState) ? defaultStageStatus : stateStatus;
  const ritualAction = store.profile.lifeStage === "seed" ? { label: "准备初潮小包", hint: "让第一次不必慌张", type: "seed", title: "月之种子开始准备破壳小包", copy: "它放进月经用品、备用内裤和一张可以向可信成人求助的小卡片；准备不代表催促身体。" } : store.profile.lifeStage === "phoenix" ? { label: "整理经验月羽", hint: "把身体经验留下来", type: "phoenix", title: "血月凤凰展开了一枚经验月羽", copy: "它把长期经历、曾经有效与无效的办法整理成可以由你控制的传承，而不是让关系随绝经结束。" } : { label: "准备月潮生日", hint: "把担心变成礼物", type: "prepare", title: "宝宝开始准备月潮礼盒", copy: "它把旅行小包、睡眠观察卡和你过去有效的办法摆在贝壳边。" };
  const stageHome = store.profile.lifeStage === "seed" ? { headline: "身体有自己的时间，我们先认识，不催促", quick: "我还没有来过月经，担心第一次在学校突然来，不知道该准备什么。", listening: "月之种子正在听", placeholder: "例如：我担心第一次在学校突然来，不知道该找谁……" } : store.profile.lifeStage === "phoenix" ? { headline: "月经结束了，身体经验和陪伴没有消失", quick: "我已经绝经了，想把以前的月经变化和有用经验整理成一条时间线。", listening: "血月凤凰正在听", placeholder: "例如：我想把这些年的变化整理清楚，带给医生或留给自己……" } : { headline: !store.cycleAnchorConfirmed ? "先说说现在，宝宝不会从空白数据猜周期" : store.cycleDay <= 5 ? "身体不舒服，也不用一个人解释清楚" : "我们先准备，不预言身体一定会怎样", quick: "今天经期第二天，小腹很痛，但下午三点有个必须完成的汇报。", listening: "宝宝正在听", placeholder: "例如：我今天小腹一直坠痛，但下午还要汇报……" };
  const submitHomeMessage = (event) => {
    event.preventDefault();
    if (!draft.trim()) {
      homeComposerRef.current?.focus();
      return;
    }
    startAgent();
  };
  const handleHomeComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitHomeMessage(event);
    }
  };
  return (
    <section className="page nest-page">
      <BabyHero mode={babyMode} status={babyStatus} name={store.profile.babyName} growth={store.growth} stage={store.profile.lifeStage} />
      <div className="nest-greeting">
        <div><p className="eyebrow">今天的潮汐</p><h2>{stageHome.headline}</h2></div>
        <button className="text-button" onClick={() => goTo("cycle")}>看周期 <CaretRight /></button>
      </div>
      <form className="composer-card home-composer" onSubmit={submitHomeMessage}>
        <label className="composer-heading" htmlFor="home-agent-message"><Sparkle weight="fill" /><span>{stageHome.listening} · 直接打字给它</span></label>
        <textarea
          ref={homeComposerRef}
          id="home-agent-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleHomeComposerKeyDown}
          placeholder={stageHome.placeholder}
          rows={3}
        />
        <div className="composer-footer"><span>Enter 发送 · Shift + Enter 换行</span><button type="submit" disabled={!draft.trim()} aria-label="把这句话发给月经宝宝"><PaperPlaneTilt weight="fill" /></button></div>
      </form>
      <div className="quick-actions quick-actions-secondary">
        <button onClick={openAgent}><ChatCircleDots /><span><strong>打开完整对话</strong><small>自由打字，也可以继续补充</small></span></button>
        <button onClick={openBodyMap}><PersonArmsSpread /><span><strong>不想打字，点点身体</strong><small>哪里不舒服就点哪里</small></span></button>
        <button onClick={() => { setDraft(""); setStore((s) => ({ ...s, babyState: "preparing" })); goTo("gifts"); showMoment(ritualAction.type, ritualAction.title, ritualAction.copy, 1); }}><Package /><span><strong>{ritualAction.label}</strong><small>{ritualAction.hint}</small></span></button>
      </div>
      <section className="memory-strip">
        <div className="section-heading"><div><p className="eyebrow">它真正记得的</p><h3>不是“你来过”，而是怎样对你有用</h3></div><span className="count-pill">{store.episodes.length} 次结果</span></div>
        <div className="memory-card"><Clock /><p>{recallCopy(store.episodes)}</p></div>
      </section>
      <section className={differenceOpen ? "difference-card open" : "difference-card"}>
        <button className="difference-toggle" onClick={() => setDifferenceOpen((open) => !open)} aria-expanded={differenceOpen}><span><small>竞品研究后的诚实回答</small><strong>为什么不是普通经期 App 或通用 AI？</strong></span><CaretDown /></button>
        {differenceOpen && <div className="difference-content"><div><span>成熟经期 App</span><p>日期、预测、症状、报告和隐私控制已经做得很好；这些不是我们的独占功能。</p></div><div><span>通用健康 AI</span><p>已经能聊天、记忆并连接部分健康数据；“会回答、会记住”本身也不够。</p></div><div className="difference-focus"><span>月经宝宝只争取这一段增量</span><p>理解你的现实限制 → 安全地只选一个行动 → 追问真实效果 → 下个相似周期正确召回，同时允许你查看、纠正和删除。</p></div><div className="difference-evidence"><ShieldCheck /><p>依据：R002 中国目的性样本、R003 竞品与替代方案审计。它们支持设计方向，不证明普遍需求或产品效果。</p></div><button className="secondary-button" onClick={() => startAgent(stageHome.quick)}>拿一件真实处境来试</button></div>}
      </section>
      <section className="home-world-grid">
        <button className="world-card" onClick={() => goTo("knowledge")}><BookOpenText /><strong>邪修雷达</strong><small>看看流行说法靠不靠谱</small><CaretRight /></button>
        <button className="world-card" onClick={() => goTo("gifts")}><UsersThree /><strong>月潮航线</strong><small>{store.friends.length || 0} 位宝宝朋友</small><CaretRight /></button>
      </section>
    </section>
  );
}

function BabyHero({ mode = "breathe", status, name, growth, stage = "cycle" }) {
  const visual = stage === "seed" ? ["/assets/lifecycle/moon-seed.png", `${name}还是一颗住在贝壳里的月之种子`] : stage === "phoenix" ? ["/assets/lifecycle/blood-moon-phoenix.png", `${name}已经化作血月凤凰`] : ["/assets/moon-sea-hero.png", `${name}趴在月光贝壳里`];
  return (
    <section className={`baby-hero baby-${mode} baby-stage-${stage}`}>
      <img src={visual[0]} alt={visual[1]} />
      <div className="hero-sheen" />
      <div className="baby-status"><span className="status-orb" /><div><small>{name}</small><strong>{status}</strong></div></div>
      <div className="growth-badge"><Sparkle weight="fill" /> 潮光 {growth}</div>
    </section>
  );
}

function BodyMapModal({ selected, setSelected, onClose, onContinue }) {
  const [pain, setPain] = useState(null);
  const [mood, setMood] = useState(null);
  const [energy, setEnergy] = useState(null);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  const locations = selected.length ? selected.map((id) => BODY_ZONES.find((z) => z.id === id)?.label).join("、") : "说不清具体位置";
  const selectedStates = [["疼痛程度", pain], ["现在的心情", mood], ["现在的精力", energy]]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}：${value}`);
  const hasInput = selected.length > 0 || selectedStates.length > 0;
  const sentence = [`我现在${locations}不舒服。`, selectedStates.length ? `${selectedStates.join("；")}。` : "", "想请你帮我一起梳理。"].join("");
  return (
    <div className="modal-layer body-map-layer">
      <div className="sheet-header"><button className="icon-button" aria-label="关闭身体记录" onClick={onClose}><X /></button><div><p className="eyebrow">轻松启动一次记录</p><h2>点点身体</h2></div><span /></div>
      <p className="sheet-intro">这不是诊断图。点你能感觉到的位置，宝宝会把它变成接下来值得询问的线索。</p>
      <div className="body-map">
        <PersonArmsSpread weight="thin" aria-hidden="true" />
        {BODY_ZONES.map((zone) => <button key={zone.id} className={selected.includes(zone.id) ? "body-hotspot selected" : "body-hotspot"} style={{ top: `${zone.top}%`, left: `${zone.left}%` }} onClick={() => toggle(zone.id)} aria-label={`${zone.label}：${zone.detail}`}><span /></button>)}
      </div>
      <div className="plain-health-inputs">
        <PlainScale label="疼痛程度" note="按你此刻的主观感受，不是医学评分" value={pain} options={["轻微", "中等", "很强"]} onChange={setPain} />
        <PlainScale label="现在的心情" note="选最接近的，不需要解释原因" value={mood} options={["平稳", "有点烦", "很低落"]} onChange={setMood} />
        <PlainScale label="现在的精力" note="按今天能做事的余量选择" value={energy} options={["还可以", "偏低", "快耗尽"]} onChange={setEnergy} />
      </div>
      <div className="body-zone-list">{BODY_ZONES.map((zone) => <button key={zone.id} className={selected.includes(zone.id) ? "zone-chip selected" : "zone-chip"} onClick={() => toggle(zone.id)}><strong>{zone.label}</strong><small>{zone.detail}</small></button>)}</div>
      <button className="primary-button sticky-action" disabled={!hasInput} onClick={() => onContinue({ text: sentence, snapshot: { pain, mood, energy } })}>{hasInput ? <>让宝宝帮我梳理 <ChatCircleDots /></> : "先点一个位置或状态"}</button>
    </div>
  );
}

function PlainScale({ label, note, value, options, onChange }) {
  return <section className="plain-scale"><div><strong>{label}</strong><small>{note}</small></div><div>{options.map((option) => <button key={option} className={value === option ? "selected" : ""} onClick={() => onChange(option)}>{option}</button>)}</div></section>;
}

function AgentPanel({ text, zones, recordSnapshot, store, setStore, onClose, showMoment }) {
  const [workingText, setWorkingText] = useState(text.trim());
  const [visibleUserText, setVisibleUserText] = useState(text.trim());
  const [chatDraft, setChatDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [priorEpisodes] = useState(() => store.episodes);
  const chatInputRef = useRef(null);
  const analysis = useMemo(() => workingText ? analyzeInput(workingText) : null, [workingText]);
  const remembered = useMemo(() => analysis ? findSimilarEpisode(priorEpisodes, analysis) : null, [priorEpisodes, analysis]);
  const [step, setStep] = useState(() => {
    if (!text.trim()) return "compose";
    return analyzeInput(text).redFlag ? "safety" : "reflect";
  });
  const gift = analysis ? CARE_GIFTS.find((item) => item.id === analysis.recommendedGift) || CARE_GIFTS[0] : null;
  const [effect, setEffect] = useState(null);
  const [episode, setEpisode] = useState(null);
  const companionVisual = store.profile.lifeStage === "seed" ? "/assets/lifecycle/moon-seed.png" : store.profile.lifeStage === "phoenix" ? "/assets/lifecycle/blood-moon-phoenix.png" : "/assets/moon-sea-hero.png";
  const companionTitle = store.profile.lifeStage === "seed" ? "月之种子" : store.profile.lifeStage === "phoenix" ? "血月凤凰" : `${store.profile.babyName} · 月经宝宝`;
  const isFirstPeriodPreparation = analysis?.tags.includes("初潮准备");
  const isLifeReview = analysis?.tags.includes("长期变化整理");
  const emergencySafety = ["bleeding", "crisis"].includes(analysis?.redFlag?.code);
  useEffect(() => {
    if (!workingText) chatInputRef.current?.focus();
  }, [workingText]);
  useEffect(() => {
    if (analysis?.redFlag) setStep("safety");
  }, [analysis?.redFlag]);
  const submitChatMessage = (event) => {
    event.preventDefault();
    const nextText = chatDraft.trim();
    if (!nextText) {
      chatInputRef.current?.focus();
      return;
    }
    const hasConversationContext = Boolean(workingText);
    const nextWorkingText = hasConversationContext ? `${workingText}\n用户补充：${nextText}` : nextText;
    const nextAnalysis = analyzeInput(nextWorkingText);
    const soundsUncertain = /(不确定|好像有变化|不太一样|突然|加重|异常出血|头晕|发烧|发热|呕吐)/.test(nextText)
      && !/(和(?:以前|以往)差不多|没有这些变化|没这些变化|没有发烧|没发烧|没有发热|没发热)/.test(nextText);
    setWorkingText(nextWorkingText);
    setVisibleUserText(nextText);
    setChatDraft("");
    setEditing(false);
    setEffect(null);
    setEpisode(null);
    setStep(nextAnalysis.redFlag ? "safety" : hasConversationContext ? (soundsUncertain ? "uncertain" : "care") : "reflect");
  };
  const handleChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitChatMessage(event);
    }
  };
  const saveEffect = (value) => {
    const nextEpisode = createEpisode(analysis, value, zones, gift, recordSnapshot);
    setEffect(value);
    setEpisode(nextEpisode);
    setStore((s) => applyEpisodeOutcome(s, nextEpisode, gift.id, analysis));
    setStep("saved");
  };
  const share = () => {
    if (!episode) return;
    const letter = { id: `letter-${Date.now()}`, episodeId: episode.id, title: `${gift.title}的真实结果`, effect, anonymous: true, sentAt: new Date().toISOString() };
    setStore((s) => ({ ...s, sentGifts: [letter, ...s.sentGifts], growth: s.growth + 2, babyState: "voyaging" }));
    showMoment("send", "月信穿过了月之海峡", "宝宝把你的真实反馈封好，只带走你同意分享的状态、行动和结果。月潮航线亮起了一小段。", 1);
    onClose();
  };
  return (
    <div className="modal-layer agent-layer">
      <div className="sheet-header"><button className="icon-button" aria-label="返回小窝" onClick={onClose}><ArrowLeft /></button><div><p className="eyebrow">{companionTitle} · 周期 Agent</p><h2>我和你一起理清</h2></div><ShieldCheck /></div>
      <div className="chat-thread" aria-live="polite">
        {analysis ? (
          <>
            <div className="message user-message">{visibleUserText}</div>
            {step === "safety" ? (
          <div className="safety-card"><WarningCircle weight="fill" /><div><p className="eyebrow">宝宝进入认真守护状态</p><h3>{analysis.redFlag.title}</h3><p>{analysis.redFlag.action}</p><div className="boundary-note">我不会继续普通礼物流程，也不会从一句话给你疾病结论。</div><div className="safety-actions">{emergencySafety && <a className="primary-button" href="tel:120">联系紧急帮助（中国大陆 120）</a>}<button className={emergencySafety ? "secondary-button" : "primary-button"} onClick={onClose}>{emergencySafety ? "我已看见，返回小窝" : "我会尽快联系医疗专业人员"}</button></div></div></div>
        ) : (
          <>
            <div className={`message baby-message mini-stage-${store.profile.lifeStage}`}><span className="mini-baby"><img src={companionVisual} alt="" /></span><div><p>我听见的不只是“难受”。{analysis.context}</p><div className="understanding-tags">{analysis.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button className="interpretation-edit" onClick={() => setEditing((value) => !value)}>{editing ? "收起修改" : "有哪里没听对？补充或改一下"}</button></div></div>
            {editing && <div className="correction-card"><label htmlFor="agent-correction">这段文字会重新理解，不会覆盖你没有确认的内容</label><textarea id="agent-correction" value={workingText} onChange={(event) => setWorkingText(event.target.value)} /><button className="primary-button" disabled={!workingText.trim()} onClick={() => { setVisibleUserText(workingText); setEditing(false); }}>重新理解这一次</button></div>}
            {remembered && <div className="context-memory"><Clock /><div><small>从你的周期记忆里找到一条相似线索</small><p>{recallCopy([remembered], analysis)}</p></div></div>}
            {step === "reflect" && <div className="agent-card"><p className="eyebrow">{analysis.intent === "knowledge" ? "先把说法放回你的处境" : isFirstPeriodPreparation ? "先把慌张变成可以准备的事" : isLifeReview ? "先选一条最重要的线" : "先确认一个安全边界"}</p><h3>{analysis.followUp}</h3>{analysis.intent === "knowledge" ? <><button className="primary-button" onClick={() => setStep("care")}>我正在经历这个困扰，想知道下一步</button><button className="secondary-button" onClick={() => setStep("care")}>我只是想先判断这句话靠不靠谱</button></> : isFirstPeriodPreparation ? <><button className="primary-button" onClick={() => setStep("care")}>先准备一份学校里的第一次月潮小包</button><button className="secondary-button" onClick={() => setStep("care")}>先写下一位我可以求助的可信成人</button></> : isLifeReview ? <><button className="primary-button" onClick={() => setStep("care")}>先整理出血与周期变化</button><button className="secondary-button" onClick={() => setStep("care")}>先整理症状、尝试和真实效果</button></> : <><button className="primary-button" onClick={() => setStep("care")}>和以往相似，没有这些变化</button><button className="secondary-button" onClick={() => setStep("uncertain")}>我不确定 / 好像有变化</button></>}</div>}
            {step === "uncertain" && <div className="safety-card soft"><Info weight="fill" /><div><h3>先不要急着把它归因给周期</h3><p>如果出现突然加重、异常出血、头晕、发热、持续呕吐或明显影响基本活动，建议尽快联系医疗机构。你也可以先把变化时间线保存下来。</p><button className="secondary-button" onClick={() => setStep("care")}>我已了解，继续看低风险照护</button></div></div>}
            {step === "care" && <div className="gift-action-card"><div className="gift-ribbon">{analysis.intent === "knowledge" ? <BookOpenText weight="fill" /> : <Gift weight="fill" />} {analysis.intent === "knowledge" ? "现在只做一个求证动作" : "现在只选一个照护行动"}</div><h3>{gift.title}</h3><p>{gift.kind}</p><div className="action-how"><Clock /> {gift.how}</div><div className="boundary-note"><ShieldCheck /> {gift.caution}</div>{gift.sourceUrl ? <a className="care-source" href={gift.sourceUrl} target="_blank" rel="noreferrer">依据：{gift.source} <CaretRight /></a> : <small>依据：{gift.source}</small>}<button className="primary-button" onClick={() => setStep("feedback")}>{analysis.intent === "knowledge" ? "继续看三层拆解" : "让宝宝陪我试一次"}</button></div>}
            {step === "feedback" && <div className="agent-card feedback-card"><p className="eyebrow">{gift.feedbackAfter} · {analysis.intent === "knowledge" ? "不把懂不懂变成考试" : "不需要讨好宝宝"}</p><h3>{analysis.intent === "knowledge" ? "这次拆解让你更清楚了吗？" : "这个办法真实地帮到你了吗？"}</h3><button onClick={() => saveEffect("helped")}><span className="effect-orb strong" /><span><strong>{analysis.intent === "knowledge" ? "已经清楚很多" : "很有帮助"}</strong><small>{analysis.intent === "knowledge" ? "保留这套求证方式" : "下次可以优先准备"}</small></span></button><button onClick={() => saveEffect("some")}><span className="effect-orb some" /><span><strong>{analysis.intent === "knowledge" ? "有一点更清楚" : "有一点帮助"}</strong><small>保留，但不要夸大</small></span></button><button onClick={() => saveEffect("none")}><span className="effect-orb none" /><span><strong>{analysis.intent === "knowledge" ? "仍然不清楚" : "没有帮助 / 更不舒服"}</strong><small>{analysis.intent === "knowledge" ? "需要补来源或换一种解释" : "排除或谨慎复用"}</small></span></button></div>}
            {step === "saved" && <div className="saved-card"><div className="saved-icon"><Check weight="bold" /></div><p className="eyebrow">{store.privacy.localMemory ? "已经成为一封潮汐札记" : "只保留在当前对话"}</p><h3>宝宝记住的是结果，不是打卡</h3><p>{store.privacy.localMemory ? `这次状态、行动与“${effect === "helped" ? "很有帮助" : effect === "some" ? "有一点帮助" : "没有帮助"}”已经保存在你的本地周期记忆中。` : "你关闭了本地周期记忆，所以这次结果不会写入长期档案，也不会更新周期位置、成长或礼物；当前对话结束后不再保留。"}</p><div className="saved-actions"><button className="primary-button" onClick={() => setStep("shareConfirm")}><EnvelopeOpen /> {store.privacy.communityConsent ? "匿名封成月信" : "只为这一次开启匿名月信"}</button><button className="secondary-button" onClick={() => { if (store.privacy.localMemory) setStore((s) => ({ ...s, babyState: effect === "none" ? "serious" : "nesting" })); showMoment("care", "宝宝把结果轻轻抱住了", store.privacy.localMemory ? "它把潮汐札记收进贝壳：诚实说‘没用’，也会帮助它更了解你。" : "它尊重你不留下长期记忆的选择；这次陪伴不会变成档案。", store.privacy.localMemory ? 1 : 0); onClose(); }}>回到我的小窝</button></div></div>}
            {step === "shareConfirm" && <div className="share-confirm-card"><p className="eyebrow">这一次，由你决定</p><h3>月信只会带走这三件事</h3><div className="share-preview"><span>处境</span><strong>{analysis.tags.join(" · ")}</strong><span>行动</span><strong>{gift.title}</strong><span>结果</span><strong>{effect === "helped" ? "很有帮助" : effect === "some" ? "有一点帮助" : "没有帮助"}</strong></div><div className="boundary-note"><Lock /> 不包含原话、姓名和完整周期档案。{store.privacy.communityConsent ? "即使你已打开分享，每一封仍需确认。" : "这次授权只适用于这一封；你的通用分享开关仍保持关闭。"}</div><button className="primary-button" onClick={share}><PaperPlaneTilt /> 确认派宝宝送出</button><button className="secondary-button" onClick={() => setStep("saved")}>先不分享</button></div>}
              </>
            )}
          </>
        ) : (
          <div className={`message baby-message agent-welcome mini-stage-${store.profile.lifeStage}`}>
            <span className="mini-baby"><img src={companionVisual} alt="" /></span>
            <div><p><strong>我在这里。</strong><br />你可以像发消息一样，直接告诉我身体哪里不舒服、心里在担心什么，或者今天还有什么必须完成的事。</p><small><Lock /> 发送后我会先复述理解，不会自动保存或分享。</small></div>
          </div>
        )}
      </div>
      <form className="agent-composer" onSubmit={submitChatMessage}>
        <label htmlFor="agent-live-message">{analysis ? "继续打字，补充或换一种说法" : "直接打字给月经宝宝"}</label>
        <div className="agent-composer-row">
          <textarea
            ref={chatInputRef}
            id="agent-live-message"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder={analysis ? "例如：和以前差不多，没有发烧，但我现在很累……" : "说说此刻发生了什么……"}
            rows={2}
          />
          <button type="submit" disabled={!chatDraft.trim()} aria-label="发送给月经宝宝"><PaperPlaneTilt weight="fill" /></button>
        </div>
        <span>Enter 发送 · Shift + Enter 换行</span>
      </form>
    </div>
  );
}

function CycleScreen({ store, goTo }) {
  const [view, setView] = useState("research");
  const hasPosition = store.cycleAnchorConfirmed && !["seed", "phoenix"].includes(store.profile.lifeStage);
  const cursor = `${Math.min(97, Math.max(2, ((store.cycleDay - 1) / 29) * 100))}%`;
  const cursorEdge = store.cycleDay <= 4 ? "edge-left" : store.cycleDay >= 27 ? "edge-right" : "";
  const positionCopy = store.profile.lifeStage === "seed"
    ? "D1–D30 是初潮之后的典型教学坐标。月之种子还没有破壳，所以这里不会替你生成一个当前周期日。"
    : store.profile.lifeStage === "phoenix"
      ? "D1–D30 只保留为回看过去身体旅程的教学坐标；绝经后不再生成当前周期位置。"
      : hasPosition
        ? `D1–D30 是典型教学坐标；自述 D${store.cycleDay} 只定位你主动提供的记录，不代表测到排卵、激素或身体状态。`
        : "D1–D30 是典型教学坐标。你还没有提供可用的来潮日期或周期日，所以今天标记保持空白。";
  return (
    <section className="page cycle-page">
      <div className="page-title"><p className="eyebrow">同一个时间点，看见身体如何协同</p><h1>周期全景图</h1><p>{positionCopy}</p></div>
      <div className="segmented-control"><button className={view === "research" ? "active" : ""} onClick={() => setView("research")}>研究参考</button><button className={view === "personal" ? "active" : ""} onClick={() => setView("personal")}>我的节律</button></div>
      <div className="timeline-card">
        <div className="timeline-intro"><span>典型自然排卵周期 · 教学模型</span><small>阶段长度与排卵时点会变化</small></div>
        <div className="cycle-axis">
          <div className="day-ruler" aria-label="周期教学坐标，从第一天到第三十天">{[1,5,10,15,20,25,30].map((day) => <span key={day} style={{ left: `${((day - 1) / 29) * 100}%` }}>D{day}</span>)}</div>
          <div className="dual-phases">
            <div className="phase-row"><small>卵巢周期</small><div className="phase-band"><span className="follicular">卵泡期</span><span className="ovulation">排卵事件<br />不确定窗口</span><span className="luteal">黄体期</span></div></div>
            <div className="phase-row"><small>内膜周期</small><div className="phase-band"><span className="menses">月经 / 脱落</span><span className="growth">增殖期</span><span className="secretory">分泌期</span></div></div>
          </div>
          {hasPosition && <div className={`today-line ${cursorEdge}`} style={{ left: cursor }}><span>自述 D{store.cycleDay}</span></div>}
          {CYCLE_TRACKS.map((track) => <SystemTrack key={track.id} {...track} />)}
        </div>
        <div className="landscape-boundary"><Info weight="fill" /><span>这些是艺术化的相对顺序示意，不是你的实时 X 光、排卵确认、内膜测量或激素检测。</span></div>
      </div>
      {view === "research" ? <ResearchClimate /> : <PersonalRhythm store={store} />}
      <details className="cycle-source-drawer">
        <summary><ShieldCheck /><span><strong>严谨性审查与完整来源</strong><small>权威来源已逐项映射；成品妇产科专家签字仍待完成</small></span><CaretDown /></summary>
        <div className="cycle-source-content">
          <p>已核对：两套周期不互斥、排卵是可变事件、内膜脱落与修复可重叠、分泌物存在其他解释、日历不生成个人器官状态。</p>
          <div className="cycle-source-list">{Object.entries(CYCLE_SOURCES).map(([id, source]) => <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.label}<CaretRight /></a>)}</div>
          <p className="audit-limit"><WarningCircle /> 这仍是黑客松教学原型，不是诊断工具，也尚未完成妇产科、内分泌和用户理解测试。</p>
          <button className="secondary-button" onClick={() => goTo("knowledge")}>去知识海继续核对说法</button>
        </div>
      </details>
    </section>
  );
}

function SystemTrack({ title, image, stages, sources, boundary }) {
  const columns = stages.map((stage) => `${stage.weight}fr`).join(" ");
  return <section className="system-track"><div className="track-heading"><strong>{title}</strong><span>教学模型</span></div><img src={image} alt={`${title}的艺术化典型周期教学序列，不代表个人实时状态`} /><div className="track-stage-labels" style={{ gridTemplateColumns: columns }}>{stages.map((stage) => <span key={stage.label}>{stage.label.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</span>)}</div><details className="track-evidence"><summary><ShieldCheck /><span>为什么这样画 · {sources.join(" / ")}</span><CaretDown /></summary><p>{boundary}</p><div className="track-source-links">{sources.map((id) => <a key={id} href={CYCLE_SOURCES[id].url} target="_blank" rel="noreferrer">{CYCLE_SOURCES[id].label}<CaretRight /></a>)}</div></details></section>;
}

function ResearchClimate() {
  return <section className="climate-card"><div className="section-heading"><div><p className="eyebrow">证据气候，而不是统一曲线</p><h3>有些地方研究更清楚，有些应该留白</h3></div><Info /></div><div className="climate-items"><div><span className="climate-dot strong" /><p><strong>体温</strong><small>排卵后相对上移有较明确机制；不能据此单独确认排卵。</small></p></div><div><span className="climate-dot conditional" /><p><strong>睡眠与疼痛</strong><small>对有PMS/痛经症状的人群更值得关注，不代表人人固定变化。</small></p></div><div><span className="climate-dot limited" /><p><strong>心情与精力</strong><small>不画“平均女性曲线”；优先看你的重复记录。</small></p></div></div></section>;
}

function PersonalRhythm({ store }) {
  const count = store.episodes.length;
  const tracks = [
    ["睡眠", (episode) => episode.tags?.includes("睡眠变化")],
    ["疼痛/不适", (episode) => episode.tags?.some((tag) => ["下腹疼痛", "头痛", "腰背不适", "疼痛很强"].includes(tag)) || episode.bodyZones?.length],
    ["精力", (episode) => episode.tags?.includes("精力偏低")],
    ["心情", (episode) => episode.tags?.includes("情绪变化")],
  ];
  return <section className="personal-rhythm"><div className="section-heading"><div><p className="eyebrow">只用你授权的记录</p><h3>{count < 2 ? "现在还不能画出你的模式" : `已有 ${count} 次状态—行动—结果`}</h3></div><span className="count-pill">{count} 条</span></div>{tracks.map(([label, matches]) => { const records = store.episodes.filter((episode) => episode.cycleDay && matches(episode)).slice(0, 8); return <div className="rhythm-row" key={label}><strong>{label}</strong><div className="rhythm-track">{records.length ? records.map((episode) => <span key={episode.id} style={{ left: `${Math.min(98, Math.max(2, ((episode.cycleDay - 1) / 29) * 100))}%` }} className={label === "疼痛/不适" ? "record-dot pain" : "record-dot"} />) : <span className="missing-line">这个维度尚无记录</span>}</div></div>; })}<p className="microcopy">每个圆点只来自相应维度的真实记录；缺失就留白。数据不足时不连成趋势，压力、生病等竞争因素也会一起保留。</p></section>;
}

function KnowledgeScreen({ knowledge, store, setStore, showMoment, startAgent }) {
  const [tab, setTab] = useState("claims");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const professional = [...knowledge.myths.map((m) => ({ ...m, _kind: "myth", _title: m.myth_statement, _body: m.accurate_correction })), ...knowledge.claims.map((c) => ({ ...c, _kind: "claim", _title: c.node_labels || c.claim_id, _body: c.claim_text_plain }))];
  const monidCards = knowledge.monid.map((p) => ({ ...p, id: p.candidateId, topic: p.symptomCluster || "公开候选", claim: p.title, experience: p.excerpt, evidence: "unknown", risk: p.safetyBoundary || "尚未完成全文和专业风险复核", source: "R006 SQLite · 小红书公开搜索摘要", sourceUrl: p.sourceUrl }));
  const practiceCards = monidCards;
  const list = tab === "claims" ? professional : practiceCards;
  const filtered = list.filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase())).slice(0, 20);
  const medicalLane = knowledge.provenance?.evidenceLanes?.find((lane) => lane.id === "medical_or_official_background");
  const openDetail = (item) => {
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "auto" });
    setDetail(item);
  };
  const tryPractice = (item) => {
    if (!item.giftable) { startAgent(`我看到一个说法：“${item.claim}”。你能帮我分清它的证据、风险和是否适合我吗？`); return; }
    setStore((s) => ({ ...s, preparedGiftIds: [...new Set([...s.preparedGiftIds, "sleep"])], growth: s.growth + 1 }));
    showMoment("research", "宝宝没有替你相信它", "它先把这条经验装进“待验证礼物”，并附上来源、风险和反馈入口。", 1);
  };
  return (
    <section className="page knowledge-page">
      <div className="page-title"><p className="eyebrow">专业证据 × 真实经验 × 你的结果</p><h1>月经知识海</h1><p>不是把所有声音混成答案，而是帮你知道每句话凭什么。</p></div>
      <label className="search-field"><MagnifyingGlass /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：黄体期运动、痛经、睡眠……" />{query && <button onClick={() => setQuery("")}><X /></button>}</label>
      <div className="segmented-control"><button className={tab === "claims" ? "active" : ""} onClick={() => setTab("claims")}>专业证据 · {knowledge.claims.length + knowledge.myths.length}</button><button className={tab === "practices" ? "active" : ""} onClick={() => setTab("practices")}>邪修雷达 · {practiceCards.length}</button></div>
      {tab === "claims" && <div className="research-boundary professional-boundary"><ShieldCheck /><span><strong>专业底座可追溯，不假装已经临床上线</strong>当前演示卡来自 R004 {knowledge.claimsMeta?.releaseId || "r5"}：{medicalLane?.counts?.active_sources || 109} 个专业/官方来源；每张卡至少有一条来源定位。妇产科产品级终审仍待完成，因此这里只做科普背景，不做诊断或处方。</span></div>}
      {tab === "practices" && <div className="research-boundary"><Info /><span>{knowledge.monid.length} 条全部由 R006 SQLite 导出，仅保留匿名摘要；固定查询的公开互动只是讨论频率代理，不等于需求规模或有效。当前 0 条可直接作为照护建议。</span></div>}
      <div className="knowledge-list">
        {filtered.map((item, index) => tab === "claims" ? (
          <button className="knowledge-card" key={item.claim_id || item.myth_id || index} onClick={() => openDetail(item)}><span className={`evidence-mark ${item._kind}`}><BookOpenText /></span><div><small>{item._kind === "myth" ? "常见误解纠正 · 来源已定位" : `${item.evidence_strength || "专业背景"} · 来源已定位`}</small><h3>{item._title}</h3><p>{item._body}</p></div><CaretRight /></button>
        ) : (
          <article className="practice-card" key={item.id || index}><div className="practice-top"><span>{item.topic}</span><EvidenceBadge type={item.evidence} /></div><h3>{item.claim}</h3><p>{item.experience}</p><div className="risk-line"><ShieldCheck /> {item.risk}</div><footer><small>{item.source}</small><button onClick={() => tryPractice(item)}>让宝宝分辨 <CaretRight /></button></footer></article>
        ))}
      </div>
      {detail && createPortal(<KnowledgeDetail item={detail} onClose={() => setDetail(null)} onAsk={() => { setDetail(null); startAgent(`请结合我的情况解释：${detail._body}`); }} />, document.querySelector(".mobile-prototype"))}
    </section>
  );
}

function EvidenceBadge({ type }) { const value = EVIDENCE_LABELS[type] || ["待复核", "尚未核验"]; return <span className={`evidence-badge ${type}`}>{value[0]}</span>; }

function KnowledgeDetail({ item, onClose, onAsk }) {
  const sourceDetails = item.source_details || [];
  return <div className="modal-layer detail-layer"><div className="sheet-header"><button className="icon-button" aria-label="返回知识海" onClick={onClose}><ArrowLeft /></button><div><p className="eyebrow">{item._kind === "myth" ? "误解纠正研究卡" : "专业研究背景卡"}</p><h2>{item._title}</h2></div><span /></div><div className="detail-content"><section><p className="eyebrow">目前可以说</p><p className="detail-lead">{item._body}</p></section>{item.population_and_context && <section><h3>适用于什么情境</h3><p>{item.population_and_context}</p></section>}{item.counterexample_or_conflict && <section><h3>不能这样简单解释</h3><p>{item.counterexample_or_conflict}</p></section>}{item.potential_harm && <section className="danger-section"><h3>错误理解可能带来什么</h3><p>{item.potential_harm}</p></section>}<section><h3>来源与边界</h3>{sourceDetails.length ? <div className="knowledge-source-list">{sourceDetails.slice(0, 8).map((source, index) => <a key={`${source.source_id}-${source.locator_type}-${index}`} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.source_title}</strong><small>{[source.organization_or_authors, source.publication_year, source.source_type].filter(Boolean).join(" · ")}</small><em>{source.verification_status === "fulltext_checked" ? "全文核验" : source.verification_status === "abstract_checked" ? "摘要核验" : "已登记"} · 定位：{source.locator_type} {source.locator_value}</em></span><CaretRight /></a>)}</div> : <p>{item.sources || "来源保存在月经知识事实数据库中。"}</p>}<p className="microcopy">{item.limitations || item.app_safe_wording || "这是一条群体知识，不是你的个人诊断。"}</p><div className="clinical-review-note"><ShieldCheck /> {item.publication_boundary || "仍待妇产科产品级终审。"}</div></section><button className="primary-button" onClick={onAsk}>结合我的情况问宝宝</button></div></div>;
}

function GiftSeaScreen({ store, setStore, showMoment }) {
  const [tab, setTab] = useState("sea");
  const addFriend = (friend) => { if (store.friends.includes(friend.id)) return; setStore((s) => ({ ...s, friends: [...s.friends, friend.id], growth: s.growth + 1, babyState: "befriending" })); showMoment("friend", `${store.profile.babyName}认识了${friend.name}`, `两只宝宝在月之海峡碰了碰耳鳍，一条新的月潮航线亮了起来。`, 1); };
  const receiveGift = (friend) => { if (store.receivedGifts.some((g) => g.from === friend.id)) return; const gift = { id: `incoming-${friend.id}`, from: friend.id, title: friend.gift, receivedAt: new Date().toISOString(), status: "unopened" }; setStore((s) => ({ ...s, receivedGifts: [gift, ...s.receivedGifts], growth: s.growth + 2, babyState: "receiving" })); showMoment("receive", `${friend.name}的月信抵达了`, `${store.profile.babyName}从海面捞起一只发光贝壳。礼物只是一段匿名经验，你可以选择打开、忽略或让宝宝先核查。`, 1); };
  const bless = (birthday) => { if (store.blessings.includes(birthday.id)) return; setStore((s) => ({ ...s, blessings: [...s.blessings, birthday.id], growth: s.growth + 1, babyState: "celebrating" })); showMoment("celebrate", `${store.profile.babyName}出发去送祝福`, `不是你去联系陌生人。宝宝带着一颗月光珍珠，穿过月之海峡参加${birthday.baby}的生日月宴。`, 1); };
  return (
    <section className="page gift-page">
      <div className="page-title"><p className="eyebrow">宝宝替你连接，而不是暴露你</p><h1>礼物海</h1><p>真实经验通过同意、匿名和风险边界变成月信，在宝宝之间流动。</p><span className="demo-seed-label">比赛演示社区 · 当前宝宝与活动均为明确标记的种子数据</span></div>
      <div className="gift-tabs"><button className={tab === "sea" ? "active" : ""} onClick={() => setTab("sea")}>海面</button><button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>Agent交友</button><button className={tab === "birthday" ? "active" : ""} onClick={() => setTab("birthday")}>今夜月宴</button><button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>我的贝壳</button></div>
      {tab === "sea" && <div className="sea-feed"><section className="sea-hero"><div className="sea-orbit"><EnvelopeOpen weight="thin" /><span>{store.sentGifts.length + store.receivedGifts.length}</span></div><p className="eyebrow">月之海峡正在发光</p><h2>每一份礼物，都带着“对谁、何时、是否有效”</h2><p>这里没有“万能偏方排行榜”，只有可以追溯的经验和诚实反馈。</p></section>{BABY_FRIENDS.slice(0,4).map((friend) => <article className="sea-gift-card" key={friend.id}><div className="friend-avatar"><img src="/assets/moon-sea-hero.png" alt={`${friend.name}的月经宝宝`} /></div><div className="sea-gift-copy"><small>{friend.route}</small><h3>{friend.gift}</h3><p>{friend.name}带来的一份匿名经验礼物 · 不是医学证据</p><button onClick={() => receiveGift(friend)}>{store.receivedGifts.some((g) => g.from === friend.id) ? <><Check /> 已收到</> : <><Gift /> 派宝宝去接</>}</button></div></article>)}</div>}
      {tab === "friends" && <div className="friend-list"><div className="section-heading"><div><p className="eyebrow">月潮航线</p><h3>{store.profile.babyName}已经认识 {store.friends.length} 位宝宝</h3></div><UsersThree /></div>{BABY_FRIENDS.map((friend) => <article className="friend-card" key={friend.id}><div className="friend-avatar"><img src="/assets/moon-sea-hero.png" alt="" /></div><div><small>{friend.state} · {friend.owner}</small><h3>{friend.name}</h3><p>{friend.mood}</p><span>{friend.route}</span></div><button aria-label={store.friends.includes(friend.id) ? `已经认识${friend.name}` : `让${store.profile.babyName}认识${friend.name}`} className={store.friends.includes(friend.id) ? "connected" : ""} onClick={() => addFriend(friend)}>{store.friends.includes(friend.id) ? <Check /> : <Plus />}</button></article>)}</div>}
      {tab === "birthday" && <div className="birthday-list"><section className="birthday-hero"><Moon weight="fill" /><p className="eyebrow">今天，整片海都在庆祝月经</p><h2>今夜月宴</h2><p>每次真实来潮的开始，都是一次“月潮生日”：不是重新出生，而是又共同走完一段身体旅程。</p></section>{BIRTHDAYS.map((item) => <article className="birthday-card" key={item.id}><div className="birthday-moon"><span>{item.day}</span><Moon weight="fill" /></div><div><small>{item.baby}的月潮生日愿望</small><h3>{item.wish}</h3><p>主人准备了：{item.prepared}</p><button onClick={() => bless(item)}>{store.blessings.includes(item.id) ? <><Check /> 宝宝已送达祝福</> : <><PaperPlaneTilt /> 派我的宝宝去祝福</>}</button></div></article>)}</div>}
      {tab === "inventory" && <Inventory store={store} setStore={setStore} showMoment={showMoment} />}
    </section>
  );
}

function Inventory({ store, setStore, showMoment }) {
  const prepared = CARE_GIFTS.filter((gift) => store.preparedGiftIds.includes(gift.id));
  const openGift = (gift) => { if (gift.status === "opened") return; setStore((s) => ({ ...s, receivedGifts: s.receivedGifts.map((g) => g.id === gift.id ? { ...g, status: "opened" } : g), growth: s.growth + 1, babyState: "opening" })); showMoment("open", "贝壳在宝宝怀里慢慢打开", "它先看见这是一段匿名经验，再把“适用情境”和“不能据此判断什么”放到你面前。", 1); };
  return <div className="inventory"><div className="section-heading"><div><p className="eyebrow">月潮生日准备</p><h3>已经放进贝壳的照护礼物</h3></div><Package /></div>{prepared.map((gift) => <article className="inventory-card" key={gift.id}><Gift weight="fill" /><div><small>{gift.kind}</small><h3>{gift.title}</h3><p>{gift.caution}</p></div></article>)}<div className="section-heading incoming-heading"><div><p className="eyebrow">收到的月信</p><h3>{store.receivedGifts.length} 份等待你决定</h3></div><EnvelopeOpen /></div>{store.receivedGifts.length ? store.receivedGifts.map((gift) => <article className="incoming-card" key={gift.id}><div><small>来自 {BABY_FRIENDS.find((f) => f.id === gift.from)?.name || "匿名宝宝"}</small><h3>{gift.title}</h3><p>公开经验礼物 · 尚未成为你的个人结论</p></div><button disabled={gift.status === "opened"} onClick={() => openGift(gift)}>{gift.status === "opened" ? "已打开" : "打开贝壳"}</button></article>) : <div className="empty-card">去海面派宝宝接一份月信吧。你随时可以忽略，不会失去成长。</div>}</div>;
}

function JourneyScreen({ store, setStore, showMoment }) {
  const [section, setSection] = useState("growth");
  const exportData = () => { const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "我的月经宝宝数据.json"; a.click(); URL.revokeObjectURL(url); };
  const reset = () => { if (!window.confirm("只清除完整宇宙版的本地演示数据，原版本不会受影响。继续吗？")) return; localStorage.removeItem(STORAGE_KEY); location.reload(); };
  return <section className="page journey-page"><div className="page-title"><p className="eyebrow">不是连续打卡，而是共同经历</p><h1>{store.profile.babyName}的成长旅程</h1><p>照护、诚实反馈、送出和收到月信，都会留下不同的关系痕迹。</p><div className="companion-age-note"><Moon weight="fill" /><span>{store.profile.lifeStage === "seed" ? "月之种子没有生日；它正在等身体自己的破壳时间" : menarcheStory(store.profile)}</span></div></div><div className="segmented-control"><button className={section === "growth" ? "active" : ""} onClick={() => setSection("growth")}>生命周期</button><button className={section === "report" ? "active" : ""} onClick={() => setSection("report")}>周期报告</button><button className={section === "privacy" ? "active" : ""} onClick={() => setSection("privacy")}>隐私</button></div>{section === "growth" && <Lifecycle store={store} setStore={setStore} showMoment={showMoment} />}{section === "report" && <Report store={store} setStore={setStore} showMoment={showMoment} />}{section === "privacy" && <div className="privacy-panel"><PrivacyRow icon={Lock} title="本地周期记忆" copy="关闭后不再新增长期记忆" checked={store.privacy.localMemory} onChange={(v) => setStore((s) => ({ ...s, privacy: { ...s.privacy, localMemory: v } }))} /><PrivacyRow icon={EnvelopeOpen} title="允许选择分享月信" copy="每一封仍需单独确认" checked={store.privacy.communityConsent} onChange={(v) => setStore((s) => ({ ...s, privacy: { ...s.privacy, communityConsent: v } }))} /><button className="settings-button" onClick={exportData}><DownloadSimple /> 导出我的本地数据 <CaretRight /></button><button className="settings-button danger" onClick={reset}><Trash /> 清除完整宇宙版数据 <CaretRight /></button><div className="boundary-note"><ShieldCheck /> 社区和月潮生日数据是明确标记的演示种子；没有真实在线用户或真实活动量。</div></div>}</section>;
}

function Lifecycle({ store, setStore, showMoment }) {
  const stageForProfile = store.profile.lifeStage === "seed" ? "seed" : store.profile.lifeStage === "phoenix" ? "phoenix" : "baby";
  const stageStatus = (id) => id === stageForProfile ? "当前同行" : id === "seed" ? "生命起点" : id === "phoenix" ? "未来 / 转化" : "生命中的陪伴者";
  const careStage = (stage) => {
    const messages = {
      seed: ["seed", "月之种子吞下了一颗月光词语", "你没有喂它打卡数字，而是喂它一句刚刚学会的身体语言。月亮呆毛轻轻亮了一下。"],
      baby: ["care", "月经宝宝抱住了一次真实照护", store.episodes.length ? "它把你真实说过“有用”或“没用”的结果收进贝壳；关系因此更准确。" : "它提醒你：比起投喂积分，它更需要一次真实的状态—行动—结果。你可以回到小窝开始。"],
      phoenix: ["phoenix", "血月凤凰接住了一枚经验月羽", store.sentGifts.length ? "它带着被你授权分享的经验飞向更远的生命阶段，力量来自传承，不来自可爱值。" : "它不会凭积分提前降临。先让经验在你的身体里发生，再由你决定是否把月信交给后来者。"],
    };
    const [type, title, copy] = messages[stage.id];
    const hasNourishment = stage.id === "seed" || (stage.id === "baby" ? store.episodes.length > 0 : store.sentGifts.length > 0);
    if (hasNourishment) setStore((s) => ({ ...s, lifecycleCare: { ...s.lifecycleCare, [stage.id]: (s.lifecycleCare?.[stage.id] || 0) + 1 }, growth: s.growth + 1, babyState: stage.id === "baby" ? "cared" : s.babyState }));
    showMoment(type, title, copy, 0);
  };
  return <div className="lifecycle"><div className="lifecycle-thread" />{LIFECYCLE.map((stage, index) => <article className={`lifecycle-card stage-${stage.id} ${stage.id === stageForProfile ? "current" : ""}`} key={stage.id}><div className="lifecycle-visual"><img src={stage.id === "seed" ? "/assets/lifecycle/moon-seed.png" : stage.id === "phoenix" ? "/assets/lifecycle/blood-moon-phoenix.png" : "/assets/moon-sea-hero.png"} alt={stage.title} /><span>{index + 1}</span></div><div><div className="lifecycle-meta"><small>{stage.subtitle}</small><b>{stageStatus(stage.id)}</b></div><h3>{stage.title}</h3><p>{stage.personality}</p><button onClick={() => careStage(stage)}>{stage.id === "seed" ? "喂一颗月光词语" : stage.id === "baby" ? "喂一次真实反馈" : "献上一枚经验月羽"} <CaretRight /></button><em>关系痕迹 {store.lifecycleCare?.[stage.id] || 0}</em></div></article>)}<div className="growth-summary"><Sparkle weight="fill" /><div><small>当前共同潮光</small><strong>{store.growth}</strong><p>来自真实照护和关系，不来自连续打卡；生命阶段也不会被积分强行解锁。</p></div></div></div>;
}

function Report({ store, setStore, showMoment }) {
  const helpful = store.episodes.filter((e) => e.effect === "helped" || e.effect === "some").length;
  const recordedCycleIds = new Set(store.episodes.map((episode) => episode.cycleId).filter(Boolean));
  const recordedCycleCount = recordedCycleIds.size;
  const enoughForPattern = recordedCycleCount >= 2;
  const prepared = store.preparedGiftIds.includes("sleep") && store.preparedGiftIds.includes("travel");
  const prepareWindow = () => {
    if (prepared) return;
    setStore((s) => ({ ...s, preparedGiftIds: [...new Set([...s.preparedGiftIds, "sleep", "travel"])], growth: s.growth + 1, babyState: "preparing" }));
    showMoment("prepare", "宝宝把担心折成了准备礼物", "它放进一张睡眠观察卡和一份出行兜底清单。它会等你的真实反馈，不把日历位置预测成固定情绪。", 1);
  };
  const deleteEpisode = (episode) => {
    if (!window.confirm("只删除这一条潮汐札记，其他记录不受影响。继续吗？")) return;
    setStore((current) => ({ ...current, episodes: current.episodes.filter((item) => item.id !== episode.id) }));
    showMoment("care", "这条札记已经归还给你", "宝宝不会因为你纠正或删除记录而失望。你的身体经验始终由你控制。", 0);
  };
  return <div className="report-panel"><section className="report-hero"><p className="eyebrow">这一份报告属于你，不属于标准周期</p><h2>{store.episodes.length ? `第 ${store.episodes.length} 次潮汐回望` : "等待第一条真实反馈"}</h2><div className="report-stats"><div><strong>{store.episodes.length}</strong><small>真实记录</small></div><div><strong>{helpful}</strong><small>有帮助行动</small></div><div><strong>{store.sentGifts.length}</strong><small>送出的月信</small></div></div></section><section className="factor-card"><h3>目前可以看到什么</h3>{store.episodes.length ? store.episodes.map((episode) => <article className="episode-row" key={episode.id}><span className={`effect-dot ${episode.effect}`} /><div><strong>{episode.tags.join(" · ")}</strong><small>{episode.actionTitle} · {new Date(episode.createdAt).toLocaleString("zh-CN")}</small><em>{episode.confidence}</em></div><button aria-label="删除这一条潮汐札记" onClick={() => deleteEpisode(episode)}><Trash /></button></article>) : <p>还没有真实反馈。宝宝不会用空白数据生成一条看似精准的个人规律。</p>}</section><section className="factor-card"><h3>PMS准备，仍在学习</h3><p>{enoughForPattern ? `目前有 ${recordedCycleCount} 个可区分周期，只够比较重复出现的线索，还不能把它们归因给周期。宝宝会同时保留睡眠、压力、生病和生活安排等竞争解释。` : store.episodes.length ? `已有 ${store.episodes.length} 条结果，但还没有足够的可区分周期编号；同一周期里的多次记录不会被冒充成“跨周期规律”。至少需要两个以上周期的授权记录，才会讨论“可能重复”。` : "至少需要两个以上周期的授权记录，才会讨论“可能重复”。现在不生成一条好看的假规律。"}</p><div className="uncertainty-meter"><span style={{ width: `${Math.min(58, recordedCycleCount * 24)}%` }} /><small>个人模式信心：{enoughForPattern ? "初步" : "不足"} · 已识别周期 {recordedCycleCount} · 数据缺失仍显示</small></div></section><section className="factor-card preparation-card"><p className="eyebrow">准备可以先发生，预测必须慢一点</p><h3>下一次月经准备窗</h3><p>现在不报一个“准确来潮日”，也不预告你一定会焦虑或没精力；先把低风险、随时可撤回的准备放进贝壳。</p><div className="preparation-items"><span>睡眠、压力与咖啡因观察</span><span>用品、衣物与出行兜底</span><span>重复异常时的就医时间线</span></div><button className={prepared ? "secondary-button" : "primary-button"} disabled={prepared} onClick={prepareWindow}>{prepared ? <><Check /> 准备窗已在贝壳里</> : <><Package /> 把准备窗装进贝壳</>}</button></section></div>;
}

function BottomNav({ screen, setScreen }) {
  return <nav className="bottom-nav">{NAV_ITEMS.map(([id, label, Icon]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}><Icon weight={screen === id ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>;
}

function BabyMoment({ type, title, copy, onClose }) {
  const visual = type === "seed" ? ["/assets/lifecycle/moon-seed.png", "月之种子的互动反馈"] : type === "phoenix" ? ["/assets/lifecycle/blood-moon-phoenix.png", "血月凤凰的互动反馈"] : ["/assets/moon-sea-hero.png", "月经宝宝的互动反馈"];
  return <div className="moment-backdrop" onClick={onClose}><section className={`baby-moment moment-${type}`} onClick={(e) => e.stopPropagation()}><button className="icon-button" aria-label="关闭互动反馈" onClick={onClose}><X /></button><div className="moment-baby"><img src={visual[0]} alt={visual[1]} /><span className="moment-ring ring-one" /><span className="moment-ring ring-two" /></div><p className="eyebrow">关系正在发生变化</p><h2>{title}</h2><p>{copy}</p><button className="primary-button" onClick={onClose}>我看见了</button></section></div>;
}

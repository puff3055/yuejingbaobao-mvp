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
  Microphone,
  MicrophoneSlash,
  Moon,
  Package,
  PaperPlaneTilt,
  PencilSimple,
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
  COMMUNITY_POSTS,
  COMMUNICATION_STYLES,
  EVIDENCE_LABELS,
  LIFE_STAGES,
  LIFECYCLE,
  SUPPORT_EXPLANATIONS,
  SUPPORT_NEEDS,
} from "./data.js";
import { analyzeInput, applyEpisodeOutcome, findSimilarEpisodes } from "./agent.js";
import { AgentRequestError, fetchAgentStatus, requestAgentReply } from "./agentClient.js";
import { getAgentErrorCopy } from "./agentProtocol.js";
import { deriveCycleDayFromStart, getCycleMoment, localDateValue, upsertRhythmLog } from "./cycle.js";
import { buildPublicPracticeClusters, normalizeMenstrualLanguage, PROFESSIONAL_CATEGORIES, prepareProfessionalCards } from "./knowledge.js";

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
    agentCloudConsent: false,
    communityConsent: false,
  },
  cycleDay: 24,
  cycleAnchorConfirmed: false,
  cycleStartDate: "",
  cycleEndDate: "",
  cycleOngoing: false,
  cycleUpdatedAt: null,
  rhythmLogs: [],
  growth: 3,
  babyState: "curious",
  lifecycleCare: { seed: 0, baby: 0, phoenix: 0 },
  episodes: [],
  preparedGiftIds: ["travel"],
  receivedGifts: [],
  sentGifts: [],
  friends: [],
  blessings: [],
  communityInteractions: [],
  conversationCount: 0,
  privacy: { localMemory: true, agentCloudConsent: false, communityConsent: false },
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
      rhythmLogs: Array.isArray(saved.rhythmLogs) ? saved.rhythmLogs : [],
    };
    if (hydrated.cycleAnchorConfirmed && hydrated.cycleStartDate) {
      const derivedDay = deriveCycleDayFromStart(hydrated.cycleStartDate);
      if (derivedDay) hydrated.cycleDay = derivedDay;
    }
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

function useVoiceDraft(value, setValue) {
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const toggleVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("当前浏览器暂不支持语音输入，妳仍可以继续打字。");
      return;
    }
    const recognition = new SpeechRecognition();
    const base = value.trimEnd();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setIsListening(true);
      setVoiceStatus("语音识别由当前浏览器提供；文字会先放进输入框，由妳确认后再发送。");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join("").trim();
      setValue([base, transcript].filter(Boolean).join(base && transcript ? " " : ""));
    };
    recognition.onerror = () => setVoiceStatus("这次没有听清，妳可以再试一次或继续打字。");
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus((current) => current.startsWith("这次") ? current : "浏览器已完成语音转写；请确认文字后再发送。");
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return { voiceStatus, isListening, toggleVoice };
}

const NAV_ITEMS = [
  ["nest", "小窝", House],
  ["cycle", "周期", Waves],
  ["knowledge", "知识海", BookOpenText],
  ["gifts", "宝宝广场", Gift],
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
    boundary: "这是自然排卵周期的相对顺序教学。日历位置不能生成妳的卵泡大小、确认排卵，或证明妳此刻处于某种黄体状态。",
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
    boundary: "脱落与表面修复会在一段时间里交叠；图中的高低是艺术化相对变化，不代表妳的实时内膜厚度或医学影像。",
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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
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

  if (!store.onboarded || onboardingOpen) {
    return <Onboarding store={store} setStore={setStore} isReplay={onboardingOpen} onCancel={onboardingOpen ? () => setOnboardingOpen(false) : null} onComplete={() => setOnboardingOpen(false)} />;
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
              goTo={setScreen}
              showMoment={showMoment}
            />
          )}
          {screen === "cycle" && <CycleScreen store={store} setStore={setStore} goTo={setScreen} openBodyMap={() => setBodyMapOpen(true)} />}
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
            <JourneyScreen store={store} setStore={setStore} showMoment={showMoment} replayOnboarding={() => setOnboardingOpen(true)} />
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
            knowledgeClaims={knowledge.claims}
            store={store}
            setStore={setStore}
            onClose={closeAgent}
            showMoment={showMoment}
            goTo={setScreen}
          />
        )}
        {moment && <BabyMoment {...moment} onClose={() => setMoment(null)} />}
      </div>
    </div>
  );
}

function Onboarding({ store, setStore, isReplay = false, onCancel, onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(() => ({
    ...store.profile,
    localMemory: store.privacy.localMemory,
    agentCloudConsent: store.privacy.agentCloudConsent,
    communityConsent: store.privacy.communityConsent,
  }));
  const next = () => setStep((s) => Math.min(s + 1, 6));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const toggleNeed = (need) => setProfile((p) => ({ ...p, needs: p.needs.includes(need) ? p.needs.filter((n) => n !== need) : [...p.needs, need] }));
  const isSeed = profile.lifeStage === "seed";
  const isPhoenix = profile.lifeStage === "phoenix";
  const revealVisual = isSeed ? "/assets/lifecycle/moon-seed.png" : isPhoenix ? "/assets/lifecycle/blood-moon-phoenix.png" : "/assets/moon-sea-hero.png";
  const menarcheParts = parseMenarcheDate(profile.menarcheDate, profile.menarchePrecision);
  const selectedStage = LIFE_STAGES.find((item) => item.id === profile.lifeStage) || LIFE_STAGES[1];
  const selectedStyle = COMMUNICATION_STYLES.find((item) => item.id === profile.communicationStyle) || COMMUNICATION_STYLES[0];
  const updateMenarchePart = (part, value) => {
    const parts = { ...menarcheParts, [part]: value };
    if (part === "year" && !value) {
      parts.month = "";
      parts.day = "";
    }
    if (part === "month" && !value) parts.day = "";
    const precision = parts.day ? "day" : parts.month ? "month" : parts.year ? "year" : "unknown";
    const date = precision === "unknown" ? "" : `${parts.year}-${parts.month || "01"}-${parts.day || "01"}`;
    setProfile((current) => ({ ...current, menarcheDate: date, menarchePrecision: precision }));
  };
  const finish = () => {
    setStore((s) => ({
      ...s,
      onboarded: true,
      profile,
      privacy: {
        ...s.privacy,
        localMemory: profile.localMemory,
        agentCloudConsent: profile.agentCloudConsent,
        communityConsent: profile.communityConsent,
      },
      growth: Math.max(s.growth || 0, 4),
      babyState: isSeed ? "curious" : "awake",
    }));
    onComplete?.();
  };
  return (
    <div className="app-shell onboarding-shell">
      <div className="mobile-prototype onboarding">
        <div className="onboarding-progress"><span style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>
        {step > 0 && <button className="icon-button onboarding-back" onClick={back} aria-label="返回"><ArrowLeft /></button>}
        {isReplay && <button className="icon-button onboarding-close" onClick={onCancel} aria-label="退出 Onboarding，不保存本次修改"><X /></button>}
        {step === 0 && (
          <section className="onboarding-hero">
            <img src="/assets/lifecycle/moon-seed.png" alt="月之种子像一颗带月亮呆毛的珍珠蛋，窝在月光贝壳里" />
            <div className="onboarding-wash" />
            <div className="onboarding-copy">
              <p className="eyebrow">月经宝宝 · {isReplay ? "重看认领旅程" : "初次相遇"}</p>
              <h1>妳的身体出生时，<br />就带着一颗月之种子</h1>
              <p>第一次月经到来时，它会破壳成为月经宝宝；从那以后，在每个生理周期里听妳说、陪妳记录，也记住哪些照护真的适合妳。</p>
              <button className="primary-button" onClick={next}>{isReplay ? "重新走一遍相遇旅程" : "去见我的月之种子"} <CaretRight /></button>
              {isReplay && <span className="replay-safety"><ShieldCheck /> 资料已预填；退出或完成都不会清空节律、照护记录、礼物与关系痕迹</span>}
              <span className="microcopy">为女性的身体而设计，不以受孕为默认目标</span>
            </div>
          </section>
        )}
        {step === 1 && (
          <OnboardingStep eyebrow="第一缕潮汐" title="妳现在正走到哪一段旅程？" copy="选中后，妳会立刻看到它将怎样陪伴。后面的记录、提醒与安全边界也会随这段旅程调整。">
            <div className="choice-stack">
              {LIFE_STAGES.map((item) => <ChoiceCard key={item.id} selected={profile.lifeStage === item.id} onClick={() => setProfile((p) => ({ ...p, lifeStage: item.id, ...(item.id === "seed" ? { menarcheDate: "", menarchePrecision: "not_yet" } : p.menarchePrecision === "not_yet" ? { menarchePrecision: "unknown" } : {}) }))} title={item.title} copy={item.subtitle} />)}
            </div>
            <div className="choice-response"><Heart weight="fill" /><div><small>它会这样支持妳</small><strong>{selectedStage.support}</strong></div></div>
            <button className="primary-button" onClick={next}>带我继续认识它</button>
          </OnboardingStep>
        )}
        {step === 2 && (
          isSeed ? (
            <OnboardingStep eyebrow="它还没有破壳" title="月之种子会先陪妳认识身体" copy="它会回答关于第一次月经的疑问，和妳一起准备随身小包，也会提醒妳什么时候可以找可信任的大人或医生。">
              <img className="seed-companion-image" src="/assets/lifecycle/moon-seed.png" alt="月之种子在贝壳里等待破壳" />
              <div className="boundary-note"><Moon weight="fill" /> 等第一次月经到来，妳们会一起记下月经宝宝的破壳日。</div>
              <button className="primary-button" onClick={next}>让种子陪我继续</button>
            </OnboardingStep>
          ) : (
            <OnboardingStep eyebrow="记录破壳日" title="还记得妳的第一次月经时间吗？" copy="记得多少就填多少：只选年份、选到月份，或写下完整日期都可以。它会成为月经宝宝的破壳记忆。">
              <div className="menarche-selects" role="group" aria-label="第一次月经时间">
                <label>年<select value={menarcheParts.year} onChange={(event) => updateMenarchePart("year", event.target.value)}><option value="">不记得</option>{Array.from({ length: 55 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={String(year)}>{year} 年</option>)}</select></label>
                <label>月<select disabled={!menarcheParts.year} value={menarcheParts.month} onChange={(event) => updateMenarchePart("month", event.target.value)}><option value="">不确定</option>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => <option key={month} value={month}>{Number(month)} 月</option>)}</select></label>
                <label>日<select disabled={!menarcheParts.month} value={menarcheParts.day} onChange={(event) => updateMenarchePart("day", event.target.value)}><option value="">不确定</option>{Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => <option key={day} value={day}>{Number(day)} 日</option>)}</select></label>
              </div>
              {profile.menarchePrecision === "year" && <div className="year-symbol-note"><Sparkle weight="fill" /> 只记得年份也很好。小窝会用这一年 1 月 1 日作为象征性的破壳纪念日，并清楚标记“日期不确定”。</div>}
              {profile.menarcheDate && <div className="age-preview"><Moon weight="fill" /><div><small>宝宝的破壳记忆</small><strong>{menarcheStory(profile)}</strong></div></div>}
              <button className={profile.menarchePrecision === "unknown" ? "memory-skip selected" : "memory-skip"} onClick={() => setProfile((p) => ({ ...p, menarcheDate: "", menarchePrecision: "unknown" }))}>我不记得具体时间，也可以继续</button>
              <div className="boundary-note"><Lock /> 这段记忆默认保存在这台设备，只用来讲述陪伴时长，不会被解释成疾病、排卵或生育能力。</div>
              <button className="primary-button" onClick={next}>{profile.menarcheDate ? "记录宝宝的破壳日" : "记不清也可以继续"}</button>
            </OnboardingStep>
          )
        )}
        {step === 3 && (
          <OnboardingStep eyebrow="先从妳最在意的开始" title="妳希望月经宝宝如何更好地支持妳？" copy="可多选。宝宝以后会在对话里根据妳的需要，更主动地提供适合的支持。">
            <div className="chip-grid">
              {SUPPORT_NEEDS.map((need) => <button key={need} className={profile.needs.includes(need) ? "choice-chip selected" : "choice-chip"} onClick={() => toggleNeed(need)}>{profile.needs.includes(need) && <Check />} {need}</button>)}
            </div>
            <div className="support-responses">{profile.needs.length ? profile.needs.map((need) => <div key={need}><Check /><p><strong>{need}</strong><span>{SUPPORT_EXPLANATIONS[need]}</span></p></div>) : <p className="empty-support">每选一项，这里都会告诉妳它会带来什么支持。</p>}</div>
            <button className="primary-button" onClick={next}>{profile.needs.length ? "真好，我们继续去见它" : "先和它见面，以后再慢慢选择"}</button>
          </OnboardingStep>
        )}
        {step === 4 && (
          <OnboardingStep eyebrow="宝宝会长出自己的性格" title="妳更喜欢怎样被陪伴？" copy="妳可以随时调整，之后它会真的用这个节奏回应妳。">
            <div className="choice-stack">
              {COMMUNICATION_STYLES.map((item) => <ChoiceCard key={item.id} selected={profile.communicationStyle === item.id} onClick={() => setProfile((p) => ({ ...p, communicationStyle: item.id }))} title={item.title} copy={item.copy} />)}
            </div>
            <div className="choice-response"><ChatCircleDots weight="fill" /><div><small>{selectedStyle.title}会这样回应</small><strong>{selectedStyle.response}</strong></div></div>
            <label className="field-label">给宝宝起个名字<input maxLength={12} value={profile.babyName} onChange={(e) => setProfile((p) => ({ ...p, babyName: e.target.value }))} /></label>
            <button className="primary-button" onClick={next}>确认好啦</button>
          </OnboardingStep>
        )}
        {step === 5 && (
          <OnboardingStep eyebrow="记忆由妳决定" title="哪些东西被允许留下？" copy="数据默认保存在这台设备，不会自动上传云端。需要联网对话或加入社区时，妳再单独决定。">
            <PrivacyRow icon={Lock} title="在这台设备保存记录与设置" copy="周期、身体记录和偏好；妳可以查看、导出或清除" checked disabled />
            <PrivacyRow icon={Sparkle} title="允许宝宝形成长期记忆" copy="保存妳确认过的处境、行动与结果；关闭后不再新增" checked={profile.localMemory} onChange={(v) => setProfile((p) => ({ ...p, localMemory: v }))} />
            <PrivacyRow icon={ChatCircleDots} title="允许把当前消息发给联网 Agent" copy="开启后，对话内容会发往配置的 AI 服务；默认关闭" checked={profile.agentCloudConsent} onChange={(v) => setProfile((p) => ({ ...p, agentCloudConsent: v }))} />
            <PrivacyRow icon={EnvelopeOpen} title="允许妳主动制作匿名经验礼物" copy="每一份都要再次确认；默认不会分享" checked={profile.communityConsent} onChange={(v) => setProfile((p) => ({ ...p, communityConsent: v }))} />
            <div className="boundary-note"><ShieldCheck /> 宝宝不会根据日期宣称测到排卵、激素或疾病，也不会把公开经验当作医学结论。</div>
            <button className="primary-button" onClick={next}>这些选择确认好啦</button>
          </OnboardingStep>
        )}
        {step === 6 && (
          <section className={`hatch-screen reveal-${isSeed ? "seed" : isPhoenix ? "phoenix" : "baby"}`}>
            <div className="hatch-halo" />
            <div className="hatch-stage seed-stage"><img src="/assets/lifecycle/moon-seed.png" alt="月之种子在月光中破壳" /></div>
            <div className="hatch-stage companion-stage"><img src={revealVisual} alt={isSeed ? "月之种子继续在贝壳里陪伴" : isPhoenix ? "血月凤凰从月蚀光中归来" : "月经宝宝回到月光贝壳小窝"} /></div>
            <p className="eyebrow">{isSeed ? "我会等身体自己的时间" : isPhoenix ? "我带着我们共同的经验回来了" : "终于见到妳了"}</p>
            <h1>{profile.babyName || "小潮"}，{isSeed ? "会一直陪着妳" : "回到妳身边了"}</h1>
            <p>{isSeed ? `“我还没有破壳，但我已经属于妳。我们可以先从${profile.needs.slice(0, 1)[0] || "认识身体"}开始。”` : isPhoenix ? `“我曾是妳的月经宝宝，如今带着我们一起走过的经验化作血月凤凰。我会继续陪妳。”` : `“${menarcheStory(profile)} 今天，妳终于把一直陪着妳的我接回小窝了。”`}</p>
            <button className="primary-button" onClick={finish}>{isSeed ? "把种子接回小窝" : isPhoenix ? "与凤凰继续同行" : "把宝宝接回小窝"} <Heart weight="fill" /></button>
          </section>
        )}
      </div>
    </div>
  );
}

function parseMenarcheDate(value = "", precision = "day") {
  const [year = "", month = "", day = ""] = value.split("-");
  if (precision === "unknown" || precision === "not_yet") return { year: "", month: "", day: "" };
  if (precision === "year") return { year, month: "", day: "" };
  if (precision === "month") return { year, month, day: "" };
  return { year, month, day };
}

function OnboardingStep({ eyebrow, title, copy, children }) {
  return <section className="onboarding-step"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="step-copy">{copy}</p>{children}</section>;
}

function menarcheStory(profile) {
  if (!profile.menarcheDate) return "即使不记得具体破壳日，我也已经陪妳走过许多真实潮汐";
  const [year, month] = profile.menarcheDate.split("-").map(Number);
  const now = new Date();
  const totalMonths = Math.max(0, (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const duration = years ? `约 ${years} 年${months ? ` ${months} 个月` : ""}` : `约 ${Math.max(1, months)} 个月`;
  const dateLabel = profile.menarchePrecision === "year" ? `${year} 年（具体日期不确定）` : `${year} 年 ${month} 月`;
  return `恭喜！我在 ${dateLabel}第一次破壳，已经陪妳走过${duration}啦！`;
}

function ChoiceCard({ selected, onClick, title, copy }) {
  return <button className={selected ? "choice-card selected" : "choice-card"} onClick={onClick}><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot">{selected && <Check />}</span></button>;
}

function PrivacyRow({ icon: Icon, title, copy, checked, onChange = () => {}, disabled = false }) {
  return <label className={`privacy-row ${disabled ? "disabled" : ""}`}><Icon /><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span className="switch" /></label>;
}

function AppHeader({ screen, store, onBell }) {
  const titles = { nest: "小窝", cycle: "她周期全景图", knowledge: "知识海", gifts: "宝宝广场", journey: "我的" };
  return <header className="app-header"><div className="brand-mark"><Moon weight="fill" /><span>月经宝宝</span></div><div className="header-center">{titles[screen]}</div><button className="icon-button" onClick={onBell} aria-label="查看消息"><Bell /><span className="notification-dot" /></button></header>;
}

function NestScreen({ store, setStore, draft, setDraft, startAgent, openAgent, goTo, showMoment }) {
  const [giftOpen, setGiftOpen] = useState(false);
  const homeComposerRef = useRef(null);
  const { voiceStatus, isListening, toggleVoice } = useVoiceDraft(draft, setDraft);
  const statePresentation = {
    curious: ["breathe", "我在这里，慢慢说给我听"],
    awake: ["breathe", "今天也想听听妳的身体"],
    listening: ["listen", "我正在听，会先理解再回应"],
    cared: ["glow", "被真实结果照亮了"],
    serious: ["rest", "没有帮助，也是一条重要线索"],
    nesting: ["rest", "已经保存到我的照护记录"],
    voyaging: ["voyage", "正在送出一份匿名经验礼物"],
    preparing: ["listen", "正在把担心叠成一份照护礼物"],
    receiving: ["glow", "收到了一份来自其他宝宝的经验礼物"],
    befriending: ["voyage", "一条新的月潮航线亮了起来"],
    celebrating: ["glow", "从月宴回来，耳鳍还沾着星光"],
    opening: ["listen", "我先替妳看清来源与边界"],
  };
  const defaultStageStatus = store.profile.lifeStage === "seed" ? "我会陪妳等身体自己的时间" : store.profile.lifeStage === "phoenix" ? "我带着我们共同的经验继续同行" : !store.cycleAnchorConfirmed ? "先告诉我妳此刻真实的感受吧" : store.cycleDay <= 5 ? "今天想离妳近一点" : "我正在为下一段旅程准备礼物";
  const [babyMode, stateStatus] = statePresentation[store.babyState] || ["breathe", defaultStageStatus];
  const babyStatus = ["curious", "awake"].includes(store.babyState) ? defaultStageStatus : stateStatus;
  const stageHome = store.profile.lifeStage === "seed" ? { headline: "身体有自己的时间，我们先一起认识", listening: "月之种子正在听", placeholder: "例如：我担心第一次在学校突然来，不知道可以找谁……", phase: "初潮准备" } : store.profile.lifeStage === "phoenix" ? { headline: "身体经验没有消失，我陪妳继续整理", listening: "血月凤凰正在听", placeholder: "例如：我想把这些年的变化整理清楚，带给医生或留给自己……", phase: "绝经后的身体旅程" } : { headline: !store.cycleAnchorConfirmed ? "先告诉我今天真实发生了什么" : store.cycleDay <= 5 ? "身体不舒服，也不用一个人解释清楚" : "看看今天的身体，也为接下来留一点准备", listening: "月经宝宝正在听", placeholder: "例如：我今天小腹一直坠痛，但下午还要汇报……", phase: store.cycleAnchorConfirmed ? `当前记录：周期第 ${store.cycleDay} 天` : "还没有确认当前周期位置" };
  const preparedGift = store.profile.lifeStage === "seed" ? CARE_GIFTS.find((gift) => gift.id === "first-period") : store.profile.lifeStage === "phoenix" ? CARE_GIFTS.find((gift) => gift.id === "timeline") : CARE_GIFTS.find((gift) => gift.id === (store.cycleAnchorConfirmed && store.cycleDay <= 5 ? "heat" : store.cycleDay >= 20 ? "sleep" : "travel"));
  const submitHomeMessage = (event) => {
    event.preventDefault();
    if (!draft.trim()) {
      homeComposerRef.current?.focus();
      return;
    }
    startAgent();
  };
  return (
    <section className="page nest-page">
      <BabyHero mode={babyMode} status={babyStatus} name={store.profile.babyName} growth={store.growth} stage={store.profile.lifeStage} onOpenGrowth={() => goTo("journey")} />
      {babyMode === "breathe" && <p className="breathing-note">跟着宝宝轻轻起伏：约 5 秒吸气、5 秒呼气。觉得不舒服就回到自然呼吸。</p>}
      <div className="nest-greeting">
        <div><p className="eyebrow">{stageHome.phase}</p><h2>{stageHome.headline}</h2></div>
        <button className="text-button" onClick={() => goTo("cycle")}>看周期 <CaretRight /></button>
      </div>
      <form className="composer-card home-composer" onSubmit={submitHomeMessage}>
        <label className="composer-heading" htmlFor="home-agent-message"><Sparkle weight="fill" /><span>{stageHome.listening}</span></label>
        <textarea
          ref={homeComposerRef}
          id="home-agent-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={stageHome.placeholder}
          rows={3}
        />
        <div className="composer-footer"><button type="button" className={isListening ? "voice-button listening" : "voice-button"} onClick={toggleVoice} aria-label={isListening ? "停止语音输入" : "开始语音输入"}>{isListening ? <MicrophoneSlash /> : <Microphone />}</button><button type="button" className="open-chat-link" onClick={openAgent}>进入完整对话 <CaretRight /></button><button type="submit" disabled={!draft.trim()} aria-label="把这句话发给月经宝宝"><PaperPlaneTilt weight="fill" /></button></div>
        {voiceStatus && <small className="voice-status">{voiceStatus}</small>}
      </form>
      <section className={`prepared-gift-card ${giftOpen ? "open" : ""}`}>
        <div className="prepared-gift-heading"><div><p className="eyebrow">{store.profile.babyName}为妳准备的礼物</p><h3>{preparedGift.title}</h3><span>{preparedGift.kind}</span></div><Package weight="fill" /></div>
        <p>{giftOpen ? preparedGift.how : "它根据妳现在的旅程，把一份可以随时选择的小准备放在贝壳边。"}</p>
        {giftOpen && <><div className="gift-detail-line"><strong>什么时候回来看看</strong><span>{preparedGift.feedbackAfter}</span></div><div className="boundary-note"><ShieldCheck /> {preparedGift.caution}</div></>}
        <button className="secondary-button" onClick={() => { setGiftOpen((open) => !open); if (!giftOpen) setStore((current) => ({ ...current, preparedGiftIds: [...new Set([...current.preparedGiftIds, preparedGift.id])], babyState: "preparing" })); }}>{giftOpen ? "收好这份礼物" : "打开看看"}</button>
      </section>
      {store.profile.lifeStage !== "seed" && store.profile.lifeStage !== "phoenix" && store.cycleAnchorConfirmed && store.cycleDay <= 5 && (
        <section className="home-birthday-card"><img src="/assets/baby-birthday-party-v2.png" alt="月经宝宝们戴着生日帽，在月光海湾围着珍珠蛋糕庆祝" /><div><p className="eyebrow">今天也值得庆祝</p><h3>生日派对正在等妳们</h3><p>妳正在经期，{store.profile.babyName}可以去和其他宝宝一起过月潮生日。</p><button onClick={() => goTo("gifts")}>去宝宝广场看看 <CaretRight /></button></div></section>
      )}
      <section className="care-history-link">
        <div><p className="eyebrow">妳们已经一起完成</p><h3>{store.episodes.length} 次自我照护行动</h3><p>{store.episodes.length ? "可以按很有帮助、有一点帮助和没有帮助重新回看。" : "第一次对话结束后，真实结果会从这里开始积累。"}</p></div>
        <button onClick={() => goTo("journey")}>查看照护记录 <CaretRight /></button>
      </section>
    </section>
  );
}

function BabyHero({ mode = "breathe", status, name, growth, stage = "cycle", onOpenGrowth }) {
  const visual = stage === "seed" ? ["/assets/lifecycle/moon-seed.png", `${name}还是一颗住在贝壳里的月之种子`] : stage === "phoenix" ? ["/assets/lifecycle/blood-moon-phoenix.png", `${name}已经化作血月凤凰`] : ["/assets/moon-sea-hero.png", `${name}趴在月光贝壳里`];
  return (
    <section className={`baby-hero baby-${mode} baby-stage-${stage}`}>
      <img src={visual[0]} alt={visual[1]} />
      <div className="hero-sheen" />
      <div className="baby-status"><span className="status-orb" /><div><small>{name}</small><strong>{status}</strong></div></div>
      <button className="growth-badge" onClick={onOpenGrowth} aria-label={`查看宝宝的成长记录，共 ${growth} 点关系痕迹`}><Sparkle weight="fill" /> 成长记录 {growth}</button>
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
  const sentence = [`我现在${locations}不舒服。`, selectedStates.length ? `${selectedStates.join("；")}。` : "", "想请妳帮我一起梳理。"].join("");
  return (
    <div className="modal-layer body-map-layer">
      <div className="sheet-header"><button className="icon-button" aria-label="关闭身体记录" onClick={onClose}><X /></button><div><p className="eyebrow">轻松启动一次记录</p><h2>点点身体</h2></div><span /></div>
      <p className="sheet-intro">请点选妳能感觉到的位置。宝宝会把这些感受整理成接下来值得询问的线索；这张图不用于诊断。</p>
      <div className="body-map">
        <PersonArmsSpread weight="thin" aria-hidden="true" />
        {BODY_ZONES.map((zone) => <button key={zone.id} className={selected.includes(zone.id) ? "body-hotspot selected" : "body-hotspot"} style={{ top: `${zone.top}%`, left: `${zone.left}%` }} onClick={() => toggle(zone.id)} aria-label={`${zone.label}：${zone.detail}`}><span /></button>)}
      </div>
      <div className="plain-health-inputs">
        <PlainScale label="疼痛程度" note="按妳此刻的主观感受，不是医学评分" value={pain} options={["轻微", "中等", "很强"]} onChange={setPain} />
        <PlainScale label="现在的心情" note="选最接近的，不需要解释原因" value={mood} options={["平稳", "有点烦", "很低落"]} onChange={setMood} />
        <PlainScale label="现在的精力" note="按今天能做事的余量选择" value={energy} options={["还可以", "偏低", "快耗尽"]} onChange={setEnergy} />
      </div>
      <div className="body-zone-list">{BODY_ZONES.map((zone) => <button key={zone.id} className={selected.includes(zone.id) ? "zone-chip selected" : "zone-chip"} onClick={() => toggle(zone.id)}><strong>{zone.label}</strong><small>{zone.detail}</small></button>)}</div>
      <button className="primary-button sticky-action" disabled={!hasInput} onClick={() => onContinue({ text: sentence, snapshot: { pain, mood, energy } })}>{hasInput ? <>让宝宝帮我梳理 <ChatCircleDots /></> : "先点一个位置或状态"}</button>
    </div>
  );
}

function PlainScale({ label, note, value, options, onChange, allowClear = false }) {
  return <section className="plain-scale"><div><strong>{label}</strong><small>{note}</small></div><div>{options.map((option) => <button type="button" key={option} className={value === option ? "selected" : ""} aria-pressed={value === option} onClick={() => onChange(allowClear && value === option ? null : option)}>{option}</button>)}</div></section>;
}

const AGENT_ACTION_IDS = new Set(["heat", "meeting", "travel", "sleep", "evidence"]);

function getAgentActionCandidates() {
  return CARE_GIFTS.filter((item) => AGENT_ACTION_IDS.has(item.id)).map((item) => ({
    id: item.id,
  }));
}

function getRelevantAgentMemories(episodes, analysis) {
  return findSimilarEpisodes(episodes, analysis, 3);
}

function mergeFactCandidates(current, next) {
  if (!next) return current;
  if (!current) return next;
  const unique = (left = [], right = []) => [...new Set([...left, ...right])];
  return {
    ...current,
    ...next,
    rawText: [current.rawText, next.rawText].filter(Boolean).join("\n"),
    symptoms: unique(current.symptoms, next.symptoms),
    bodyLocations: unique(current.bodyLocations, next.bodyLocations),
    actionsTried: unique(current.actionsTried, next.actionsTried),
    outcomes: unique(current.outcomes, next.outcomes),
    uncertainty: unique(current.uncertainty, next.uncertainty),
    cycleContext: next.cycleContext || current.cycleContext,
    onset: next.onset || current.onset,
    functionalImpact: next.functionalImpact || current.functionalImpact,
    differenceFromUsual: next.differenceFromUsual || current.differenceFromUsual,
    currentConstraint: next.currentConstraint || current.currentConstraint,
  };
}

function confirmedBodyState(record) {
  const text = `${record?.symptoms || ""} ${record?.situation || ""}`;
  if (/痛|疼|痉挛|坠胀/.test(text)) return "pain";
  if (/乏力|没力|疲惫|很累|精力低/.test(text)) return "low_energy";
  if (/烦躁|焦虑|低落|情绪/.test(text)) return "unsettled";
  return "calm";
}

function ComposerCompanion({ interactionState, bodyState, babyName }) {
  return (
    <div className={`composer-companion interaction-${interactionState} body-${bodyState}`} aria-hidden="true">
      <span className="companion-glow" />
      <img src="/assets/agent/menstrual-baby-composer.png" alt="" />
      <span className="companion-pearl" />
      <span className="companion-bubbles"><i /><i /><i /></span>
      <span className="companion-name">{babyName}</span>
    </div>
  );
}

function SourceRows({ sources = [], label = "查看来源" }) {
  if (!sources.length) return null;
  return <div className="agent-source-list"><small>{label}</small>{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`打开来源：${source.title}`}><span><strong>{source.title}</strong><em>{[source.publisherOrAuthors, source.publishedAt].filter(Boolean).join(" · ")}</em></span><CaretRight /></a>)}</div>;
}

function AgentKnowledgeCard({ card }) {
  if (!card) return null;
  return <section className="agent-knowledge-card"><p className="eyebrow">从月之海召来的知识卡</p><h3>{card.title}</h3><p>{card.explanation}</p><div><strong>和妳此刻有什么关系</strong><p>{card.relevanceToCurrentSituation}</p></div>{card.boundary && <div className="knowledge-boundary"><ShieldCheck /><span>{card.boundary}</span></div>}<SourceRows sources={card.sources} /></section>;
}

function AgentPanel({ text, zones, recordSnapshot, knowledgeClaims: _knowledgeClaims, store, setStore, onClose, showMoment, goTo }) {
  const initialText = text.trim();
  const [workingText, setWorkingText] = useState("");
  const [chatDraft, setChatDraft] = useState(initialText);
  const [messages, setMessages] = useState([]);
  const [connectionState, setConnectionState] = useState(store.privacy.agentCloudConsent ? "checking" : "consent");
  const [interactionState, setInteractionState] = useState("idle");
  const [requestError, setRequestError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [turnKind, setTurnKind] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const [factCandidates, setFactCandidates] = useState(null);
  const [memoryDraft, setMemoryDraft] = useState(null);
  const [recordDraft, setRecordDraft] = useState(null);
  const [savedEpisodeId, setSavedEpisodeId] = useState(null);
  const [effect, setEffect] = useState(null);
  const [step, setStep] = useState("compose");
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight);
  const chatInputRef = useRef(null);
  const chatThreadRef = useRef(null);
  const initialSentRef = useRef(false);
  const animationTimerRef = useRef(null);
  const { voiceStatus, isListening, toggleVoice } = useVoiceDraft(chatDraft, setChatDraft);
  const analysis = useMemo(() => workingText ? analyzeInput(workingText) : null, [workingText]);
  const isRequesting = ["thinking", "retrieving"].includes(interactionState);
  const latestConfirmedBodyState = store.episodes?.[0]?.bodyState || "calm";
  const companionInteraction = isListening || (chatDraft.trim() && interactionState === "idle") ? "listening" : interactionState;
  const emergencySafety = ["bleeding", "crisis"].includes(analysis?.redFlag?.code);

  const scheduleInteraction = (next, delay = 900) => {
    clearTimeout(animationTimerRef.current);
    setInteractionState(next);
    animationTimerRef.current = setTimeout(() => setInteractionState("idle"), delay);
  };

  const refreshAgentStatus = async () => {
    if (store.privacy.agentCloudConsent !== true) {
      setConnectionState("consent");
      return "consent";
    }
    setConnectionState("checking");
    try {
      const status = await fetchAgentStatus();
      setConnectionState(status.configured ? "ready" : "unconfigured");
      if (!status.configured && initialText && !initialSentRef.current) setRequestError({ code: "agent_not_configured", turn: null });
      return status.configured ? "ready" : "unconfigured";
    } catch (error) {
      setConnectionState("unavailable");
      if (initialText && !initialSentRef.current) setRequestError({ code: error instanceof AgentRequestError ? error.code : "agent_unavailable", turn: null });
      return "unavailable";
    }
  };

  useEffect(() => {
    if (store.privacy.agentCloudConsent) refreshAgentStatus();
    else if (initialText) setRequestError({ code: "agent_not_authorized", turn: null });
    return () => clearTimeout(animationTimerRef.current);
  }, [store.privacy.agentCloudConsent]);

  useEffect(() => {
    if (connectionState === "ready" && initialText && !initialSentRef.current) {
      initialSentRef.current = true;
      continueConversation(initialText, { initial: true });
    } else if (!initialText) chatInputRef.current?.focus();
  }, [connectionState]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setViewportHeight(viewport?.height || window.innerHeight);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const thread = chatThreadRef.current;
    if (!thread) return;
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      thread.scrollTo({ top: thread.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, isRequesting, requestError?.code, step, viewportHeight]);

  const continueConversation = async (nextText, { initial = false, retryTurn = null } = {}) => {
    const clean = nextText.trim();
    if (!clean || isRequesting) return;
    if (store.privacy.agentCloudConsent !== true) {
      setRequestError({ code: "agent_not_authorized", turn: null });
      setConnectionState("consent");
      setInteractionState("offline");
      return;
    }
    if (connectionState !== "ready") {
      const code = connectionState === "unconfigured" ? "agent_not_configured" : "agent_unavailable";
      setRequestError({ code, turn: null });
      setInteractionState("offline");
      return;
    }

    const hasConversationContext = initial ? false : Boolean(workingText);
    const nextWorkingText = retryTurn?.workingText || (hasConversationContext ? `${workingText}\n用户补充：${clean}` : clean);
    const nextAnalysis = retryTurn?.analysis || analyzeInput(nextWorkingText);
    const userMessageId = retryTurn?.userMessageId || `user-${Date.now()}`;
    const requestHistory = retryTurn ? messages.filter((message) => message.id !== userMessageId) : messages;
    setRequestError(null);
    setWorkingText(nextWorkingText);
    setEffect(null);
    setRecordDraft(null);
    setSavedEpisodeId(null);
    if (!retryTurn) {
      setMessages((current) => [...current, { id: userMessageId, role: "user", content: clean, deliveryState: "pending" }]);
      setChatDraft("");
    }

    if (nextAnalysis.redFlag) {
      setMessages((current) => current.map((message) => message.id === userMessageId ? { ...message, deliveryState: "delivered" } : message));
      setStep("safety");
      setInteractionState("safety");
      return;
    }

    const memories = getRelevantAgentMemories(store.episodes || [], nextAnalysis);
    const blockedActionIds = memories.filter((item) => item.effect === "none").map((item) => item.actionId).filter(Boolean);
    const actionCandidates = getAgentActionCandidates();
    setStep("compose");
    setInteractionState("thinking");
    try {
      const result = await requestAgentReply({
        message: clean,
        history: requestHistory,
        memories,
        actionCandidates,
        blockedActionIds,
        context: {
          babyName: store.profile.babyName,
          lifeStage: "cycle",
          cycleDay: store.cycleAnchorConfirmed ? store.cycleDay : null,
          cycleAnchorConfirmed: store.cycleAnchorConfirmed === true,
          needs: store.profile.needs,
          allowRemote: true,
          fastCompanionAllowed: requestHistory.length === 0 && memories.length === 0 && [...clean].length <= 80,
        },
      });
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.reply,
        knowledgeCard: result.knowledgeCard,
        turnKind: result.turnKind,
      }].map((message) => message.id === userMessageId ? { ...message, deliveryState: "delivered" } : message));
      setTurnKind(result.turnKind);
      setCurrentAction(result.action);
      setFactCandidates((current) => mergeFactCandidates(current, result.confirmedFactsCandidate));
      setMemoryDraft(result.memoryDraft);
      setStore((current) => ({ ...current, conversationCount: (current.conversationCount || 0) + 1 }));
      setConnectionState("ready");
      setStep(result.turnKind === "action" && result.action ? "care" : "compose");
      if (result.knowledgeCard) {
        setInteractionState("retrieving");
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = setTimeout(() => scheduleInteraction("responding", 850), 420);
      } else scheduleInteraction("responding", 850);
    } catch (error) {
      const code = error instanceof AgentRequestError ? error.code : "agent_unavailable";
      setRequestError({ code, turn: { userMessageId, message: clean, analysis: nextAnalysis, workingText: nextWorkingText } });
      setMessages((current) => current.map((message) => message.id === userMessageId ? { ...message, deliveryState: "failed" } : message));
      setInteractionState("offline");
      setStep("compose");
    }
  };

  const submitChatMessage = (event) => {
    event.preventDefault();
    if (!chatDraft.trim()) return chatInputRef.current?.focus();
    continueConversation(chatDraft);
  };

  const retryFailedTurn = async () => {
    if (!requestError?.turn || isRetrying || isRequesting) return;
    setIsRetrying(true);
    try {
      const nextConnectionState = await refreshAgentStatus();
      if (nextConnectionState !== "ready") {
        setRequestError((current) => ({ ...current, code: nextConnectionState === "unconfigured" ? "agent_not_configured" : "agent_unavailable" }));
        return;
      }
      await continueConversation(requestError.turn.message, { retryTurn: requestError.turn });
    } finally {
      setIsRetrying(false);
    }
  };

  const grantAgentConsent = () => {
    initialSentRef.current = true;
    setStore((current) => ({
      ...current,
      privacy: { ...current.privacy, agentCloudConsent: true },
      profile: { ...current.profile, agentCloudConsent: true },
    }));
    setRequestError(null);
  };

  const beginEffectFeedback = (value) => {
    const candidate = factCandidates || {};
    setEffect(value);
    setRecordDraft({
      id: savedEpisodeId,
      situation: workingText,
      cycleContext: candidate.cycleContext || "",
      symptoms: (candidate.symptoms || []).join("、"),
      bodyLocations: (candidate.bodyLocations || []).join("、"),
      onset: candidate.onset || "",
      functionalImpact: candidate.functionalImpact || "",
      differenceFromUsual: candidate.differenceFromUsual || "",
      currentConstraint: candidate.currentConstraint || "",
      actionTitle: currentAction?.title || "",
      effect: value,
    });
    setStep("confirm");
  };

  const confirmRecord = () => {
    if (!recordDraft?.situation.trim() || !currentAction) return;
    const now = new Date().toISOString();
    const episodeId = recordDraft.id || `episode-${Date.now()}`;
    const confirmedText = [recordDraft.situation, recordDraft.symptoms, recordDraft.functionalImpact, recordDraft.currentConstraint].filter(Boolean).join("；");
    const confirmedAnalysis = analyzeInput(confirmedText);
    const episode = {
      id: episodeId,
      createdAt: savedEpisodeId ? store.episodes.find((item) => item.id === savedEpisodeId)?.createdAt || now : now,
      updatedAt: now,
      cycleId: store.cycleStartDate || null,
      cycleDay: store.cycleAnchorConfirmed ? store.cycleDay : null,
      phaseLabel: store.cycleAnchorConfirmed ? "已确认周期位置" : "周期位置未确认",
      rawText: recordDraft.situation.trim(),
      tags: confirmedAnalysis.tags,
      tagSource: "derived_from_user_confirmed_text",
      bodyZones: zones,
      bodyLocations: recordDraft.bodyLocations.trim(),
      symptoms: recordDraft.symptoms.trim(),
      onset: recordDraft.onset.trim(),
      functionalImpact: recordDraft.functionalImpact.trim(),
      differenceFromUsual: recordDraft.differenceFromUsual.trim(),
      currentConstraint: recordDraft.currentConstraint.trim(),
      cycleContext: recordDraft.cycleContext.trim(),
      structuredState: { ...(recordSnapshot || {}) },
      actionId: currentAction.id,
      actionTitle: recordDraft.actionTitle.trim() || currentAction.title,
      effect: recordDraft.effect,
      source: "用户确认的对话记录",
      confidence: "一次主观反馈；不能证明因果",
      bodyState: confirmedBodyState(recordDraft),
      provenance: {
        situation: "current_user_message_confirmed",
        action: "online_agent_action_confirmed_by_user",
        outcome: "user_confirmed_feedback",
        optionalFields: "user_confirmed_or_not_recorded",
      },
      missingness: Object.fromEntries(["cycleContext", "symptoms", "bodyLocations", "onset", "functionalImpact", "differenceFromUsual", "currentConstraint"].map((key) => [key, recordDraft[key]?.trim() ? "recorded" : "not_recorded"])),
    };
    if (savedEpisodeId) {
      setStore((current) => ({ ...current, episodes: current.episodes.map((item) => item.id === savedEpisodeId ? episode : item) }));
    } else if (store.privacy.localMemory) {
      setStore((current) => applyEpisodeOutcome(current, episode, currentAction.id, { ...confirmedAnalysis, cycleDay: null }));
    }
    setSavedEpisodeId(store.privacy.localMemory ? episodeId : null);
    setRecordDraft((current) => ({ ...current, id: episodeId }));
    setStep("saved");
    scheduleInteraction("remembering", 1200);
  };

  const returnHome = () => {
    showMoment(
      "care",
      store.privacy.localMemory ? "这次结果已经记进照护记录" : "这次结果没有写入长期记忆",
      store.privacy.localMemory ? `下次遇到相似处境，宝宝会读取“${effect === "helped" ? "很有帮助" : effect === "some" ? "有一点帮助" : "没有帮助或更不舒服"}”，但不会把一次尝试说成固定规律。` : "当前对话、长期记忆和主动分享是不同权限。",
      store.privacy.localMemory ? 1 : 0,
    );
    onClose();
  };

  const openCareRecords = () => {
    setStore((current) => ({ ...current, journeySection: "report" }));
    onClose();
    goTo("journey");
  };

  return (
    <div className="modal-layer agent-layer" style={{ "--agent-viewport-height": `${viewportHeight}px` }}>
      <div className="sheet-header"><button className="icon-button" aria-label="返回小窝" onClick={onClose}><ArrowLeft /></button><div><p className="eyebrow">妳的小窝 · 月经宝宝</p><h2>说给我听吧</h2></div><ShieldCheck /></div>
      <div ref={chatThreadRef} className="chat-thread" aria-live="polite">
        {!messages.length && <div className="agent-empty-state"><p className="eyebrow">从此刻开始</p><h3>不用先把话整理好</h3><p>身体哪里不舒服、什么时候开始、今天还有什么必须完成的事，想到哪一句就说哪一句。</p><small><Lock /> 只有妳确认过的记录，才会进入长期记忆。</small></div>}
        {messages.map((message) => message.role === "user" ? <div className={`message user-message ${message.deliveryState === "failed" ? "failed" : ""}`} key={message.id}><span>{message.content}</span>{message.deliveryState === "failed" && <small>没有收到回复</small>}</div> : <div className="message baby-message" key={message.id}><span className="assistant-pearl" /><div><p>{message.content}</p><AgentKnowledgeCard card={message.knowledgeCard} /></div></div>)}
        {isRequesting && <div className="message baby-message agent-pending-message" role="status" aria-label="月经宝宝正在回应"><div className="pearl-thinking-dots" aria-hidden="true"><i /><i /><i /></div></div>}
        {requestError && <div className="agent-system-error" role="alert"><WarningCircle /><div><p className="eyebrow">系统状态 · 不是宝宝回复</p><h3>本轮没有生成回复</h3><p>{getAgentErrorCopy(requestError.code)}</p><div>{requestError.code === "agent_not_authorized" && <button className="primary-button" onClick={grantAgentConsent}>允许联网；消息仍由妳决定何时发送</button>}{requestError.turn && <button className="secondary-button" disabled={isRetrying || isRequesting || connectionState === "checking"} onClick={retryFailedTurn}>{isRetrying ? "正在重新连接" : "重新发送这一条"}</button>}{!requestError.turn && requestError.code !== "agent_not_authorized" && <button className="secondary-button" disabled={connectionState === "checking"} onClick={refreshAgentStatus}>{connectionState === "checking" ? "正在重新连接" : "重新检查连接"}</button>}</div></div></div>}
        {analysis && step === "safety" && <div className="safety-card" role="alert"><WarningCircle weight="fill" /><div><p className="eyebrow">产品安全提示 · 不是 Agent 回复</p><h3>{analysis.redFlag.title}</h3><p>{analysis.redFlag.action}</p><div className="boundary-note">普通对话无法判断原因，也不能替代及时的专业评估。</div><div className="safety-actions">{emergencySafety && <a className="primary-button" href="tel:120">联系紧急帮助（中国大陆 120）</a>}<button className={emergencySafety ? "secondary-button" : "primary-button"} onClick={onClose}>{emergencySafety ? "我已看见" : "我会尽快联系医疗专业人员"}</button></div></div></div>}
        {step === "care" && currentAction && <div className="gift-action-card"><div className="gift-ribbon"><Gift weight="fill" /> 一个可以选择、也可以停下的办法</div><h3>{currentAction.title}</h3><p>{currentAction.why}</p><div className="action-how"><Clock /> {currentAction.how}</div><div className="boundary-note"><ShieldCheck /> {currentAction.stopWhen}</div><SourceRows sources={currentAction.sources} label="这个办法的专业来源" /><small>妳可以不采用；只有妳亲自反馈的结果，才会成为以后行动排序的依据。</small><button className="primary-button" onClick={() => setStep("feedback")}>我试过了，告诉宝宝真实结果</button></div>}
        {step === "feedback" && <div className="agent-card feedback-card"><p className="eyebrow">这次结果会先由妳确认</p><h3>{currentAction?.id === "evidence" ? "这次解释让妳更清楚了吗？" : "这个办法真实地帮到妳了吗？"}</h3><button onClick={() => beginEffectFeedback("helped")}><span className="effect-orb strong" /><span><strong>{currentAction?.id === "evidence" ? "清楚很多" : "很有帮助"}</strong><small>以后遇到相似处境，可以优先回看</small></span></button><button onClick={() => beginEffectFeedback("some")}><span className="effect-orb some" /><span><strong>{currentAction?.id === "evidence" ? "清楚一点" : "有一点帮助"}</strong><small>保留结果，但不夸大</small></span></button><button onClick={() => beginEffectFeedback("none")}><span className="effect-orb none" /><span><strong>{currentAction?.id === "evidence" ? "还是不清楚" : "没有帮助 / 更不舒服"}</strong><small>下次降低或阻止同类行动</small></span></button></div>}
        {step === "confirm" && recordDraft && <div className="record-confirm-card"><p className="eyebrow">保存前由妳确认</p><h3>这次要留下哪些事实？</h3><p>宝宝整理的是草稿。妳可以直接改；空白会保留成“没有记录”。</p><label>当时发生了什么<textarea rows="3" value={recordDraft.situation} onChange={(event) => setRecordDraft((current) => ({ ...current, situation: event.target.value }))} /></label><div className="record-core-result"><span><small>做了</small><strong>{recordDraft.actionTitle}</strong></span><span><small>结果</small><strong>{recordDraft.effect === "helped" ? "很有帮助" : recordDraft.effect === "some" ? "有一点帮助" : "没有帮助 / 更不舒服"}</strong></span></div><details><summary>补充或修改更多字段 <CaretDown /></summary><label>身体感受<input value={recordDraft.symptoms} onChange={(event) => setRecordDraft((current) => ({ ...current, symptoms: event.target.value }))} placeholder="没有记录" /></label><label>影响了什么<input value={recordDraft.functionalImpact} onChange={(event) => setRecordDraft((current) => ({ ...current, functionalImpact: event.target.value }))} placeholder="例如：很难集中注意" /></label><label>和以往有什么不同<input value={recordDraft.differenceFromUsual} onChange={(event) => setRecordDraft((current) => ({ ...current, differenceFromUsual: event.target.value }))} placeholder="不知道也可以留空" /></label><label>当时的现实限制<input value={recordDraft.currentConstraint} onChange={(event) => setRecordDraft((current) => ({ ...current, currentConstraint: event.target.value }))} placeholder="例如：下午还有会" /></label><label>什么时候开始<input value={recordDraft.onset} onChange={(event) => setRecordDraft((current) => ({ ...current, onset: event.target.value }))} placeholder="没有记录" /></label></details><div className="record-confirm-actions"><button className="primary-button" onClick={confirmRecord} disabled={!recordDraft.situation.trim()}>{savedEpisodeId ? "保存这次修改" : store.privacy.localMemory ? "确认并存入照护记录" : "确认，但不写入长期记忆"}</button><button className="secondary-button" onClick={() => setStep("feedback")}>返回修改结果</button></div></div>}
        {step === "saved" && <div className="saved-card"><div className="saved-icon"><Check weight="bold" /></div><p className="eyebrow">{store.privacy.localMemory ? "已保存到我的照护记录" : "只保留在当前对话"}</p><h3>{store.privacy.localMemory ? "处境、行动和真实结果已经连在一起" : "这次没有写入长期记忆"}</h3><p>{store.privacy.localMemory ? `结果是“${effect === "helped" ? "很有帮助" : effect === "some" ? "有一点帮助" : "没有帮助或更不舒服"}”。下次相似处境中，它会真实改变行动排序。` : "关闭长期记忆时，本轮不会成为下次建议依据，也不会自动分享。"}</p><div className="saved-actions"><button className="secondary-button" onClick={() => setStep("confirm")}>修改这条记录</button>{store.privacy.localMemory && <button className="primary-button" onClick={openCareRecords}><BookOpenText /> 查看我的照护记录</button>}<button className="secondary-button" onClick={returnHome}>回到小窝</button></div></div>}
        {memoryDraft?.shouldOffer && turnKind !== "action" && <p className="agent-memory-boundary">这一轮只生成了可纠正的候选，不会自动写入长期记忆。</p>}
      </div>
      <form className="agent-composer" onSubmit={submitChatMessage}>
        <ComposerCompanion interactionState={companionInteraction} bodyState={latestConfirmedBodyState} babyName={store.profile.babyName} />
        <label htmlFor="agent-live-message">月经宝宝正趴在这里听妳说</label>
        <div className="agent-composer-row"><textarea ref={chatInputRef} id="agent-live-message" value={chatDraft} onFocus={() => !isRequesting && setInteractionState("listening")} onBlur={() => interactionState === "listening" && setInteractionState("idle")} onChange={(event) => { setChatDraft(event.target.value); if (!isRequesting) setInteractionState(event.target.value.trim() ? "listening" : "idle"); }} placeholder={analysis ? "继续补充这一刻发生了什么……" : "说说此刻发生了什么……"} rows={2} /><button type="button" className={isListening ? "voice-button listening" : "voice-button"} onClick={toggleVoice} aria-label={isListening ? "停止语音输入" : "开始语音输入"}>{isListening ? <MicrophoneSlash /> : <Microphone />}</button><button type="submit" disabled={!chatDraft.trim() || isRequesting || isRetrying} aria-label="发送给月经宝宝"><PaperPlaneTilt weight="fill" /></button></div>
        <span>{voiceStatus || "发送前可以继续修改；只有妳确认后，才会留下长期记录"}</span>
      </form>
    </div>
  );
}

function CycleScreen({ store, setStore, goTo, openBodyMap }) {
  const [positionOpen, setPositionOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const [editingRhythm, setEditingRhythm] = useState(null);
  const cycleMoment = getCycleMoment(store);
  const hasPosition = cycleMoment.available;
  const showCursor = hasPosition && cycleMoment.withinPanorama;
  const cursor = `${Math.min(97, Math.max(2, ((store.cycleDay - 1) / 29) * 100))}%`;
  const cursorEdge = store.cycleDay <= 4 ? "edge-left" : store.cycleDay >= 27 ? "edge-right" : "";
  const latestRhythm = store.rhythmLogs?.[0] || null;
  const openRhythm = (log = null) => {
    setEditingRhythm(log);
    setRhythmOpen(true);
  };
  const saveRhythm = (draftLog) => {
    setStore((current) => ({ ...current, rhythmLogs: upsertRhythmLog(current.rhythmLogs, draftLog) }));
    setRhythmOpen(false);
    setEditingRhythm(null);
  };
  const deleteRhythm = (logId) => {
    setStore((current) => ({ ...current, rhythmLogs: (current.rhythmLogs || []).filter((log) => log.id !== logId) }));
    setRhythmOpen(false);
    setEditingRhythm(null);
  };
  const portalTarget = document.querySelector(".mobile-prototype");
  return (
    <section className="page cycle-page">
      <p className="page-intro-line">同一个时间点，看见我的身体正在如何协同</p>
      <CyclePositionCard moment={cycleMoment} store={store} latestRhythm={latestRhythm} onEditPosition={() => setPositionOpen(true)} onRecord={() => openRhythm()} onBodyRecord={openBodyMap} />
      <div className="timeline-card">
        <div className="timeline-intro"><span>身体协同示意</span><small>每个人的周期长度与排卵时点都会不同</small></div>
        <div className="cycle-axis">
          <div className="day-ruler" aria-label="周期教学坐标，从第一天到第三十天">{[1,5,10,15,20,25,30].map((day) => <span key={day} style={{ left: `${((day - 1) / 29) * 100}%` }}>D{day}</span>)}</div>
          <div className="dual-phases">
            <div className="phase-row"><small>卵巢周期</small><div className="phase-band"><span className="follicular">卵泡期</span><span className="ovulation">排卵事件<br />不确定窗口</span><span className="luteal">黄体期</span></div></div>
            <div className="phase-row"><small>内膜周期</small><div className="phase-band"><span className="menses">月经 / 脱落</span><span className="growth">增殖期</span><span className="secretory">分泌期</span></div></div>
          </div>
          {showCursor && <div className={`today-line ${cursorEdge}`} style={{ left: cursor }}><span><Moon weight="fill" />我的 D{store.cycleDay}</span></div>}
          {CYCLE_TRACKS.map((track) => <SystemTrack key={track.id} {...track} />)}
        </div>
        <div className="landscape-boundary"><Info weight="fill" /><span>这里呈现生理事件的相对顺序；妳的日期记录不能测出排卵、内膜厚度或激素水平。</span></div>
      </div>
      <div className="cycle-data-section-heading"><div><p className="eyebrow">研究参考</p><h2>这个位置，研究能告诉我什么</h2></div><span>群体资料</span></div>
      <ResearchClimate moment={cycleMoment} cycleDay={store.cycleDay} />
      <div className="cycle-data-section-heading personal"><div><p className="eyebrow">我的节律</p><h2>我的记录正在形成怎样的线索</h2></div><span>只用授权数据</span></div>
      <PersonalRhythm store={store} onAdd={() => openRhythm()} onEdit={openRhythm} onLocate={() => setPositionOpen(true)} />
      <details className="cycle-source-drawer">
        <summary><ShieldCheck /><span><strong>严谨性审查与完整来源</strong><small>权威来源已逐项映射；成品妇产科专家签字仍待完成</small></span><CaretDown /></summary>
        <div className="cycle-source-content">
          <p>已核对：两套周期不互斥、排卵是可变事件、内膜脱落与修复可重叠、分泌物存在其他解释、日历不生成个人器官状态。</p>
          <div className="cycle-source-list">{Object.entries(CYCLE_SOURCES).map(([id, source]) => <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.label}<CaretRight /></a>)}</div>
          <p className="audit-limit"><WarningCircle /> 这仍是黑客松教学原型，不是诊断工具，也尚未完成妇产科、内分泌和用户理解测试。</p>
          <button className="secondary-button" onClick={() => goTo("knowledge")}>去知识海继续核对说法</button>
        </div>
      </details>
      {positionOpen && portalTarget && createPortal(<CyclePositionEditor store={store} onClose={() => setPositionOpen(false)} onSave={({ cycleDay, cycleStartDate, cycleEndDate, cycleOngoing }) => { setStore((current) => ({ ...current, cycleDay, cycleStartDate, cycleEndDate, cycleOngoing, cycleAnchorConfirmed: true, cycleUpdatedAt: new Date().toISOString() })); setPositionOpen(false); }} onClear={() => { setStore((current) => ({ ...current, cycleAnchorConfirmed: false, cycleStartDate: "", cycleEndDate: "", cycleOngoing: false, cycleUpdatedAt: new Date().toISOString() })); setPositionOpen(false); }} />, portalTarget)}
      {rhythmOpen && portalTarget && createPortal(<RhythmLogModal store={store} existing={editingRhythm} onClose={() => { setRhythmOpen(false); setEditingRhythm(null); }} onSave={saveRhythm} onDelete={deleteRhythm} />, portalTarget)}
    </section>
  );
}

function CyclePositionCard({ moment, store, latestRhythm, onEditPosition, onRecord, onBodyRecord }) {
  const canLocate = !["seed", "phoenix"].includes(store.profile.lifeStage);
  const rhythmSummary = latestRhythm
    ? [latestRhythm.sleep, latestRhythm.pain, latestRhythm.energy, latestRhythm.mood].filter(Boolean).join(" · ")
    : "今天还没有留下睡眠、疼痛、精力或心情";
  return (
    <section className={`cycle-position-card ${moment.available ? "has-position" : "needs-position"}`}>
      <header>
        <div className="cycle-position-orb"><Moon weight="fill" /><span>{moment.available ? `D${store.cycleDay}` : "—"}</span></div>
        <div><p className="eyebrow">我的当前位置</p><h2>{moment.title}</h2></div>
        {canLocate && <button className="position-edit-button" onClick={onEditPosition}>{moment.available ? "修改" : "定位"}</button>}
      </header>
      <div className="cycle-position-now">
        <small>{moment.available ? "教学模型中的同时状态" : "为什么这里暂时留白"}</small>
        <strong>{moment.phaseLabel || moment.description}</strong>
        {moment.available && <p>{moment.description}</p>}
      </div>
      {moment.available && (
        <div className="cycle-next-prep">
          <div className="next-prep-title"><CalendarDots /><span><small>接下来可能发生什么</small><strong>{moment.next}</strong></span></div>
          <div className="prep-list">{moment.preparations.map((item) => <span key={item}>{item}</span>)}</div>
        </div>
      )}
      {canLocate && (
        <div className="cycle-position-actions">
          <div className="cycle-record-buttons"><button onClick={onRecord}><Plus /> 记录今天的节律</button><button onClick={onBodyRecord}><PersonArmsSpread /> 点点身体位置</button></div>
          <span><strong>妳的真实感受</strong>{rhythmSummary}</span>
        </div>
      )}
      <p className="cycle-position-boundary"><ShieldCheck /> “位置”来自妳确认的日期或周期日；身体感受只来自妳亲自填写的记录。</p>
    </section>
  );
}

function CyclePositionEditor({ store, onClose, onSave, onClear }) {
  const today = localDateValue();
  const [startDate, setStartDate] = useState(store.cycleStartDate || "");
  const [endDate, setEndDate] = useState(store.cycleEndDate || "");
  const [ongoing, setOngoing] = useState(Boolean(store.cycleOngoing));
  const [dayInput, setDayInput] = useState(store.cycleAnchorConfirmed ? String(store.cycleDay) : "");
  const [calendarTarget, setCalendarTarget] = useState(null);
  const dayNumber = Number(dayInput);
  const validDay = Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 365;
  const validRange = !startDate || ongoing || !endDate || endDate >= startDate;
  const endDecisionMade = !startDate || ongoing || Boolean(endDate);
  const updateStartDate = (value) => {
    setStartDate(value);
    const derived = deriveCycleDayFromStart(value);
    setDayInput(derived ? String(derived) : "");
    if (endDate && endDate < value) setEndDate("");
  };
  const setTodayAsStart = () => {
    setStartDate(today);
    setDayInput("1");
    setEndDate("");
    setOngoing(true);
  };
  const chooseDate = (value) => {
    if (calendarTarget === "start") updateStartDate(value);
    if (calendarTarget === "end") {
      setEndDate(value);
      setOngoing(false);
    }
    setCalendarTarget(null);
  };
  return (
    <div className="modal-layer cycle-position-editor">
      <div className="sheet-header"><button className="icon-button" aria-label="关闭周期定位" onClick={onClose}><X /></button><div><h2>我现在在生理周期的哪个位置</h2><p className="sheet-subtitle">由妳确认，不替妳猜</p></div><Moon weight="fill" /></div>
      <div className="cycle-editor-content">
        <section className="cycle-editor-intro"><span className="position-moon"><Moon weight="fill" /></span><div><small>根据妳填写的日期</small><strong>{validDay ? `今天是第 ${dayNumber} 天` : "等待妳的记录"}</strong><p>{validDay && dayNumber > 30 ? "会保留真实天数；全景图只显示前 30 天。" : "填写开始日期，再选择结束日期或“还没有结束”，宝宝才能把今天放回妳的时间线。"}</p></div></section>
        <section className="period-date-group"><h3>这次月经从哪天开始</h3><div className="period-start-actions"><button className="calendar-field-button" onClick={() => setCalendarTarget("start")}><span><small>开始日期</small><strong>{formatCycleDate(startDate) || "选择日期"}</strong></span><CalendarDots /></button><button className={startDate === today ? "today-check-button selected" : "today-check-button"} onClick={setTodayAsStart}><span className="check-box">{startDate === today && <Check weight="bold" />}</span><span><strong>今天刚来月经</strong><small>设为第 1 天</small></span></button></div></section>
        <section className="period-date-group"><h3>这次月经从哪天结束</h3><button className={ongoing ? "ongoing-button selected" : "ongoing-button"} onClick={() => { setOngoing((value) => !value); if (!ongoing) setEndDate(""); }}><span className="check-box">{ongoing && <Check weight="bold" />}</span><span><strong>还没有结束</strong><small>结束后可以再回来补日期</small></span></button><button className={`calendar-field-button end ${ongoing || !startDate ? "disabled" : ""}`} disabled={ongoing || !startDate} onClick={() => setCalendarTarget("end")}><span><small>结束日期</small><strong>{formatCycleDate(endDate) || (startDate ? "选择日期" : "先选开始日期")}</strong></span><CalendarDots /></button>{!validRange && <p className="field-error">结束日期不能早于开始日期。</p>}</section>
        {calendarTarget && <CycleCalendar value={calendarTarget === "start" ? startDate : endDate} min={calendarTarget === "end" ? startDate : ""} max={today} title={calendarTarget === "start" ? "选择开始日期" : "选择结束日期"} onSelect={chooseDate} onClose={() => setCalendarTarget(null)} />}
        <details className="manual-cycle-day"><summary>记不清日期？直接填写今天是第几天 <CaretDown /></summary><label className="field-label">今天是第几天<input inputMode="numeric" type="number" min="1" max="365" placeholder="例如：2" value={dayInput} onChange={(event) => { setDayInput(event.target.value); setStartDate(""); setEndDate(""); setOngoing(false); }} /></label></details>
        <div className="boundary-note"><ShieldCheck /> 这里只记录妳确认的日期，不会据此断言排卵、激素、内膜状态或诊断。</div>
        <button className="primary-button" disabled={!validDay || !validRange || !endDecisionMade} onClick={() => onSave({ cycleDay: dayNumber, cycleStartDate: startDate, cycleEndDate: ongoing ? "" : endDate, cycleOngoing: ongoing })}>确认</button>
        {store.cycleAnchorConfirmed && <button className="secondary-button clear-position-button" onClick={onClear}>这次日期不确定，先不显示位置</button>}
      </div>
    </div>
  );
}

function formatCycleDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return `${year} 年 ${month} 月 ${day} 日`;
}

function dateValue(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function CycleCalendar({ value, min, max, title, onSelect, onClose }) {
  const base = value || max || localDateValue();
  const [baseYear, baseMonth] = base.split("-").map(Number);
  const [month, setMonth] = useState(() => new Date(baseYear, baseMonth - 1, 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  return <section className="cycle-calendar" role="dialog" aria-label={title}><header><button aria-label="上个月" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><CaretRight /></button><div><small>{title}</small><strong>{year} 年 {monthIndex + 1} 月</strong></div><button aria-label="下个月" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><CaretRight /></button></header><div className="calendar-weekdays">{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((day, index) => { if (!day) return <span key={`empty-${index}`} />; const current = dateValue(year, monthIndex, day); const disabled = (min && current < min) || (max && current > max); return <button key={current} disabled={disabled} className={value === current ? "selected" : current === localDateValue() ? "today" : ""} onClick={() => onSelect(current)}>{day}</button>; })}</div><button className="calendar-cancel" onClick={onClose}>先不选</button></section>;
}

function SystemTrack({ title, image, stages, sources, boundary }) {
  const columns = stages.map((stage) => `${stage.weight}fr`).join(" ");
  return <section className="system-track"><div className="track-heading"><strong>{title}</strong><span>教学模型</span></div><img src={image} alt={`${title}的艺术化典型周期教学序列，不代表个人实时状态`} /><div className="track-stage-labels" style={{ gridTemplateColumns: columns }}>{stages.map((stage) => <span key={stage.label}>{stage.label.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</span>)}</div><details className="track-evidence"><summary><ShieldCheck /><span>为什么这样画 · {sources.join(" / ")}</span><CaretDown /></summary><p>{boundary}</p><div className="track-source-links">{sources.map((id) => <a key={id} href={CYCLE_SOURCES[id].url} target="_blank" rel="noreferrer">{CYCLE_SOURCES[id].label}<CaretRight /></a>)}</div></details></section>;
}

function ResearchClimate({ moment, cycleDay }) {
  return <section className="climate-card"><div className="section-heading"><div><p className="eyebrow">{moment.available ? `${moment.phaseLabel}附近的研究参考` : "先留白，也是一种准确"}</p><h3>{moment.available ? "把群体研究当背景，不当作妳的预测" : "确认日期后，再把研究放到对应位置"}</h3></div><Info /></div>{moment.available && <p className="current-research-cue">在妳确认的 D{cycleDay}，全景图用于理解器官事件的相对顺序；睡眠、疼痛、心情和精力仍以妳的记录为准。</p>}<div className="climate-items"><div><span className="climate-dot strong" /><p><strong>体温</strong><small>排卵后相对上移有较明确机制；不能据此单独确认排卵。</small></p></div><div><span className="climate-dot conditional" /><p><strong>睡眠与疼痛</strong><small>在有 PMS 或痛经症状的人群中更值得观察，不代表人人固定变化。</small></p></div><div><span className="climate-dot limited" /><p><strong>心情与精力</strong><small>不画统一曲线；优先比较妳跨周期重复出现的记录。</small></p></div></div></section>;
}

const RHYTHM_DIMENSIONS = [
  { key: "sleep", label: "睡眠", note: "按醒来后的恢复感", options: ["有恢复感", "一般", "没睡够"] },
  { key: "pain", label: "疼痛/不适", note: "按它对当下生活的影响", options: ["没有", "有一点", "很影响我"] },
  { key: "energy", label: "精力", note: "按今天能做事的余量", options: ["还可以", "偏低", "快耗尽"] },
  { key: "mood", label: "心情", note: "选最接近的，不解释原因也可以", options: ["平稳", "有点烦", "很低落"] },
];

function PersonalRhythm({ store, onAdd, onEdit, onLocate }) {
  const logs = store.rhythmLogs || [];
  const positionedLogs = logs.filter((log) => log.cycleDay && log.cycleDay <= 30);
  return (
    <section className="personal-rhythm">
      <div className="section-heading rhythm-heading"><div><p className="eyebrow">只用妳授权的记录</p><h3>{logs.length < 2 ? "先留下今天，不急着画规律" : `已有 ${logs.length} 天真实节律`}</h3></div><span className="count-pill">{logs.length} 天</span></div>
      <button className="rhythm-add-button" onClick={onAdd}><span><Plus /><strong>记录今天</strong></span><small>睡眠、疼痛、精力、心情，想填几个就填几个</small><CaretRight /></button>
      {!store.cycleAnchorConfirmed && <button className="rhythm-location-note" onClick={onLocate}><CalendarDots /><span><strong>记录可以先发生</strong><small>确认周期日后，这些点才会落到 D1–D30 轴上</small></span><CaretRight /></button>}
      <div className="rhythm-axis" aria-hidden="true"><span>D1</span><span>D15</span><span>D30</span></div>
      {RHYTHM_DIMENSIONS.map(({ key, label }) => {
        const records = positionedLogs.filter((log) => log[key]);
        return <div className="rhythm-row" key={key}><strong>{label}</strong><div className="rhythm-track">{records.length ? records.slice(0, 12).map((log) => <span key={log.id} title={`D${log.cycleDay} · ${log[key]}`} aria-label={`${label}，D${log.cycleDay}，${log[key]}`} style={{ left: `${Math.min(98, Math.max(2, ((log.cycleDay - 1) / 29) * 100))}%` }} className={`record-dot ${key}`} />) : <span className="missing-line">这个维度尚无定位记录</span>}</div></div>;
      })}
      <p className="microcopy">每个圆点只代表那一天妳亲自填写的一项感受；缺失就留白，数据不足时不连线、不生成“妳的固定模式”。</p>
      {logs.length > 0 && <div className="rhythm-log-list"><div className="rhythm-log-list-title"><strong>最近记录</strong><small>可以随时修改</small></div>{logs.slice(0, 5).map((log) => <button key={log.id} className="rhythm-log-card" onClick={() => onEdit(log)}><span className="rhythm-log-date"><Moon weight="fill" /><strong>{log.cycleDay ? `D${log.cycleDay}` : "未定位"}</strong><small>{new Date(log.recordedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</small></span><span className="rhythm-log-values">{RHYTHM_DIMENSIONS.filter(({ key }) => log[key]).map(({ key, label }) => <em key={key}><b>{label}</b>{log[key]}</em>)}</span><CaretRight /></button>)}</div>}
      {store.episodes.length > 0 && <p className="rhythm-episode-note"><ChatCircleDots /> 对话中另有 {store.episodes.length} 条“状态—行动—结果”照护记录；这里不把两类数据混成同一种测量。</p>}
    </section>
  );
}

function RhythmLogModal({ store, existing, onClose, onSave, onDelete }) {
  const [draftLog, setDraftLog] = useState(() => existing ? { ...existing } : {
    id: null,
    recordedAt: null,
    cycleDay: store.cycleAnchorConfirmed ? store.cycleDay : null,
    sleep: null,
    pain: null,
    energy: null,
    mood: null,
    note: "",
  });
  const hasValue = RHYTHM_DIMENSIONS.some(({ key }) => draftLog[key]) || draftLog.note.trim();
  const canSave = Boolean(hasValue && store.privacy.localMemory);
  return (
    <div className="modal-layer rhythm-log-modal">
      <div className="sheet-header"><button className="icon-button" aria-label="关闭节律记录" onClick={onClose}><X /></button><div><p className="eyebrow">轻轻留下一天</p><h2>{existing ? "修改这次节律" : "记录今天的节律"}</h2></div><span className="rhythm-day-chip">{draftLog.cycleDay ? `D${draftLog.cycleDay}` : "未定位"}</span></div>
      <div className="rhythm-log-content">
        <section className="rhythm-log-intro"><Moon weight="fill" /><div><strong>想填几个就填几个</strong><p>只选妳此刻有感觉的维度。它们都是主观自述，不是医学评分，也不会自动归因给周期。</p></div></section>
        <div className="rhythm-scales">{RHYTHM_DIMENSIONS.map(({ key, label, note, options }) => <PlainScale key={key} label={label} note={note} value={draftLog[key]} options={options} allowClear onChange={(value) => setDraftLog((current) => ({ ...current, [key]: value }))} />)}</div>
        <label className="rhythm-note-field">还想留下一句话（可选）<textarea maxLength="80" rows="3" placeholder="例如：昨晚赶工到很晚；今天还要出门……" value={draftLog.note} onChange={(event) => setDraftLog((current) => ({ ...current, note: event.target.value }))} /><small>{draftLog.note.length}/80</small></label>
        {!store.privacy.localMemory && <div className="boundary-note"><Lock /> 妳关闭了长期周期记忆，所以这条记录不会被保存。可以到“我的 → 隐私”重新开启。</div>}
        <div className="boundary-note"><ShieldCheck /> 保存后仍可修改。一个点只说明“那天妳这样记录过”，不证明是周期造成的。</div>
        <button className="primary-button" disabled={!canSave} onClick={() => onSave(draftLog)}>{existing ? "保存修改" : "放进我的节律"} <Check /></button>
        {existing && <button className="secondary-button rhythm-delete-button" onClick={() => { if (window.confirm("只删除这一条节律记录，其他记录和数据不会受影响。继续吗？")) onDelete(existing.id); }}><Trash /> 删除这条节律记录</button>}
        <button className="secondary-button" onClick={onClose}>先不记录</button>
      </div>
    </div>
  );
}

function KnowledgeScreen({ knowledge, store, setStore, showMoment, startAgent }) {
  const [tab, setTab] = useState("claims");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [category, setCategory] = useState("全部");
  const professional = useMemo(() => prepareProfessionalCards(knowledge.claims, knowledge.myths), [knowledge.claims, knowledge.myths]);
  const practiceClusters = useMemo(() => buildPublicPracticeClusters(knowledge.monid), [knowledge.monid]);
  const normalizedQuery = normalizeMenstrualLanguage(query).toLowerCase();
  const list = tab === "claims" ? professional : practiceClusters;
  const filtered = list.filter((item) => {
    if (tab === "claims" && category !== "全部" && item._category !== category) return false;
    const searchText = tab === "claims" ? `${item._category} ${item._title} ${item._body}` : item.searchText;
    return !normalizedQuery || normalizeMenstrualLanguage(searchText).toLowerCase().includes(normalizedQuery);
  }).slice(0, 24);
  const medicalLane = knowledge.provenance?.evidenceLanes?.find((lane) => lane.id === "medical_or_official_background");
  const openDetail = (item) => {
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "auto" });
    setDetail(item);
  };
  return (
    <section className="page knowledge-page">
      <p className="page-intro-line">专业证据、公开经验候选与妳的真实结果分开整理，帮助妳看懂一条说法能说什么、不能说什么。</p>
      <label className="search-field"><MagnifyingGlass /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：黄体期运动、痛经、睡眠……" />{query && <button onClick={() => setQuery("")}><X /></button>}</label>
      <div className="segmented-control"><button className={tab === "claims" ? "active" : ""} onClick={() => setTab("claims")}>专业证据 · {knowledge.claims.length + knowledge.myths.length}</button><button className={tab === "practices" ? "active" : ""} onClick={() => setTab("practices")}>邪修雷达 · {practiceClusters.length} 类</button></div>
      {tab === "claims" && <div className="research-boundary professional-boundary"><ShieldCheck /><span><strong>专业底座可追溯，不假装已经临床上线</strong>当前演示卡来自 R004 {knowledge.claimsMeta?.releaseId || "r5"}：{medicalLane?.counts?.active_sources || 109} 个专业/官方来源；每张卡至少有一条来源定位。妇产科产品级终审仍待完成，因此这里只做科普背景，不做诊断或处方。</span></div>}
      {tab === "claims" && <div className="knowledge-category-chips">{PROFESSIONAL_CATEGORIES.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>}
      {tab === "practices" && <div className="research-boundary"><Info /><span><strong>先把营销标题清掉，再看“大家在讨论什么”</strong>R006 的 {knowledge.monid.length} 条记录都是固定查询下公开可见的搜索摘要，不是全文、人数或效果证据。现在聚合成 {practiceClusters.length} 类说法；0 条可直接作为照护建议。</span></div>}
      <div className="knowledge-list">
        {filtered.map((item, index) => tab === "claims" ? (
          <button className="knowledge-card" key={item.claim_id || item.myth_id || index} onClick={() => openDetail(item)}><span className={`evidence-mark ${item._kind}`}><BookOpenText /></span><div><small>{item._category} · {item._kind === "myth" ? "常见误解纠正" : item.evidence_strength || "专业背景"} · 来源已定位</small><h3>{item._title}</h3><p>{item._body}</p></div><CaretRight /></button>
        ) : (
          <article className="practice-card cluster-card" key={item.id || index}><div className="practice-top"><span>{item.category}</span><EvidenceBadge type="unknown" /></div><h3>{item.title}</h3><p>{item.summary}</p><div className="cluster-count"><strong>{item.candidateCount}</strong><span>条候选摘要提到相近主题<br />不是 {item.candidateCount} 人赞同</span></div><div className="risk-line"><ShieldCheck /> {item.boundary}</div><footer><small>{item.sourceLabel}</small><button onClick={() => openDetail({ ...item, _kind: "practice-cluster" })}>看整理与来源 <CaretRight /></button></footer></article>
        ))}
        {!filtered.length && <div className="empty-card">这一类暂时没有匹配内容。可以换一个更具体的身体问题。</div>}
      </div>
      {detail && createPortal(detail._kind === "practice-cluster" ? <PracticeClusterDetail item={detail} onClose={() => setDetail(null)} onAsk={() => { setDetail(null); startAgent(`我在公开讨论里看到“${detail.title}”这一类说法。请先问我的具体情况，再帮我分清证据、风险和是否适合我。`); }} /> : <KnowledgeDetail item={detail} onClose={() => setDetail(null)} onAsk={() => { setDetail(null); startAgent(`请先问我的具体情况，再结合专业来源解释：${detail._body}`); }} />, document.querySelector(".mobile-prototype"))}
    </section>
  );
}

function EvidenceBadge({ type }) { const value = EVIDENCE_LABELS[type] || ["待复核", "尚未核验"]; return <span className={`evidence-badge ${type}`}>{value[0]}</span>; }

function KnowledgeDetail({ item, onClose, onAsk }) {
  const sourceDetails = item.source_details || [];
  return <div className="modal-layer detail-layer"><div className="sheet-header"><button className="icon-button" aria-label="返回知识海" onClick={onClose}><ArrowLeft /></button><div><p className="eyebrow">{item._category} · {item._kind === "myth" ? "误解纠正研究卡" : "专业研究背景卡"}</p><h2>{item._title}</h2></div><span /></div><div className="detail-content"><section><p className="eyebrow">目前可以说</p><p className="detail-lead">{item._body}</p></section>{item.population_and_context && <section><h3>适用于什么情境</h3><p>{normalizeMenstrualLanguage(item.population_and_context)}</p></section>}{item.counterexample_or_conflict && <section><h3>不能这样简单解释</h3><p>{normalizeMenstrualLanguage(item.counterexample_or_conflict)}</p></section>}{item.potential_harm && <section className="danger-section"><h3>错误理解可能带来什么</h3><p>{normalizeMenstrualLanguage(item.potential_harm)}</p></section>}<section><h3>来源与边界</h3>{sourceDetails.length ? <div className="knowledge-source-list">{sourceDetails.slice(0, 8).map((source, index) => <a key={`${source.source_id}-${source.locator_type}-${index}`} href={source.url} target="_blank" rel="noreferrer"><span><strong>{normalizeMenstrualLanguage(source.source_title)}</strong><small>{[source.organization_or_authors, source.publication_year, source.source_type].filter(Boolean).join(" · ")}</small><em>{source.verification_status === "fulltext_checked" ? "全文核验" : source.verification_status === "abstract_checked" ? "摘要核验" : "已登记"} · 定位：{source.locator_type} {source.locator_value}</em></span><CaretRight /></a>)}</div> : <p>{normalizeMenstrualLanguage(item.sources || "来源保存在月经知识事实数据库中。")}</p>}<p className="microcopy">{normalizeMenstrualLanguage(item.limitations || item.app_safe_wording || "这是一条群体知识，不能替妳做个人诊断。")}</p><div className="clinical-review-note"><ShieldCheck /> {normalizeMenstrualLanguage(item.publication_boundary || "仍待妇产科产品级终审。")}</div></section><button className="primary-button" onClick={onAsk}>结合我的情况问宝宝</button></div></div>;
}

function PracticeClusterDetail({ item, onClose, onAsk }) {
  return <div className="modal-layer detail-layer"><div className="sheet-header"><button className="icon-button" aria-label="返回邪修雷达" onClick={onClose}><ArrowLeft /></button><div><p className="eyebrow">公开经验候选 · 尚未验证</p><h2>{item.title}</h2></div><span /></div><div className="detail-content"><section><p className="eyebrow">我们整理出了什么</p><p className="detail-lead">{item.summary}</p></section><section className="sample-frame"><h3>这个数字具体表示什么</h3><div className="sample-number"><strong>{item.candidateCount}</strong><span>条候选搜索摘要<br />来自固定查询当时的公开结果</span></div><p>这不是全平台规模，也不是 {item.candidateCount} 位不同用户，更不是赞同或有效人数。重复内容、营销内容和反例仍可能存在。</p></section><section><h3>候选摘要怎样描述</h3><div className="cluster-examples">{item.examples.map((example) => <a href={example.sourceUrl} target="_blank" rel="noreferrer" key={example.id}><span>{example.excerpt}</span><small>只读到公开搜索摘要 · 查看原始链接</small><CaretRight /></a>)}</div></section><section className="danger-section"><h3>现在不能得出什么结论</h3><p>不能据此声称这个做法普遍、有效、安全，也不能把公开互动量当作推荐人数。产品当前不会把它自动变成照护行动或社区礼物。</p></section><section><h3>安全边界</h3><p>{item.boundary}</p><div className="clinical-review-note"><ShieldCheck /> 下一步需要全文阅读、反例编码、权威证据对照和妇产科风险复核。</div></section><button className="primary-button" onClick={onAsk}>结合我的情况，让宝宝继续分辨</button></div></div>;
}

function GiftSeaScreen({ store, setStore, showMoment }) {
  const [tab, setTab] = useState("birthday");
  const [giftFilter, setGiftFilter] = useState("helped");
  const addFriend = (friend) => { if (store.friends.includes(friend.id)) return; setStore((s) => ({ ...s, friends: [...s.friends, friend.id], growth: s.growth + 1, babyState: "befriending" })); showMoment("friend", `${store.profile.babyName}认识了${friend.name}`, `两只宝宝在月之海峡碰了碰耳鳍，一条新的月潮航线亮了起来。`, 1); };
  const giftEffects = { mianmian: "helped", lulu: "helped", xingxing: "some", beike: "some", xiaoman: "none", yueya: "helped" };
  const giftLabels = { helped: "很有帮助礼物卡", some: "有一点帮助礼物卡", none: "避雷卡" };
  const visibleGifts = BABY_FRIENDS.filter((friend) => giftEffects[friend.id] === giftFilter);
  const receiveGift = (friend) => { if (store.receivedGifts.some((g) => g.from === friend.id)) return; const gift = { id: `incoming-${friend.id}`, from: friend.id, title: friend.gift, effect: giftEffects[friend.id], receivedAt: new Date().toISOString(), status: "unopened" }; setStore((s) => ({ ...s, receivedGifts: [gift, ...s.receivedGifts], growth: s.growth + 2, babyState: "receiving" })); showMoment("receive", `${friend.name}送来的${giftLabels[gift.effect]}到了`, `${store.profile.babyName}替妳收下了这份经验礼物。妳可以先看适用处境和真实结果，再决定要不要尝试。`, 1); };
  const bless = (birthday) => { if (store.blessings.includes(birthday.id)) return; setStore((s) => ({ ...s, blessings: [...s.blessings, birthday.id], growth: s.growth + 1, babyState: "celebrating" })); showMoment("celebrate", `${store.profile.babyName}出发去送祝福`, `宝宝戴上小帽子，带着一颗月光珍珠去参加${birthday.baby}的庆祝会。回来时，它也为妳带回一点暖暖的星光。`, 1); };
  const interact = (post) => {
    if (store.communityInteractions.includes(post.id)) return;
    const friend = BABY_FRIENDS.find((item) => item.id === post.babyId);
    setStore((current) => ({ ...current, communityInteractions: [...current.communityInteractions, post.id], growth: current.growth + 1, babyState: "befriending" }));
    showMoment("friend", `${store.profile.babyName}去${post.action}了`, friend ? `它轻轻碰了碰${friend.name}的耳鳍。两只宝宝记住了这次温柔相遇。` : "宝宝带着妳的心意，在海边交到了一位新朋友。", 1);
  };
  return (
    <section className="page gift-page">
      <p className="page-intro-line">和宝宝去海边散步：庆祝新阶段、交换照护经验，也认识其他宝宝。</p>
      <div className="gift-tabs"><button className={tab === "birthday" ? "active" : ""} onClick={() => setTab("birthday")}>生日区</button><button className={tab === "gifts" ? "active" : ""} onClick={() => setTab("gifts")}>礼物区</button><button className={tab === "community" ? "active" : ""} onClick={() => setTab("community")}>宝宝社区</button></div>
      {tab === "birthday" && <div className="birthday-list"><section className="birthday-party-hero"><img src="/assets/baby-birthday-party-v2.png" alt="月经宝宝们戴着生日帽，在月光海湾围着珍珠蛋糕庆祝" /><div><p className="eyebrow">今天，海边有三种相遇值得庆祝</p><h2>宝宝生日派对</h2><p>庆祝种子被接回、月经宝宝破壳，也庆祝血月凤凰带着经验重逢。</p></div></section>{BIRTHDAYS.map((item) => <article className={`birthday-card birthday-${item.type}`} key={item.id}><div className="birthday-moon"><span>{item.day}</span><Moon weight="fill" /></div><div><small>{item.badge} · {item.baby}</small><h3>{item.wish}</h3><p>它为今天准备了：{item.prepared}</p><button onClick={() => bless(item)}>{store.blessings.includes(item.id) ? <><Check /> 宝宝已经送上祝福</> : <><PaperPlaneTilt /> 派我的宝宝去庆祝</>}</button></div></article>)}</div>}
      {tab === "gifts" && <div className="sea-feed"><section className="sea-hero"><div className="sea-orbit"><EnvelopeOpen weight="thin" /><span>{store.sentGifts.length + store.receivedGifts.length}</span></div><p className="eyebrow">照护经验被整理成三种礼物</p><h2>有帮助、有一点帮助、没有帮助，都能被清楚看见</h2><p>每张卡会说明当时处境、尝试行动和真实结果；公开经验仍需妳自己判断是否适用。</p></section><div className="gift-effect-tabs"><button className={giftFilter === "helped" ? "active" : ""} onClick={() => setGiftFilter("helped")}>很有帮助</button><button className={giftFilter === "some" ? "active" : ""} onClick={() => setGiftFilter("some")}>有一点帮助</button><button className={giftFilter === "none" ? "active" : ""} onClick={() => setGiftFilter("none")}>避雷卡</button></div>{visibleGifts.map((friend) => <article className={`sea-gift-card gift-${giftFilter}`} key={friend.id}><div className="friend-avatar"><img src="/assets/moon-sea-hero.png" alt={`${friend.name}的月经宝宝`} /></div><div className="sea-gift-copy"><small>{giftLabels[giftFilter]} · {friend.route}</small><h3>{friend.gift}</h3><p>{friend.name}带来的匿名经验；收到后仍会先看适用处境与风险边界。</p><button onClick={() => receiveGift(friend)}>{store.receivedGifts.some((g) => g.from === friend.id) ? <><Check /> 已收到这份礼物</> : <><Gift /> 派宝宝去接</>}</button></div></article>)}</div>}
      {tab === "community" && <div className="community-feed"><section className="community-intro"><UsersThree /><div><p className="eyebrow">宝宝们自己的海边动态</p><h2>妳派宝宝去认识朋友</h2><p>它们会分享收到礼物、长出新贝纹、想交朋友或准备生日的日常。</p></div></section>{COMMUNITY_POSTS.map((post) => { const friend = BABY_FRIENDS.find((item) => item.id === post.babyId); const interacted = store.communityInteractions.includes(post.id); return <article className="community-post" key={post.id}><div className="friend-avatar"><img src="/assets/moon-sea-hero.png" alt={`${friend?.name || "一只宝宝"}的头像`} /></div><div><header><strong>{friend?.name || "月海宝宝"}</strong><small>{post.time}</small></header><p>{post.text}</p><div className="community-post-actions"><button className={interacted ? "connected" : ""} onClick={() => interact(post)}>{interacted ? <><Check /> 心意送到了</> : <><HandHeart /> {post.action}</>}</button>{friend && <button className={store.friends.includes(friend.id) ? "connected" : ""} onClick={() => addFriend(friend)}>{store.friends.includes(friend.id) ? "已经是朋友" : "让宝宝认识它"}</button>}</div></div></article>; })}</div>}
    </section>
  );
}

function Inventory({ store, setStore, showMoment }) {
  const prepared = CARE_GIFTS.filter((gift) => store.preparedGiftIds.includes(gift.id));
  const openGift = (gift) => { if (gift.status === "opened") return; setStore((s) => ({ ...s, receivedGifts: s.receivedGifts.map((g) => g.id === gift.id ? { ...g, status: "opened" } : g), growth: s.growth + 1, babyState: "opening" })); showMoment("open", "贝壳在宝宝怀里慢慢打开", "它先看见这是一段匿名经验，再把适用情境和证据边界放到妳面前。", 1); };
  return <div className="inventory"><div className="section-heading"><div><p className="eyebrow">月潮生日准备</p><h3>我准备的照护礼物</h3></div><Package /></div>{prepared.map((gift) => <article className="inventory-card" key={gift.id}><Gift weight="fill" /><div><small>{gift.kind}</small><h3>{gift.title}</h3><p>{gift.caution}</p></div></article>)}<div className="section-heading incoming-heading"><div><p className="eyebrow">收到的匿名经验礼物</p><h3>{store.receivedGifts.length} 份等待妳决定</h3></div><EnvelopeOpen /></div>{store.receivedGifts.length ? store.receivedGifts.map((gift) => <article className="incoming-card" key={gift.id}><div><small>来自 {BABY_FRIENDS.find((f) => f.id === gift.from)?.name || "匿名宝宝"}</small><h3>{gift.title}</h3><p>公开经验礼物 · 尚未成为妳的个人结论</p></div><button disabled={gift.status === "opened"} onClick={() => openGift(gift)}>{gift.status === "opened" ? "已查看" : "查看内容"}</button></article>) : <div className="empty-card">去礼物区派宝宝接一份匿名经验礼物吧。妳随时可以忽略，不会失去成长。</div>}</div>;
}

function JourneyScreen({ store, setStore, showMoment, replayOnboarding }) {
  const [section, setSection] = useState(() => store.journeySection || "growth");
  const chooseSection = (nextSection) => {
    setSection(nextSection);
    setStore((current) => ({ ...current, journeySection: nextSection }));
  };
  const exportData = () => { const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "我的月经宝宝数据.json"; a.click(); URL.revokeObjectURL(url); };
  const reset = () => { if (!window.confirm("只清除完整宇宙版的本地演示数据，原版本不会受影响。继续吗？")) return; localStorage.removeItem(STORAGE_KEY); location.reload(); };
  const currentCompanion = store.profile.lifeStage === "seed" ? "月之种子" : store.profile.lifeStage === "phoenix" ? "血月凤凰" : "月经宝宝";
  return (
    <section className="page journey-page">
      <section className="my-baby-summary"><img src={store.profile.lifeStage === "seed" ? "/assets/lifecycle/moon-seed.png" : store.profile.lifeStage === "phoenix" ? "/assets/lifecycle/blood-moon-phoenix.png" : "/assets/moon-sea-hero.png"} alt={`${store.profile.babyName}，妳的${currentCompanion}`} /><div><p className="eyebrow">现在陪伴妳的{currentCompanion}</p><h1>{store.profile.babyName}</h1><p>{store.profile.lifeStage === "seed" ? "它会陪妳认识身体，安静等待自己的破壳时间。" : store.profile.lifeStage === "phoenix" ? "它带着妳们共同积累的身体经验，继续陪妳飞向新的生命阶段。" : menarcheStory(store.profile)}</p></div><div className="baby-summary-stats"><span><strong>{store.conversationCount || 0}</strong><small>次对话</small></span><span><strong>{store.episodes.length}</strong><small>次自我照护</small></span><span><strong>{store.sentGifts.length + store.receivedGifts.length}</strong><small>份礼物</small></span><span><strong>{store.friends.length}</strong><small>位宝宝朋友</small></span></div></section>
      <button className="onboarding-replay-card" onClick={replayOnboarding}><span className="replay-seed"><img src="/assets/lifecycle/moon-seed.png" alt="月之种子在月光贝壳中" /></span><span><small>妳们最初相遇的故事</small><strong>重看月之种子来到小窝的过程</strong><em>已有记录会保留，妳也可以重新调整陪伴偏好</em></span><CaretRight /></button>
      <div className="segmented-control"><button className={section === "growth" ? "active" : ""} onClick={() => chooseSection("growth")}>宝宝</button><button className={section === "report" ? "active" : ""} onClick={() => chooseSection("report")}>照护记录</button><button className={section === "privacy" ? "active" : ""} onClick={() => chooseSection("privacy")}>隐私</button></div>
      {section === "growth" && <Lifecycle store={store} setStore={setStore} showMoment={showMoment} />}
      {section === "report" && <Report store={store} setStore={setStore} showMoment={showMoment} />}
      {section === "privacy" && <div className="privacy-panel"><PrivacyRow icon={Lock} title="在这台设备保存记录与设置" copy="周期、身体记录和偏好；妳可以导出或清除" checked disabled /><PrivacyRow icon={Sparkle} title="允许宝宝形成长期记忆" copy="保存妳确认过的处境、行动和结果；关闭后不再新增" checked={store.privacy.localMemory} onChange={(v) => setStore((s) => ({ ...s, privacy: { ...s.privacy, localMemory: v } }))} /><PrivacyRow icon={ChatCircleDots} title="允许把当前消息发给联网 Agent" copy="开启后，对话内容会发往配置的 AI 服务；默认关闭" checked={store.privacy.agentCloudConsent} onChange={(v) => setStore((s) => ({ ...s, privacy: { ...s.privacy, agentCloudConsent: v }, profile: { ...s.profile, agentCloudConsent: v } }))} /><PrivacyRow icon={EnvelopeOpen} title="允许妳主动制作匿名经验礼物" copy="每一份仍需再次确认；默认不分享" checked={store.privacy.communityConsent} onChange={(v) => setStore((s) => ({ ...s, privacy: { ...s.privacy, communityConsent: v } }))} /><button className="settings-button" onClick={exportData}><DownloadSimple /> 导出我的本地数据 <CaretRight /></button><button className="settings-button danger" onClick={reset}><Trash /> 清除完整宇宙版数据 <CaretRight /></button><div className="boundary-note"><ShieldCheck /> 宝宝社区里的示例动态会与妳的私人记录分开；只有妳逐次确认的礼物才会进入分享流程。</div></div>}
    </section>
  );
}

function Lifecycle({ store, setStore, showMoment }) {
  const stageForProfile = store.profile.lifeStage === "seed" ? "seed" : store.profile.lifeStage === "phoenix" ? "phoenix" : "baby";
  const stageStatus = (id) => id === stageForProfile ? "现在" : id === "seed" ? "曾经" : id === "phoenix" ? "未来" : stageForProfile === "seed" ? "未来" : "曾经";
  const ordered = [...LIFECYCLE].sort((a, b) => (a.id === stageForProfile ? -1 : b.id === stageForProfile ? 1 : 0));
  return <div className="lifecycle"><div className="lifecycle-intro"><p className="eyebrow">同一份生命经验，长成不同的样子</p><h2>现在先好好认识陪着妳的它</h2><p>月之种子是一次温柔回望，血月凤凰是一段有力量的展望。</p></div>{ordered.map((stage) => <article className={`lifecycle-card stage-${stage.id} ${stage.id === stageForProfile ? "current" : ""}`} key={stage.id}><div className="lifecycle-visual"><img src={stage.id === "seed" ? "/assets/lifecycle/moon-seed.png" : stage.id === "phoenix" ? "/assets/lifecycle/blood-moon-phoenix.png" : "/assets/moon-sea-hero.png"} alt={stage.title} /></div><div><div className="lifecycle-meta"><small>{stage.subtitle}</small><b>{stageStatus(stage.id)}</b></div><h3>{stage.title}</h3><p>{stage.personality}</p>{stage.id === stageForProfile && <div className="current-stage-data"><span><strong>{store.conversationCount || 0}</strong> 次认真对话</span><span><strong>{store.episodes.length}</strong> 次照护结果</span><span><strong>{store.sentGifts.length + store.receivedGifts.length}</strong> 份爱的传递</span></div>}</div></article>)}</div>;
}

function Report({ store, setStore, showMoment }) {
  const [filter, setFilter] = useState("all");
  const [shareDraft, setShareDraft] = useState(null);
  const [editingEpisode, setEditingEpisode] = useState(null);
  const effectCounts = {
    helped: store.episodes.filter((episode) => episode.effect === "helped").length,
    some: store.episodes.filter((episode) => episode.effect === "some").length,
    none: store.episodes.filter((episode) => episode.effect === "none").length,
  };
  const visibleEpisodes = filter === "all" ? store.episodes : store.episodes.filter((episode) => episode.effect === filter);
  const deleteEpisode = (episode) => {
    if (!window.confirm("只删除这一条照护记录，其他记录不受影响。继续吗？")) return;
    setStore((current) => ({ ...current, episodes: current.episodes.filter((item) => item.id !== episode.id) }));
    showMoment("care", "这条照护记录已经删除", "宝宝会尊重妳的纠正。妳的身体经验始终由妳控制。", 0);
  };
  const alreadyShared = (episode) => store.sentGifts.some((gift) => gift.episodeId === episode.id);
  const beginEpisodeEdit = (episode) => {
    setShareDraft(null);
    setEditingEpisode({
      id: episode.id,
      rawText: episode.rawText || "",
      symptoms: episode.symptoms || "",
      bodyLocations: episode.bodyLocations || "",
      onset: episode.onset || "",
      functionalImpact: episode.functionalImpact || "",
      differenceFromUsual: episode.differenceFromUsual || "",
      currentConstraint: episode.currentConstraint || "",
      cycleContext: episode.cycleContext || "",
      actionTitle: episode.actionTitle || "",
      effect: episode.effect || "some",
    });
  };
  const saveEpisodeEdit = (event) => {
    event.preventDefault();
    if (!editingEpisode?.rawText.trim()) return;
    const confirmedText = [editingEpisode.rawText, editingEpisode.symptoms, editingEpisode.functionalImpact, editingEpisode.currentConstraint].filter(Boolean).join("；");
    const confirmedAnalysis = analyzeInput(confirmedText);
    const optionalFields = ["cycleContext", "symptoms", "bodyLocations", "onset", "functionalImpact", "differenceFromUsual", "currentConstraint"];
    setStore((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => episode.id === editingEpisode.id ? {
        ...episode,
        rawText: editingEpisode.rawText.trim(),
        tags: confirmedAnalysis.tags,
        tagSource: "derived_from_user_corrected_text",
        symptoms: editingEpisode.symptoms.trim(),
        bodyLocations: editingEpisode.bodyLocations.trim(),
        onset: editingEpisode.onset.trim(),
        functionalImpact: editingEpisode.functionalImpact.trim(),
        differenceFromUsual: editingEpisode.differenceFromUsual.trim(),
        currentConstraint: editingEpisode.currentConstraint.trim(),
        cycleContext: editingEpisode.cycleContext.trim(),
        actionTitle: editingEpisode.actionTitle.trim() || episode.actionTitle,
        effect: editingEpisode.effect,
        bodyState: confirmedBodyState(editingEpisode),
        updatedAt: new Date().toISOString(),
        provenance: {
          ...(episode.provenance || {}),
          situation: "user_corrected_after_save",
          optionalFields: "user_corrected_or_not_recorded",
          outcome: "user_corrected_feedback",
        },
        missingness: Object.fromEntries(optionalFields.map((key) => [key, editingEpisode[key]?.trim() ? "recorded" : "not_recorded"])),
      } : episode),
    }));
    setEditingEpisode(null);
    showMoment("care", "宝宝记住了妳的纠正", "旧的内容已经被替换。下一次回忆和行动排序会读取妳刚刚确认的新版本。", 0);
  };
  const confirmShare = () => {
    if (!shareDraft || alreadyShared(shareDraft)) return;
    const titleByEffect = { helped: "很有帮助礼物卡", some: "有一点帮助礼物卡", none: "避雷卡" };
    const letter = { id: `letter-${Date.now()}`, episodeId: shareDraft.id, title: `${titleByEffect[shareDraft.effect]} · ${shareDraft.actionTitle}`, effect: shareDraft.effect, anonymous: true, sentAt: new Date().toISOString() };
    setStore((current) => ({ ...current, sentGifts: [letter, ...current.sentGifts], growth: current.growth + 2, babyState: "voyaging" }));
    setShareDraft(null);
    showMoment("send", "宝宝把妳的经验认真包好了", `它送出了一张${titleByEffect[shareDraft.effect]}。另一只宝宝会看见当时的处境、做过什么和真实结果，也会看见适用边界。`, 1);
  };
  const effectLabel = (effect) => effect === "helped" ? "很有帮助" : effect === "some" ? "有一点帮助" : "没有帮助或更不舒服";
  return <div className="report-panel">
    <section className="report-hero"><p className="eyebrow">妳和宝宝共同确认过的真实结果</p><h2>{store.episodes.length ? `已经完成 ${store.episodes.length} 次自我照护行动` : "第一条照护记录会从真实反馈开始"}</h2><div className="report-stats"><div><strong>{effectCounts.helped}</strong><small>很有帮助</small></div><div><strong>{effectCounts.some}</strong><small>有一点帮助</small></div><div><strong>{effectCounts.none}</strong><small>没有帮助</small></div></div></section>
    {editingEpisode && <form className="record-edit-card" onSubmit={saveEpisodeEdit}><div className="record-edit-heading"><div><p className="eyebrow">这份身体经验始终由妳决定</p><h3>修改这一条照护记录</h3></div><button type="button" aria-label="关闭记录修改" onClick={() => setEditingEpisode(null)}><X /></button></div><label>当时发生了什么<textarea rows="3" value={editingEpisode.rawText} onChange={(event) => setEditingEpisode((current) => ({ ...current, rawText: event.target.value }))} /></label><div className="record-edit-grid"><label>身体感受<input value={editingEpisode.symptoms} onChange={(event) => setEditingEpisode((current) => ({ ...current, symptoms: event.target.value }))} placeholder="没有记录" /></label><label>身体位置<input value={editingEpisode.bodyLocations} onChange={(event) => setEditingEpisode((current) => ({ ...current, bodyLocations: event.target.value }))} placeholder="没有记录" /></label><label>影响了什么<input value={editingEpisode.functionalImpact} onChange={(event) => setEditingEpisode((current) => ({ ...current, functionalImpact: event.target.value }))} placeholder="没有记录" /></label><label>现实限制<input value={editingEpisode.currentConstraint} onChange={(event) => setEditingEpisode((current) => ({ ...current, currentConstraint: event.target.value }))} placeholder="没有记录" /></label><label>什么时候开始<input value={editingEpisode.onset} onChange={(event) => setEditingEpisode((current) => ({ ...current, onset: event.target.value }))} placeholder="没有记录" /></label><label>和以往有什么不同<input value={editingEpisode.differenceFromUsual} onChange={(event) => setEditingEpisode((current) => ({ ...current, differenceFromUsual: event.target.value }))} placeholder="不知道也可以留空" /></label></div><label>做了什么<input value={editingEpisode.actionTitle} onChange={(event) => setEditingEpisode((current) => ({ ...current, actionTitle: event.target.value }))} /></label><fieldset><legend>真实结果</legend><div className="edit-effect-options"><button type="button" className={editingEpisode.effect === "helped" ? "active" : ""} onClick={() => setEditingEpisode((current) => ({ ...current, effect: "helped" }))}>很有帮助</button><button type="button" className={editingEpisode.effect === "some" ? "active" : ""} onClick={() => setEditingEpisode((current) => ({ ...current, effect: "some" }))}>有一点帮助</button><button type="button" className={editingEpisode.effect === "none" ? "active" : ""} onClick={() => setEditingEpisode((current) => ({ ...current, effect: "none" }))}>没有帮助 / 更不舒服</button></div></fieldset>{alreadyShared(editingEpisode) && <p className="shared-snapshot-note"><Lock /> 已经送出的礼物卡是当时单独确认的匿名快照，不会跟着这次修改自动变化。</p>}<button className="primary-button" type="submit" disabled={!editingEpisode.rawText.trim()}>保存妳的纠正</button><button className="secondary-button" type="button" onClick={() => setEditingEpisode(null)}>取消</button></form>}
    {shareDraft && <section className="share-record-card"><div className="share-record-heading"><EnvelopeOpen /><div><small>{shareDraft.effect === "helped" ? "很有帮助礼物卡" : shareDraft.effect === "some" ? "有一点帮助礼物卡" : "避雷卡"}</small><h3>让宝宝把这次经验包成礼物</h3></div><button aria-label="关闭分享确认" onClick={() => setShareDraft(null)}><X /></button></div><div className="share-preview"><span>当时</span><strong>{shareDraft.tags.join(" · ")}</strong><span>做了</span><strong>{shareDraft.actionTitle}</strong><span>反馈</span><strong>{effectLabel(shareDraft.effect)}</strong></div><div className="boundary-note"><Lock /> 只包含上面三项，不包含妳的原话、姓名、日期或完整周期档案。本次授权只适用于这一张卡。</div><button className="primary-button" onClick={confirmShare}><PaperPlaneTilt /> 确认派宝宝送出</button><button className="secondary-button" onClick={() => setShareDraft(null)}>先留在我的记录里</button></section>}
    <section className="factor-card care-records-card"><div className="care-records-title"><div><h3>在自己的经验里学习</h3><p>按结果回看当时发生了什么、妳做了什么，以及身体怎样回应。</p></div><span>{visibleEpisodes.length} 条</span></div><div className="effect-filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部 {store.episodes.length}</button><button className={filter === "helped" ? "active" : ""} onClick={() => setFilter("helped")}>很有帮助 {effectCounts.helped}</button><button className={filter === "some" ? "active" : ""} onClick={() => setFilter("some")}>有一点 {effectCounts.some}</button><button className={filter === "none" ? "active" : ""} onClick={() => setFilter("none")}>没有帮助 {effectCounts.none}</button></div>{visibleEpisodes.length ? visibleEpisodes.map((episode) => <article className="episode-row episode-story" key={episode.id}><span className={`effect-dot ${episode.effect}`} /><div><strong>{effectLabel(episode.effect)}</strong><dl><dt>当时</dt><dd>{episode.rawText || episode.tags.join(" · ") || "没有记录"}</dd>{episode.symptoms && <><dt>身体</dt><dd>{episode.symptoms}</dd></>}<dt>做了</dt><dd>{episode.actionTitle}</dd><dt>反馈</dt><dd>{effectLabel(episode.effect)}</dd></dl><em>{new Date(episode.createdAt).toLocaleString("zh-CN")}</em></div><div className="episode-actions"><button aria-label="修改这一条照护记录" onClick={() => beginEpisodeEdit(episode)}><PencilSimple /></button><button className={alreadyShared(episode) ? "shared" : ""} disabled={alreadyShared(episode)} aria-label={alreadyShared(episode) ? "这条记录已经做成礼物卡" : "把这条记录做成礼物卡"} onClick={() => setShareDraft(episode)}>{alreadyShared(episode) ? <Check /> : <Gift />}</button><button aria-label="删除这一条照护记录" onClick={() => deleteEpisode(episode)}><Trash /></button></div></article>) : <p>{store.episodes.length ? "这个分类里还没有记录。" : "还没有真实反馈。去小窝和宝宝说说此刻发生了什么，它会陪妳完成第一次照护闭环。"}</p>}</section>
  </div>;
}

function BottomNav({ screen, setScreen }) {
  return <nav className="bottom-nav">{NAV_ITEMS.map(([id, label, Icon]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}><Icon weight={screen === id ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>;
}

function BabyMoment({ type, title, copy, onClose }) {
  const visual = type === "seed" ? ["/assets/lifecycle/moon-seed.png", "月之种子的互动反馈"] : type === "phoenix" ? ["/assets/lifecycle/blood-moon-phoenix.png", "血月凤凰的互动反馈"] : ["/assets/moon-sea-hero.png", "月经宝宝的互动反馈"];
  return <div className="moment-backdrop" onClick={onClose}><section className={`baby-moment moment-${type}`} onClick={(e) => e.stopPropagation()}><button className="icon-button" aria-label="关闭互动反馈" onClick={onClose}><X /></button><div className="moment-baby"><img src={visual[0]} alt={visual[1]} /><span className="moment-ring ring-one" /><span className="moment-ring ring-two" /></div><p className="eyebrow">关系正在发生变化</p><h2>{title}</h2><p>{copy}</p><button className="primary-button" onClick={onClose}>我看见了</button></section></div>;
}

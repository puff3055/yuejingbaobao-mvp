import { useEffect, useMemo, useState } from 'react'

const SOURCES = {
  S02: {
    id: 'S02',
    title: 'The Normal Menstrual Cycle and the Control of Ovulation',
    publisher: 'Endotext / NCBI Bookshelf',
    year: '2018 更新',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK279054/',
  },
  S03: {
    id: 'S03',
    title: 'Menstrual cycle phase misclassification and hormone-confirmed phases',
    publisher: 'Psychoneuroendocrinology',
    year: '2023',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10714354/',
  },
  S04: {
    id: 'S04',
    title: 'Real-world menstrual cycle characteristics of more than 600,000 cycles',
    publisher: 'npj Digital Medicine',
    year: '2019',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244/',
  },
  S05: {
    id: 'S05',
    title: 'The menstrual cycle and sleep',
    publisher: 'Sleep Medicine Clinics',
    year: '2023 / 2024',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38501513/',
  },
  S06: {
    id: 'S06',
    title: 'Hormone-verified menstrual cycle phases and mood in healthy young women',
    publisher: 'Psychological Medicine',
    year: '2025',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40976232/',
  },
  S07: {
    id: 'S07',
    title: 'The effects of menstrual cycle phase on exercise performance',
    publisher: 'Sports Medicine',
    year: '2020',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7497427/',
  },
  S08: {
    id: 'S08',
    title: 'Daily, weekly, seasonal and menstrual cycles in women’s mood and behaviour',
    publisher: 'Nature Human Behaviour',
    year: '2021',
    url: 'https://www.nature.com/articles/s41562-020-01046-9',
  },
  S09: {
    id: 'S09',
    title: 'Wearable-derived temperature, heart rate and sleep across the cycle',
    publisher: 'Journal of Sleep Research',
    year: '2024',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11416332/',
  },
  S10: {
    id: 'S10',
    title: 'Menstrual-related symptoms: a systematic review',
    publisher: 'BMC Women’s Health',
    year: '2023',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9819475/',
  },
  S11: {
    id: 'S11',
    title: 'Biologic Markers of Nonconceptive Menstrual Cycles',
    publisher: 'NCBI Bookshelf',
    year: '1991',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK218918/',
  },
  S12: {
    id: 'S12',
    title: 'ISPMD consensus on premenstrual disorders',
    publisher: 'Archives of Women’s Mental Health',
    year: '2013',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3955202/',
  },
  S13: {
    id: 'S13',
    title: 'Endometrial breakdown, repair and regeneration',
    publisher: 'Frontiers in Reproductive Health',
    year: '2022',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9580638/',
  },
  S14: {
    id: 'S14',
    title: 'Cervicovaginal mucus barrier and menstrual-cycle influences',
    publisher: 'Frontiers in Cellular and Infection Microbiology',
    year: '2020',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7663572/',
  },
  S15: {
    id: 'S15',
    title: 'Endometriosis: diagnosis and management',
    publisher: 'NICE NG73',
    year: '持续更新',
    url: 'https://www.nice.org.uk/guidance/ng73/chapter/recommendations',
  },
}

const CLIMATE_ITEMS = [
  {
    key: 'temperature',
    label: '体温',
    evidence: '机制较明确',
    tone: 'warm',
    summary: '排卵后通常相对上移',
    detail: '孕酮具有产热作用，典型排卵周期中基础体温或夜间皮温在排卵后可相对上移；单次升高不能确认排卵。',
    limit: '疾病、饮酒、熬夜、测量时间和设备都会影响个人读数。',
    sourceIds: ['S02', 'S11', 'S03'],
    sourceType: '研究参考',
  },
  {
    key: 'sleep',
    label: '睡眠',
    evidence: '条件性',
    tone: 'mist',
    summary: '不是人人都有固定曲线',
    detail: '有 PMS 或痛经的人更常在经前或月经附近报告睡眠变差；无明显症状的人，客观睡眠连续性变化可能很小。',
    limit: '不能仅凭周期日推断某个人今晚睡得好不好。',
    sourceIds: ['S05', 'S08', 'S09'],
    sourceType: '研究参考',
  },
  {
    key: 'pain',
    label: '疼痛 / 不适',
    evidence: '条件性',
    tone: 'ripple',
    summary: '痛经者更常在月经开始附近报告',
    detail: '疼痛发生和强度差异很大。对有痛经的人，症状起始更常集中在月经开始附近。',
    limit: '持续、加重或影响日常生活的疼痛不应被“正常周期”解释掉。',
    sourceIds: ['S10', 'S15'],
    sourceType: '研究参考',
  },
  {
    key: 'energy',
    label: '精力',
    evidence: '证据有限',
    tone: 'neutral',
    summary: '没有可靠的通用高低峰',
    detail: '群体研究不支持把某个阶段直接翻译成人人适用的“高效期”或“低能期”。',
    limit: '工作、训练和休息建议应优先依据个人感受、恢复、症状和生活情境。',
    sourceIds: ['S07', 'S08'],
    sourceType: '研究参考',
  },
  {
    key: 'mood',
    label: '心情',
    evidence: '分人群',
    tone: 'cloud',
    summary: '健康人群没有固定阶段人格',
    detail: '激素验证研究未发现健康年轻女性的心情或总体幸福感随阶段系统变化；部分 PMS/PMDD 人群经前可能更敏感。',
    limit: '不能把烦躁、脆弱或低落自动归因于周期，更不能据此评价性格。',
    sourceIds: ['S06', 'S08', 'S12'],
    sourceType: '研究参考',
  },
]

const PERSONAL_TRACKS = [
  {
    key: 'sleep',
    name: '睡眠',
    basis: '设备 8 晚 + 自报 10 天',
    scale: '越高 = 主观恢复越好',
    values: [2, 2, 1, 2, 3, null, 3, 3, 4, 3, 3, null, 4, 3, 3, 3, 2, null, 2, 3, 3, 2, null, 2, 2, null, 1, 2, null, null],
    today: 'D24 演示记录：睡眠 6 小时 40 分；主观恢复一般。',
    observation: '过去 3 个周期中有 2 次在月经前 2–4 天记录睡眠较差；晚睡也同时出现，尚不能归因为周期。',
  },
  {
    key: 'pain',
    name: '疼痛 / 不适',
    basis: '自报 16 天',
    scale: '越高 = 越明显',
    values: [4, 3, 2, 1, 1, null, 0, 0, 0, 0, null, 0, 1, 1, 0, 0, null, 0, 0, 1, 0, null, 0, null, 1, 1, 1, 2, null, null],
    today: 'D24 无记录；页面保留缺口，不自动补成“轻微疼痛”。',
    observation: '经期首两日的腹部疼痛在 3 个周期中重复出现；是否影响日常仍需继续记录。',
  },
  {
    key: 'energy',
    name: '精力',
    basis: '自报 15 天',
    scale: '越高 = 主观精力越充足',
    values: [1, 1, 2, 2, null, 3, 3, 2, 3, 4, null, 3, 3, 2, 3, null, 3, 2, 2, 3, 2, null, 2, 2, 2, 1, null, 1, null, null],
    today: 'D24 演示记录：精力 2/4；当天工作压力偏高。',
    observation: '记录不足以形成稳定阶段规律；目前更明显的共同背景是睡眠不足和高压力日。',
  },
  {
    key: 'mood',
    name: '心情',
    basis: '自报 14 天',
    scale: '高度只代表当日主观强度，不代表好坏',
    values: [3, 2, 2, null, 2, 3, 2, 2, 3, null, 2, 3, 2, 3, 2, null, 2, 2, 3, 2, null, 3, 2, 2, 2, 3, null, 3, null, null],
    today: 'D24 演示记录：词语“有点敏感”；同时记录到沟通冲突。',
    observation: '暂未观察到只在某个周期阶段重复出现的心情模式。',
  },
]

const STAGE_LABELS = {
  ovary: [
    ['多枚卵泡开始发育', 9],
    ['优势卵泡继续生长', 31],
    ['排卵事件', 51],
    ['黄体形成并发挥作用', 70],
    ['未妊娠时逐渐退化', 91],
  ],
  endometrium: [
    ['功能层脱落与出血', 10],
    ['脱落同时开始修复', 30],
    ['增殖与逐渐增厚', 51],
    ['分泌性改变', 72],
    ['进入下一周期', 92],
  ],
  mucus: [
    ['经后通常较少、较黏', 15],
    ['接近排卵可更清滑、易拉丝', 50],
    ['排卵后通常重新变稠、减少', 83],
  ],
}

function getCycleState(day, cycleLength, ovulationDay) {
  const ovary = day < ovulationDay - 4
    ? '多枚卵泡募集并发育'
    : day < ovulationDay - 1
      ? '优势卵泡继续生长'
      : day <= ovulationDay + 1
        ? '排卵事件的估计窗口'
        : day < cycleLength - 4
          ? '黄体形成并发挥作用'
          : '未妊娠时，黄体逐渐退化'

  const endometrium = day <= 5
    ? '功能层脱落、出血，同时开始表面修复'
    : day <= ovulationDay
      ? '内膜处于增殖与逐渐增厚的教学阶段'
      : day < cycleLength - 2
        ? '内膜出现分泌性改变'
        : '激素撤退后，准备进入下一次月经'

  const mucus = day <= 5
    ? '经血会遮盖宫颈黏液的观察'
    : day < ovulationDay - 3
      ? '通常较少、较黏'
      : day <= ovulationDay + 1
        ? '可更清、更滑、更易拉丝'
        : '通常重新变稠并减少'

  return { ovary, endometrium, mucus }
}

export function CyclePanoramaV2({ onBack, onOpenV1 }) {
  const [day, setDay] = useState(24)
  const [cycleLength, setCycleLength] = useState(30)
  const [mode, setMode] = useState('reference')
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [mechanismOpen, setMechanismOpen] = useState(false)
  const [expandedTrack, setExpandedTrack] = useState('')
  const [modelNotice, setModelNotice] = useState(false)

  const ovulationDay = Math.max(11, cycleLength - 14)
  const ovulationStart = Math.max(1, ovulationDay - 2)
  const ovulationEnd = Math.min(cycleLength, ovulationDay + 2)
  const dayPercent = cycleLength > 1 ? ((day - 1) / (cycleLength - 1)) * 100 : 0
  const menstruationPercent = (Math.min(5, cycleLength) / cycleLength) * 100
  const preOvulationPercent = ((ovulationStart - 1) / cycleLength) * 100
  const ovulationPercent = ((ovulationEnd - ovulationStart + 1) / cycleLength) * 100
  const lutealPercent = Math.max(0, 100 - preOvulationPercent - ovulationPercent)
  const cycleState = useMemo(
    () => getCycleState(day, cycleLength, ovulationDay),
    [day, cycleLength, ovulationDay],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedInfo(null)
        setMechanismOpen(false)
        setModelNotice(false)
      }
      if (event.key === 'ArrowLeft' && !selectedInfo && !mechanismOpen) {
        setDay((current) => Math.max(1, current - 1))
      }
      if (event.key === 'ArrowRight' && !selectedInfo && !mechanismOpen) {
        setDay((current) => Math.min(cycleLength, current + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cycleLength, mechanismOpen, selectedInfo])

  const selectStage = (title, detail, sourceIds, limit) => {
    setSelectedInfo({
      title,
      detail,
      sourceIds,
      limit,
      evidence: '教学模型',
      sourceType: '典型自然排卵周期教学示意',
    })
  }

  const changeCycleLength = (event) => {
    const next = Number(event.target.value)
    setCycleLength(next)
    setDay((current) => Math.min(current, next))
  }

  return (
    <section
      className="cycle-v2-shell"
      style={{
        '--day-position': `${dayPercent}%`,
        '--menstruation-width': `${menstruationPercent}%`,
        '--pre-ovulation-width': `${preOvulationPercent}%`,
        '--ovulation-width': `${ovulationPercent}%`,
        '--luteal-width': `${lutealPercent}%`,
      }}
    >
      <aside className="cycle-v2-rail" aria-label="周期全景图导航">
        <div className="cycle-v2-brand">
          <img src="/assets/moon-creature.png" alt="月海灵兽" />
          <b>月经宇宙</b>
          <small>CYCLE ATLAS</small>
        </div>
        <nav>
          <button type="button" onClick={onBack}>返回小窝</button>
          <button type="button" className="active">周期全景图</button>
          <button type="button" onClick={onOpenV1}>查看 1.0</button>
        </nav>
        <div className="cycle-v2-rail-note">
          <span>2.0</span>
          <p>先看典型模型，再加入自己的真实记录。</p>
        </div>
      </aside>

      <div className="cycle-v2-content">
        <header className="cycle-v2-header">
          <div>
            <p>一张图，看见同一天身体里的协作</p>
            <h1>周期全景图</h1>
          </div>
          <div className="cycle-v2-header-actions">
            <button type="button" onClick={() => setModelNotice(true)}>这个模型适合我吗？</button>
            <button type="button" className="mechanism-button" onClick={() => setMechanismOpen(true)}>为什么会联动</button>
          </div>
        </header>

        <section className="cycle-v2-timeline" aria-label="周期时间导航">
          <div className="timeline-meta">
            <span className="model-tag">教学示意</span>
            <p>典型自然排卵周期 · 周期长度和排卵时点会变化</p>
            <label>
              示例周期
              <select value={cycleLength} onChange={changeCycleLength} aria-label="选择教学示例周期长度">
                {[26, 28, 30, 32].map((length) => <option key={length} value={length}>{length} 天</option>)}
              </select>
            </label>
          </div>

          <div className="timeline-scale">
            <div className="timeline-days" aria-hidden="true">
              {[1, 5, 10, 15, 20, 25, cycleLength].filter((value, index, list) => value <= cycleLength && list.indexOf(value) === index).map((value) => (
                <span key={value} style={{ left: `${((value - 1) / (cycleLength - 1)) * 100}%` }}>D{value}</span>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max={cycleLength}
              value={day}
              onChange={(event) => setDay(Number(event.target.value))}
              aria-label={`教学日 D${day}，拖动查看同一天的身体变化`}
            />
            <output className="timeline-current">教学日 D{day}</output>
          </div>

          <div className="phase-bands">
            <div className="phase-row">
              <span className="phase-name">卵巢周期</span>
              <div className="phase-track ovarian-track">
                <span className="phase follicular">卵泡期</span>
                <span className="phase ovulation">排卵事件的估计窗口</span>
                <span className="phase luteal">黄体期</span>
              </div>
            </div>
            <div className="phase-row">
              <span className="phase-name">子宫内膜周期</span>
              <div className="phase-track uterine-track">
                <span className="phase menses">月经 / 脱落</span>
                <span className="phase proliferative">增殖期</span>
                <span className="phase secretory">分泌期</span>
              </div>
            </div>
            <p className="overlap-note">月经窗口与卵泡期重叠；它们来自两套同步但不同的周期命名。</p>
          </div>
        </section>

        <div className="cycle-v2-body">
          <main className="cycle-v2-main">
            <section className="panorama-scene" aria-label="周期生理变化的连续教学景观">
              <div className="today-beam" aria-hidden="true"><i /><span>D{day}</span></div>

              <div className="panorama-layer signal-layer">
                <div className="layer-heading">
                  <span>上游协调信号</span>
                  <button type="button" onClick={() => setMechanismOpen(true)}>展开 FSH、LH、雌二醇与孕酮</button>
                </div>
                <img src="/assets/cycle-v2/signal-streams.png" alt="抽象光流表现上游激素信号的协调，不代表个人实测数值" />
              </div>

              <div className="panorama-layer ovary-layer">
                <div className="layer-heading">
                  <span>卵巢变化</span>
                  <button type="button" onClick={() => selectStage('卵巢周期', '卵泡募集与发育、优势卵泡、排卵事件、黄体形成与退化，是典型自然排卵周期中的相对顺序。', ['S02'], '页面不会根据日期生成你的真实卵泡大小或确认排卵。')}>教学模型 · 查看来源</button>
                </div>
                <img src="/assets/cycle-v2/ovary-sequence.png" alt="卵泡发育、排卵、黄体形成与退化的连续医学教学插画" />
                <StageLabels
                  labels={STAGE_LABELS.ovary}
                  onSelect={(label) => selectStage(label, '这是典型自然排卵周期中的相对事件顺序，时间位置只是可调教学例子。', ['S02', 'S03', 'S04'], '排卵时点会变化，日历法不能可靠确认你的真实阶段。')}
                />
              </div>

              <div className="panorama-layer endometrium-layer">
                <div className="layer-heading">
                  <span>子宫内膜</span>
                  <button type="button" onClick={() => selectStage('子宫内膜周期', '内膜的脱落、修复、增殖和分泌性改变与卵巢激素环境同步变化。', ['S02', 'S13'], '月经早期的脱落与表面修复并非完全前后分离，可在相邻区域同时发生。')}>教学模型 · 查看来源</button>
                </div>
                <img src="/assets/cycle-v2/endometrium-sequence.png" alt="子宫内膜从脱落和修复，到增殖、分泌性改变的连续组织切面教学插画" />
                <StageLabels
                  labels={STAGE_LABELS.endometrium}
                  onSelect={(label) => selectStage(label, '内膜变化是典型教学模型，不是你的实时子宫影像。', ['S02', 'S13'], '内膜厚度和形态不能仅由周期日推断。')}
                />
              </div>

              <div className="panorama-layer mucus-layer">
                <div className="layer-heading">
                  <span>宫颈黏液 / 可观察分泌物</span>
                  <button type="button" onClick={() => selectStage('宫颈黏液', '在典型自然周期中，接近排卵时宫颈黏液可更清、更滑、更易拉丝；排卵后通常重新变稠并减少。', ['S02', 'S14'], '用户看到的分泌物不全等于宫颈黏液；感染、避孕、哺乳等也会影响。')}>教学模型 · 查看来源</button>
                </div>
                <img src="/assets/cycle-v2/mucus-sequence.png" alt="宫颈黏液从较少较黏，到接近排卵更清滑，再到排卵后变稠减少的教学插画" />
                <StageLabels
                  labels={STAGE_LABELS.mucus}
                  onSelect={(label) => selectStage(label, '这是宫颈黏液的典型趋势，用于理解身体可观察现象。', ['S02', 'S14'], '异常气味、瘙痒、颜色或疼痛不能仅用周期解释。')}
                />
                <p className="mucus-footnote">分泌物不全等于宫颈黏液；异常气味、瘙痒、颜色或疼痛不能仅用周期解释。</p>
              </div>
            </section>

            <section className={`experience-climate ${mode}`}>
              <div className="experience-heading">
                <div>
                  <span>身体体验气候</span>
                  <p>{mode === 'reference' ? '研究只支持到哪里，就只画到哪里' : '只显示用户自己留下的记录与缺口'}</p>
                </div>
                <div className="mode-switch" role="group" aria-label="切换身体体验数据视图">
                  <button type="button" className={mode === 'reference' ? 'active' : ''} onClick={() => setMode('reference')}>研究参考</button>
                  <button type="button" className={mode === 'personal' ? 'active' : ''} onClick={() => setMode('personal')}>我的节律</button>
                </div>
              </div>

              {mode === 'reference' ? (
                <div className="climate-reference">
                  <img src="/assets/cycle-v2/climate-strip.png" alt="体温、睡眠、疼痛、精力、心情五种证据气候的抽象教学插画" />
                  <div className="climate-zones">
                    {CLIMATE_ITEMS.map((item) => (
                      <button key={item.key} type="button" onClick={() => setSelectedInfo(item)}>
                        <span>{item.label}</span>
                        <b>{item.summary}</b>
                        <small>{item.evidence} · 查看依据</small>
                      </button>
                    ))}
                  </div>
                  <p className="climate-boundary">这里不是五条“所有女性都会这样”的标准曲线。精力和心情尤其不应被阶段决定。</p>
                </div>
              ) : (
                <PersonalTracks
                  cycleLength={cycleLength}
                  day={day}
                  expandedTrack={expandedTrack}
                  setExpandedTrack={setExpandedTrack}
                  onSource={() => setSelectedInfo({
                    title: '个人节律的解释边界',
                    detail: '演示轨道把设备、自报、缺失与 Agent 候选观察分开。只有跨周期重复、样本量和反例都可见时，系统才提出“可能重复”。',
                    sourceIds: ['S03', 'S12'],
                    limit: '这组数据是原型演示记录，不是当前用户的真实健康数据，也不构成诊断。',
                    evidence: '演示记录',
                    sourceType: '自报 / 设备 / 候选推断',
                  })}
                />
              )}
            </section>
          </main>

          <aside className="current-point" aria-label={`教学日 D${day} 的解释`}>
            <div className="current-point-head">
              <span>同一时间点</span>
              <strong>D{day}</strong>
              <p>位置估计 · 不是排卵确认</p>
            </div>
            <CurrentRow label="卵巢" value={cycleState.ovary} type="教学" onClick={() => selectStage('此时的卵巢', cycleState.ovary, ['S02', 'S03', 'S04'], '日期位置不能确认个人排卵或卵泡状态。')} />
            <CurrentRow label="内膜" value={cycleState.endometrium} type="教学" onClick={() => selectStage('此时的子宫内膜', cycleState.endometrium, ['S02', 'S13'], '这是教学模型，不是实时影像或内膜厚度测量。')} />
            <CurrentRow label="黏液" value={cycleState.mucus} type="教学" onClick={() => selectStage('此时的宫颈黏液', cycleState.mucus, ['S02', 'S14'], '实际分泌物受多种因素影响。')} />
            <CurrentRow
              label="体温"
              value={day > ovulationDay + 1 ? '典型模型中可相对上移' : '典型模型中相对较低'}
              type="研究"
              onClick={() => setSelectedInfo(CLIMATE_ITEMS[0])}
            />
            {mode === 'reference' ? (
              <div className="current-no-inference">
                <b>睡眠、疼痛、精力、心情</b>
                <p>不根据 D{day} 自动分配。切到“我的节律”查看真实记录。</p>
              </div>
            ) : (
              <div className="current-personal">
                <span>演示记录 · 3 个周期</span>
                {PERSONAL_TRACKS.map((track) => {
                  const value = track.values[day - 1]
                  return <p key={track.key}><b>{track.name}</b>{value == null ? '未记录' : `${value} / 4`}</p>
                })}
              </div>
            )}
            <div className="current-safety">
              <b>不要把一切都归因于周期</b>
              <p>持续、加重或影响生活的疼痛，以及异常出血或分泌物，值得寻求专业评估。</p>
              <button type="button" onClick={() => setSelectedInfo({
                title: '什么时候不能只看周期？',
                detail: '明显影响日常生活、持续或加重的疼痛，需要认真评估。异常出血、妊娠可能、发热、晕厥等也不应仅被解释为周期变化。',
                sourceIds: ['S15'],
                limit: '原型提供的是安全边界提示，不做诊断或排除诊断。',
                evidence: '临床安全边界',
                sourceType: '指南',
              })}>查看求助边界</button>
            </div>
          </aside>
        </div>
      </div>

      {selectedInfo && <SourceDrawer item={selectedInfo} onClose={() => setSelectedInfo(null)} />}
      {mechanismOpen && <MechanismDrawer onClose={() => setMechanismOpen(false)} onOpenSource={() => {
        setMechanismOpen(false)
        setSelectedInfo({
          title: '为什么这些层会联动？',
          detail: '下丘脑—垂体—卵巢轴通过 GnRH、FSH、LH 与卵巢产生的雌二醇、孕酮相互反馈，协调卵泡、排卵、黄体和内膜变化。',
          sourceIds: ['S02', 'S03'],
          limit: '展开图中的曲线按各自范围归一化，只表达相对时序，不能跨激素比较绝对数值，也不是个人化验结果。',
          evidence: '机制教学',
          sourceType: '教学模型',
        })
      }} />}
      {modelNotice && <ModelNotice onClose={() => setModelNotice(false)} />}
    </section>
  )
}

function StageLabels({ labels, onSelect }) {
  return (
    <div className="stage-labels">
      {labels.map(([label, position]) => (
        <button key={label} type="button" style={{ left: `${position}%` }} onClick={() => onSelect(label)}>{label}</button>
      ))}
    </div>
  )
}

function CurrentRow({ label, value, type, onClick }) {
  return (
    <button type="button" className="current-row" onClick={onClick}>
      <span>{label}<small>{type}</small></span>
      <b>{value}</b>
      <em>查看依据</em>
    </button>
  )
}

function PersonalTracks({ cycleLength, day, expandedTrack, setExpandedTrack, onSource }) {
  return (
    <div className="personal-tracks">
      <div className="personal-summary">
        <span>演示记录</span>
        <b>3 个周期 · 本周期记录 18 / {cycleLength} 天</b>
        <button type="button" onClick={onSource}>解释规则与来源</button>
      </div>
      {PERSONAL_TRACKS.map((track) => {
        const isExpanded = expandedTrack === track.key
        return (
          <article key={track.key} className={`personal-track ${isExpanded ? 'expanded' : ''}`}>
            <button type="button" className="track-toggle" onClick={() => setExpandedTrack(isExpanded ? '' : track.key)} aria-expanded={isExpanded}>
              <span><b>{track.name}</b><small>{track.basis}</small></span>
              <em>{isExpanded ? '收起记录' : '展开记录'}</em>
            </button>
            <div className="track-plot" style={{ '--track-days': cycleLength }} aria-label={`${track.name}的演示记录，缺失日保留空白`}>
              {Array.from({ length: cycleLength }, (_, index) => {
                const value = track.values[index]
                return (
                  <span
                    key={`${track.key}-${index}`}
                    className={`${value == null ? 'missing' : ''} ${day === index + 1 ? 'today' : ''}`}
                    style={{ '--value': value == null ? 0 : value }}
                    title={`D${index + 1}：${value == null ? '未记录' : `${value}/4`}`}
                  >
                    <i />
                  </span>
                )
              })}
            </div>
            <div className="track-scale"><span>D1</span><span>{track.scale}</span><span>D{cycleLength}</span></div>
            {isExpanded && (
              <div className="track-detail">
                <p><b>当前点</b>{track.today}</p>
                <p><b>Agent 候选观察</b>{track.observation}</p>
                <div><button type="button">这次与周期无关</button><button type="button">我不确定</button><button type="button">记录需要纠正</button></div>
              </div>
            )}
          </article>
        )
      })}
      <p className="personal-boundary">缺失日保持为空；一两个周期只能称“观察”，不能称为你的规律或诊断。</p>
    </div>
  )
}

function SourceDrawer({ item, onClose }) {
  const sourceIds = item.sourceIds || []
  return (
    <div className="cycle-v2-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="source-drawer" role="dialog" aria-modal="true" aria-labelledby="source-drawer-title">
        <div className="drawer-handle" />
        <button type="button" className="drawer-close" onClick={onClose}>关闭</button>
        <div className="drawer-kicker"><span>{item.sourceType || '研究参考'}</span><b>{item.evidence || '查看证据边界'}</b></div>
        <h2 id="source-drawer-title">{item.title || item.label}</h2>
        <p className="drawer-detail">{item.detail}</p>
        <div className="drawer-limit"><b>适用边界</b><p>{item.limit}</p></div>
        <div className="drawer-sources">
          <span>参考来源</span>
          {sourceIds.map((sourceId) => {
            const source = SOURCES[sourceId]
            if (!source) return null
            return (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                <small>{source.id} · {source.publisher} · {source.year}</small>
                <b>{source.title}</b>
                <em>打开原始来源</em>
              </a>
            )
          })}
        </div>
        <p className="drawer-disclaimer">本页用于健康教育与自我观察，不提供诊断、排卵确认或个体化医疗建议。</p>
      </aside>
    </div>
  )
}

function MechanismDrawer({ onClose, onOpenSource }) {
  return (
    <div className="cycle-v2-overlay mechanism-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="mechanism-drawer" role="dialog" aria-modal="true" aria-labelledby="mechanism-title">
        <button type="button" className="drawer-close" onClick={onClose}>关闭</button>
        <p className="mechanism-kicker">上游协调机制 · 教学展开</p>
        <h2 id="mechanism-title">为什么卵巢、内膜与黏液会在同一时间改变？</h2>
        <div className="mechanism-visual">
          <img src="/assets/cycle-v2/signal-streams.png" alt="下丘脑、垂体和卵巢信号相互反馈的抽象光流教学图" />
          <div className="mechanism-flow">
            <span>下丘脑</span><span>垂体 FSH / LH</span><span>卵巢</span><span>雌二醇 / 孕酮</span><span>内膜与黏液</span>
          </div>
        </div>
        <div className="mechanism-grid">
          <article><b>FSH</b><p>参与卵泡募集与发育。</p></article>
          <article><b>LH</b><p>排卵前出现显著升高，并参与黄体形成。</p></article>
          <article><b>雌二醇</b><p>与内膜增殖及排卵前黏液改变相关。</p></article>
          <article><b>孕酮</b><p>黄体期上升，与内膜分泌性改变和产热作用相关。</p></article>
        </div>
        <div className="mechanism-warning"><b>读图方式</b><p>这些不是共用单位的实测曲线。每种激素只能看自己的相对时序，不能比较彼此“谁更多”。</p></div>
        <button type="button" className="mechanism-source" onClick={onOpenSource}>查看机制来源与限制</button>
      </aside>
    </div>
  )
}

function ModelNotice({ onClose }) {
  return (
    <div className="cycle-v2-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="model-notice" role="dialog" aria-modal="true" aria-labelledby="model-notice-title">
        <button type="button" className="drawer-close" onClick={onClose}>关闭</button>
        <span>模型适用范围</span>
        <h2 id="model-notice-title">先确认：这是一张典型自然排卵周期教学图</h2>
        <p>它适合帮助理解事件顺序，不适合把 D24 直接当作你的卵巢、内膜、排卵或激素事实。</p>
        <ul>
          <li>激素避孕、无排卵、妊娠、产后或哺乳期时，这个模型可能不适用。</li>
          <li>青春期、围绝经期、周期明显不规律时，阶段和持续时间可能不同。</li>
          <li>只有你的真实记录、测量和临床信息，才能形成更可靠的个体视角。</li>
        </ul>
        <button type="button" className="mechanism-source" onClick={onClose}>理解，继续探索</button>
      </aside>
    </div>
  )
}

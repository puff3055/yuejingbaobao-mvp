import { useEffect, useMemo, useState } from 'react'

const phases = [
  {
    id: 'menstruation',
    name: '月经期',
    short: '月经期',
    start: 1,
    end: 5,
    duration: '本周期估计 5 天 · 常见约 2–7 天',
    image: '/assets/cycle/body-menstruation.png',
    accent: '#8a4b68',
    headline: '脱落、止血与修复正在交错发生',
    summary: '内膜功能层局部脱落，经液经宫颈排出；相邻区域已经开始重新覆盖。子宫肌层可能出现波浪式收缩。',
    signal: 'withdrawal',
  },
  {
    id: 'follicular',
    name: '卵泡期',
    short: '卵泡期',
    start: 6,
    end: 16,
    duration: '本周期估计 11 天 · 这一段最容易变化',
    image: '/assets/cycle/body-follicular.png',
    accent: '#8170aa',
    headline: '卵泡发育，内膜重新生长',
    summary: '多个卵泡开始发育，其中一个可能逐渐成为优势卵泡；内膜完成表面修复后继续增生。',
    signal: 'growth',
  },
  {
    id: 'ovulation',
    name: '排卵窗口',
    short: '排卵附近',
    start: 17,
    end: 18,
    duration: '本周期估计 D17–18 · 不是确认的排卵日',
    image: '/assets/cycle/body-ovulation.png',
    accent: '#b67d74',
    headline: '一次短暂的释放事件',
    summary: '典型模型中，成熟卵泡在信号脉冲后释放卵母细胞；宫颈黏液的含水量和流动性也可能改变。',
    signal: 'release',
  },
  {
    id: 'luteal',
    name: '黄体期',
    short: '黄体期',
    start: 19,
    end: 30,
    duration: '本周期估计 12 天 · 常见相对稳定但仍有差异',
    image: '/assets/cycle/body-luteal.png',
    accent: '#bf8c48',
    headline: '黄体形成，内膜进入分泌性状态',
    summary: '排卵后的卵泡结构转为黄体；内膜变得更厚、更具分泌性。若没有持续妊娠，黄体之后会逐渐退化。',
    signal: 'prepare',
  },
]

const focusOrder = ['ovary', 'endometrium', 'uterus', 'cervix', 'fluid']

const focusMeta = {
  ovary: { label: '卵巢事件', tag: '器官变化' },
  endometrium: { label: '子宫内膜', tag: '组织变化' },
  uterus: { label: '收缩与血管', tag: '运动与止血' },
  cervix: { label: '宫颈与黏液', tag: '可观察线索' },
  fluid: { label: '经液路径', tag: '排出过程' },
}

const focusCopy = {
  menstruation: {
    ovary: '新一轮卵泡募集已经开始，但日历不能告诉我们哪一枚会成为优势卵泡。',
    endometrium: '功能层并非一次性全部脱落；局部脱落时，相邻表面已经开始修复。',
    uterus: '螺旋小血管、局部止血与肌层收缩一起参与限制失血和排出经液。',
    cervix: '经液会经过宫颈管和阴道排出；宫颈、阴道与外阴是不同结构。',
    fluid: '经液不是“脏血”，还包含内膜来源的细胞、组织与局部分泌成分。',
  },
  follicular: {
    ovary: '多个卵泡发育，其中一个可能逐渐成为优势卵泡；卵泡期长短是周期差异的重要来源。',
    endometrium: '经期后的表面修复完成，内膜在信号作用下逐渐增生，但厚度不能由日期个人化推算。',
    uterus: '子宫并非静止容器，但这一阶段的运动模式不宜简化成每个人相同的固定动画。',
    cervix: '接近排卵时，典型模型中的宫颈黏液可能逐渐增加含水量，变得更清、更滑。',
    fluid: '通常没有月经出血；如果出现非经期出血，应按实际模式记录，不能直接归因于排卵。',
  },
  ovulation: {
    ovary: '成熟卵泡释放卵母细胞是短暂事件；排卵日不能只靠日历确认。',
    endometrium: '内膜仍处于增生后的完整状态，并不是在排卵时开始脱落。',
    uterus: '子宫运动会随周期变化，但方向和频率存在个体差异，画面只承担教学。',
    cervix: '宫颈黏液可能更清、更滑、更有延展性；用户看到的分泌物不全等于宫颈黏液。',
    fluid: '这里展示的是黏液状态变化，不是用分泌物单独确认生育窗口。',
  },
  luteal: {
    ovary: '排卵后的卵泡结构形成黄体；黄体不是另一枚卵泡，而是一个短期分泌结构。',
    endometrium: '内膜进入更厚、更具分泌性的状态；高低不是“身体好坏”的评分。',
    uterus: '若黄体随后退化，局部血管、炎症介质和组织反应会共同参与下一次月经启动。',
    cervix: '典型模型中的宫颈黏液可能更少、更黏稠，但避孕方式、感染和其他状态都会改变它。',
    fluid: '没有出血不等于可以确认排卵；出血本身也不能证明之前一定发生过排卵。',
  },
}

const signalCards = [
  { id: 'growth', label: '帮助卵泡发育', plain: 'FSH 信号', detail: '支持一组卵泡开始发育。' },
  { id: 'release', label: '触发释放事件', plain: 'LH 脉冲', detail: '典型模型中与排卵事件紧密相连。' },
  { id: 'estrogen', label: '促进组织生长', plain: '雌二醇信号', detail: '与内膜增生及黏液变化相关。' },
  { id: 'prepare', label: '进入分泌性状态', plain: '孕酮信号', detail: '主要来自排卵后形成的黄体。' },
  { id: 'withdrawal', label: '信号回落', plain: '月经启动条件', detail: '黄体退化后，内膜局部反应启动。' },
]

const referenceMetrics = [
  {
    id: 'temperature', label: '基础体温', unit: '相对变化', strength: '机制较稳定',
    note: '排卵后可能轻微升高；发热、睡眠与测量方式都会影响。',
    values: [20,22,20,18,19,20,22,21,23,24,25,25,26,27,28,28,32,42,58,61,64,66,65,64,63,62,60,57,45,28],
  },
  {
    id: 'sleep', label: '睡眠', unit: '可能受影响', strength: '条件相关',
    note: '在有 PMS 或痛经的人群中更值得留意，不是所有人的固定曲线。',
    values: [42,45,48,51,54,55,56,57,58,58,57,58,59,57,56,55,54,53,53,52,51,49,47,46,43,42,40,39,38,40],
  },
  {
    id: 'pain', label: '疼痛 / 不适', unit: '发生可能', strength: '部分人明显',
    note: '经期疼痛很常见但不是必须忍受；持续影响功能时值得求助。',
    values: [82,88,74,58,42,28,22,20,18,18,19,19,18,18,19,21,24,22,20,20,21,24,28,31,34,38,42,48,55,63],
  },
  {
    id: 'energy', label: '精力', unit: '没有统一模板', strength: '证据有限',
    note: '群体研究不能支持一条适用于所有人的阶段效率曲线。',
    values: [38,35,39,44,49,54,58,61,63,60,65,62,64,66,60,62,59,61,57,55,58,54,52,55,50,48,51,47,49,45],
  },
  {
    id: 'mood', label: '心情', unit: '没有固定人格', strength: '差异很大',
    note: '周期阶段不能自动生成情绪结论；疼痛、睡眠、压力和处境同样重要。',
    values: [51,46,55,50,58,49,56,60,53,61,57,64,55,59,52,62,54,58,56,49,57,52,60,47,55,43,50,45,54,48],
  },
]

const personalMetrics = [
  {
    id: 'temperature', label: '基础体温', unit: '3 个周期', strength: '18 次测量',
    note: '你在过去 3 个周期的后半段多次记录到轻微升高；这仍不是排卵确认。',
    values: [null,22,20,null,19,21,null,23,24,null,26,25,28,null,29,30,34,45,60,63,null,66,65,67,65,64,null,58,44,null],
  },
  {
    id: 'sleep', label: '睡眠', unit: '3 个周期', strength: '22 次记录',
    note: '你在最近 3 个周期的经前 4–5 天更常报告睡得浅。',
    values: [42,45,null,50,54,55,null,62,64,60,58,null,62,60,58,57,null,56,55,53,51,49,45,42,38,35,33,36,null,40],
  },
  {
    id: 'pain', label: '疼痛 / 不适', unit: '3 个周期', strength: '25 次记录',
    note: '明显疼痛集中在经期前 3 天；本周期 D24 记录为“轻微腹胀”。',
    values: [86,91,76,50,34,20,18,null,14,12,15,12,null,15,16,18,20,18,17,16,18,19,22,28,30,32,36,null,52,68],
  },
  {
    id: 'energy', label: '精力', unit: '3 个周期', strength: '19 次记录',
    note: '你在经期常主动减少安排；周期中段的精力记录较高，但仍受睡眠影响。',
    values: [30,28,34,null,45,52,58,64,68,null,72,70,69,74,71,66,null,63,60,58,55,53,50,46,44,null,40,38,36,34],
  },
  {
    id: 'mood', label: '心情平稳度', unit: '3 个周期', strength: '17 次记录',
    note: '你没有形成稳定的阶段情绪曲线；压力较高的几天比周期位置更能解释波动。',
    values: [48,null,52,58,55,60,null,62,59,65,63,null,61,64,58,60,null,57,55,52,60,54,58,46,51,null,44,49,47,52],
  },
]

function phaseForDay(day) {
  return phases.find((phase) => day >= phase.start && day <= phase.end) || phases[0]
}

export function CycleExplorer({ onBack }) {
  const [day, setDay] = useState(24)
  const [mode, setMode] = useState('personal')
  const [focus, setFocus] = useState('ovary')
  const [mechanismOpen, setMechanismOpen] = useState(false)
  const [microOpen, setMicroOpen] = useState(false)
  const phase = useMemo(() => phaseForDay(day), [day])
  const metrics = mode === 'reference' ? referenceMetrics : personalMetrics

  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') {
        setMicroOpen(false)
        setMechanismOpen(false)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  const currentSignalIds = phase.id === 'follicular'
    ? ['growth', 'estrogen']
    : phase.id === 'ovulation'
      ? ['release', 'estrogen']
      : [phase.signal]

  const choosePhase = (phaseId) => {
    const selected = phases.find((item) => item.id === phaseId)
    if (selected) setDay(Math.round((selected.start + selected.end) / 2))
  }

  return (
    <section className="cycle-screen">
      <header className="cycle-topbar">
        <button className="cycle-brand" onClick={onBack} aria-label="返回月经宝宝小窝">
          <span className="cycle-brand-mark">月</span>
          <span><b>月经宝宝</b><small>MENSTRUAL UNIVERSE</small></span>
        </button>
        <nav aria-label="主要导航">
          <button onClick={onBack}>小窝</button>
          <button className="selected">知识海</button>
          <button disabled>我的</button>
        </nav>
        <div className="cycle-account"><span>今天 D{day}</span><button onClick={onBack}>回到宝宝身边</button></div>
      </header>

      <div className="cycle-scroll">
        <div className="cycle-intro">
          <div>
            <p className="cycle-kicker">知识海 · 身体正在发生什么</p>
            <h1>周期身体切面</h1>
            <p>拖动时间，直接看见卵巢、子宫、宫颈与身体感受如何在同一周期里协调。</p>
          </div>
          <div className="cycle-summary">
            <span>本周期预计 30 天</span><i></i><span>近 3 次 29–32 天</span><i></i><b>今天 D{day} · 估计{phase.short}</b>
            <small>日期只能用于估计，不是你的实时扫描或排卵确认。</small>
          </div>
        </div>

        <section className="timeline-card" aria-label="周期时间轴">
          <div className="timeline-heading">
            <div><span>完整周期</span><b>D1 → 下次月经前</b></div>
            <div className="day-stepper">
              <button onClick={() => setDay((value) => Math.max(1, value - 1))} aria-label="前一天">前一天</button>
              <strong>D{day}</strong>
              <button onClick={() => setDay((value) => Math.min(30, value + 1))} aria-label="后一天">后一天</button>
            </div>
          </div>
          <input
            className="cycle-range"
            type="range"
            min="1"
            max="30"
            value={day}
            onChange={(event) => setDay(Number(event.target.value))}
            aria-label="选择周期第几天"
            style={{ '--cycle-progress': `${((day - 1) / 29) * 100}%`, '--cycle-accent': phase.accent }}
          />
          <div className="day-labels"><span>D1</span><span>D5</span><span>D10</span><span>D15</span><span>D20</span><span>D25</span><span>D30</span></div>
          <div className="phase-band">
            {phases.map((item) => (
              <button
                key={item.id}
                className={`${item.id} ${item.id === phase.id ? 'active' : ''}`}
                onClick={() => choosePhase(item.id)}
                aria-pressed={item.id === phase.id}
                style={{ flex: item.end - item.start + 1 }}
              >
                <b>{item.name}</b><small>D{item.start}–{item.end}</small>
              </button>
            ))}
          </div>
          <p className="phase-duration">{phase.duration}</p>
        </section>

        <section className="body-workbench">
          <aside className="phenomena-panel">
            <div className="panel-title"><span>看见身体</span><b>现象层</b></div>
            <p>先看身体发生了什么，再决定要不要理解背后的信号。</p>
            <div className="phenomena-list">
              {focusOrder.map((id, index) => (
                <button key={id} className={focus === id ? 'selected' : ''} onClick={() => setFocus(id)} aria-pressed={focus === id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span><b>{focusMeta[id].label}</b><small>{focusMeta[id].tag}</small></span>
                </button>
              ))}
            </div>
            <div className="model-key"><span>典型教学模型</span><p>器官画面不会伪装成你的个人实时状态。</p></div>
          </aside>

          <div className="anatomy-stage">
            <div className="anatomy-image-wrap">
              <img key={phase.id} className="anatomy-image" src={phase.image} alt={`${phase.name}的透明盆腔生理教学切面`} />
              <div className="anatomy-caption"><span>典型模型</span><b>{phase.name} · D{day}</b></div>
              <button className={`anatomy-hotspot hotspot-ovary ${focus === 'ovary' ? 'selected' : ''}`} onClick={() => setFocus('ovary')} aria-pressed={focus === 'ovary'}>卵巢</button>
              <button className={`anatomy-hotspot hotspot-endometrium ${focus === 'endometrium' ? 'selected' : ''}`} onClick={() => setFocus('endometrium')} aria-pressed={focus === 'endometrium'}>内膜</button>
              <button className={`anatomy-hotspot hotspot-uterus ${focus === 'uterus' ? 'selected' : ''}`} onClick={() => setFocus('uterus')} aria-pressed={focus === 'uterus'}>收缩与血管</button>
              <button className={`anatomy-hotspot hotspot-cervix ${focus === 'cervix' ? 'selected' : ''}`} onClick={() => setFocus('cervix')} aria-pressed={focus === 'cervix'}>宫颈</button>
            </div>
            <div className="anatomy-actions">
              <button className={mechanismOpen ? 'active' : ''} onClick={() => setMechanismOpen((value) => !value)} aria-expanded={mechanismOpen} aria-controls="cycle-mechanism-panel">
                {mechanismOpen ? '收起机制解释' : '为什么这些变化会联动？'}
              </button>
              <button onClick={() => setMicroOpen(true)}>放大内膜里的脱落与修复</button>
            </div>
          </div>

          <aside className="today-panel">
            <div className="today-label"><span>今天的估计位置</span><b>D{day}</b></div>
            <h2>{phase.headline}</h2>
            <p>{phase.summary}</p>
            <div className="focus-card">
              <small>{focusMeta[focus].label} · {focusMeta[focus].tag}</small>
              <b>{focusCopy[phase.id][focus]}</b>
              {focus === 'endometrium' && <button onClick={() => setMicroOpen(true)}>进入微观切面</button>}
            </div>
            <div className="today-boundary">
              <span>对你意味着什么</span>
              <p>{mode === 'personal' ? '内部器官仍是教学模型；下面只叠加你真实记录过的体温、睡眠与感受。' : '研究视图呈现群体范围，不代表“大部分女性”都一定如此。'}</p>
            </div>
          </aside>
        </section>

        {mechanismOpen && <section className="mechanism-panel" id="cycle-mechanism-panel">
          <div className="mechanism-heading">
            <div><span>解释层</span><h2>信号不是一条“好坏曲线”，而是器官之间的消息</h2></div>
            <button onClick={() => setMechanismOpen(false)}>关闭解释层</button>
          </div>
          <div className="signal-flow">
            {signalCards.map((card) => (
              <article key={card.id} className={currentSignalIds.includes(card.id) ? 'active' : ''}>
                <small>{card.label}</small><b>{card.plain}</b><p>{card.detail}</p>
              </article>
            ))}
          </div>
          <p className="signal-boundary">这里只解释“为什么身体会联动”。日期不能生成你的真实 FSH、LH、雌二醇或孕酮数值；高也不等于好，低也不等于差。</p>
        </section>}

        <section className="metrics-section">
          <div className="metrics-heading">
            <div><span>身体指标</span><h2>同一条时间轴，两种证据视角</h2><p>每个指标独占一行，才能看见它自己的完整周期趋势。</p></div>
            <div className="view-toggle" role="group" aria-label="选择指标数据来源">
              <button className={mode === 'reference' ? 'selected' : ''} onClick={() => setMode('reference')} aria-pressed={mode === 'reference'}>研究参考</button>
              <button className={mode === 'personal' ? 'selected' : ''} onClick={() => setMode('personal')} aria-pressed={mode === 'personal'}>我的节律</button>
            </div>
          </div>
          <div className="metrics-context">
            {mode === 'reference'
              ? <><b>研究参考</b><span>显示特定研究中的方向、范围和不确定性，不称作“大部分女性”。</span></>
              : <><b>我的节律 · 演示账户</b><span>来自 Agent 获得授权的 3 个周期、76 条自报或测量记录；缺失天数不会被补画。</span></>}
          </div>
          <div className="metric-table">
            <div className="metric-axis"><span></span><div><b>D1</b><b>D5</b><b>D10</b><b>D15</b><b>D20</b><b>D25</b><b>D30</b></div><span></span></div>
            {metrics.map((metric) => (
              <MetricRow key={metric.id} metric={metric} day={day} mode={mode} />
            ))}
          </div>
        </section>

        <section className="cycle-sources">
          <div><b>这张图回答什么？</b><p>身体在同一周期里可能发生什么，以及哪些是你真实记录过的体验。</p></div>
          <div><b>它不回答什么？</b><p>不确认排卵、不诊断疾病，也不根据阶段给你固定人格或效率指令。</p></div>
          <details>
            <summary>查看来源与表达边界</summary>
            <p>基础生理来自 Endotext、内膜生理与修复综述、宫颈黏液综述及动态 MRI 研究。第一版仍需妇产科与内分泌专业审阅。</p>
            <div><a href="https://www.ncbi.nlm.nih.gov/books/NBK279054/" target="_blank" rel="noreferrer">正常月经周期与排卵调节</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9098793/" target="_blank" rel="noreferrer">子宫出血与内膜生理</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6780040/" target="_blank" rel="noreferrer">非孕子宫动态 MRI</a></div>
          </details>
        </section>
      </div>

      {microOpen && <div className="micro-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMicroOpen(false) }}>
        <section className="micro-dialog" role="dialog" aria-modal="true" aria-labelledby="micro-title" aria-describedby="micro-summary">
          <div className="micro-image"><img src="/assets/cycle/endometrium-micro.png" alt="经期内膜局部脱落、螺旋血管与表面修复的微观教学图" /></div>
          <div className="micro-copy">
            <span>器官 → 微观切面</span>
            <h2 id="micro-title">出血时，修复也已经开始</h2>
            <p id="micro-summary">月经不是内膜被动地“流完”。不同区域可以同时经历脱落、局部止血和表面重新覆盖。</p>
            <ol>
              <li><b>局部脱落</b><small>主要是周期变化明显的功能层，不是整层子宫内膜全部剥离。</small></li>
              <li><b>血管与止血</b><small>螺旋小血管、血小板及凝血/纤溶平衡共同限制失血。</small></li>
              <li><b>重新覆盖</b><small>相邻区域仍在脱落时，表面再上皮化已经能够开始。</small></li>
            </ol>
            <button onClick={() => setMicroOpen(false)}>回到完整身体切面</button>
            <small>教学模型，不代表你的实时内膜状态或个人出血原因。</small>
          </div>
        </section>
      </div>}
    </section>
  )
}

function MetricRow({ metric, day, mode }) {
  return (
    <div className={`metric-row metric-${mode}`}>
      <div className="metric-name"><b>{metric.label}</b><span>{metric.unit}</span></div>
      <div className="metric-chart" aria-label={`${metric.label}的${mode === 'reference' ? '研究参考' : '个人记录'}趋势`}>
        {metric.values.map((value, index) => (
          <span
            key={`${metric.id}-${index}`}
            className={`${value == null ? 'missing' : ''} ${index + 1 === day ? 'today' : ''}`}
            style={{ '--metric-height': `${value == null ? 7 : value}%` }}
            title={`D${index + 1}${value == null ? '：未记录' : ''}`}
          />
        ))}
      </div>
      <div className="metric-note"><b>{metric.strength}</b><p>{metric.note}</p></div>
    </div>
  )
}

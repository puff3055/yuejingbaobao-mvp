import { useEffect, useState } from 'react'
import { CycleExplorer } from './CycleExplorer.jsx'
import { CyclePanoramaV2 } from './CyclePanoramaV2.jsx'
import './overrides.css'
import './baby-profile.css'
import './nest-chat.css'
import './navigation-fixes.css'
import './baby-scale.css'
import './welcome-fix.css'
import './cycle-explorer.css'
import './cycle-panorama-v2.css'

const questions = [
  { title: '月经来临时，什么最容易淹没你？', options: ['身体疼痛和紧绷', '情绪像天气一样变化', '能量突然消失'] },
  { title: '难受的时候，你最希望获得什么？', options: ['一个温暖安静的小窝', '有人理解并陪着我', '知道身体正在发生什么'] },
  { title: '你最先察觉到哪一种变化？', options: ['身体的疼痛与酸胀', '情绪的起伏与敏感', '精力和节奏的变化'] },
]

export function App() {
  const [screen, setScreen] = useState(() => {
    if (window.location.hash === '#cycle-v2') return 'cycle-v2'
    if (window.location.hash === '#cycle') return 'cycle'
    return 'home'
  })
  const [q, setQ] = useState(0)
  const [answers, setAnswers] = useState([])
  const [body, setBody] = useState('疼痛明显')
  const [mood, setMood] = useState('想哭')
  const [energy, setEnergy] = useState('很累')
  const [care, setCare] = useState('热敷 20 分钟，疼痛缓了一点。')
  const [heatStarted, setHeatStarted] = useState(false)
  const [careFeedback, setCareFeedback] = useState('')
  const [selectedBaby, setSelectedBaby] = useState(null)
  const [thanked, setThanked] = useState(false)
  const [chatText, setChatText] = useState('今天肚子很痛，什么都不想做，还有点想哭。')
  const [lastMessage, setLastMessage] = useState('')
  const [chatStage, setChatStage] = useState(0)
  const [responseFrom, setResponseFrom] = useState('chat')
  const [giftSeaFrom, setGiftSeaFrom] = useState('response')

  useEffect(() => {
    const hash = screen === 'cycle-v2' ? '#cycle-v2' : screen === 'cycle' ? '#cycle' : ''
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }, [screen])

  const sendChat = () => {
    if (!chatText.trim()) return
    setLastMessage(chatText.trim())
    setChatText('')
    setChatStage(1)
    setTimeout(() => setChatStage(2), 900)
  }

  const answer = (value) => {
    const next = [...answers, value]
    setAnswers(next)
    if (q < 2) setQ(q + 1)
    else setScreen('result')
  }

  return (
    <div className="stage">
      <main className={`mobile ${screen}`}>
        {screen === 'cycle' && <CycleExplorer onBack={() => setScreen('home')} />}
        {screen === 'cycle-v2' && <CyclePanoramaV2 onBack={() => setScreen('home')} onOpenV1={() => setScreen('cycle')} />}

        {screen === 'welcome' && <section className="welcome-screen">
          <button className="floating-back" onClick={()=>setScreen('home')}>← 返回小窝</button>
          <div className="brand">月经宇宙 <i>MENSTRUAL UNIVERSE</i></div>
          <div className="moon-orbit"><img src="/assets/moon-sea-hero.png" alt="生活在贝壳月湾里的月海灵兽" /></div>
          <div className="welcome-copy">
            <p className="eyebrow">一场关于身体潮汐的相遇</p>
            <h1>你的身体潮汐，<br/>会孕育哪一种<br/><em>月经宝宝？</em></h1>
            <p>回答 3 个关于身体感受的问题，找到此刻最适合陪伴你的共生灵兽。</p>
            <button className="primary" onClick={() => setScreen('quiz')}>开始回答 3 个问题 <span>→</span></button>
            <small>这不是医学诊断，只是理解照护需求的新方式</small>
          </div>
        </section>}

        {screen === 'quiz' && <section className="quiz-screen">
          <header><button className="back" onClick={() => q ? setQ(q-1) : setScreen('welcome')}>←</button><span>潮汐感知</span><b>{q+1} / 3</b></header>
          <div className="progress"><i style={{width:`${(q+1)*33.33}%`}} /></div>
          <div className="quiz-art"><img src="/assets/moon-creature.png" alt="月海灵兽" /></div>
          <p className="eyebrow">听一听身体的声音</p>
          <h2>{questions[q].title}</h2>
          <div className="options">{questions[q].options.map((o,i)=><button key={o} onClick={()=>answer(i)}><span>{['潮','云','月'][i]}</span>{o}<b>›</b></button>)}</div>
          <p className="privacy">你的选择只属于你和宝宝</p>
        </section>}

        {screen === 'result' && <section className="result-screen">
          <button className="floating-back" onClick={()=>{setQ(2);setScreen('quiz')}}>← 修改答案</button>
          <div className="spark">✦ 潮汐回应了你 ✦</div>
          <div className="result-art"><img src="/assets/moon-creature.png" alt="你的月海灵兽" /></div>
          <p className="eyebrow">你的身体潮汐孕育了</p>
          <h1>月海灵兽</h1>
          <p className="desc">你对身体的疼痛与能量变化十分敏锐。它会住在贝壳月湾里，提醒你：柔软不是脆弱，休息也是照顾身体的一种方式。</p>
          <div className="trait"><span>需要的照护</span><b>温暖 · 休息 · 被理解</b></div>
          <button className="primary" onClick={() => setScreen('home')}>领取我的月海灵兽 <span>→</span></button>
          <small>宝宝会随着你的身体旅程长出独特特征</small>
        </section>}

        {screen === 'home' && <section className="nest-home">
          <div className="nest-top"><div className="nest-brand"><b>月经宇宙</b><small>MENSTRUAL UNIVERSE</small></div><button onClick={()=>setScreen('welcome')}>重新感知宝宝</button></div>
          <div className="nest-greeting"><p>下午好，小满</p><h1>宝宝今天想<br/>靠近你一点</h1></div>
          <div className="nest-hero"><img src="/assets/moon-sea-hero.png" alt="住在贝壳月湾里的月海灵兽" /><div className="plain-status"><span>经期第 2 天</span><i></i><span>疼痛明显</span><i></i><span>精力很低</span></div></div>
          <div className="baby-note"><span>月海灵兽</span><p>“我感觉你今天走得有点慢。<br/>愿意和我说说发生了什么吗？”</p></div>
          <button className="primary nest-chat" onClick={()=>{setChatStage(0);setScreen('chat')}}>和宝宝聊聊今天 <span>→</span></button>
          <button className="quick-check" onClick={()=>setScreen('checkin')}>不想打字？快速选择身体状态</button>
          <nav className="nest-nav"><button className="selected"><b>小窝</b><small>正在照顾</small></button><button onClick={()=>setScreen('cycle-v2')}><b>知识海</b><small>进入周期全景图 2.0</small></button><button disabled><b>我的</b><small>Demo 暂未开放</small></button></nav>
        </section>}

        {screen === 'chat' && <section className={`chat-screen ${chatStage===0?'chat-intro':'chat-active'}`}>
          <header><button className="back" onClick={()=>setScreen('home')}>←</button><span>和月海灵兽说说话</span><b>私密对话</b></header>
          <div className="chat-baby"><img src="/assets/moon-sea-hero.png" alt="正在倾听的月海灵兽" /><span>宝宝正在听你说</span></div>
          <div className="conversation">
            <div className="bubble baby-bubble"><small>月海灵兽</small><p>我看到你今天比平时安静。身体哪里不舒服，还是心里有点难受？你可以慢慢说。</p></div>
            {lastMessage && <div className="bubble user-bubble"><small>我</small><p>{lastMessage}</p></div>}
            {chatStage===1 && <div className="bubble baby-bubble typing"><small>宝宝正在理解</small><i></i><i></i><i></i></div>}
            {chatStage===2 && <div className="bubble baby-bubble agent-reply"><small>月海灵兽 · 已理解</small><p>我听见了：你的腹部疼痛很明显、精力很低，也有点想哭。这不是你不够坚强。</p><div><span>疼痛明显</span><span>精力很低</span><span>想哭</span></div><p>我们先不一次解决所有事。要不要让我陪你找一件现在能做的小事？</p><button onClick={()=>{setResponseFrom('chat');setScreen('response')}}>看看宝宝找到的照护 →</button></div>}
          </div>
          <div className="chat-compose"><textarea value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="告诉宝宝你现在的感受…"/><button onClick={sendChat}>发送</button></div>
          <button className="quick-check chat-quick" onClick={()=>setScreen('checkin')}>说不出来？改用快速选择</button>
        </section>}

        {screen === 'checkin' && <section className="checkin-screen">
          <header><button className="back" onClick={()=>setScreen('home')}>←</button><span>告诉宝宝今天的感受</span><b>私密</b></header>
          <div className="mini-creature"><img src="/assets/moon-creature.png" alt="月海灵兽" /></div>
          <h2>今天经期，<br/>你的身体感觉怎么样？</h2>
          <Choice title="疼痛程度" hint="腹部、腰部或头部的不适" values={['几乎不痛','隐隐不适','疼痛明显']} value={body} set={setBody}/>
          <Choice title="现在的心情" hint="选择最接近此刻的感受" values={['平静','烦躁','想哭']} value={mood} set={setMood}/>
          <Choice title="现在的精力" hint="完成日常事情还有多少力气" values={['很累','还可以','有精神']} value={energy} set={setEnergy}/>
          <button className="primary" onClick={()=>{setResponseFrom('checkin');setScreen('response')}}>让宝宝回应我 <span>→</span></button>
        </section>}

        {screen === 'response' && <section className="response-screen">
          <header className="response-header"><button className="back" onClick={()=>setScreen(responseFrom)}>←</button><span>宝宝为你找到的照护</span><b>私密</b></header>
          <p className="eyebrow">宝宝听见了你的身体</p>
          <div className="response-art"><img src="/assets/moon-creature.png" alt="被月光包围的月海灵兽" /></div>
          <h2>“你今天疼得很明显，也很累。<br/>我们先做一件小事。”</h2>
          <div className="care-action">
            <span>宝宝建议你先试试</span><b>给小腹热敷 20 分钟</b>
            {!heatStarted && <button onClick={()=>setHeatStarted(true)}>开始热敷</button>}
            {heatStarted && !careFeedback && <div className="feedback"><small>试过之后，感觉怎么样？</small><div><button onClick={()=>setCareFeedback('没帮助')}>没帮助</button><button onClick={()=>setCareFeedback('有一点用')}>有一点用</button><button onClick={()=>setCareFeedback('很有用')}>很有用</button></div></div>}
            {careFeedback && <div className="feedback-result"><span>已记下：{careFeedback}</span>{careFeedback==='没帮助'?<button onClick={()=>{setHeatStarted(false);setCareFeedback('')}}>换一个方法</button>:<button onClick={()=>setScreen('gift')}>保存这次有效照护 →</button>}</div>}
          </div>
          <button className="support-row" onClick={()=>setScreen('knowledge')}><span><small>身体为什么会这样？</small><b>为什么痛经会一阵一阵？</b></span><em>查看知识与研究 ›</em></button>
          <button className="support-row" onClick={()=>{setGiftSeaFrom('response');setScreen('giftsea')}}><span><small>别的宝宝怎么照顾自己？</small><b>3 份相似经历的照护礼物</b></span><em>打开礼物卡 ›</em></button>
        </section>}

        {screen === 'knowledge' && <section className="detail-screen">
          <header><button className="back" onClick={()=>setScreen('response')}>←</button><span>宝宝衔回的知识</span><b>科普</b></header>
          <p className="eyebrow">身体发生了什么</p><h1>为什么痛经会<br/>一阵一阵？</h1>
          <div className="knowledge-hero">子宫正在有节律地收缩</div>
          <p>月经期间，身体会释放前列腺素，促使子宫肌肉收缩，帮助经血排出。收缩有节律地发生，所以疼痛可能一阵一阵出现。</p>
          <div className="research-card"><small>研究怎么说</small><b>前列腺素水平与原发性痛经有关</b><p>这也是为什么一些循证照护方法会关注缓解疼痛和炎症反应。</p></div>
          <div className="medical-note"><b>什么时候值得求助？</b><p>如果疼痛持续影响学习、工作或日常生活，它值得被认真对待，可以寻求专业医生帮助。</p></div>
          <button className="primary" onClick={()=>setScreen('response')}>带着知识回到宝宝身边 <span>→</span></button>
        </section>}

        {screen === 'giftsea' && <section className="detail-screen giftsea-screen">
          <header><button className="back" onClick={()=>setScreen(giftSeaFrom)}>←</button><span>痛经海沟</span><b>礼物海</b></header>
          <p className="eyebrow">来自相似身体经历</p><h1>3 个宝宝送来的<br/>照护礼物</h1>
          <div className="baby-gifts">
            <GiftBaby name="莓莓" type="月海灵兽" text="热敷时把膝盖微微蜷起来，我会舒服一点。" tag="身体疼痛" onClick={()=>{setSelectedBaby({name:'莓莓',type:'月海灵兽',years:'陪伴主人 8 年',likes:'喜欢收集暖潮贝壳',gift:'热敷时把膝盖微微蜷起来，我会舒服一点。'});setThanked(false);setScreen('baby')}} />
            <GiftBaby name="阿绒" type="山海小兽" text="疼的时候允许自己走慢一点，不需要向任何人证明。" tag="低能量" onClick={()=>{setSelectedBaby({name:'阿绒',type:'山海小兽',years:'陪伴主人 5 年',likes:'喜欢安静的小窝',gift:'疼的时候允许自己走慢一点，不需要向任何人证明。'});setThanked(false);setScreen('baby')}} />
            <GiftBaby name="小翎" type="绛月幼灵" text="我会提前准备温水和止痛方案，减少慌乱。" tag="经期准备" onClick={()=>{setSelectedBaby({name:'小翎',type:'绛月幼灵',years:'陪伴主人 12 年',likes:'喜欢收集知识珠',gift:'我会提前准备温水和止痛方案，减少慌乱。'});setThanked(false);setScreen('baby')}} />
          </div>
          <p className="safe center">只展示宝宝主人主动公开的礼物与资料</p>
        </section>}

        {screen === 'baby' && selectedBaby && <section className="baby-screen">
          <header><button className="back" onClick={()=>setScreen('giftsea')}>←</button><span>宝宝公开资料</span><b>已获允许</b></header>
          <div className="baby-profile-art"><img src="/assets/moon-creature.png" alt={selectedBaby.name} /></div>
          <p className="eyebrow">{selectedBaby.type}</p><h1>{selectedBaby.name}</h1>
          <div className="public-info"><span>{selectedBaby.years}</span><i></i><span>{selectedBaby.likes}</span></div>
          <div className="profile-gift"><small>它送进痛经海沟的礼物</small><p>“{selectedBaby.gift}”</p></div>
          {!thanked?<button className="primary" onClick={()=>setThanked(true)}>让我的宝宝送一颗感谢贝壳 <span>→</span></button>:<div className="thanks-done"><b>感谢贝壳已送达</b><p>{selectedBaby.name}开心地收下了。你们的宝宝成为了潮汐朋友。</p></div>}
          <p className="safe center">宝宝替主人互动，不公开私密身体记录</p>
        </section>}

        {screen === 'gift' && <section className="gift-screen">
          <header><button className="back" onClick={()=>setScreen('response')}>←</button><span>保存这次有效照护</span><b>由你决定</b></header>
          <div className="gift-orb">礼</div>
          <p className="eyebrow">宝宝记住了刚才发生的事</p>
          <h2>把有效的方法保存下来</h2>
          <textarea value={care} onChange={e=>setCare(e.target.value)} />
          <div className="audience"><span>如果愿意，可以匿名送给</span><b>正在经历明显疼痛的宝宝</b></div>
          <p className="safe">只分享上面这句话；你的日期、疼痛程度和私密对话不会公开。</p>
          <button className="primary" onClick={()=>setScreen('success')}>匿名送进痛经海沟 <span>→</span></button>
          <button className="secondary-save" onClick={()=>setScreen('home')}>只保存给我和宝宝</button>
        </section>}

        {screen === 'success' && <section className="success-screen">
          <button className="floating-back" onClick={()=>setScreen('gift')}>← 返回照护礼物</button>
          <div className="success-moon"><img src="/assets/moon-creature.png" alt="开心发光的月海灵兽" /></div>
          <p className="eyebrow">你的温暖开始流动</p>
          <h1>礼物已进入<br/>痛经海沟</h1>
          <p>“谢谢你照顾了我们，也愿意把这份温暖留下来。”</p>
          <div className="growth"><span>宝宝成长了</span><b>月海灵兽长出了第一枚暖潮贝纹</b><p>它会记得：热敷曾经对你有一点帮助。</p></div>
          <button className="primary" onClick={()=>{setGiftSeaFrom('success');setScreen('giftsea')}}>看看礼物落在哪里 <span>→</span></button>
          <button className="secondary-save" onClick={()=>setScreen('home')}>回到宝宝小窝</button>
          <button className="replay" onClick={()=>{setQ(0);setAnswers([]);setScreen('welcome')}}>重新演示</button>
        </section>}
      </main>
    </div>
  )
}

function Choice({title,hint,values,value,set}){
  return <div className="choice"><label>{title}<small>{hint}</small></label><div>{values.map(v=><button className={value===v?'selected':''} onClick={()=>set(v)} key={v}>{v}</button>)}</div></div>
}

function GiftBaby({name,type,text,tag,onClick}){
  return <button className="gift-baby" onClick={onClick}><span className="baby-avatar">月</span><span><b>{name} <small>{type}</small></b><p>“{text}”</p><em>{tag} · 查看宝宝资料</em></span><strong>›</strong></button>
}

# 月经宝宝｜Hackathon MVP

一个手机端优先、女本位的周期行动 Agent：先理解用户当下的身体感受与现实任务，进行风险分流，只给一个低负担行动，追问真实效果，并把结果变成可查看、可纠正、可删除的周期记忆。

## 这版真正实现了什么

- 关系化 Onboarding：`月之种子 → 月经宝宝 → 血月凤凰`，区分初潮破壳日与每次真实来潮的月潮生日。
- 小窝核心闭环：自由输入或身体图 → Agent 结构化理解 → 用户纠正 → 风险门 → 情境行动 → 效果反馈 → 本地存档/可选月信。
- 周期全景：共享 D1–D30 教学轴，同时解释卵巢事件、子宫内膜与宫颈黏液；研究参考和个人记录分离。
- 专业知识：前端从研究导出读取 64 条有定位背景主张与 21 张误解卡，显示来源与终审状态。
- 公开经验治理：R006 的 216 条公开候选单独进入“邪修雷达”，当前 0 条自动成为建议。
- 关系与游戏化：宝宝状态、月之海峡、礼物海、Agent 交友、生日月宴、礼物反馈与生命周期页面。
- 隐私控制：本地记忆开关、逐条查看/编辑/删除、导出与重置；原型不做云端上传。

完整功能状态见 [`pitch/FEATURE_INVENTORY.md`](./pitch/FEATURE_INVENTORY.md)，会议需求覆盖见 [`MEETING_COVERAGE.md`](./MEETING_COVERAGE.md)。

## 本地交付

- 产品开发预览：`http://127.0.0.1:4174/`
- 演示 HTML：`http://127.0.0.1:4176/`
- PowerPoint：[`pitch/月经宝宝-黑客松Demo.pptx`](./pitch/月经宝宝-黑客松Demo.pptx)
- 演示脚本：[`pitch/DEMO_SCRIPT.md`](./pitch/DEMO_SCRIPT.md)
- 评委问答：[`pitch/JUDGE_QA.md`](./pitch/JUDGE_QA.md)
- 最终点击/视觉验收：[`artifacts/qa/final-audit/README.md`](./artifacts/qa/final-audit/README.md)

## 开发与验证

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4174
npm run research:sync
npm run research:qa
npm test
npm run build
```

当前冻结结果：24/24 自动化测试通过、研究同步与研究 QA 通过、Vite 生产构建通过。

## 数据事实源

- 医学知识工作库：`docs/research/studies/R004-clinical-safety/B5-continuous-locator-cause-graph/menstrual-knowledge-r5.sqlite`
- 公开经验候选：`docs/research/studies/R006-public-practice-atlas/r006-public-practice.sqlite`
- 黑客松统一目录：`docs/research/synthesis/hackathon-evidence-catalog/research-catalog.sqlite`
- 全量调研报告：`docs/research/02-黑客松MVP全量调研报告.md`

SQLite/统一数据层是事实源；前端 JSON 是由脚本重建的只读导出，不手工维护第二份数字。

## 必须诚实说明的边界

- 这是比赛原型，不是医疗器械，也不诊断、开药或确认排卵/激素状态。
- 周期位置是教学模型或日历估计，不是用户身体的实时扫描。
- 社区宝宝、生日活动与礼物是明确标记的比赛种子数据，不是真实线上社区。
- 专业库仍有待妇产科终审项目；公开经验候选未经逐条全文医学核验。
- IP 陪伴、低摩擦记录和跨周期行动记忆是待真实用户验证的产品假设，不是已经证明的健康结果。

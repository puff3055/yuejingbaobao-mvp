import { useState, useMemo } from 'react';
import './personal-cycle.css';
import {
  STATE_VALUES,
  OUTCOME_VALUES,
  OUTCOME_LABELS,
  STATE_LABELS,
  groupRecordsByCycle,
  getCycleDayLabel,
  groupActionsByOutcome,
  findSimilarRecords,
  generateMedicalSummary,
  formatDateTime,
  formatDuration
} from './personalCycleModel';

const SYMPTOM_OPTIONS = ['疲乏', '易怒', '失眠', '乳房胀痛', '头痛', '恶心', '腹胀', '情绪低落', '食欲改变', '水肿'];
const LOCATION_OPTIONS = ['小腹', '后腰', '大腿', '肛门', '全身', '胃部'];
const IMPACT_OPTIONS = ['工作效率下降', '无法入睡', '活动受限', '注意力不集中', '学习效率下降', '社交减少', '自我照顾困难'];
const CONTEXT_OPTIONS = ['有会议', '周末休息', '项目deadline', '旅行中', '生理期', '压力大', '天气变化'];
const MOOD_OPTIONS = ['烦躁', '平静', '愉快', '低落', '焦虑', '易怒', '疲惫', '兴奋'];
const ENERGY_OPTIONS = ['充足', '中等', '偏低', '很低'];
const SLEEP_QUALITY_OPTIONS = ['很好', '良好', '一般', '较差', '很差'];
const CONCENTRATION_OPTIONS = ['集中', '正常', '分散', '难以集中'];
const BLEEDING_LEVEL_OPTIONS = ['无', '少量', '中量', '大量'];

export default function PersonalCycleWorkspace({ records = [], isDemo = false, onRecordChange }) {
  const [selectedRecord, setSelectedRecord] = useState(records[0] || null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState({});

  const cycleGroups = useMemo(() => groupRecordsByCycle(records), [records]);
  const similarRecords = useMemo(() => 
    selectedRecord ? findSimilarRecords(records, selectedRecord) : [],
    [records, selectedRecord]
  );
  const actionsByOutcome = useMemo(() => groupActionsByOutcome(records), [records]);
  const medicalSummary = useMemo(() => generateMedicalSummary(records), [records]);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))[0];
  }, [records]);

  const currentRecord = selectedRecord || latestRecord;

  const openEdit = (fieldKey) => {
    if (!currentRecord) return;
    setEditingField(fieldKey);
    const field = currentRecord.fields[fieldKey];
    setEditValue({
      state: field.state,
      ...(field.state === STATE_VALUES.VALUE ? field : {})
    });
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (!currentRecord || !editingField) return;
    
    const updatedFields = {
      ...currentRecord.fields,
      [editingField]: {
        state: editValue.state,
        ...(editValue.state === STATE_VALUES.VALUE 
          ? Object.fromEntries(Object.entries(editValue).filter(([k]) => k !== 'state'))
          : {})
      }
    };

    const updatedRecord = {
      ...currentRecord,
      fields: updatedFields,
      provenance: {
        ...currentRecord.provenance,
        fieldSources: {
          ...currentRecord.provenance.fieldSources,
          [`fields.${editingField}.state`]: 'user_confirmed'
        }
      }
    };

    if (onRecordChange) {
      onRecordChange(updatedRecord);
    }

    setEditModalOpen(false);
    setEditingField(null);
    setEditValue({});
  };

  const renderStateBadge = (state) => {
    if (state === STATE_VALUES.VALUE) return null;
    return <span className="state-badge">{STATE_LABELS[state]}</span>;
  };

  const renderRecordField = (label, fieldKey, renderValue) => {
    const field = currentRecord?.fields?.[fieldKey];
    if (!field) return null;
    
    const hasValue = field.state === STATE_VALUES.VALUE;
    const isEmpty = field.state === STATE_VALUES.NONE;
    
    return (
      <div className="pc-field-row">
        <div className="pc-field-label">{label}</div>
        <div className="pc-field-value">
          {hasValue && renderValue(field)}
          {isEmpty && <span style={{ color: '#a291a1' }}>没有</span>}
          {!hasValue && !isEmpty && <span style={{ color: '#a291a1' }}>{STATE_LABELS[field.state]}</span>}
          {renderStateBadge(field.state)}
        </div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editingField) return null;

    const renderEditContent = () => {
      switch (editingField) {
        case 'bleeding':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <select 
                  value={editValue.level || ''}
                  onChange={(e) => setEditValue({ ...editValue, level: e.target.value })}
                >
                  <option value="">选择出血量</option>
                  {BLEEDING_LEVEL_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          );
        case 'pain':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, intensity: null, locations: [] })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <>
                  <div className="pain-slider">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={editValue.intensity || 0}
                      onChange={(e) => setEditValue({ ...editValue, intensity: parseInt(e.target.value) })}
                    />
                    <span className="pain-value">{editValue.intensity || 0}</span>
                  </div>
                  <div className="multi-select">
                    {LOCATION_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        className={`multi-select-option ${(editValue.locations || []).includes(opt) ? 'selected' : ''}`}
                        onClick={() => {
                          const current = editValue.locations || [];
                          const next = current.includes(opt) 
                            ? current.filter(l => l !== opt)
                            : [...current, opt];
                          setEditValue({ ...editValue, locations: next });
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        case 'symptoms':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, values: [] })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <div className="multi-select">
                  {SYMPTOM_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      className={`multi-select-option ${(editValue.values || []).includes(opt) ? 'selected' : ''}`}
                      onClick={() => {
                        const current = editValue.values || [];
                        const next = current.includes(opt) 
                          ? current.filter(v => v !== opt)
                          : [...current, opt];
                        setEditValue({ ...editValue, values: next });
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        case 'sleep':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, hours: null, quality: null })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    placeholder="睡眠小时数"
                    value={editValue.hours || ''}
                    onChange={(e) => setEditValue({ ...editValue, hours: parseInt(e.target.value) || null })}
                  />
                  <select 
                    value={editValue.quality || ''}
                    onChange={(e) => setEditValue({ ...editValue, quality: e.target.value })}
                  >
                    <option value="">选择睡眠质量</option>
                    {SLEEP_QUALITY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          );
        case 'mood':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, value: null })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <select 
                  value={editValue.value || ''}
                  onChange={(e) => setEditValue({ ...editValue, value: e.target.value })}
                >
                  <option value="">选择心情</option>
                  {MOOD_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          );
        case 'energy':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, value: null })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <select 
                  value={editValue.value || ''}
                  onChange={(e) => setEditValue({ ...editValue, value: e.target.value })}
                >
                  <option value="">选择精力状态</option>
                  {ENERGY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          );
        case 'concentration':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, value: null })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <select 
                  value={editValue.value || ''}
                  onChange={(e) => setEditValue({ ...editValue, value: e.target.value })}
                >
                  <option value="">选择注意力状态</option>
                  {CONCENTRATION_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          );
        case 'functionalImpact':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, values: [] })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <div className="multi-select">
                  {IMPACT_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      className={`multi-select-option ${(editValue.values || []).includes(opt) ? 'selected' : ''}`}
                      onClick={() => {
                        const current = editValue.values || [];
                        const next = current.includes(opt) 
                          ? current.filter(v => v !== opt)
                          : [...current, opt];
                        setEditValue({ ...editValue, values: next });
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        case 'context':
          return (
            <div className="pc-edit-field">
              <div className="state-selector">
                {Object.values(STATE_VALUES).map(state => (
                  <button
                    key={state}
                    className={`state-option ${editValue.state === state ? 'selected' : ''}`}
                    onClick={() => setEditValue({ ...editValue, state, values: [] })}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {editValue.state === STATE_VALUES.VALUE && (
                <div className="multi-select">
                  {CONTEXT_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      className={`multi-select-option ${(editValue.values || []).includes(opt) ? 'selected' : ''}`}
                      onClick={() => {
                        const current = editValue.values || [];
                        const next = current.includes(opt) 
                          ? current.filter(v => v !== opt)
                          : [...current, opt];
                        setEditValue({ ...editValue, values: next });
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        default:
          return null;
      }
    };

    const fieldLabels = {
      bleeding: '出血情况',
      pain: '疼痛',
      symptoms: '伴随症状',
      sleep: '睡眠',
      mood: '心情',
      energy: '精力',
      concentration: '注意力/记忆',
      functionalImpact: '功能影响',
      context: '现实限制'
    };

    return (
      <div className="pc-edit-modal-overlay" onClick={() => setEditModalOpen(false)}>
        <div className="pc-edit-modal" onClick={(e) => e.stopPropagation()}>
          <div className="pc-edit-modal-header">
            <h3>编辑 {fieldLabels[editingField]}</h3>
            <button className="close-btn" onClick={() => setEditModalOpen(false)}>×</button>
          </div>
          <div className="pc-edit-form">
            {renderEditContent()}
          </div>
          <div className="pc-edit-actions">
            <button className="cancel-btn" onClick={() => setEditModalOpen(false)}>取消</button>
            <button className="save-btn" onClick={handleSave}>保存</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineItem = (record, isSimilar) => (
    <div className={`pc-timeline-item ${isSimilar ? 'similar' : ''}`}>
      <div className="pc-timeline-dot" />
      <div className="pc-timeline-header">
        <span className="pc-timeline-cycle">{record.cycle.cycleId.replace('cycle-', '')}</span>
        <span className="pc-timeline-day">{getCycleDayLabel(record.cycle.day)}</span>
      </div>
      <div className="pc-timeline-content">
        {record.rawUserText && <span className="tag">{record.rawUserText}</span>}
        {record.fields.mood?.state === STATE_VALUES.VALUE && (
          <span className="tag">{record.fields.mood.value}</span>
        )}
        {record.fields.energy?.state === STATE_VALUES.VALUE && (
          <span className="tag">{record.fields.energy.value}</span>
        )}
        {record.fields.pain?.state === STATE_VALUES.VALUE && (
          <span className="tag">疼痛{record.fields.pain.intensity}</span>
        )}
      </div>
    </div>
  );

  const generateClues = () => {
    const clues = [];
    
    const moodRecords = records.filter(r => r.fields.mood?.state === STATE_VALUES.VALUE);
    const irritableRecords = moodRecords.filter(r => r.fields.mood.value === '烦躁');
    if (irritableRecords.length >= 2) {
      const positions = [...new Set(irritableRecords.map(r => r.cycle.day))];
      clues.push(
        `在最近 ${cycleGroups.length} 个周期中，${irritableRecords.length} 个周期在相近位置（约第 ${positions.join('、')} 天）出现烦躁情绪。这是一个值得继续观察的线索。`
      );
    }

    const sleepRecords = records.filter(r => r.fields.sleep?.state === STATE_VALUES.VALUE);
    const poorSleepRecords = sleepRecords.filter(r => r.fields.sleep.hours < 6);
    if (poorSleepRecords.length >= 2) {
      clues.push(
        `${poorSleepRecords.length} 次记录显示睡眠不足（少于6小时），其中 ${poorSleepRecords.filter(r => r.cycle.day > 20).length} 次发生在周期后半段。`
      );
    }

    const painRecords = records.filter(r => r.fields.pain?.state === STATE_VALUES.VALUE);
    const highPainRecords = painRecords.filter(r => r.fields.pain.intensity >= 4);
    if (highPainRecords.length > 0) {
      clues.push(
        `${highPainRecords.length} 次记录疼痛强度达到或超过 4/10，主要位置包括 ${[...new Set(highPainRecords.flatMap(r => r.fields.pain.locations))].join('、')}。`
      );
    }

    const cyclesWithNoMood = cycleGroups.filter(g => 
      !g.records.some(r => r.fields.mood?.state === STATE_VALUES.VALUE)
    );
    if (cyclesWithNoMood.length > 0) {
      clues.push(
        `${cyclesWithNoMood.length} 个周期缺少情绪记录，建议在这些周期的相似位置补充观察。`
      );
    }

    if (clues.length === 0) {
      clues.push('目前记录数量较少，建议继续观察以识别个人周期线索。');
    }

    return clues;
  };

  return (
    <div className="pc-workspace">
      <header className="pc-header">
        {isDemo && <div className="demo-badge">演示数据，用于检查交互与信息组织</div>}
        <h1>我的周期记录</h1>
        <p>从妳确认过的记录里，看见身体经历了什么</p>
      </header>

      <section className="pc-section">
        <div className="pc-section-header">
          <h2>这一刻发生了什么</h2>
          {currentRecord && (
            <button className="edit-btn" onClick={() => openEdit('mood')}>编辑</button>
          )}
        </div>
        <div className="pc-section-content">
          {currentRecord ? (
            <>
              <div className="pc-record-original">
                <div className="label">妳当时说</div>
                <div className="text">{currentRecord.rawUserText}</div>
              </div>

              <div className="pc-field-row">
                <div className="pc-field-label">时间与周期</div>
                <div className="pc-field-value">
                  {formatDateTime(currentRecord.occurredAt)}
                  <span className="state-badge">{getCycleDayLabel(currentRecord.cycle.day)}</span>
                </div>
              </div>

              {renderRecordField('出血情况', 'bleeding', (f) => (
                <span>{f.level || '未指定'}</span>
              ))}

              {renderRecordField('疼痛', 'pain', (f) => (
                <>
                  <span>强度 {f.intensity}/10，位置：{f.locations.join('、')}</span>
                  <span className="pain-bar" style={{ width: '80px' }}>
                    <span className="pain-bar-inner" style={{ width: `${f.intensity * 10}%` }} />
                  </span>
                </>
              ))}

              {renderRecordField('伴随症状', 'symptoms', (f) => (
                <div className="tag-list">{f.values.map(v => <span key={v} className="tag">{v}</span>)}</div>
              ))}

              {renderRecordField('睡眠', 'sleep', (f) => (
                <span>{f.hours}小时，{f.quality}</span>
              ))}

              {renderRecordField('心情', 'mood', (f) => (
                <span>{f.value}</span>
              ))}

              {renderRecordField('精力', 'energy', (f) => (
                <span>{f.value}</span>
              ))}

              {renderRecordField('注意力', 'concentration', (f) => (
                <span>{f.value}</span>
              ))}

              {renderRecordField('功能影响', 'functionalImpact', (f) => (
                <div className="tag-list">{f.values.map(v => <span key={v} className="tag">{v}</span>)}</div>
              ))}

              {renderRecordField('现实限制', 'context', (f) => (
                <div className="tag-list">{f.values.map(v => <span key={v} className="tag">{v}</span>)}</div>
              ))}

              {currentRecord.actions && currentRecord.actions.length > 0 && (
                <div className="pc-actions-list">
                  <div className="label" style={{ fontSize: '11px', color: '#9a8698', marginBottom: '8px' }}>已尝试的行动</div>
                  {currentRecord.actions.map(action => (
                    <div key={action.id} className="pc-action-item">
                      <div className="pc-action-header">
                        <span className="pc-action-label">{action.label}</span>
                        <span className={`pc-action-outcome ${action.outcome}`}>
                          {OUTCOME_LABELS[action.outcome]}
                        </span>
                      </div>
                      <div className="pc-action-details">
                        {action.startedAt && <div>开始于 {formatDateTime(action.startedAt)}</div>}
                        {action.outcomeAt && action.startedAt && (
                          <div>反馈于 {formatDuration(action.startedAt, action.outcomeAt)} 后</div>
                        )}
                        {action.userNote && <div className="note">备注：{action.userNote}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="pc-empty-state">
              <p>暂无记录</p>
            </div>
          )}
        </div>
      </section>

      <section className="pc-section">
        <div className="pc-section-header">
          <h2>这几个周期，我看见的线索</h2>
        </div>
        <div className="pc-section-content">
          {cycleGroups.length > 0 ? (
            <>
              <div className="pc-timeline">
                {cycleGroups.flatMap(group => 
                  group.records.map(record => 
                    <div key={record.id}>
                      {renderTimelineItem(record, similarRecords.some(s => s.id === record.id))}
                    </div>
                  )
                )}
              </div>

              <div className="pc-clues-section">
                <h3>值得继续观察的线索</h3>
                {generateClues().map((clue, index) => (
                  <div key={index} className="pc-clue-item">
                    {clue}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="pc-empty-state">
              <p>暂无周期记录</p>
            </div>
          )}
        </div>
      </section>

      <section className="pc-section">
        <div className="pc-section-header">
          <h2>什么曾经帮助过我</h2>
        </div>
        <div className="pc-section-content">
          {Object.entries(actionsByOutcome).some(([, actions]) => actions.length > 0) ? (
            <>
              {(Object.entries(OUTCOME_LABELS)).map(([outcome, label]) => {
                const actions = actionsByOutcome[outcome] || [];
                if (actions.length === 0) return null;
                return (
                  <div key={outcome}>
                    <div className="pc-action-group-title">{label} ({actions.length})</div>
                    {actions.map(action => (
                      <div key={action.id} className="pc-action-item">
                        <div className="pc-action-header">
                          <span className="pc-action-label">{action.label}</span>
                          <span className={`pc-action-outcome ${outcome}`}>{label}</span>
                        </div>
                        <div className="pc-action-details">
                          <div>处境：{action.recordContext.rawUserText || '未描述'}</div>
                          {action.startedAt && <div>尝试于 {formatDateTime(action.startedAt)}</div>}
                          {action.outcomeAt && action.startedAt && (
                            <div>{formatDuration(action.startedAt, action.outcomeAt)} 后反馈</div>
                          )}
                          {action.userNote && <div className="note">用户认为：{action.userNote}</div>}
                          {action.otherConcurrentActions && action.otherConcurrentActions.length > 0 && (
                            <div>同时还尝试了其他行动</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="pc-empty-state">
              <p>暂无照护行动记录</p>
            </div>
          )}
        </div>
      </section>

      <section className="pc-section pc-medical-summary">
        <div className="pc-section-header">
          <h2>带给医生</h2>
        </div>
        <div className="pc-section-content">
          {medicalSummary ? (
            <>
              <div className="pc-medical-card">
                <span className="label">主要困扰</span>
                <span className="value">{medicalSummary.userConcerns}</span>
              </div>
              <div className="pc-medical-card">
                <span className="label">发生时间与周期位置</span>
                <span className="value">
                  {formatDateTime(medicalSummary.latestDate)}<br />
                  {medicalSummary.cyclePosition}
                </span>
              </div>
              <div className="pc-medical-card">
                <span className="label">出血变化</span>
                <span className="value">{medicalSummary.bleedingChanges}</span>
              </div>
              <div className="pc-medical-card">
                <span className="label">疼痛位置与强度</span>
                <span className="value">
                  平均强度 {medicalSummary.painIntensity}<br />
                  {medicalSummary.painLocations}
                </span>
              </div>
              <div className="pc-medical-card">
                <span className="label">伴随症状</span>
                <span className="value tag-list">
                  {medicalSummary.symptoms.split('、').map(s => (
                    <span key={s} className="tag">{s}</span>
                  ))}
                </span>
              </div>
              <div className="pc-medical-card">
                <span className="label">对生活的影响</span>
                <span className="value tag-list">
                  {medicalSummary.functionalImpact.split('、').map(i => (
                    <span key={i} className="tag">{i}</span>
                  ))}
                </span>
              </div>
              {medicalSummary.actionsTaken && (
                <div className="pc-medical-card">
                  <span className="label">尝试过的方法与结果</span>
                  <span className="value">
                    {medicalSummary.actionsTaken.map((a, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>
                        - {a.action}：{a.outcome}
                      </div>
                    ))}
                  </span>
                </div>
              )}
              <div className="pc-medical-card">
                <span className="label">与以往相比的变化</span>
                <span className="value">{medicalSummary.changesFromPast}</span>
              </div>
              <div className="pc-medical-card">
                <span className="label">想向医生提问</span>
                <span className="value">{medicalSummary.questionsForDoctor}</span>
              </div>
              <div className="pc-medical-disclaimer">
                <p>这是根据妳确认过的记录整理的沟通材料，不提供诊断，也不能替代专业评估。</p>
              </div>
            </>
          ) : (
            <div className="pc-empty-state">
              <p>暂无足够记录生成就医摘要</p>
            </div>
          )}
        </div>
      </section>

      {renderEditModal()}
    </div>
  );
}

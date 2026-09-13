import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import '../body-progress.css'

const PARTS = [
  ['neck','Pescoço'], ['shoulders','Ombros'], ['chest','Peitoral'], ['waist','Cintura'],
  ['abdomen','Abdômen'], ['left-arm','Braço esquerdo'], ['right-arm','Braço direito'],
  ['left-thigh','Coxa esquerda'], ['right-thigh','Coxa direita'], ['left-calf','Panturrilha esquerda'], ['right-calf','Panturrilha direita']
]
const INITIAL = { neck: 38, shoulders: 112, chest: 101, waist: 88, abdomen: 91, 'left-arm': 35, 'right-arm': 35.5, 'left-thigh': 57, 'right-thigh': 57.5, 'left-calf': 37, 'right-calf': 37 }

function BodyMap({ selected, onSelect, values }) {
  const color = id => selected === id ? 'var(--acc)' : values[id] ? 'color-mix(in srgb, var(--acc) 42%, var(--card))' : 'var(--card-2)'
  return <svg className="progress-bodymap" viewBox="0 0 220 430" role="img" aria-label="Mapa corporal interativo">
    <circle cx="110" cy="34" r="25" fill={color('neck')} onClick={() => onSelect('neck')} />
    <rect x="96" y="59" width="28" height="35" rx="10" fill={color('shoulders')} onClick={() => onSelect('shoulders')} />
    <path d="M72 70 Q110 55 148 70 L138 150 Q110 165 82 150Z" fill={color('chest')} onClick={() => onSelect('chest')} />
    <path d="M82 145 Q110 158 138 145 L132 225 Q110 240 88 225Z" fill={color('abdomen')} onClick={() => onSelect('abdomen')} />
    <path d="M88 205 Q110 220 132 205 L128 250 Q110 262 92 250Z" fill={color('waist')} onClick={() => onSelect('waist')} />
    <rect x="45" y="75" width="30" height="105" rx="14" fill={color('left-arm')} onClick={() => onSelect('left-arm')} />
    <rect x="145" y="75" width="30" height="105" rx="14" fill={color('right-arm')} onClick={() => onSelect('right-arm')} />
    <rect x="75" y="245" width="32" height="120" rx="15" fill={color('left-thigh')} onClick={() => onSelect('left-thigh')} />
    <rect x="113" y="245" width="32" height="120" rx="15" fill={color('right-thigh')} onClick={() => onSelect('right-thigh')} />
    <rect x="78" y="360" width="26" height="62" rx="12" fill={color('left-calf')} onClick={() => onSelect('left-calf')} />
    <rect x="116" y="360" width="26" height="62" rx="12" fill={color('right-calf')} onClick={() => onSelect('right-calf')} />
  </svg>
}

export default function BodyProgress() {
  const nav = useNavigate(); const S = useStore(s => s.S); const update = useStore(s => s.update)
  const [view, setView] = useState('front'); const [selected, setSelected] = useState('chest'); const [value, setValue] = useState('')
  const checkins = S.bodyMeasurements || []; const latest = checkins.at(-1)?.values || INITIAL
  const filled = Object.keys(latest).filter(k => latest[k]).length
  const label = PARTS.find(([id]) => id === selected)?.[1] || selected
  const history = useMemo(() => checkins.map(c => c.values?.[selected]).filter(Boolean), [checkins, selected])
  const save = () => { const n = Number(value.replace(',', '.')); if (!(n > 0)) return; update(s => { s.bodyMeasurements = [...(s.bodyMeasurements || []), { date: new Date().toISOString().slice(0,10), values: { ...latest, [selected]: n } }] }); setValue('') }
  return <div className="narrow body-progress-view">
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Back')}><Icon name="chevronLeft" /></button><div><h1>Evolução corporal</h1><div className="sub">Seu check-in corporal semanal</div></div></div>
    <div className="card progress-summary"><strong>{t('This week')}</strong><span>{filled} / {PARTS.length} medidas registradas</span><div className="progress-track"><i style={{ width: `${filled / PARTS.length * 100}%` }} /></div></div>
    <Segmented value={view} onChange={setView} options={[{ value:'front', label:'Frente' }, { value:'back', label:t('Back') }]} />
    <div className="card progress-map-card"><BodyMap selected={selected} onSelect={setSelected} values={latest} /><div className="progress-parts">{PARTS.map(([id, name]) => <button key={id} className={selected===id?'selected':''} onClick={() => setSelected(id)}><span>{name}</span><b>{latest[id] ? `${latest[id]} cm` : '—'}</b></button>)}</div></div>
    <div className="card progress-entry"><div className="row between"><div><h2>{label}</h2><div className="muted small">{history.length > 1 ? `${history.at(-1)} cm · ${history.at(-1)-history[0] >= 0 ? '+' : ''}${(history.at(-1)-history[0]).toFixed(1)} cm` : 'Ainda sem histórico'}</div></div><Icon name="ruler" /></div><div className="progress-input-row"><input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} placeholder={latest[selected] ? String(latest[selected]) : 'cm'} aria-label="Medida em centímetros" /><Button onClick={save}>Salvar medida</Button></div></div>
  </div>
}

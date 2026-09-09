import fs from 'fs'
import path from 'path'

// Mock format.js
const uid = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 9; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}
const isoOf = d => {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const SPEC = [
  ['Dia de Peito', 'chest', [['0025', 4, 8], ['0047', 3, 10], ['0289', 3, 10], ['0308', 3, 12], ['0251', 3, 10], ['0314', 3, 10]]],
  ['Dia de Costas', 'back', [['0652', 4, 10], ['0027', 4, 8], ['2330', 3, 10], ['1323', 3, 10], ['0293', 3, 10], ['0076', 3, 12]]],
  ['Dia de Pernas', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ['Dia de Abdômen', 'abs', [['0274', 3, 15], ['0472', 3, 12], ['0687', 3, 20], ['0630', 3, 30], ['0002', 3, 15], ['0267', 3, 15]]],
  ['Dia de Braços', 'arm', [['0031', 3, 10], ['0313', 3, 10], ['0070', 3, 12], ['0060', 3, 10], ['0201', 3, 12], ['0057', 3, 10]]],
  ['Dia de Ombros', 'shoulders', [['0091', 4, 8], ['0334', 3, 12], ['0041', 3, 12], ['0076', 3, 12], ['2137', 3, 10], ['0326', 3, 12]]],
  ['Dia de Glúteos', 'glutes', [['1409', 4, 10], ['0043', 3, 10], ['0085', 3, 10], ['0054', 3, 12], ['0431', 3, 12], ['0586', 3, 12]]]
]

const starterRoutines = () =>
  SPEC.map(([name, emoji, list]) => ({ id: uid(), name, emoji, ex: list.map(([id, sets, reps]) => ({ id, sets, reps, weight: 0 })) }))

const PROG = {
  // Chest
  '0025': [30, 0.5], '0047': [20, 0.4], '0289': [15, 0.3], '0308': [10, 0.2], '0251': [0, 0], '0314': [15, 0.3],
  // Back
  '0652': [0, 0], '0027': [30, 0.5], '2330': [30, 0.5], '1323': [30, 0.5], '0293': [15, 0.3], '0076': [10, 0.2],
  // Legs
  '0043': [40, 1], '0085': [40, 1], '0739': [80, 2], '0585': [30, 0.5], '0586': [25, 0.5], '0605': [40, 1]
}

const WEEKS = 52
const BW_FROM = 72.4, BW_TO = 61.2
const TARGET_W = 60

const round = (w, step) => Math.round(w / step) * step
const at = (date, h, m) => { const d = new Date(date); d.setHours(h, m, 0, 0); return d.getTime() }

const routines = starterRoutines()
const [push, pull, legs] = routines
const byWeekday = { 1: push, 3: pull, 5: legs }

const nowH = new Date().getHours()
const today = new Date(); today.setHours(12, 0, 0, 0)
const start = new Date(today); start.setDate(start.getDate() - WEEKS * 7)

const workouts = []
const bodyweight = []
const exWeights = {}
const best = {}

for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
  const day = new Date(d)
  const iso = isoOf(day)
  const weekIdx = Math.floor((day - start) / (7 * 86400000))
  const p = Math.min(1, weekIdx / WEEKS)

  // weigh-ins: Monday and Thursday
  if (day.getDay() === 1 || day.getDay() === 4) {
    const w = BW_FROM + (BW_TO - BW_FROM) * p + (Math.random() - 0.5) * 0.4
    bodyweight.push({ d: iso, w: Math.round(w * 10) / 10, t: at(day, 7, 30) })
  }

  const routine = byWeekday[day.getDay()]
  if (!routine) continue

  const prs = []
  const entries = routine.ex.map((cfg, exIdx) => {
    const [base, inc] = PROG[cfg.id] || [20, 0.5]
    const step = base >= 40 ? 2.5 : 1.25
    const w = base ? Math.max(step, round((base + inc * weekIdx), step)) : 0
    const sets = []
    for (let i = 0; i < cfg.sets; i++) {
      sets.push({ w, r: cfg.reps, done: true, rir: 2 })
    }
    if (w > (best[cfg.id] || 0)) { best[cfg.id] = w; prs.push(cfg.id) }
    exWeights[cfg.id] = { w: Math.max(w, exWeights[cfg.id]?.w || 0), d: iso }
    return { id: cfg.id, sets, topW: w || null }
  })

  const bw = bodyweight.length ? bodyweight[bodyweight.length - 1].w : BW_FROM
  const startMs = at(day, 18, 5 + Math.floor(Math.random() * 15))
  const w = {
    id: uid(), d: iso, start: startMs, end: startMs + (45 + Math.floor(Math.random() * 15)) * 60000,
    routineId: routine.id, name: routine.name, bw,
    entries,
    prs: weekIdx === 0 ? [] : prs
  }
  w.vol = entries.reduce((v, e) => v + e.sets.reduce((n, s) => n + s.w * s.r, 0), 0)
  workouts.push(w)
}

const state = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'pt',
  theme: 'dark', accent: 'lime', body: 'male', targetW: TARGET_W,
  routines,
  week: { 1: push.id, 3: pull.id, 5: legs.id },
  dayPlan: {},
  workouts, bodyweight, exWeights, customEx: [], mediaSize: 'full',
  reminder: { on: false, time: '08:00', tz: null }, effort: 'rir',
  weighBeforeWorkout: true, onboardingDone: true, simpleMode: true, seenTips: {}
}

const outPath = 'C:/Users/FabianoSchmits/Desktop/perfil_1_ano.json'
fs.writeFileSync(outPath, JSON.stringify(state, null, 2))
console.log('Saved to ' + outPath)

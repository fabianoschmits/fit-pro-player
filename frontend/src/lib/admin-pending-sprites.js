import { EXDB as SOURCE_EXERCISES } from './exercises-data.js'
import PT_EXERCISE_NAMES from '../generated/pt-exercise-names.js'
import {
  EXERCISE_SPRITE_BY_EXERCISE_ID,
  EXERCISE_SPRITE_PNG_SLUGS,
  EXERCISE_SPRITE_POPULARITY_IDS,
} from './exercise-guide-assets.js'

const PNG_SLUG_SET = new Set(EXERCISE_SPRITE_PNG_SLUGS)

// Set of exercise IDs that already have verified sprite assets
const ACTIVE_SPRITE_IDS = new Set(
  Object.entries(EXERCISE_SPRITE_BY_EXERCISE_ID)
    .filter(([, slug]) => PNG_SLUG_SET.has(slug))
    .map(([id]) => id),
)

// Weights for compound lifts & most popular gym exercises based on internet query frequency & common training programs
const COMPOUND_BIG = [
  { p: /\b(bench press|supino)\b/i, score: 350 },
  { p: /\b(squat|agachamento)\b/i, score: 350 },
  { p: /\b(deadlift|levantamento terra|stiff|rdl)\b/i, score: 350 },
  { p: /\b(overhead press|shoulder press|military press|desenvolvimento)\b/i, score: 320 },
  { p: /\b(pull[\s-]?up|chin[\s-]?up|barra fixa)\b/i, score: 320 },
  { p: /\b(row|remada)\b/i, score: 310 },
  { p: /\b(lat pulldown|puxada alta|puxada)\b/i, score: 310 },
  { p: /\b(hip thrust|elevacao de quadril|elevacao pelvica)\b/i, score: 300 },
  { p: /\b(leg press)\b/i, score: 300 },
  { p: /\b(lunge|afundo|avanco|bulgarian split)\b/i, score: 280 },
  { p: /\b(dip|dips|mergulho|paralelas)\b/i, score: 280 },
  { p: /\b(push[\s-]?up|flexao de braco|flexao)\b/i, score: 280 },
]

const ISOLATION_POPULAR = [
  { p: /\b(bicep curl|biceps curl|rosca direta|rosca alternada|rosca martelo|rosca scott|rosca concentrada|rosca 21|rosca)\b/i, score: 250 },
  { p: /\b(tricep extension|triceps extension|tricep pushdown|triceps testa|triceps frances|tricep kickback|tricep press|triceps)\b/i, score: 250 },
  { p: /\b(lateral raise|elevacao lateral)\b/i, score: 240 },
  { p: /\b(front raise|elevacao frontal)\b/i, score: 200 },
  { p: /\b(rear delt|deltoide posterior|crucifixo invertido|crucifixo inverso)\b/i, score: 220 },
  { p: /\b(fly|flyes|chest fly|crucifixo)\b/i, score: 230 },
  { p: /\b(face pull)\b/i, score: 230 },
  { p: /\b(leg extension|cadeira extensora|extensao de perna)\b/i, score: 240 },
  { p: /\b(leg curl|lying leg curl|seated leg curl|mesa flexora|cadeira flexora|flexao de perna)\b/i, score: 240 },
  { p: /\b(calf raise|panturrilha em pe|panturrilha sentado|gemeos|panturrilha)\b/i, score: 220 },
  { p: /\b(shrug|shrugs|encolhimento)\b/i, score: 200 },
  { p: /\b(pec deck|peck deck|voador)\b/i, score: 210 },
  { p: /\b(hack squat|agachamento hack)\b/i, score: 230 },
  { p: /\b(ab wheel|wheel rollout|roda abdominal)\b/i, score: 200 },
  { p: /\b(crunch|sit[\s-]?up|abdominal supra|abdominal infra|abdominal|prancha|plank)\b/i, score: 210 },
  { p: /\b(pullover|puloever)\b/i, score: 210 },
]

const PENALTIES = [
  { p: /\b(with towel|com toalha)\b/i, score: -100 },
  { p: /\b(bowling motion|movimento de boliche)\b/i, score: -150 },
  { p: /\b(male|female)\b/i, score: -60 },
  { p: /\b(self assisted)\b/i, score: -40 },
]

const EQ_TIERS = {
  barbell: 70,
  dumbbell: 70,
  cable: 60,
  'leverage machine': 55,
  'smith machine': 50,
  'body weight': 45,
  'ez barbell': 40,
  kettlebell: 35,
  band: 25,
  'sled machine': 25,
  weighted: 25,
  'stability ball': 15,
  'medicine ball': 15,
  'resistance band': 15,
  roller: 10,
  'wheel roller': 10,
  'bosu ball': 5,
  rope: 5,
}

const PRIMARY_TARGETS = new Set(['pectorals', 'lats', 'quads', 'hamstrings', 'glutes', 'triceps', 'biceps', 'delts'])

export function calculateExerciseRelevance(ex, ptName = '') {
  const nameEn = (ex?.n || '').toLowerCase()
  const namePt = (ptName || '').toLowerCase()
  const text = `${nameEn} ${namePt}`
  let score = 0

  score += EQ_TIERS[ex?.eq] || 0

  let maxCompound = 0
  for (const c of COMPOUND_BIG) {
    if (c.p.test(text) && c.score > maxCompound) {
      maxCompound = c.score
    }
  }
  score += maxCompound

  let maxIso = 0
  for (const iso of ISOLATION_POPULAR) {
    if (iso.p.test(text) && iso.score > maxIso) {
      maxIso = iso.score
    }
  }
  score += maxIso

  for (const pen of PENALTIES) {
    if (pen.p.test(text)) score += pen.score
  }

  if (PRIMARY_TARGETS.has(ex?.tg)) score += 30

  return score
}

export function formatExercisePtName(rawName = '') {
  if (!rawName) return ''
  const trimmed = rawName.trim()
  return trimmed.charAt(0).toLocaleUpperCase('pt-BR') + trimmed.slice(1)
}

/**
 * Returns all exercises that do NOT yet have sprites created,
 * sorted by internet usage / popularity relevance.
 */
export function getPendingExercises() {
  const list = []
  for (const ex of SOURCE_EXERCISES) {
    if (!ACTIVE_SPRITE_IDS.has(ex.id)) {
      const rawPt = PT_EXERCISE_NAMES[ex.id] || ex.n
      const ptName = formatExercisePtName(rawPt)
      const score = calculateExerciseRelevance(ex, rawPt)
      list.push({
        id: ex.id,
        nameEn: ex.n,
        namePt: ptName,
        eq: ex.eq,
        bp: ex.bp,
        tg: ex.tg,
        score,
      })
    }
  }

  return list.sort((a, b) => b.score - a.score || a.namePt.localeCompare(b.namePt, 'pt-BR'))
}

export const TOTAL_CATALOGUE_EXERCISES = SOURCE_EXERCISES.length
export const ACTIVE_SPRITE_COUNT = ACTIVE_SPRITE_IDS.size


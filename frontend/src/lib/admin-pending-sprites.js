import { EXDB as SOURCE_EXERCISES } from './exercises-data.js'
import PT_EXERCISE_NAMES from '../generated/pt-exercise-names.js'
import PT_INSTRUCTIONS from '../instr/pt.js'
import {
  EXERCISE_SPRITE_BY_EXERCISE_ID,
  EXERCISE_SPRITE_PNG_SLUGS,
} from './exercise-guide-assets.js'
import {
  getPromptMetadata,
  getExerciseFullPrompt,
  hasPreparedPrompt,
} from './exercise-sprite-prompts.js'
import {
  SPRITE_PRIORITY_QUEUE_IDS,
  SPRITE_PRIORITY_QUEUE_SET,
  TOTAL_PRIORITY_QUEUE_EXERCISES,
} from './sprite-priority-queue.js'

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

// Pre-indexed map of catalog exercises by ID for fast lookup
const SOURCE_EXERCISES_BY_ID = new Map(SOURCE_EXERCISES.map(ex => [ex.id, ex]))

/**
 * Returns exclusively the exercises from the 100-item priority whitelist
 * that do NOT yet have sprites published, in the exact order defined by the whitelist.
 *
 * When an exercise from the priority whitelist receives sprites, it is excluded
 * without automatic replacement by other exercises from the catalogue.
 */
export function getPendingExercises() {
  const list = []
  for (const id of SPRITE_PRIORITY_QUEUE_IDS) {
    if (!ACTIVE_SPRITE_IDS.has(id)) {
      const ex = SOURCE_EXERCISES_BY_ID.get(id)
      if (!ex) continue

      const promptMeta = getPromptMetadata(id)
      const rawPt = promptMeta?.namePt || PT_EXERCISE_NAMES[id] || ex.n
      const ptName = formatExercisePtName(rawPt)
      const stepsPt = PT_INSTRUCTIONS[id] || []
      const stepsEn = ex.st || []

      list.push({
        id: ex.id,
        nameEn: ex.n,
        namePt: ptName,
        eq: ex.eq,
        bp: ex.bp,
        tg: ex.tg,
        mg: ex.mg,
        sm: ex.sm || [],
        stepsPt,
        stepsEn,
        score: 0,
        isPriority: true,
        // Prompt catalog metadata
        hasPrompt: Boolean(promptMeta),
        frameCount: promptMeta?.frameCount || null,
        family: promptMeta?.family || 'indefinido',
        status: promptMeta?.status || 'missing',
        needsReview: promptMeta?.status === 'needs_review',
        issues: promptMeta?.issues || [],
        execution: promptMeta?.execution || null,
      })
    }
  }

  return list
}

/**
 * Returns the secondary backlog of all remaining exercises (outside the 100 priority queue)
 * that do NOT yet have sprites published, sorted by relevance score / popularity.
 */
export function getRemainingBacklogExercises() {
  const list = []
  for (const ex of SOURCE_EXERCISES) {
    if (!ACTIVE_SPRITE_IDS.has(ex.id) && !SPRITE_PRIORITY_QUEUE_SET.has(ex.id)) {
      const promptMeta = getPromptMetadata(ex.id)
      const rawPt = promptMeta?.namePt || PT_EXERCISE_NAMES[ex.id] || ex.n
      const ptName = formatExercisePtName(rawPt)
      const score = calculateExerciseRelevance(ex, rawPt)
      const stepsPt = PT_INSTRUCTIONS[ex.id] || []
      const stepsEn = ex.st || []

      list.push({
        id: ex.id,
        nameEn: ex.n,
        namePt: ptName,
        eq: ex.eq,
        bp: ex.bp,
        tg: ex.tg,
        mg: ex.mg,
        sm: ex.sm || [],
        stepsPt,
        stepsEn,
        score,
        isPriority: false,
        // Prompt catalog metadata
        hasPrompt: Boolean(promptMeta),
        frameCount: promptMeta?.frameCount || null,
        family: promptMeta?.family || 'indefinido',
        status: promptMeta?.status || 'missing',
        needsReview: promptMeta?.status === 'needs_review',
        issues: promptMeta?.issues || [],
        execution: promptMeta?.execution || null,
      })
    }
  }

  return list.sort((a, b) => b.score - a.score || a.namePt.localeCompare(b.namePt, 'pt-BR'))
}

/**
 * Default base template for IA sprite creation.
 * Contains placeholders:
 * {EXERCISE_NAME_PT}, {EXERCISE_NAME_EN}, {EQUIPMENT}, {BODY_PART}, {TARGET_MUSCLE}, {BIOMECHANICS_STEPS}
 */
export const DEFAULT_PROMPT_TEMPLATE = `### EXERCÍCIO: {EXERCISE_NAME_PT} ({EXERCISE_NAME_EN})
- Equipamento: {EQUIPMENT}
- Região do corpo: {BODY_PART} | Foco muscular: {TARGET_MUSCLE}

---

### INSTRUÇÃO DE CRIAÇÃO DOS SPRITES DE ANIMAÇÃO (CICLO COMPLETO DO MOVIMENTO):

Crie uma sequência de 4 imagens (frames) que representem o ciclo COMPLETO e biomecanicamente correto da repetição do exercício, para gerar uma animação fluida em loop (1 → 2 → 3 → 4 → repete):

1. **FRAME 1 (POSIÇÃO INICIAL):**
   - O modelo na postura inicial exata do exercício, com pegada/apoio corretos, corpo alinhado e pronto para iniciar o movimento.

2. **FRAME 2 (FASE DE TRANSIÇÃO / CONCÊNTRICA OU EXCÊNTRICA):**
   - Meio do caminho do movimento. A carga/corpo se deslocando de forma suave e contínua em direção ao ponto de máxima contração ou máxima amplitude.

3. **FRAME 3 (PICO DO MOVIMENTO / MÁXIMA AMPLITUDE):**
   - O ponto ápice do exercício (ex: contração máxima ou flexão/extensão máxima controlada). Amplitude completa com boa postura biomecânica.

4. **FRAME 4 (RETORNO CONTROLADO):**
   - Meio do caminho no retorno para a posição inicial. Transição suave que conecta perfeitamente de volta ao FRAME 1 sem saltos.

---

### REGRAS OBRIGATÓRIAS DE ÂNGULO E CONSISTÊNCIA VISUAL:
- **CÂMERA RIGOROSAMENTE FIXA:** Ângulo estático fixo (sem zoom, sem rotação de câmera, sem cortes e sem mudança de enquadramento entre os frames).
- **SEM MOVIMENTO DE TELA:** O fundo, os pesos/aparelhos fixos e os pés/apoios estáveis devem permanecer EXATAMENTE na mesma posição em todas as 4 imagens para não haver tremor ("screen shake") quando a animação rodar em loop.
- **ISOLAMENTO / FUNDO:** Fundo uniforme ou transparente limpo, modelo perfeitamente centralizado com margem de segurança ao redor para que nenhuma parte do corpo saia da tela durante a execução.
- **PROPORÇÃO E RESOLUÇÃO:** Quadrado (1:1), 1024x1024, resolução nítida.
- **ILUMINAÇÃO CONSISTENTE:** Mesma direção de luz e sombras em todos os 4 frames.

---

### BIOMECÂNICA / PASSO A PASSO DO EXERCÍCIO:
{BIOMECHANICS_STEPS}`

/**
 * Retrieves the full prepared prompt for an exercise.
 * If the exercise has a prepared prompt in the catalogue, returns its exact text.
 * Returns null if no prepared prompt is available.
 *
 * Notice: This never silently creates a generic prompt when a prepared prompt is missing,
 * in strict accordance with the FPP Prompt System specification.
 */
export async function getExercisePrompt(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id
  if (!id) return null
  return await getExerciseFullPrompt(id)
}

/**
 * Legacy prompt generator retained strictly for backward compatibility.
 * Primary source for actual prompt copying is getExercisePrompt().
 */
export function generateSpritePrompt(item, customTemplate = null) {
  const meta = getPromptMetadata(item?.id)
  const namePt = (item?.namePt || meta?.namePt || '').toUpperCase()
  const nameEn = item?.nameEn || meta?.nameEn || ''
  const eq = item?.eq || meta?.eq || 'body weight'
  const bp = item?.bp || meta?.bp || ''
  const tg = item?.tg || meta?.tg || ''

  // Format biomechanical execution steps
  let executionGuide = ''
  if (Array.isArray(item?.stepsPt) && item.stepsPt.length) {
    executionGuide = item.stepsPt.map((step, i) => `${i + 1}. ${step}`).join('\n')
  } else if (Array.isArray(item?.stepsEn) && item.stepsEn.length) {
    executionGuide = item.stepsEn.map((step, i) => `${i + 1}. ${step}`).join('\n')
  } else {
    executionGuide = 'Execute a repetição completa com postura ereta, abdômen contraído e amplitude controlada.'
  }

  const template = (customTemplate && typeof customTemplate === 'string' && customTemplate.trim())
    ? customTemplate
    : DEFAULT_PROMPT_TEMPLATE

  return template
    .replace(/{EXERCISE_NAME_PT}/g, namePt)
    .replace(/{EXERCISE_NAME_EN}/g, nameEn)
    .replace(/{EQUIPMENT}/g, eq)
    .replace(/{BODY_PART}/g, bp)
    .replace(/{TARGET_MUSCLE}/g, tg)
    .replace(/{BIOMECHANICS_STEPS}/g, executionGuide)
}

export const TOTAL_CATALOGUE_EXERCISES = SOURCE_EXERCISES.length
export const ACTIVE_SPRITE_COUNT = ACTIVE_SPRITE_IDS.size
export { SPRITE_PRIORITY_QUEUE_IDS, SPRITE_PRIORITY_QUEUE_SET, TOTAL_PRIORITY_QUEUE_EXERCISES }

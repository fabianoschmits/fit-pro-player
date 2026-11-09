/**
 * Loader and manager for official pre-generated FPP exercise sprite prompts.
 *
 * Source: FPP_TODOS_1324_PROMPTS_E_EXECUCOES.json (1.324 prompts preparados)
 * Uses lightweight mini index for instant rendering (< 48 KB) and dynamic chunk loading for full prompts.
 */
import PROMPTS_MINI from '../data/exercise-sprite-prompts-mini.json'

// In-memory cache for loaded full prompt chunks: { [chunkId]: { [id]: exerciseObj } }
const loadedChunks = new Map()

// Vite glob import of chunks for on-demand dynamic loading
const chunkModules = import.meta.glob('../data/prompts/chunk_*.json')

/**
 * Returns the lightweight metadata record for an exercise from the pre-indexed catalogue.
 * Returns null if not found.
 */
export function getPromptMetadata(id) {
  if (!id) return null
  const paddedId = String(id).padStart(4, '0')
  const entry = PROMPTS_MINI[paddedId]
  if (!entry) return null
  return {
    id: paddedId,
    frameCount: entry.f || 4,
    needsReview: Boolean(entry.r),
    status: entry.r ? 'needs_review' : 'source_based_unverified',
    issues: entry.i || [],
  }
}

/**
 * Checks if a specific exercise has a valid prepared prompt.
 */
export function hasPreparedPrompt(id) {
  if (!id) return false
  const paddedId = String(id).padStart(4, '0')
  return Boolean(PROMPTS_MINI[paddedId])
}

/**
 * Retrieves the full prepared prompt text for an exercise asynchronously.
 * Loads the corresponding chunk file on demand.
 */
export async function getExerciseFullPrompt(id) {
  if (!id) return null
  const paddedId = String(id).padStart(4, '0')
  const numId = parseInt(paddedId, 10)
  if (Number.isNaN(numId)) return null

  const chunkKey = Math.floor(numId / 100)
  const chunkModulePath = `../data/prompts/chunk_${chunkKey}.json`

  if (!loadedChunks.has(chunkKey)) {
    const importer = chunkModules[chunkModulePath]
    if (!importer) {
      console.warn(`[exercise-sprite-prompts] Chunk not found for id ${id} (chunk ${chunkKey})`)
      return null
    }
    const module = await importer()
    loadedChunks.set(chunkKey, module.default || module)
  }

  const chunkData = loadedChunks.get(chunkKey)
  const exercise = chunkData ? chunkData[paddedId] : null
  return exercise?.prompt || null
}

/**
 * Retrieves the full exercise record (including execution and full prompt) asynchronously.
 */
export async function getExerciseFullData(id) {
  if (!id) return null
  const paddedId = String(id).padStart(4, '0')
  const numId = parseInt(paddedId, 10)
  if (Number.isNaN(numId)) return null

  const chunkKey = Math.floor(numId / 100)
  const chunkModulePath = `../data/prompts/chunk_${chunkKey}.json`

  if (!loadedChunks.has(chunkKey)) {
    const importer = chunkModules[chunkModulePath]
    if (!importer) return null
    const module = await importer()
    loadedChunks.set(chunkKey, module.default || module)
  }

  const chunkData = loadedChunks.get(chunkKey)
  return chunkData ? chunkData[paddedId] || null : null
}

export { PROMPTS_MINI }

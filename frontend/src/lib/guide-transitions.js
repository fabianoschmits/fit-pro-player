// Frame transition presets for Workout Guide animations.
// The first catalogue exercises (library order, top to bottom) each get a different
// style so the owner can compare them in the detail sheet and pick a winner.

import { EXDB } from './exercises-data.js'
import { exerciseGuideAsset } from './exercise-guide-assets.js'

export const GUIDE_TRANSITION_MS = 460

export const GUIDE_TRANSITION_MODES = Object.freeze([
  'drag',
  'slide-x',
  'slide-y',
  'crossfade',
  'spring',
  'blur',
  'wipe',
])

/** How many catalogue exercises show a preview badge + distinct transition. */
export const GUIDE_TRANSITION_PREVIEW_COUNT = 12

const PREVIEW_CYCLE = ['drag', 'slide-x', 'slide-y', 'crossfade', 'spring', 'blur', 'wipe']

function buildPreviewMap() {
  const map = {}
  let n = 0
  for (const ex of EXDB) {
    const asset = exerciseGuideAsset(ex)
    if (!asset) continue
    map[asset.slug] = PREVIEW_CYCLE[n % PREVIEW_CYCLE.length]
    n += 1
    if (n >= GUIDE_TRANSITION_PREVIEW_COUNT) break
  }
  return map
}

/** @type {Readonly<Record<string, string>>} */
export const GUIDE_TRANSITION_BY_SLUG = Object.freeze(buildPreviewMap())

export const GUIDE_TRANSITION_LABELS = Object.freeze({
  drag: 'arrasto',
  'slide-x': 'deslize →',
  'slide-y': 'deslize ↑',
  crossfade: 'dissolve',
  spring: 'mola',
  blur: 'blur',
  wipe: 'wipe',
})

export function guideTransitionMode(slug) {
  return GUIDE_TRANSITION_BY_SLUG[slug] || 'crossfade'
}

export function guideTransitionLabel(mode) {
  return GUIDE_TRANSITION_LABELS[mode] || mode
}

export function applyGuideFrameTransition(layers, nextFrame, prevFrame, transitionMs = GUIDE_TRANSITION_MS) {
  if (!layers?.length) return () => {}

  const hide = layer => {
    layer.classList.remove('is-active', 'is-entering', 'is-exiting')
    layer.setAttribute('aria-hidden', 'true')
  }

  if (prevFrame === null || prevFrame === nextFrame) {
    layers.forEach((layer, index) => {
      const active = index === nextFrame
      layer.classList.toggle('is-active', active)
      layer.classList.remove('is-entering', 'is-exiting')
      layer.setAttribute('aria-hidden', String(!active))
    })
    return () => {}
  }

  layers.forEach((layer, index) => {
    if (index !== nextFrame && index !== prevFrame) hide(layer)
  })

  const next = layers[nextFrame]
  const prev = layers[prevFrame]

  if (prev) {
    prev.classList.remove('is-entering', 'is-active')
    prev.classList.add('is-exiting')
    prev.setAttribute('aria-hidden', 'false')
  }

  if (next) {
    next.classList.remove('is-exiting', 'is-active')
    next.classList.add('is-entering')
    next.setAttribute('aria-hidden', 'false')
    void next.offsetWidth
    requestAnimationFrame(() => {
      next.classList.add('is-active')
      requestAnimationFrame(() => next.classList.remove('is-entering'))
    })
  }

  const timer = window.setTimeout(() => {
    if (prev) prev.classList.remove('is-exiting')
  }, transitionMs)

  return () => window.clearTimeout(timer)
}

export const EXERCISE_SVG_SPRITES = Object.freeze({
  '0001': Object.freeze({
    duration: 4560,
    frameCount: 6,
    frameWidth: 400,
    height: 265,
    posterFrame: 5,
    sequence: Object.freeze([0, 0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1]),
  }),
})

export const SVG_SPRITE_EXERCISE_IDS = Object.freeze(Object.keys(EXERCISE_SVG_SPRITES))

export function exerciseSvgSprite(ex) {
  return ex?.id ? EXERCISE_SVG_SPRITES[ex.id] || null : null
}

export function hasExerciseSvgSprite(ex) {
  return Boolean(exerciseSvgSprite(ex))
}

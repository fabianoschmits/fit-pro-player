const FRAME_WIDTH = 400
const FRAME_HEIGHT = 320

const PING_PONG = Object.freeze([0, 0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1])
const ALTERNATING = Object.freeze([0, 1, 2, 1, 0, 3, 4, 5, 4, 3])
const CYCLE = Object.freeze([0, 1, 2, 3, 4, 5])

const PATH_LOADERS = Object.freeze({
  '0001': () => import('../generated/exercise-sprites/0001.js'),
  '0002': () => import('../generated/exercise-sprites/0002.js'),
  '0003': () => import('../generated/exercise-sprites/0003.js'),
  '1512': () => import('../generated/exercise-sprites/1512.js'),
  '0006': () => import('../generated/exercise-sprites/0006.js'),
  '0007': () => import('../generated/exercise-sprites/0007.js'),
  '1368': () => import('../generated/exercise-sprites/1368.js'),
  '3293': () => import('../generated/exercise-sprites/3293.js'),
  '3294': () => import('../generated/exercise-sprites/3294.js'),
  '2355': () => import('../generated/exercise-sprites/2355.js'),
})

function sprite(id, { duration, ground = true, posterFrame = 0, sequence }) {
  return Object.freeze({
    duration,
    frameCount: 6,
    frameWidth: FRAME_WIDTH,
    ground,
    height: FRAME_HEIGHT,
    loadPaths: PATH_LOADERS[id],
    posterFrame,
    sequence,
  })
}

export const EXERCISE_SVG_SPRITES = Object.freeze({
  '0001': sprite('0001', { duration: 4560, posterFrame: 2, sequence: PING_PONG }),
  '0002': sprite('0002', { duration: 5000, sequence: ALTERNATING }),
  '0003': sprite('0003', { duration: 2400, ground: false, sequence: CYCLE }),
  '1512': sprite('1512', { duration: 6000, posterFrame: 2, sequence: ALTERNATING }),
  '0006': sprite('0006', { duration: 4400, posterFrame: 1, sequence: ALTERNATING }),
  '0007': sprite('0007', { duration: 5200, posterFrame: 1, sequence: ALTERNATING }),
  '1368': sprite('1368', { duration: 2700, sequence: CYCLE }),
  '3293': sprite('3293', { duration: 5200, ground: false, sequence: ALTERNATING }),
  '3294': sprite('3294', { duration: 5000, sequence: ALTERNATING }),
  '2355': sprite('2355', { duration: 4800, ground: false, posterFrame: 2, sequence: PING_PONG }),
})

export const SVG_SPRITE_EXERCISE_IDS = Object.freeze([
  '0001', '0002', '0003', '1512', '0006', '0007', '1368', '3293', '3294', '2355',
])

export function exerciseSvgSprite(ex) {
  return ex?.id ? EXERCISE_SVG_SPRITES[ex.id] || null : null
}

export function hasExerciseSvgSprite(ex) {
  return Boolean(exerciseSvgSprite(ex))
}

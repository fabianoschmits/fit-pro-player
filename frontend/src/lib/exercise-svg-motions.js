const DEFAULT_POSE = {
  hip: [180, 152],
  torso: 0,
  upperArmL: 0,
  forearmL: 0,
  upperArmR: 0,
  forearmR: 0,
  thighL: 0,
  shinL: 0,
  footL: 180,
  thighR: 0,
  shinR: 0,
  footR: 0,
  footShiftL: [0, 0],
  footShiftR: [0, 0],
}

function pose(values = {}) {
  const result = { ...DEFAULT_POSE, ...values }
  if (values.arms === 'head') {
    result.upperArmL = result.torso + 154
    result.forearmL = result.torso - 148
    result.upperArmR = result.torso - 154
    result.forearmR = result.torso + 148
  }
  return result
}

const floor = (y = 254) => ({ type: 'floor', y })
const mat = (x, y, width, height, rotate = 0) => ({ type: 'mat', x, y, width, height, rotate })
const bar = (y = 20) => ({ type: 'bar', y })

// These ten hand-authored sequences intentionally follow the first ten catalogue
// entries. They are a validation batch: later catalogue entries continue to use
// the bundled procedural viewer until their own reviewed SVG sequence is added.
export const SVG_EXERCISE_MOTIONS = {
  '0001': {
    view: 'front',
    profile: true,
    target: 'abs',
    duration: 4800,
    poster: 0.5,
    offsets: [0, 0.2, 0.5, 0.8, 1],
    equipment: [mat(67, 193, 250, 34)],
    poses: [
      pose({ hip: [205, 176], torso: -88, arms: 'head', thighL: -62, shinL: -28, footL: 0, thighR: -68, shinR: -24, footR: 0 }),
      pose({ hip: [205, 176], torso: -69, arms: 'head', thighL: -62, shinL: -28, footL: 0, thighR: -68, shinR: -24, footR: 0 }),
      pose({ hip: [205, 176], torso: -45, arms: 'head', thighL: -62, shinL: -28, footL: 0, thighR: -68, shinR: -24, footR: 0 }),
      pose({ hip: [205, 176], torso: -69, arms: 'head', thighL: -62, shinL: -28, footL: 0, thighR: -68, shinR: -24, footR: 0 }),
      pose({ hip: [205, 176], torso: -88, arms: 'head', thighL: -62, shinL: -28, footL: 0, thighR: -68, shinR: -24, footR: 0 }),
    ],
  },
  '0002': {
    view: 'front',
    target: 'obliques',
    duration: 5600,
    poster: 0.24,
    offsets: [0, 0.22, 0.5, 0.78, 1],
    equipment: [floor()],
    poses: [
      pose(),
      pose({ torso: 22, upperArmL: 4, forearmL: 4, upperArmR: -3, forearmR: -3 }),
      pose(),
      pose({ torso: -22, upperArmL: 3, forearmL: 3, upperArmR: -4, forearmR: -4 }),
      pose(),
    ],
  },
  '0003': {
    view: 'front',
    profile: true,
    target: 'core',
    duration: 4600,
    poster: 0.02,
    offsets: [0, 0.25, 0.5, 0.75, 1],
    equipment: [mat(64, 186, 252, 36)],
    poses: [
      pose({ hip: [181, 172], torso: -73, arms: 'head', thighL: 112, shinL: -42, footL: -8, thighR: -89, shinR: -89, footR: 0 }),
      pose({ hip: [181, 172], torso: -78, arms: 'head', thighL: -48, shinL: -8, footL: 0, thighR: -48, shinR: 42, footR: 10 }),
      pose({ hip: [181, 172], torso: -83, arms: 'head', thighL: -89, shinL: -89, footL: 0, thighR: -112, shinR: 42, footR: 8 }),
      pose({ hip: [181, 172], torso: -78, arms: 'head', thighL: -48, shinL: 42, footL: -10, thighR: -48, shinR: -8, footR: 0 }),
      pose({ hip: [181, 172], torso: -73, arms: 'head', thighL: 112, shinL: -42, footL: -8, thighR: -89, shinR: -89, footR: 0 }),
    ],
  },
  '1512': {
    view: 'front',
    profile: true,
    target: 'quads',
    duration: 6000,
    poster: 0.6,
    offsets: [0, 0.22, 0.58, 0.8, 1],
    equipment: [mat(58, 225, 254, 24)],
    poses: [
      pose({ hip: [190, 132], torso: -86, upperArmL: 1, forearmL: 0, upperArmR: -1, forearmR: 0, thighL: 3, shinL: -88, footL: 0, thighR: -2, shinR: -92, footR: 0 }),
      pose({ hip: [196, 135], torso: -88, upperArmL: 1, forearmL: 0, upperArmR: -1, forearmR: 0, thighL: 2, shinL: -88, footL: 0, thighR: -84, shinR: 5, footR: -5 }),
      pose({ hip: [207, 143], torso: -91, upperArmL: 3, forearmL: 0, upperArmR: -1, forearmR: 0, thighL: 8, shinL: -84, footL: 0, thighR: -78, shinR: 12, footR: -6 }),
      pose({ hip: [196, 135], torso: -88, upperArmL: 1, forearmL: 0, upperArmR: -1, forearmR: 0, thighL: 2, shinL: -88, footL: 0, thighR: -84, shinR: 5, footR: -5 }),
      pose({ hip: [190, 132], torso: -86, upperArmL: 1, forearmL: 0, upperArmR: -1, forearmR: 0, thighL: 3, shinL: -88, footL: 0, thighR: -2, shinR: -92, footR: 0 }),
    ],
  },
  '0006': {
    view: 'front',
    target: 'obliques',
    duration: 5000,
    poster: 0.2,
    offsets: [0, 0.23, 0.5, 0.77, 1],
    equipment: [mat(82, 54, 196, 218)],
    poses: [
      pose({ hip: [180, 151], torso: 0, upperArmL: 12, forearmL: 8, upperArmR: -12, forearmR: -8, thighL: 23, shinL: 158, footL: 180, thighR: -23, shinR: -158, footR: 0 }),
      pose({ hip: [174, 151], torso: -9, upperArmL: 7, forearmL: 4, upperArmR: -24, forearmR: -18, thighL: 23, shinL: 158, footL: 180, thighR: -23, shinR: -158, footR: 0 }),
      pose({ hip: [180, 151], torso: 0, upperArmL: 12, forearmL: 8, upperArmR: -12, forearmR: -8, thighL: 23, shinL: 158, footL: 180, thighR: -23, shinR: -158, footR: 0 }),
      pose({ hip: [186, 151], torso: 9, upperArmL: 24, forearmL: 18, upperArmR: -7, forearmR: -4, thighL: 23, shinL: 158, footL: 180, thighR: -23, shinR: -158, footR: 0 }),
      pose({ hip: [180, 151], torso: 0, upperArmL: 12, forearmL: 8, upperArmR: -12, forearmR: -8, thighL: 23, shinL: 158, footL: 180, thighR: -23, shinR: -158, footR: 0 }),
    ],
  },
  '0007': {
    view: 'back',
    target: 'lats',
    duration: 5600,
    poster: 0.26,
    offsets: [0, 0.23, 0.5, 0.77, 1],
    equipment: [{ type: 'cable', anchors: [[92, 22], [268, 22]] }, floor(260)],
    poses: [
      pose({ hip: [180, 145], wristL: [92, 29], wristR: [268, 29], armBendL: -1, armBendR: 1, thighL: 69, shinL: 2, footL: 180, thighR: -69, shinR: -2, footR: 0 }),
      pose({ hip: [180, 148], torso: 3, wristL: [151, 112], wristR: [268, 29], armBendL: -1, armBendR: 1, thighL: 69, shinL: 2, footL: 180, thighR: -69, shinR: -2, footR: 0 }),
      pose({ hip: [180, 145], wristL: [92, 29], wristR: [268, 29], armBendL: -1, armBendR: 1, thighL: 69, shinL: 2, footL: 180, thighR: -69, shinR: -2, footR: 0 }),
      pose({ hip: [180, 148], torso: -3, wristL: [92, 29], wristR: [209, 112], armBendL: -1, armBendR: 1, thighL: 69, shinL: 2, footL: 180, thighR: -69, shinR: -2, footR: 0 }),
      pose({ hip: [180, 145], wristL: [92, 29], wristR: [268, 29], armBendL: -1, armBendR: 1, thighL: 69, shinL: 2, footL: 180, thighR: -69, shinR: -2, footR: 0 }),
    ],
  },
  '1368': {
    view: 'front',
    target: 'calves',
    duration: 5200,
    poster: 0.34,
    offsets: [0, 0.25, 0.5, 0.75, 1],
    equipment: [mat(66, 215, 252, 26), { type: 'ankle-guide', center: [275, 180] }],
    poses: [
      pose({ hip: [126, 145], torso: 0, upperArmL: 18, forearmL: -58, upperArmR: -18, forearmR: 58, thighL: -76, shinL: -87, footL: -16, thighR: -70, shinR: -84, footR: -28, footShiftR: [-2, 0] }),
      pose({ hip: [126, 145], torso: 0, upperArmL: 18, forearmL: -58, upperArmR: -18, forearmR: 58, thighL: -76, shinL: -87, footL: -16, thighR: -70, shinR: -84, footR: 3, footShiftR: [0, 2] }),
      pose({ hip: [126, 145], torso: 0, upperArmL: 18, forearmL: -58, upperArmR: -18, forearmR: 58, thighL: -76, shinL: -87, footL: -16, thighR: -70, shinR: -84, footR: 28, footShiftR: [2, 0] }),
      pose({ hip: [126, 145], torso: 0, upperArmL: 18, forearmL: -58, upperArmR: -18, forearmR: 58, thighL: -76, shinL: -87, footL: -16, thighR: -70, shinR: -84, footR: 3, footShiftR: [0, -2] }),
      pose({ hip: [126, 145], torso: 0, upperArmL: 18, forearmL: -58, upperArmR: -18, forearmR: 58, thighL: -76, shinL: -87, footL: -16, thighR: -70, shinR: -84, footR: -28, footShiftR: [-2, 0] }),
    ],
  },
  '3293': {
    view: 'back',
    target: 'lats',
    duration: 6200,
    poster: 0.22,
    offsets: [0, 0.22, 0.5, 0.78, 1],
    equipment: [bar()],
    poses: [
      pose({ hip: [180, 160], wristL: [116, 20], wristR: [244, 20], armBendL: -1, armBendR: 1, thighL: 3, shinL: 2, footL: 180, thighR: -3, shinR: -2, footR: 0 }),
      pose({ hip: [146, 126], torso: -6, wristL: [116, 20], wristR: [244, 20], armBendL: -1, armBendR: 1, thighL: 3, shinL: 2, footL: 180, thighR: -3, shinR: -2, footR: 0 }),
      pose({ hip: [180, 160], wristL: [116, 20], wristR: [244, 20], armBendL: -1, armBendR: 1, thighL: 3, shinL: 2, footL: 180, thighR: -3, shinR: -2, footR: 0 }),
      pose({ hip: [214, 126], torso: 6, wristL: [116, 20], wristR: [244, 20], armBendL: -1, armBendR: 1, thighL: 3, shinL: 2, footL: 180, thighR: -3, shinR: -2, footR: 0 }),
      pose({ hip: [180, 160], wristL: [116, 20], wristR: [244, 20], armBendL: -1, armBendR: 1, thighL: 3, shinL: 2, footL: 180, thighR: -3, shinR: -2, footR: 0 }),
    ],
  },
  '3294': {
    view: 'front',
    target: 'pectorals',
    duration: 6200,
    poster: 0.22,
    offsets: [0, 0.22, 0.5, 0.78, 1],
    equipment: [mat(43, 51, 274, 190)],
    poses: [
      pose({ hip: [211, 145], torso: -90, wristL: [143, 242], wristR: [143, 48], armBendL: 1, armBendR: -1, thighL: -94, shinL: -92, footL: 0, thighR: -86, shinR: -88, footR: 0 }),
      pose({ hip: [211, 166], torso: -90, wristL: [143, 242], wristR: [143, 48], armBendL: 1, armBendR: -1, thighL: -94, shinL: -92, footL: 0, thighR: -86, shinR: -88, footR: 0 }),
      pose({ hip: [211, 145], torso: -90, wristL: [143, 242], wristR: [143, 48], armBendL: 1, armBendR: -1, thighL: -94, shinL: -92, footL: 0, thighR: -86, shinR: -88, footR: 0 }),
      pose({ hip: [211, 124], torso: -90, wristL: [143, 242], wristR: [143, 48], armBendL: 1, armBendR: -1, thighL: -94, shinL: -92, footL: 0, thighR: -86, shinR: -88, footR: 0 }),
      pose({ hip: [211, 145], torso: -90, wristL: [143, 242], wristR: [143, 48], armBendL: 1, armBendR: -1, thighL: -94, shinL: -92, footL: 0, thighR: -86, shinR: -88, footR: 0 }),
    ],
  },
  '2355': {
    view: 'front',
    target: 'abs',
    duration: 4800,
    poster: 0.5,
    offsets: [0, 0.2, 0.5, 0.8, 1],
    equipment: [bar(13)],
    poses: [
      pose({ hip: [180, 158], wristL: [109, 13], wristR: [251, 13], armBendL: -1, armBendR: 1, thighL: 9, shinL: 163, footL: 170, thighR: -9, shinR: -163, footR: 10 }),
      pose({ hip: [180, 158], wristL: [109, 13], wristR: [251, 13], armBendL: -1, armBendR: 1, thighL: 82, shinL: 12, footL: 0, thighR: -82, shinR: -12, footR: 180 }),
      pose({ hip: [180, 158], wristL: [109, 13], wristR: [251, 13], armBendL: -1, armBendR: 1, thighL: 132, shinL: 19, footL: 0, thighR: -132, shinR: -19, footR: 180 }),
      pose({ hip: [180, 158], wristL: [109, 13], wristR: [251, 13], armBendL: -1, armBendR: 1, thighL: 82, shinL: 12, footL: 0, thighR: -82, shinR: -12, footR: 180 }),
      pose({ hip: [180, 158], wristL: [109, 13], wristR: [251, 13], armBendL: -1, armBendR: 1, thighL: 9, shinL: 163, footL: 170, thighR: -9, shinR: -163, footR: 10 }),
    ],
  },
}

// Keep catalogue order explicit: JavaScript sorts integer-like object keys ahead
// of zero-padded ids when Object.keys() is used.
export const SVG_EXERCISE_IDS = Object.freeze([
  '0001', '0002', '0003', '1512', '0006', '0007', '1368', '3293', '3294', '2355',
])

export function exerciseSvgMotion(ex) {
  return SVG_EXERCISE_MOTIONS[ex?.id] || null
}

export function hasExerciseSvgMotion(ex) {
  return Boolean(exerciseSvgMotion(ex))
}

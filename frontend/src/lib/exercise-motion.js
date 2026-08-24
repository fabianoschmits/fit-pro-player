import EMBEDDED_MOTIONS from '../generated/exercise-motions.js'

// A few common gym patterns are not part of Posecode's example library yet. These
// small, inspectable movement programs are ours and use the same joint vocabulary.
const CUSTOM_MOTIONS = {
  'pull-up': `posecode exercise "Pull-up cycle"
  rig humanoid
  prop bar
  pose start = standing
  step "Hang" 0.7s settle:
    shoulders: flex 175
    elbows: flex 5
    elbows: pronate 80
    grip: hands bar
    cue "Hang from the bar with the arms long and the shoulders active"
  step "Pull" 1.2s drive:
    shoulders: flex 90
    elbows: flex 125
    elbows: pronate 80
    spine: extend 12
    chest: extend 10
    grip: hands bar
    cue "Drive both elbows down and bring the upper chest toward the bar"
  step "Lower" 1.5s settle:
    shoulders: flex 175
    elbows: flex 5
    elbows: pronate 80
    spine: extend 0
    chest: extend 0
    grip: hands bar
    cue "Lower under control to a full hang without releasing the bar"
  repeat 8`,
  'archer-pull-up': `posecode exercise "Archer pull-up"
  rig humanoid
  prop bar
  pose start = standing
  step "Hang wide" 0.7s settle:
    shoulders: flex 175
    shoulders: abduct 25
    elbows: flex 5
    elbows: pronate 80
    grip: hands bar
    cue "Hang from a wide grip with both arms long"
  step "Pull right" 1.3s drive:
    shoulder_right: flex 90
    shoulder_right: abduct 20
    elbow_right: flex 130
    shoulder_left: flex 160
    shoulder_left: abduct 55
    elbow_left: flex 8
    spine: abduct 14
    grip: hands bar
    cue "Pull toward the right hand while the left arm remains nearly straight"
  step "Cross through" 1.2s settle:
    shoulders: flex 175
    shoulders: abduct 25
    elbows: flex 5
    grip: hands bar
    cue "Return through a controlled wide hang"
  step "Pull left" 1.3s drive:
    shoulder_left: flex 90
    shoulder_left: abduct 20
    elbow_left: flex 130
    shoulder_right: flex 160
    shoulder_right: abduct 55
    elbow_right: flex 8
    spine: adduct 14
    grip: hands bar
    cue "Pull toward the left hand while the right arm remains nearly straight"
  step "Lower" 1.2s settle:
    shoulders: flex 175
    shoulders: abduct 25
    elbows: flex 5
    grip: hands bar
    cue "Lower to the wide hang without releasing the bar"
  repeat 5`,
  'push-up': `posecode exercise "Push-up"
  rig humanoid
  pose start = plank
  step "Lower" 1.2s settle:
    elbows: flex 95
    shoulders: extend 15
    ground-lock: hands, feet
    cue "Lower the chest between the planted hands while the body stays braced"
  step "Press" 1s drive:
    elbows: flex 5
    shoulders: extend 0
    ground-lock: hands, feet
    cue "Press the floor away and return to a straight-arm plank"
  repeat 8`,
  'chest-press': `posecode exercise "Chest press"
  rig humanoid
  pose start = supine
  step "Lower" 1.3s settle:
    shoulders: flex 55
    shoulders: abduct 55
    elbows: flex 100
    ground-lock: back, feet
    cue "Lower the hands beside the chest with the elbows bent"
  step "Press" 1s drive:
    shoulders: flex 90
    shoulders: abduct 10
    elbows: flex 5
    ground-lock: back, feet
    cue "Press both hands above the chest until the elbows are almost straight"
  repeat 8`,
  'overhead-press': `posecode exercise "Overhead press"
  rig humanoid
  pose start = standing
  step "Rack" 1.1s settle:
    shoulders: flex 85
    shoulders: abduct 45
    elbows: flex 105
    ground-lock: feet
    cue "Hold the hands beside the shoulders with the elbows bent"
  step "Press" 1s drive:
    shoulders: flex 165
    shoulders: abduct 15
    elbows: flex 5
    ground-lock: feet
    cue "Press overhead without leaning the torso back"
  repeat 8`,
  'chest-fly': `posecode exercise "Chest fly"
  rig humanoid
  pose start = supine
  step "Open" 1.5s settle:
    shoulders: flex 20
    shoulders: abduct 85
    elbows: flex 15
    ground-lock: back, feet
    cue "Open both arms in a wide arc with a soft bend at the elbows"
  step "Close" 1.2s drive:
    shoulders: flex 90
    shoulders: abduct 8
    elbows: flex 15
    ground-lock: back, feet
    cue "Bring the hands together above the chest in the same arc"
  repeat 8`,
  'triceps-extension': `posecode exercise "Overhead triceps extension"
  rig humanoid
  pose start = standing
  step "Lower" 1.4s settle:
    shoulders: flex 165
    elbows: flex 125
    ground-lock: feet
    cue "Keep the upper arms overhead and bend only the elbows"
  step "Extend" 1s drive:
    shoulders: flex 165
    elbows: flex 5
    ground-lock: feet
    cue "Straighten the elbows while the upper arms remain still"
  repeat 10`,
  'triceps-pushdown': `posecode exercise "Triceps pushdown"
  rig humanoid
  pose start = standing
  step "Return" 1.2s settle:
    shoulders: flex 10
    elbows: flex 105
    ground-lock: feet
    cue "Keep the elbows beside the ribs as the forearms rise"
  step "Push down" 0.9s drive:
    shoulders: flex 10
    elbows: flex 5
    ground-lock: feet
    cue "Extend the elbows and finish with the hands beside the thighs"
  repeat 10`,
  'leg-extension': `posecode exercise "Seated leg extension"
  rig humanoid
  pose start = seated
  step "Extend" 1s drive:
    knees: flex 5
    cue "Straighten both knees without lifting the thighs"
  step "Lower" 1.5s settle:
    knees: flex 90
    cue "Bend the knees and lower the shins under control"
  repeat 10`,
  'leg-press': `posecode exercise "Leg press"
  rig humanoid
  pose start = supine
  step "Lower" 1.5s settle:
    hips: flex 100
    knees: flex 115
    ankles: dorsiflex 12
    ground-lock: back
    cue "Bring the knees toward the torso while the back stays supported"
  step "Press" 1s drive:
    hips: flex 25
    knees: flex 10
    ankles: dorsiflex 0
    ground-lock: back
    cue "Extend the hips and knees without locking them forcefully"
  repeat 10`,
  'front-raise': `posecode exercise "Front raise"
  rig humanoid
  pose start = standing
  step "Raise" 1.2s settle:
    shoulders: flex 90
    elbows: flex 10
    ground-lock: feet
    cue "Raise the arms forward to shoulder height"
  step "Lower" 1.5s settle:
    shoulders: flex 0
    elbows: flex 5
    ground-lock: feet
    cue "Lower the arms without swinging the torso"
  repeat 8`,
  'reverse-fly': `posecode exercise "Reverse fly"
  rig humanoid
  pose start = standing
  step "Hinge" 1.2s settle:
    pelvis: hinge 65
    knees: flex 18
    shoulders: flex 65
    elbows: flex 12
    ground-lock: feet
    cue "Hinge forward with a long spine and let the arms hang"
  step "Open" 1.1s drive:
    pelvis: hinge 65
    knees: flex 18
    shoulders: abduct 90
    elbows: flex 12
    ground-lock: feet
    cue "Open the arms to the sides and squeeze the shoulder blades"
  step "Lower" 1.3s settle:
    pelvis: hinge 65
    knees: flex 18
    shoulders: flex 65
    elbows: flex 12
    ground-lock: feet
    cue "Return the arms below the shoulders without losing the hinge"
  repeat 8`,
  'squat-row': `posecode exercise "Squat to row"
  rig humanoid
  pose start = standing
  step "Squat" 1.3s settle:
    hips: flex 75
    knees: flex 90
    pelvis: hinge 20
    shoulders: flex 70
    elbows: flex 10
    ground-lock: feet
    cue "Sit into the squat with the arms extended"
  step "Stand and row" 1.1s drive:
    hips: flex 0
    knees: flex 0
    pelvis: hinge 0
    shoulders: extend 10
    elbows: flex 95
    ground-lock: feet
    cue "Stand and draw the elbows behind the ribs"
  repeat 8`,
  'thruster': `posecode exercise "Squat to overhead press"
  rig humanoid
  pose start = standing
  step "Squat" 1.3s settle:
    hips: flex 80
    knees: flex 95
    pelvis: hinge 22
    shoulders: flex 85
    elbows: flex 105
    ground-lock: feet
    cue "Descend with the hands held at shoulder height"
  step "Drive and press" 1.1s drive:
    hips: flex 0
    knees: flex 0
    pelvis: hinge 0
    shoulders: flex 165
    elbows: flex 5
    ground-lock: feet
    cue "Stand powerfully and finish with the arms overhead"
  repeat 8`,
  'deadlift-row': `posecode exercise "Deadlift to row"
  rig humanoid
  pose start = standing
  step "Hinge" 1.4s settle:
    pelvis: hinge 70
    hips: flex 65
    knees: flex 22
    shoulders: flex 65
    elbows: flex 10
    ground-lock: feet
    cue "Hinge with a flat back and straight arms"
  step "Row" 1s drive:
    pelvis: hinge 70
    hips: flex 65
    knees: flex 22
    shoulders: extend 10
    elbows: flex 95
    ground-lock: feet
    cue "Pull the elbows past the ribs while holding the hinge"
  step "Stand" 1.2s drive:
    pelvis: hinge 0
    hips: flex 0
    knees: flex 0
    shoulders: flex 0
    elbows: flex 5
    ground-lock: feet
    cue "Extend the hips and return to standing"
  repeat 8`,
  'olympic-lift': `posecode exercise "Olympic lift"
  rig humanoid
  pose start = standing
  step "Load" 1.2s settle:
    pelvis: hinge 65
    hips: flex 75
    knees: flex 85
    shoulders: flex 45
    elbows: flex 5
    ground-lock: feet
    cue "Load the hips and knees with the arms long"
  step "Drive overhead" 0.8s drive:
    pelvis: hinge 0
    hips: flex 0
    knees: flex 20
    shoulders: flex 165
    elbows: flex 5
    ground-lock: feet
    cue "Extend the body and receive the load overhead"
  repeat 6`,
  'hip-extension': `posecode exercise "Hip extension"
  rig humanoid
  pose start = standing
  step "Extend" 1.2s settle:
    hip_right: extend 25
    knee_right: flex 8
    ground-lock: foot_left
    cue "Move one leg behind the body without arching the lower back"
  step "Return" 1.3s settle:
    hip_right: extend 0
    knee_right: flex 0
    ground-lock: foot_left
    reach: foot_right floor
    cue "Return the foot under the hip with control"
  repeat 8`,
}

const MOTIONS = { ...EMBEDDED_MOTIONS, ...CUSTOM_MOTIONS }

const rules = [
  [/\b(?:squat).*\b(?:row)|\b(?:row).*\b(?:squat)/, 'squat-row'],
  [/\b(?:squat).*\b(?:press)|\bthruster\b/, 'thruster'],
  [/\b(?:deadlift).*\b(?:row)|\b(?:row).*\b(?:deadlift)/, 'deadlift-row'],
  [/\b(?:snatch|clean(?: and)? jerk|clean & jerk|power clean|hang clean)\b/, 'olympic-lift'],
  [/\bmountain climber\b/, 'mountain-climber'],
  [/\b(?:push[ -]?up|press[ -]?up)\b/, 'push-up'],
  [/\b(?:bench press|chest press|floor press|svend press)\b/, 'chest-press'],
  [/\b(?:pec deck|chest fly|chest flye|cable fly|cable cross|cross[ -]?over)\b/, 'chest-fly'],
  [/\b(?:reverse fly|rear delt fly|rear deltoid)\b/, 'reverse-fly'],
  [/\b(?:shoulder press|military press|overhead press|arnold press|bradford press)\b/, 'overhead-press'],
  [/\b(?:front raise|forward raise)\b/, 'front-raise'],
  [/\b(?:lateral raise|side raise|t[ -]?raise|y[ -]?raise|shoulder abduction)\b/, 'lateral-raise'],
  [/\b(?:triceps? pushdown|push[ -]?down)\b/, 'triceps-pushdown'],
  [/\b(?:triceps? extension|skull ?crusher|triceps? kickback)\b/, 'triceps-extension'],
  [/\b(?:chest|triceps?) dip\b|\bdips?\b/, 'triceps-dips'],
  [/\barcher.*\b(?:pull[ -]?up|chin[ -]?up)|\b(?:pull[ -]?up|chin[ -]?up).*\barcher\b/, 'archer-pull-up'],
  [/\b(?:pull[ -]?up|chin[ -]?up|pulldown|pull down|dead hang)\b/, 'pull-up'],
  [/\b(?:row|rowing)\b/, 'bent-over-row'],
  [/\bdeadlift\b/, 'deadlift'],
  [/\b(?:good morning|hip hinge)\b/, 'good-morning'],
  [/\b(?:box squat|squat to bench)\b/, 'box-squat'],
  [/\bwall sit\b/, 'wall-sit'],
  [/\bsquats?\b/, 'squat'],
  [/\b(?:lunges?|split squat|bulgarian)\b/, 'forward-lunge'],
  [/\b(?:step[ -]?up|stepbox)\b/, 'step-up'],
  [/\b(?:leg press|hack press)\b/, 'leg-press'],
  [/\b(?:leg extension|knee extension)\b/, 'leg-extension'],
  [/\b(?:leg curl|hamstring curl|femoral)\b/, 'standing-hamstring-curl'],
  [/\b(?:calf raise|heel raise|calf press)\b/, 'heel-raises'],
  [/\b(?:glute bridge|hip thrust|hip raise|hip lift)\b/, 'glute-bridge'],
  [/\b(?:hip abduction|leg abduction|side leg|lateral leg)\b/, 'hip-abduction'],
  [/\b(?:hip extension|glute kickback|donkey kick)\b/, 'hip-extension'],
  [/\b(?:hanging|suspended).*\b(?:leg raise|knee raise)|\barm slingers\b/, 'hanging-knee-raise'],
  [/\b(?:leg raise|knee raise|hip flexion)\b/, 'supine-leg-raise'],
  [/\b(?:bicycle|air bike)\b/, 'bicycle-crunch'],
  [/\bdead bug\b/, 'dead-bug'],
  [/\b(?:sit[ -]?up|crunch|abdominal)\b/, 'crunch'],
  [/\b(?:plank|power point)\b/, 'plank-hold'],
  [/\bsuperman\b|\bback extension\b|\bhyperextension\b/, 'superman'],
  [/\b(?:biceps? curl|hammer curl|preacher curl|concentration curl|zottman|spider curl)\b/, 'biceps-curl'],
  [/\b(?:wrist|forearm|grip|finger)\b/, 'wrist-forearm-rolls'],
  [/\b(?:shrug|scapul|shoulder blade|retraction)\b/, 'shoulder-blade-retraction'],
  [/\b(?:arm circle|shoulder circle)\b/, 'arm-circles'],
  [/\b(?:shoulder roll)\b/, 'shoulder-rolls'],
  [/\b(?:russian twist|seated twist|torso twist)\b/, 'seated-torso-twist'],
  [/\b(?:twist|rotation|rotational)\b/, 'spinal-twist'],
  [/\bside bend\b/, 'side-bend'],
  [/\b(?:neck rotation|neck circle)\b/, 'neck-rotation'],
  [/\bneck.*\bstretch|\bstretch.*\bneck/, 'neck-side-stretch'],
  [/\b(?:quad|quadriceps).*\bstretch|\bstretch.*\b(?:quad|quadriceps)/, 'standing-quad-stretch'],
  [/\b(?:hamstring|femoral).*\bstretch|\bstretch.*\b(?:hamstring|femoral)/, 'seated-forward-fold'],
  [/\b(?:chest|pec).*\bstretch|\bstretch.*\b(?:chest|pec)/, 'chest-opener'],
  [/\b(?:shoulder|deltoid).*\bstretch|\bstretch.*\b(?:shoulder|deltoid)/, 'shoulder-stretch'],
  [/\b(?:toe touch|forward fold)\b/, 'touch-toes'],
  [/\bcobra\b/, 'cobra'],
  [/\b(?:jumping jack|astride jump)\b/, 'jumping-jacks'],
  [/\b(?:high knee|march)\b/, 'high-knee-march'],
  [/\b(?:front kick|kick)\b/, 'front-kick'],
  [/\b(?:run|walk|sprint|jog|treadmill)\b/, 'walk-cycle'],
  [/\b(?:jump|hop|skip)\b/, 'jumping-jacks'],
]

const fallbackByBodyPart = {
  back: 'bent-over-row', cardio: 'walk-cycle', chest: 'push-up',
  'lower arms': 'wrist-forearm-rolls', 'lower legs': 'heel-raises', neck: 'neck-rotation',
  shoulders: 'lateral-raise', 'upper arms': 'biceps-curl', 'upper legs': 'squat', waist: 'crunch',
}

// ExerciseDB has hundreds of equipment, grip and angle variants. Once the
// highly specific rules above have had a chance to identify a movement, these
// body-part-aware rules keep those variants on the correct joint pattern
// instead of falling back to a generic animation for the region.
function bodyPartMotion(ex, name) {
  switch (ex?.bp) {
    case 'upper arms':
      if (/\b(?:curl|drag curl)\b/.test(name)) return 'biceps-curl'
      if (/\b(?:extension|kickback|french press|pin press)\b/.test(name)) return 'triceps-extension'
      break
    case 'chest':
      if (/\b(?:fly|flye|flyes|crossover|breathing pullover|pullover)\b/.test(name)) return 'chest-fly'
      if (/\bpress\b/.test(name)) return 'chest-press'
      break
    case 'shoulders':
      if (/\b(?:rear|reverse).*(?:fly|raise)|(?:fly|raise).*(?:rear|reverse)\b/.test(name)) return 'reverse-fly'
      if (/\b(?:press|jerk)\b/.test(name)) return 'overhead-press'
      if (/\b(?:front|forward).*\braise\b/.test(name)) return 'front-raise'
      if (/\b(?:raise|iron cross|around the world|round arm)\b/.test(name)) return 'lateral-raise'
      break
    case 'upper legs':
      if (/\b(?:clean|snatch|tire flip)\b/.test(name)) return 'olympic-lift'
      if (/\b(?:leg|sled).*(?:press)|(?:press).*(?:leg|sled)\b/.test(name)) return 'leg-press'
      if (/\b(?:bridge|pelvic tilt|hip lift|hip raise)\b/.test(name)) return 'glute-bridge'
      if (/\b(?:adduction|abduction|side lying leg)\b/.test(name)) return 'hip-abduction'
      if (/\b(?:pull through|swing|hip extension)\b/.test(name)) return 'hip-extension'
      if (/\b(?:hamstring|glute ham|leg curl|femoral)\b/.test(name)) return 'standing-hamstring-curl'
      if (/\b(?:leg extension|knee extension)\b/.test(name)) return 'leg-extension'
      if (/\b(?:flutter kick|swimmer kick)\b/.test(name)) return 'hip-flexion-demo'
      if (/\bstretch\b/.test(name)) return 'seated-forward-fold'
      break
    case 'waist':
      if (/\b(?:rollout|rollerout|ab roller|body saw|inchworm|planche|l-sit|maltese|flag)\b/.test(name)) return 'plank-hold'
      if (/\b(?:pallof|landmine 180|windmill|judo flip|standing lift|slam|figure 8)\b/.test(name)) return 'spinal-twist'
      if (/\bheel touch/.test(name)) return 'side-bend'
      if (/\b(?:v-up|curl-up|cocoon|elbow.to.knee|otis up|butt-ups)\b/.test(name)) return 'crunch'
      if (/\bpelvic tilt\b/.test(name)) return 'glute-bridge'
      break
    case 'lower legs':
      if (/\b(?:ankle|calf|heel|toe|tibialis|gastrocnemius|soleus)\b/.test(name)) return 'heel-raises'
      break
    case 'cardio':
      if (/\b(?:burpee|bear crawl)\b/.test(name)) return 'mountain-climber'
      if (/\b(?:scissor|skater|ski step|side hop)\b/.test(name)) return 'jumping-jacks'
      if (/\b(?:cycle|stepmill|step machine)\b/.test(name)) return 'high-knee-march'
      break
    case 'back':
      if (/\b(?:pullover|muscle-up|muscle up|rope climb|chin|lever)\b/.test(name)) return 'pull-up'
      if (/\b(?:lat|back|spine).*(?:stretch)|(?:stretch).*(?:lat|back|spine)|upward facing dog|sphinx\b/.test(name)) return 'cobra'
      if (/\bslam\b/.test(name)) return 'pull-up'
      break
    case 'lower arms':
      if (/\b(?:pronation|supination|rotate|rotation|gripper|hand squeeze)\b/.test(name)) return 'wrist-forearm-rolls'
      break
    default:
      break
  }
  return null
}

export function exerciseMotion(ex) {
  const name = String(ex?.n || '').toLowerCase()
  const match = rules.find(([pattern]) => pattern.test(name))
  const inferred = match?.[1] || bodyPartMotion(ex, name)
  const key = inferred || fallbackByBodyPart[ex?.bp] || 'overhead-reach-reset'
  return { key, source: MOTIONS[key], matched: Boolean(inferred) }
}

export const EXERCISE_MOTIONS = MOTIONS

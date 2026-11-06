// Explicit functional-state projection, shared by browser, native storage and recovery copies.
// Strings are retained only in documented user-data fields, never arbitrary containers.
const scalar = value => value === null || ['string','number','boolean'].includes(typeof value) ? value : undefined
const fields = names => Object.fromEntries(names.split(' ').map(key => [key, scalar]))
const record = schema => value => value === null ? null : value && typeof value === 'object' && !Array.isArray(value)
 ? Object.fromEntries(Object.entries(schema).filter(([key]) => Object.hasOwn(value,key)).map(([key,project]) => [key,project(value[key])]).filter(([,v]) => v !== undefined)) : undefined
const list = project => value => Array.isArray(value) ? value.map(project).filter(v => v !== undefined) : undefined
const dictionary = (keyPattern, project) => value => value && typeof value === 'object' && !Array.isArray(value)
 ? Object.fromEntries(Object.entries(value).filter(([key]) => keyPattern.test(key)).map(([key,v]) => [key,project(v)]).filter(([,v]) => v !== undefined)) : undefined
const id = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,255}$/
const day = /^[0-6]$/
const date = /^\d{4}-\d{2}-\d{2}$/
const set = record(fields('id w r reps rir rpe dur sec min speed done weight rest type completedAt phase mode warmup'))
const progressionPlan = record({...fields('policy kind weight reps sec sets'),why:list(scalar)})
const prescription = record({...fields('id name mode sets reps weight load rest notes min sec speed rir rpe exerciseId group supersetId sg effort prog repsMin repsMax increment unit policy warmup bodyweight side inc progOverride'), plan:list(set)})
const entry = record({...fields('id name mode notes sg topW replacedFrom replacedBy'), muscleSnapshot:record({...fields('n bp'),muscleWeights:dictionary(id,scalar),muscleGroups:list(scalar)}), sets:list(set), target:prescription, plan:progressionPlan})
const routineMarkers = fields('planGenerated personalizedKey planGoal planExperience planSignature starterCustomName starter starterKey starterId starterName')
const flex = record({...fields('targetMinutes preferredMinutes estimatedMinutes mode phase'),outline:list(record({...fields('key exerciseId selected name sets sg')}))})
const routine = record({...routineMarkers,...fields('id name title emoji assigned assignedDayKey assignmentId programVersionId prog starter starterKey starterId starterName archived'), ex:list(prescription)})
const workout = record({...fields('id d name routineId start end duration note notes status pausedAt pauseMs restEnd restSec assignmentId programVersionId writerToken revision sessionId freestyle mode durationMs vol bw cur professionalExecutionId assignedDayKey progressionApplied massUnit endedEarly'), flex,entries:list(entry),prs:list(scalar),prescribedEntries:list(prescription)})
const profile = record(fields('name avatarId birthDate sex heightCm startWeight goal experience completedAt preferredWorkoutMinutes'))
const assigned = record(fields('assignmentId programId versionId versionNumber updatedAt receivedAt'))
const notifications = record({...fields('rest timedSet workoutReminder professional weightReminder measurementReminder trainingTime checkinTime leadMinutes checkinDay'),quietHours:record(fields('enabled start end'))})
const schedule = record({week:dictionary(day,scalar),dayPlan:dictionary(date,scalar), assignedProgram:assigned,...fields('libraryId libraryTitle')})
const wirePlan = record({mode:scalar,schedule,routines:list(record({id:scalar,title:scalar,prescription:record({...routineMarkers,...fields('emoji assigned assignedDayKey assignmentId programVersionId prog'),ex:list(prescription)})}))})
const preferenceSchema = {...fields('displayUnit massUnit stateSchemaVersion restSec sound keepAwake lang theme accent body targetW mediaSize effort weighBeforeWorkout onboardingDone simpleMode'),profile,notifications,
 reminder:record(fields('on time tz')),bodyMeasurementGoals:dictionary(/^(chest|waist|hips|neck|shoulders|abdomen|(?:left|right)-(?:arm|forearm|thigh|calf))$/,scalar),
 seenTips:dictionary(id,scalar), pwaInstallPrompt:record(fields('dismissForever snoozeUntil'))}
const wirePreference = record({displayUnit:scalar,values:record(preferenceSchema)})
const wireBody = record({weights:list(record(fields('id date weightKg'))),measurements:list(record({...fields('id date note'),valuesCm:dictionary(/^(chest|waist|hips|neck|shoulders|abdomen|(?:left|right)-(?:arm|forearm|thigh|calf))$/,scalar)}))})
const conflict = project => record({base:project,local:project,remote:project,path:scalar})
const schema = {...preferenceSchema,...fields('planMode bodyServerRevision planServerRevision activeLibraryId activeLibraryTitle _ts unit'),
 routines:list(routine), week:dictionary(day,scalar),dayPlan:dictionary(date,scalar),
 workouts:list(workout),active:workout,exWeights:dictionary(id,value => typeof value === 'number' ? value : record(fields('w d sec min speed rir rpe'))(value)),
 bodyweight:list(record(fields('id d w t'))), bodyMeasurements:list(record({...fields('id date notes createdAt updatedAt'),values:dictionary(/^(chest|waist|hips|neck|shoulders|abdomen|(?:left|right)-(?:arm|forearm|thigh|calf))$/,value => typeof value === 'number' ? value : undefined)})),
 customEx:list(record({...fields('id name n bp tg eq custom muscle equipment mode secondary instructions image desc'),sm:list(scalar),muscleGroups:list(scalar),muscleWeights:dictionary(id,scalar)})),
 assignedProgram:assigned,_pendingSync:record(fields('plan preferences body history')),_pendingWorkoutDeletes:list(scalar),
 pendingProfessionalEvents:list(record({...fields('id accountId kind assignmentId programId versionId createdAt occurredAt type status executionId dayKey attempts lastError blocked'),payload:record({flex,...fields('source workoutId workoutName start end massUnit durationMs'),prescription:list(prescription),entries:list(entry),workout})})),
 professionalProgramDrafts:dictionary(id,record({title:scalar,workspace:record({routines:list(routine),week:dictionary(day,scalar)}),...fields('revision sentRevision updatedAt')})),
 _syncBases:record({plan:wirePlan,preferences:wirePreference,body:wireBody}),_syncConflicts:record({plan:conflict(wirePlan),preferences:conflict(wirePreference),body:conflict(wireBody)}),
}
export const projectPersistedState = record(schema)

const operationPayload = record({...fields('entryIndex setIndex exerciseId entryId setId massUnit note reason durationMs workoutId endedEarly'),set,entry,workout,active:workout,entries:list(entry),exercises:list(entry)})
const snapshot = record({flex,...fields('id d start end durationMs routineId name bw cur professionalExecutionId assignmentId programVersionId assignedDayKey massUnit bodyweightKg'),entries:list(entry),exercises:list(entry),prescribedEntries:list(prescription)})
export const projectSessionRecovery = record({...fields('schemaVersion accountId phase updatedAt'),session:record({...fields('id accountId routineId assignmentId status revision writerToken massUnit startedAt completedAt updatedAt'),prescriptionSnapshot:snapshot}),pendingOperations:list(record({...fields('operationId kind'),payload:operationPayload}))})

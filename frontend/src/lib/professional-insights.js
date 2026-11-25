import { compareTraining } from './training-comparison.js'
import { detectTrainingChanges } from './training-checkin.js'
import { completedWeeklyHistory, workoutCalendarDate } from './weekly-progress-core.js'
import { addCalendarDays, calendarDate, getWeekStart, resolveWeeklyTimeZone } from './weekly-progress-calendar.js'

export const PROFESSIONAL_INSIGHT_LIMITS = Object.freeze({ days:14, recent:5, lowRatio:0.75, minimumPlannedSets:4, recurrence:3, equipment:2, flexReduction:0.2 })
export const PROFESSIONAL_INSIGHT_TYPES = {
 recurring_time_constraint:['attention','Recurring time constraints','Review workout duration'],
 recurring_low_completion:['attention','Execution below the confirmed plan','Review planning'],
 recurring_equipment_unavailable:['attention','Equipment unavailable repeatedly','Review exercise alternatives'],
 recurring_exercise_changes:['attention','Recurring exercise changes','Review planned exercises'],
 reduced_training_frequency:['attention','Reduced training frequency','View weekly evolution'],
 no_recent_workouts:['attention','No recent workouts recorded','View student history'],
 recurring_fatigue:['attention','Tiredness reported in workouts','Review shared training context'],
 reported_discomfort:['review','Discomfort reported by the student','View related workout'],
 frequent_flex_adjustments:['attention','Frequent duration adjustments','Review preferred duration'],
 positive_training_consistency:['positive','Consistent training records','View evolution'],
}
/** @type {{complete:boolean,scope?:string,status?:string,timeZone?:string,start?:string,end?:string}} */
const DEFAULT_COVERAGE={complete:false}
export function buildProfessionalInsights({student,workouts=[],sharedCheckins=[],coverage=DEFAULT_COVERAGE,now=new Date(),timeZone}) {
 try { new Intl.DateTimeFormat('en',{timeZone:timeZone||'America/Sao_Paulo'}) } catch { timeZone='America/Sao_Paulo' }
 timeZone=resolveWeeklyTimeZone(timeZone||'America/Sao_Paulo')
 if (!student?.id || !student.relationshipId) return []
 const today=calendarDate(now,timeZone), start=addCalendarDays(today,-13), week=getWeekStart(today,timeZone)
 const all=completedWeeklyHistory(workouts,now,timeZone).sort((a,b)=>String(workoutCalendarDate(b,timeZone)).localeCompare(String(workoutCalendarDate(a,timeZone))) || a.id.localeCompare(b.id))
 const recent=all.filter(w=>workoutCalendarDate(w,timeZone)>=start), alerts=[]
 const byId=new Map(recent.map(w=>[w.id,w]))
 const emit=(type,rows,evidence={})=>{
  const ids=[...new Set(rows.map(w=>w.id))].sort(), [priority,titleKey,suggestedAction]=PROFESSIONAL_INSIGHT_TYPES[type]
  // One stable tracking slot per rule/cycle. Only material evidence changes reopen it.
  const episodeKey=student.relationshipId+':'+type
  const evidenceFingerprint=JSON.stringify([type,ids,evidence.period || null])
  alerts.push({version:1,ruleVersion:1,type,studentId:student.id,relationshipId:student.relationshipId,episodeKey,evidenceFingerprint,priority,titleKey,suggestedAction,
   timeZone,scope:coverage.scope,window:{start:type==='positive_training_consistency'?addCalendarDays(week,-21):type==='reduced_training_frequency'?addCalendarDays(week,-14):type==='no_recent_workouts'?addCalendarDays(today,-7):start,end:['positive_training_consistency','reduced_training_frequency'].includes(type)?addCalendarDays(week,-1):type==='no_recent_workouts'?addCalendarDays(today,-1):today},evidence:{...evidence,workoutIds:ids,count:ids.length},status:'new'})
 }
 for (const [reason,type,minimum] of [['time_constraint','recurring_time_constraint',3],['equipment_unavailable','recurring_equipment_unavailable',2],['fatigue','recurring_fatigue',3],['pain_or_discomfort','reported_discomfort',1]]) {
  const ids=new Set(sharedCheckins.filter(c=>c.reasons?.includes(reason) && byId.has(c.workoutId)).map(c=>c.workoutId))
  if(ids.size>=Number(minimum))emit(type,[...ids].map(id=>byId.get(id)))
 }
 const evaluated=recent.map(w=>({w,c:compareTraining(w),d:detectTrainingChanges(w)}))
 const eligible=evaluated.slice(0,PROFESSIONAL_INSIGHT_LIMITS.recent).filter(x=>x.c.reference==='adjusted')
 const eligibleRecent=evaluated.filter(x=>x.c.reference==='adjusted').slice(0,PROFESSIONAL_INSIGHT_LIMITS.recent)
 const low=eligible.filter(x=>x.c.summary.adjustedSets>=PROFESSIONAL_INSIGHT_LIMITS.minimumPlannedSets && x.c.summary.actualSets/x.c.summary.adjustedSets<PROFESSIONAL_INSIGHT_LIMITS.lowRatio)
 if(low.length>=3)emit('recurring_low_completion',low.map(x=>x.w),{completion:100*low.reduce((s,x)=>s+x.c.summary.actualSets,0)/low.reduce((s,x)=>s+x.c.summary.adjustedSets,0)})
 const changed=eligibleRecent.filter(x=>x.d.changes.skippedExercises.length || x.d.changes.replacedExercises.length)
 if(changed.length>=3)emit('recurring_exercise_changes',changed.map(x=>x.w),{changes:changed.map(x=>({workoutId:x.w.id,...x.d.changes}))})
 const flex=eligibleRecent.filter(x=>x.c.flexApplied && x.c.summary.plannedSets>0 && (x.c.summary.plannedSets-x.c.summary.adjustedSets)/x.c.summary.plannedSets>=PROFESSIONAL_INSIGHT_LIMITS.flexReduction)
 if(flex.length>=3)emit('frequent_flex_adjustments',flex.map(x=>x.w))
 // Absence/frequency claims require proof of the entire interval, not just visible assignments.
 const linked=calendarDate(student.relationshipCreatedAt,timeZone)
 const covers=from=>coverage.complete===true&&coverage.scope==='authorized-professional-executions'&&coverage.status==='authorized-professional-complete'&&coverage.timeZone===timeZone&&coverage.start<=from&&coverage.end>=today
 if(linked) {
  const weeks=[1,2,3].map(n=>all.filter(w=>{const d=workoutCalendarDate(w,timeZone);return d>=addCalendarDays(week,-7*n)&&d<addCalendarDays(week,-7*(n-1))}))
  if(covers(addCalendarDays(week,-14))&&linked<=addCalendarDays(week,-14)&&weeks[1].length>=3 && weeks[1].length-weeks[0].length>=2 && weeks[0].length<=weeks[1].length/2)emit('reduced_training_frequency',weeks[0],{current:weeks[0].length,previous:weeks[1].length,period:addCalendarDays(week,-7)})
  if(covers(addCalendarDays(week,-21))&&linked<=addCalendarDays(week,-21)&&weeks.every(rows=>rows.length>=2))emit('positive_training_consistency',weeks.flat(),{period:addCalendarDays(week,-7)})
  const past=all.filter(w=>workoutCalendarDate(w,timeZone)<today)
  if(covers(addCalendarDays(today,-7))&&linked<=addCalendarDays(today,-7)&&student.activePlan && !past.some(w=>workoutCalendarDate(w,timeZone)>=addCalendarDays(today,-7)) && past.some(w=>workoutCalendarDate(w,timeZone)>=addCalendarDays(today,-42)))emit('no_recent_workouts',past.slice(0,1))
 }
 return alerts
}
export function applyInsightState(insight,state,now=new Date()) {
 let matches=state?.evidenceFingerprint===insight.evidenceFingerprint
 if(!matches&&state?.evidenceFingerprint) {
  try {
   const [type,ids,period]=JSON.parse(state.evidenceFingerprint)
   matches=type===insight.type&&insight.evidence.workoutIds.every(id=>ids.includes(id))&&(!insight.evidence.period||insight.evidence.period===period)
  } catch { /* Unknown old fingerprint is not evidence of a review. */ }
 }
 const expired=state?.status==='snoozed' && new Date(state.snoozedUntil).getTime()<=new Date(now).getTime()
 return {...insight,status:matches&&!expired?state.status:'new',revision:state?.revision||0}
}
export function insightCounts(alerts,activeStudents) {
 return {activeStudents,pendingStudents:new Set(alerts.filter(a=>a.status==='new'&&a.priority!=='positive').map(a=>a.studentId)).size,newAlerts:alerts.filter(a=>a.status==='new').length,reviewedAlerts:alerts.filter(a=>a.status==='reviewed').length}
}

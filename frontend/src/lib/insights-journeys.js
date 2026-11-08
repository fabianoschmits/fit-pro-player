import { getInsightsAccount, trackInsight } from './insights-client.js'
const drafts=new Map()
let owner=null
function account() {
  const current=getInsightsAccount()
  if(current!==owner){drafts.clear();owner=current}
  return current
}
export function beginPersonalRoutineJourney(id,{hasName=false,hasExercises=false}={}) {
  if(!account()) return null
  const journey=crypto.randomUUID()
  drafts.set(id,journey)
  if(drafts.size>20) drafts.delete(drafts.keys().next().value)
  trackInsight('plan_creation_started',{flow:'plan_creation',step:'create',journey_id:journey})
  for(const step of [...(hasName?['name']:[]),...(hasExercises?['exercise','configure']:[])]) trackInsight('plan_creation_step_completed',{flow:'plan_creation',step,journey_id:journey})
  return journey
}
export function personalRoutineJourney(id) { return account()?drafts.get(id)||null:null }

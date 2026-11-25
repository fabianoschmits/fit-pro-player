import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementAvatar } from '../components/ManagementUI.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { t, dateLocale } from '../lib/i18n.js'
import { compareTraining } from '../lib/training-comparison.js'
import { workoutCalendarDate } from '../lib/weekly-progress-core.js'
import { insightCounts, PROFESSIONAL_INSIGHT_TYPES } from '../lib/professional-insights.js'
import { useProfessionalInsights } from '../lib/use-professional-insights.js'
import '../professional-insights.css'
const ruleKeys={
 recurring_time_constraint:'Time constraints shared in at least 3 workouts over 14 days.',
 recurring_low_completion:'At least 3 of the last 5 workouts below 75% of adjusted sets, with at least 4 planned sets.',
 recurring_equipment_unavailable:'Equipment unavailability shared in at least 2 workouts over 14 days.',
 recurring_exercise_changes:'Omissions or explicit substitutions in at least 3 of the last 5 eligible workouts.',
 reduced_training_frequency:'At least 50% fewer records and 2 fewer workouts between two complete weeks.',
 no_recent_workouts:'No records in 7 complete days, with prior history and confirmed coverage.',
 recurring_fatigue:'Tiredness shared in at least 3 workouts over 14 days.',
 reported_discomfort:'The student explicitly shared discomfort. This is a report, not a medical assessment.',
 frequent_flex_adjustments:'Explicit Flex reductions of at least 20% in at least 3 of the last 5 eligible workouts.',
 positive_training_consistency:'At least 2 completed workouts in each of 3 complete consecutive weeks.',
}
const statusLabels={new:'New alerts',reviewed:'Reviewed',snoozed:'Snoozed',archived:'Archived'}
const priorityLabels={review:'Review',attention:'Attention',positive:'Positive'}
const insightIcon=type=>type.includes('time')||type.includes('duration')||type.includes('flex')?'clock':type==='reported_discomfort'?'info':'chart'
const formatDate=value=>new Intl.DateTimeFormat(dateLocale(),{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'))
export default function ProfessionalInsights(){
 const [params,setParams]=useSearchParams(),studentId=params.get('student'),offset=Math.max(0,Number(params.get('offset'))||0)
 const {data,alerts,error,online,loading,refresh,save}=useProfessionalInsights({studentId,offset})
 const [failure,setFailure]=useState(false),[busy,setBusy]=useState(false)
 const selected=alerts.find(a=>a.episodeKey===params.get('alert'))
 const related=selected?.workouts.filter(workout=>selected.evidence.workoutIds.includes(workout.id)).sort((a,b)=>String(b.completedAt||b.d).localeCompare(String(a.completedAt||a.d)))||[]
 const counts=insightCounts(alerts,data?.total)
 const update=(key,value)=>setParams(previous=>{const next=new URLSearchParams(previous);value?next.set(key,value):next.delete(key);return next})
 const filtered=useMemo(()=>alerts.filter(a=>(!params.get('status')||a.status===params.get('status'))&&(!params.get('category')||a.priority===params.get('category'))&&(!params.get('type')||a.type===params.get('type'))&&a.student.displayName?.toLocaleLowerCase().includes((params.get('search')||'').toLocaleLowerCase())).sort((a,b)=>{
  const rank=x=>(x.status==='new'?0:3)+['review','attention','positive'].indexOf(x.priority)
  return rank(a)-rank(b)||a.episodeKey.localeCompare(b.episodeKey)
 }),[alerts,params])
 const mark=async(status,days=null)=>{setBusy(true);setFailure(false);try{await save(selected,status,days)}catch{setFailure(true)}finally{setBusy(false)}}
 const actionPath=selected?'/professional/students/'+selected.studentId+(selected.type.includes('time')||selected.type.includes('flex')||selected.type.includes('completion')||selected.type.includes('equipment')?'/plan':'?section=history'):''
 const listParams=new URLSearchParams(params);listParams.delete('alert')
 return <ManagementLayout title={t(selected?'Insight details':'Student follow-up')} subtitle={t('Understand the records that may need your attention.')} backTo={selected?'/professional/insights?'+listParams:'/professional'}>
 <div className="professional-insights" data-professional-insights>
 {!online?<p role="status">{t('Connect to update student follow-up.')}</p>:loading?<div className="card" role="status" aria-busy="true">{t('Loading…')}</div>:error?<p role="alert">{t('Could not load student follow-up.')}<Button onClick={refresh}>{t('Try again')}</Button></p>:<>
 {failure&&<p role="alert">{t('Could not save follow-up status.')}</p>}
 {selected?<>
 <div className="management-record professional-insight-student"><ManagementAvatar name={selected.student.displayName} avatarRef={selected.student.avatarRef} userId={selected.studentId}/><strong>{selected.student.displayName}</strong></div>
 <section className="card"><h2><Icon name={insightIcon(selected.type)}/>{t(selected.titleKey)}</h2><small>{t(statusLabels[selected.status])}</small><p>{t(ruleKeys[selected.type])}</p><small>{formatDate(selected.window.start)} – {formatDate(selected.window.end)}</small><p>{t('{0} related workouts.',selected.evidence.count)}</p>{selected.evidence.completion!=null&&<p>{t('{0}% of adjusted sets.',new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(selected.evidence.completion))}</p>}</section>
 <h3>{t('Related workouts')}</h3>{related.map(workout=>{
  const id=workout.id,date=workoutCalendarDate(workout,undefined),comparison=compareTraining(workout),percent=comparison.summary.percent
  return <Link className="professional-insight-workout" key={id} to={'/professional/students/'+selected.studentId+'?section=history'}>
   <time>{date?formatDate(date):'—'}</time><div><strong>{workout?.name||t('Workout')}</strong>{percent!=null&&<><small>{t('{0}% of adjusted sets.',new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(percent))}</small><progress aria-label={t('Execution below the confirmed plan')} value={percent} max={Math.max(100,percent)}/></>}</div><span>›</span>
  </Link>
 })}
 <Link className="management-button management-button-primary" to={actionPath}>{t(actionPath.endsWith('/plan')?selected.suggestedAction:'View student history')} ›</Link>
 <Button disabled={busy} onClick={()=>mark('reviewed')}>{t('Mark as reviewed')}</Button>
 <details><summary>{t('Follow up later')}</summary>{[1,3,7].map(days=><Button key={days} disabled={busy} onClick={()=>mark('snoozed',days)}>{t('In {0} days',days)}</Button>)}</details>
 <Button variant="ghost" disabled={busy} onClick={()=>mark(selected.status==='archived'?'new':'archived')}>{t(selected.status==='archived'?'Restore follow-up':'Archive')}</Button>
 </>:<>
 <div className="professional-insights-metrics">{[['Active students',counts.activeStudents],['Students needing attention',counts.pendingStudents],['New alerts',counts.newAlerts],['Reviewed',counts.reviewedAlerts]].map(([key,value])=><div className="card" key={key}><strong>{value}</strong><span>{t(key)}</span></div>)}</div>
 <p className="small dim">{t('Indicators refer to available records. Some data may be unavailable.')}</p>
 <label>{t('Search student')}<input type="search" value={params.get('search')||''} onChange={e=>update('search',e.target.value)}/></label>
 <label>{t('Follow-up status')}<select value={params.get('status')||''} onChange={e=>update('status',e.target.value)}><option value="">{t('All')}</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label>
 <details><summary>{t('More filters')}</summary><label>{t('Category')}<select value={params.get('category')||''} onChange={e=>update('category',e.target.value)}><option value="">{t('All')}</option>{Object.entries(priorityLabels).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label><label>{t('Insight type')}<select value={params.get('type')||''} onChange={e=>update('type',e.target.value)}><option value="">{t('All')}</option>{Object.entries(PROFESSIONAL_INSIGHT_TYPES).map(([key,value])=><option key={key} value={key}>{t(value[1])}</option>)}</select></label></details>
 {!data?.total?<p>{t('You do not have linked students yet.')}</p>:!filtered.length?<p>{t('No new alerts in the analyzed records.')}</p>:filtered.map(alert=><button type="button" className="card professional-insight-card" key={alert.episodeKey} onClick={()=>update('alert',alert.episodeKey)}><span className="management-record"><ManagementAvatar name={alert.student.displayName} avatarRef={alert.student.avatarRef} userId={alert.studentId}/><strong>{alert.student.displayName}</strong><small>{t(statusLabels[alert.status])}</small></span><strong><Icon name={insightIcon(alert.type)}/>{t(alert.titleKey)}</strong><span>{t('{0} related workouts.',alert.evidence.count)}</span><span className="professional-insight-action">{t(alert.suggestedAction)} ›</span></button>)}
 <div className="professional-insights-pagination"><Button disabled={!offset} onClick={()=>update('offset',String(Math.max(0,offset-20)))}>{t('Previous')}</Button><Button disabled={!data?.hasMore} onClick={()=>update('offset',String(offset+20))}>{t('Next')}</Button></div>
 </>}
 </>}
 </div></ManagementLayout>
}

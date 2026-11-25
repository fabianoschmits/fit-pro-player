import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'
const CYCLE='11250000-0000-4000-8000-000000000010'
const NOW=new Date('2026-11-25T15:00:00Z')
const workouts=['one','two','three'].map((id,index)=>({id,d:'2026-11-'+(23-index),name:'Treino sintético '+id,start:Date.parse('2026-11-'+(23-index)+'T12:00:00Z'),end:Date.parse('2026-11-'+(23-index)+'T13:00:00Z'),comparison:{version:1,origin:'professional',planned:[{exerciseId:'0025',workSets:4,muscleWeights:{chest:1}}],adjusted:[{exerciseId:'0025',workSets:4,muscleWeights:{chest:1}}],flexApplied:false},entries:[{id:'0025',sets:[{done:true,r:8,w:20}]}]}))
test('student shares reasons, professional reviews once, and revocation removes evidence',async({page,browser},info)=>{
 await page.clock.setFixedTime(NOW)
 const state=stateFixture();state.workouts=workouts
 const rows=Object.fromEntries(workouts.map((w,index)=>[w.id,{id:'checkin-'+index,workout_id:w.id,user_id:STUDENT,version:1,status:'answered',reasons:['time_constraint'],note:'PRIVATE NOTE',revision:1,operation_id:'initial-'+index,updated_at:NOW.toISOString()}]))
 const grants=new Set(['two','three']),states=[]
 await seed(page,{authenticated:true,userId:STUDENT,state,rpc:{
  workout_sessions:(_args,{request})=>new URL(request.url()).searchParams.get('status')==='eq.active'?null:workouts.map(w=>({id:w.id,user_id:STUDENT,status:'completed',revision:1,writer_token:'fixture',mass_unit:'kg',prescription_snapshot:{comparison:w.comparison},started_at:new Date(w.start).toISOString(),completed_at:new Date(w.end).toISOString(),updated_at:new Date(w.end).toISOString()})),
  workout_session_operations:workouts.map(w=>({session_id:w.id,user_id:STUDENT,kind:'session_completed',payload:{workout:w}})),
  training_checkins:()=>Object.values(rows),
  training_checkin_shares:()=>[...grants].map(id=>({checkin_id:rows[id].id,relationship_id:CYCLE,shared_reasons:['time_constraint'],revoked_at:null})),
  student_professional_cards:[{professional_user_id:USER,relationship_id:CYCLE,professional_name:'Profissional sintético',linked_at:'2026-10-01T12:00:00Z'}],
  save_training_checkin:args=>{
   const row=rows[args.p_workout_id]
   expect(args.p_expected_revision).toBe(row.revision)
   rows[args.p_workout_id]={...row,...args.p_record,revision:row.revision+1,operation_id:args.p_operation_id}
   if(args.p_shares!==null){if(args.p_shares.some(s=>s.reasons.includes('time_constraint')))grants.add(args.p_workout_id);else grants.delete(args.p_workout_id)}
   return rows[args.p_workout_id]
  },
 }})
 await page.goto('/#/progress/training-map?session=one')
 await page.locator('[data-training-checkin-summary]').getByRole('button',{name:'Editar resposta',exact:true}).click()
 const form=page.locator('[data-training-checkin]')
 await form.getByRole('checkbox',{name:'Compartilhar motivos com este profissional',exact:true}).check()
 await form.getByRole('button',{name:'Salvar resposta',exact:true}).click()
 await expect.poll(()=>grants.has('one')).toBe(true)
 const professionalContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); const professional=await professionalContext.newPage();await professional.clock.setFixedTime(NOW)
 await seed(professional,{professional:true,state:stateFixture(),rpc:{
  get_professional_insights_context:()=>({items:[{student:{id:STUDENT,relationshipId:CYCLE,displayName:'Aluno sintético',relationshipCreatedAt:'2026-10-01'},coverage:{complete:false},workouts:workouts.map(w=>({...w,completedAt:new Date(w.end).toISOString()})),sharedCheckins:[...grants].map(workoutId=>({workoutId,reasons:['time_constraint']})),states}],total:1,hasMore:false,offset:0}),
  save_professional_insight_state:args=>{states.splice(0,states.length,{type:args.p_type,episodeKey:args.p_episode_key,evidenceFingerprint:args.p_fingerprint,status:args.p_status,revision:1});return {revision:1}},
 }})
 await professional.goto('/#/professional/insights')
 await professional.locator('.professional-insight-card').filter({hasText:'Falta de tempo recorrente'}).click()
 await expect(professional.locator('[data-professional-insights]')).toContainText('3 treinos relacionados.')
 await expect(professional.locator('[data-professional-insights]')).not.toContainText('PRIVATE NOTE')
 await professional.screenshot({path:info.outputPath('professional-insight-mobile.png')})
 await professional.getByRole('button',{name:'Marcar como revisado',exact:true}).click()
 await expect.poll(()=>states.length).toBe(1)
 await professional.reload({waitUntil:'domcontentloaded'})
 await expect(professional.locator('[data-professional-insights]')).toContainText('3 treinos relacionados.')
 await expect(professional.locator('[data-professional-insights]')).toContainText('Revisados')
 expect(states).toHaveLength(1);expect(states[0].status).toBe('reviewed')
 await page.locator('[data-training-checkin-summary]').getByRole('button',{name:'Editar resposta',exact:true}).click()
 await form.getByRole('checkbox',{name:'Compartilhar motivos com este profissional',exact:true}).uncheck()
 await form.getByRole('button',{name:'Salvar resposta',exact:true}).click()
 await expect.poll(()=>grants.has('one')).toBe(false)
 await professional.reload({waitUntil:'domcontentloaded'})
 await expect(professional.locator('.professional-insight-card').filter({hasText:'Falta de tempo recorrente'})).toHaveCount(0)
 await professionalContext.close()
})

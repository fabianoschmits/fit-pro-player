import { test, expect } from '@playwright/test'
import { seed, stateFixture, STUDENT } from './fixtures.test.js'
test('checkin conflict preserves both answers and resolves without restoring consent',async({page})=>{
 const now=new Date('2026-11-25T15:00:00Z');await page.clock.setFixedTime(now)
 const w={id:'conflict-workout',d:'2026-11-24',name:'Treino sintético',start:Date.parse('2026-11-24T12:00:00Z'),end:Date.parse('2026-11-24T13:00:00Z'),entries:[{id:'0025',sets:[{done:true,r:8,w:20}]}],comparison:{version:1,origin:'personal',planned:[{exerciseId:'0025',workSets:4,muscleWeights:{chest:1}}],adjusted:[{exerciseId:'0025',workSets:4,muscleWeights:{chest:1}}]}}
 const local={version:1,status:'answered',reasons:['time_constraint'],note:'LOCAL RESPONSE',operationId:'11250000-0000-4000-8000-000000000090'}
 let remote={id:'checkin-conflict',workout_id:w.id,user_id:STUDENT,version:1,status:'answered',reasons:['fatigue'],note:'REMOTE RESPONSE',revision:7,operation_id:'11250000-0000-4000-8000-000000000091'}
 const state=stateFixture();state.workouts=[w];state.trainingCheckinRecords={[w.id]:{...local,revision:1}}
 state.pendingCheckinOperations=[{accountId:STUDENT,workoutId:w.id,operationId:local.operationId,record:local,expectedRevision:1,shares:null}]
 let writes=0
 await seed(page,{authenticated:true,userId:STUDENT,state,rpc:{
  workout_sessions:(_args,{request})=>new URL(request.url()).searchParams.get('status')==='eq.active'?null:[{id:w.id,user_id:STUDENT,status:'completed',revision:1,writer_token:'fixture',mass_unit:'kg',prescription_snapshot:{comparison:w.comparison},started_at:new Date(w.start).toISOString(),completed_at:new Date(w.end).toISOString(),updated_at:new Date(w.end).toISOString()}],
  workout_session_operations:[{session_id:w.id,user_id:STUDENT,kind:'session_completed',payload:{workout:w}}],training_checkins:()=>[remote],training_checkin_shares:[],student_professional_cards:[],
  save_training_checkin:args=>{
   writes++
   if(args.p_expected_revision!==remote.revision)return {__error:{status:409,body:{code:'40001',message:'checkin revision conflict'}}}
   expect(args.p_shares).toEqual([])
   remote={...remote,...args.p_record,revision:8,operation_id:args.p_operation_id};return remote
  },
 }})
 await page.goto('/#/progress/training-map?session='+w.id)
 await expect.poll(()=>writes).toBe(1)
 await page.locator('[data-training-checkin-summary]').getByRole('button',{name:'Editar resposta',exact:true}).click()
 const sheet=page.locator('[data-checkin-conflict]')
 await expect(sheet).toContainText('LOCAL RESPONSE');await expect(sheet).toContainText('REMOTE RESPONSE')
 await sheet.getByRole('button',{name:'Manter minha resposta',exact:true}).click()
 await expect.poll(()=>remote.revision).toBe(8)
 await page.reload({waitUntil:'domcontentloaded'})
 await expect(page.locator('[data-training-checkin-summary]')).toContainText('LOCAL RESPONSE')
 expect(writes).toBe(2);expect(remote.note).toBe('LOCAL RESPONSE')
})

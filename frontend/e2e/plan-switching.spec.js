import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, openMainNavigation } from './fixtures.test.js'

const personalId = '66666666-6666-4666-8666-666666666666'
const planId = '55555555-5555-4555-8555-555555555555'
const versionId = '44444444-4444-4444-8444-444444444444'
const professionalRoutine = '88888888-8888-4888-8888-888888888888'
const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const received = { id:planId, title:'Plano força profissional', source_type:'professional', available:true, professional_name:'Fabiano', version:{id:versionId,version_number:1,weekly_plan:Object.fromEntries(days.map(day=>[day,[{exerciseId:'0025',sets:4,reps:8,load:80,rest:90}]])),workout_titles:Object.fromEntries(days.map(day=>[day,'Força prescrita']))} }

// This fake server owns the canonical plan across reloads, including optimistic revisions.
async function backend(page, { items = [received], starter = false } = {}) {
 const state = stateFixture()
 if(starter) state.routines[0]={id:'e2e-routine',name:'Meu treino atual',emoji:'abs',ex:[
  {id:'0274',sets:2,reps:15,rest:60,mode:'reps',weight:0},
  {id:'0872',sets:2,reps:12,rest:60,mode:'reps',weight:0},
  {id:'0276',sets:2,reps:10,rest:60,mode:'reps',weight:0},
  {id:'0979',sets:2,reps:12,rest:60,mode:'reps',weight:0},
  {id:'0857',sets:2,reps:8,rest:90,mode:'reps',weight:0},
 ]}
 let revision = 1, selected = null, calls = 0, release = null, conflict = false
 let personal = state.routines.map(({id,name,...prescription},position)=>({id,title:name,prescription,position,user_id:USER,created_at:"2026-11-01",updated_at:"2026-11-01",revision:1}))
 let personalSchedule = {week:{...state.week},dayPlan:{}}
 let routines = structuredClone(personal)
 let schedule = {user_id:USER,updated_at:"2026-11-01",revision,mode:'weekly',schedule:structuredClone(personalSchedule)}
 const snapshot = () => ({routines:structuredClone(routines),schedule:structuredClone(schedule)})
 const rpc={
  athlete_routines:()=>routines,
  athlete_schedules:()=>schedule,
  athlete_plan_library_page:()=>({items,total:items.length,selectedId:selected}),
  save_personal_library_plan:()=>personalId,
  save_athlete_plan:args=>{
   revision++
   routines=args.p_routines.map((row,position)=>({...row,position,user_id:USER,created_at:"2026-11-01",updated_at:"2026-11-01",revision}))
   personal=routines.filter(row=>!row.prescription.assigned)
   schedule={user_id:USER,updated_at:"2026-11-01",revision,mode:args.p_mode,schedule:args.p_schedule}
   if(!selected || selected===personalId) personalSchedule=structuredClone(args.p_schedule)
   return snapshot()
  },
  apply_library_plan:async args=>{
   calls++
   if(release) await new Promise(resolve=>{release.resolve=resolve})
   if(conflict || args.p_expected_revision!==revision) return {__error:{status:409,body:{code:'40001',message:'revision conflict'}}}
   selected=args.p_plan_id; revision++
   const professional=selected===planId
   routines=professional?[...personal,{id:professionalRoutine,title:'Força prescrita',position:personal.length,user_id:USER,created_at:'2026-11-01',updated_at:"2026-11-01",revision,prescription:{emoji:'dumbbell',ex:[{id:'0025',sets:4,reps:8,weight:80,rest:90}],assigned:true,assignmentId:'assignment',programVersionId:versionId,assignedDayKey:'monday'}}]:structuredClone(personal)
   schedule={user_id:USER,updated_at:"2026-11-01",revision,mode:'weekly',schedule:professional?{week:Object.fromEntries(days.map((_,day)=>[day,professionalRoutine])),dayPlan:{},libraryId:planId,libraryTitle:received.title,assignedProgram:{assignmentId:'assignment',versionId,programId:'program'}}:{...structuredClone(personalSchedule),libraryId:personalId,libraryTitle:'Meu plano',assignedProgram:null}}
   return snapshot()
  },
 }
 await seed(page,{authenticated:true,state,rpc})
 return {attach:other=>seed(other,{authenticated:true,state:structuredClone(state),rpc}),get personalRows(){return structuredClone(personal)},get personalTitle(){return personal[0].title},get calls(){return calls},get selected(){return selected},hold(){release={}},finish(){release.resolve();release=null},conflict(){conflict=true}}
}
const tab = (page,name)=>page.getByRole('group',{name:'Escolher plano',exact:true}).getByRole('button',{name,exact:true})
const header = page=>page.locator('.app-header')
async function applyProfessional(page) {
 await tab(page,'Treino do profissional').click()
 await page.getByRole('button',{name:'Usar este plano',exact:true}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar plano',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(header(page).getByRole('heading',{name:received.title,exact:true})).toBeVisible()
}

test('selector is a preview; confirmation waits for server and both active plans survive reload',async({page})=>{
 const server=await backend(page)
 await page.goto('/#/plan')
 await tab(page,'Treino do profissional').click()
 await expect(page.locator('.created-workouts')).toHaveCount(0)
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 expect(server.calls).toBe(0)
 await page.getByRole('button',{name:'Usar este plano',exact:true}).first().click()
 server.hold()
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar plano',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Aplicando…',exact:true})).toBeDisabled()
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 await page.keyboard.press('Escape')
 await expect(page.getByRole('dialog')).toBeVisible()
 server.finish()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(header(page).getByRole('heading',{name:received.title,exact:true})).toBeVisible()
 await expect(tab(page,'Treino do profissional')).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('.plan-view > .training-plan-workspace .plan-week-card')).toContainText('Força prescrita')
 await tab(page,'Meus treinos').click()
 await expect(page.locator('.created-workouts')).toContainText('Treino de teste')
 await expect(header(page).getByRole('heading',{name:received.title,exact:true})).toBeVisible()
 expect(server.calls).toBe(1)
 await page.reload()
 await expect(header(page).getByRole('heading',{name:received.title,exact:true})).toBeVisible()
 await tab(page,'Meus treinos').click()
 await page.goto('/#/plan/r/e2e-routine')
 await page.locator('.routine-name').fill('Pessoal atualizado')
 await page.locator('.routine-name').blur()
 await expect.poll(()=>server.personalTitle).toBe('Pessoal atualizado')
 await page.locator('.routine-completion-actions').getByRole('button',{name:'Pronto',exact:true}).click()
 await expect(page).toHaveURL(/#\/plan\?library=self$/)
 await expect(tab(page,'Treino do profissional')).toHaveAttribute('aria-pressed','true')
 await tab(page,'Meus treinos').click()
 await expect(tab(page,'Meus treinos')).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Usar meus treinos',exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar meus treinos',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(tab(page,'Meus treinos')).toHaveAttribute('aria-pressed','true')
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 await expect(page.locator('.plan-view > .training-plan-workspace .plan-week-card')).toContainText('Pessoal atualizado')
 await page.reload()
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 expect(server.selected).toBe(personalId)
 await page.goto('/#/plan/r/e2e-routine')
 await expect(page.locator('.routine-name')).toHaveValue('Pessoal atualizado')
 await expect(page.locator('.routine-name')).toBeEditable()
 await page.goto('/#/home')
 await openMainNavigation(page)
 await page.locator('[data-tab-key="start"]').click()
 await expect(page).toHaveURL(/#\/workout$/)
 await expect(page.locator('.workout-session-title')).toContainText('Pessoal atualizado')
 const active=await page.evaluate(user=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${user}`)).state.active,USER)
 expect(active.routineId).toBe('e2e-routine')
 expect(active.entries[0].target).toMatchObject({weight:20,reps:10})
 expect(active.entries[0].sets).toHaveLength(1)
 expect(active.assignmentId || active.assignment_id || null).toBeNull()
})

test('another session conflict keeps the confirmation open and preserves execution plan',async({page})=>{
 const server=await backend(page)
 await page.goto('/#/plan')
 await tab(page,'Treino do profissional').click()
 await page.getByRole('button',{name:'Usar este plano',exact:true}).first().click()
 server.conflict()
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar plano',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('outra sessão')
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 await expect(page.locator('.plan-view > .training-plan-workspace .plan-week-card')).toContainText('Treino de teste')
 expect(server.selected).toBeNull()
})

for(const items of [[],[{...received,available:false}]]) test(`no selectable professional plan for ${items.length?'unavailable history':'empty library'}`,async({page})=>{
 const server=await backend(page,{items})
 await page.goto('/#/plan')
 await expect(page.locator('.created-workouts')).toContainText('Treino de teste')
 await expect(page.getByRole('group',{name:'Escolher plano',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Usar este plano',exact:true})).toHaveCount(0)
 expect(server.calls).toBe(0)
})







test('routine details and actual workout execute the professional prescription',async({page})=>{
 await backend(page)
 await page.goto('/#/plan')
 await applyProfessional(page)
 await page.goto(`/#/plan/r/${professionalRoutine}`)
 await expect(page.locator('.routine-name')).toHaveValue('Força prescrita')
 await expect(page.locator('.routine-name')).toHaveAttribute('readonly','')
 await page.goto('/#/home')
 await openMainNavigation(page)
 await page.locator('[data-tab-key="start"]').click()
 await expect(page).toHaveURL(/#\/workout$/)
 await expect(page.locator('.workout-session-title')).toContainText('Força prescrita')
 await expect(page.locator('.wp-exercise-player')).toBeVisible()
 const active=await page.evaluate(user=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${user}`)).state.active,USER)
 expect(active.routineId).toBe(professionalRoutine)
 expect(active.entries[0].target).toMatchObject({weight:80,reps:8})
 expect(active.entries[0].sets).toHaveLength(4)
})


test('two sessions reject stale application and reload the winning professional plan',async({page,browser})=>{
 const server=await backend(page)
 await page.goto('/#/plan')
 const secondContext=await browser.newContext({baseURL:new URL(page.url()).origin})
 try {
  const second=await secondContext.newPage()
  await server.attach(second)
  await second.goto('/#/plan')
  await expect(header(second).locator('h1')).toHaveText('Seu plano semanal')
  await tab(second,'Treino do profissional').click()
  await second.getByRole('button',{name:'Usar este plano',exact:true}).first().click()
  await applyProfessional(page)
  await second.getByRole('dialog').getByRole('button',{name:'Aplicar plano',exact:true}).click()
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('outra sessão')
  await expect(header(second).locator('h1')).toHaveText('Seu plano semanal')
  expect(server.calls).toBe(2)
  expect(server.selected).toBe(planId)
  await second.reload()
  await expect(header(second).locator('h1')).toHaveText(received.title)
  await expect(second.locator('.plan-view > .training-plan-workspace .plan-week-card')).toContainText('Força prescrita')
  await expect(second.getByRole('dialog')).toHaveCount(0)
  expect(server.calls).toBe(2)
 } finally {await secondContext.close()}
})

test('server routines without starter metadata restore after local normalization',async({page})=>{
 const server=await backend(page,{starter:true})
 await page.goto('/#/plan')
 await expect.poll(()=>page.evaluate(user=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${user}`)).state.routines[0].starterKey,USER)).toBe('Abs Day')
 expect(server.personalRows[0].prescription.starterKey).toBeUndefined()
 await applyProfessional(page)
 await tab(page,'Meus treinos').click()
 await page.getByRole('button',{name:'Usar meus treinos',exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar meus treinos',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 expect(server.selected).toBe(personalId)
 expect(server.personalRows[0].prescription.starterKey).toBeUndefined()
 await page.reload()
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 await expect(page.locator('.created-workouts')).toBeVisible()
})

test('removing from one professional calendar day replaces the entire week and allows reapplication',async({page})=>{
 const server=await backend(page)
 await page.goto('/#/plan')
 await applyProfessional(page)
 await expect(page.locator('.professional-plan-preview .received-workout-card')).toHaveCount(7)
 await expect(page.getByRole('button',{name:'Usar este plano',exact:true})).toHaveCount(0)
 await page.locator('.plan-view > .training-plan-workspace .plan-day').first().click()
 await expect(page.getByRole('dialog')).toContainText('Retirar plano profissional?')
 expect(server.calls).toBe(1)
 await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click()
 await expect(header(page).locator('h1')).toHaveText(received.title)
 await page.locator('.plan-view > .training-plan-workspace .plan-day').first().click()
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar meus treinos',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(tab(page,'Meus treinos')).toHaveAttribute('aria-pressed','true')
 await expect(header(page).locator('h1')).toHaveText('Seu plano semanal')
 await expect(page.locator('.plan-view > .training-plan-workspace .plan-week-card')).not.toContainText('Força prescrita')
 expect(server.selected).toBe(personalId)
 await applyProfessional(page)
 expect(server.selected).toBe(planId)
 expect(server.calls).toBe(3)
})

test('creating a personal routine while professional is active returns to My workouts after Done',async({page})=>{
 const server=await backend(page)
 await page.goto('/#/plan')
 await applyProfessional(page)
 await tab(page,'Meus treinos').click()
 await page.locator('.created-workouts .plan-section-head button').click()
 await page.locator('.routine-name').fill('Novo pessoal')
 await page.locator('.routine-name').blur()
 await page.locator('.routine-completion-actions').getByRole('button',{name:'Pronto',exact:true}).click()
 await expect(page).toHaveURL(/#\/plan\?library=self$/)
 await expect(tab(page,'Treino do profissional')).toHaveAttribute('aria-pressed','true')
 await tab(page,'Meus treinos').click()
 await expect(tab(page,'Meus treinos')).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('.created-workouts')).toContainText('Novo pessoal')
 await expect(header(page).locator('h1')).toHaveText(received.title)
 expect(server.calls).toBe(1)
})

for(const legacyError of ['plan selection changed','professional prescription is read only'])
test(`a stale professional cache synchronizes without reapplying and then confirms the received update once: ${legacyError}`,async({page})=>{
 const state=stateFixture()
 state.activeLibraryId=legacyError==='plan selection changed'?'stale-local-selection':'server-old-plan'
 state.assignedProgram={versionId:'previous-version'}
 state.planServerRevision=23
 state._pendingSync={plan:true}
 let revision=24, applications=0, rejectedSaves=0
 const personal=state.routines.map(({id,name,...prescription},position)=>({id,title:name,prescription,position,user_id:USER,revision:24,created_at:'2026-11-01',updated_at:'2026-11-01'}))
 let routines=[...personal,{id:professionalRoutine,title:'Versão anterior',position:1,user_id:USER,revision:24,created_at:'2026-11-01',updated_at:'2026-11-01',prescription:{assigned:true,programVersionId:'previous-version',ex:[{id:'0025',sets:2,reps:12,weight:30}]}}]
 let schedule={user_id:USER,revision,mode:'weekly',updated_at:'2026-11-01',schedule:{week:{1:professionalRoutine},dayPlan:{},libraryId:'server-old-plan',assignedProgram:{versionId:'previous-version'}}}
 await seed(page,{authenticated:true,state,rpc:{
  athlete_routines:()=>routines,athlete_schedules:()=>schedule,
  athlete_plan_library_page:()=>({items:[received],total:1}),
  save_athlete_plan:()=>{rejectedSaves++;return {__error:{status:403,body:{code:'42501',message:legacyError}}}},
  apply_library_plan:args=>{
   expect(args).toEqual({p_plan_id:planId,p_expected_revision:24})
   applications++;revision++
   routines=[...personal,{...routines[1],title:'Força prescrita',revision,prescription:{assigned:true,programVersionId:versionId,ex:[{id:'0025',sets:4,reps:8,weight:80}]}}]
   schedule={...schedule,revision,schedule:{week:Object.fromEntries(days.map((_,day)=>[day,professionalRoutine])),dayPlan:{},libraryId:planId,libraryTitle:received.title,assignedProgram:{versionId}}}
   return {routines,schedule}
  },
 }})
 await page.goto('/#/plan')
 await expect.poll(()=>page.evaluate(user=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${user}`)).state._pendingSync.plan,USER)).toBe(false)
 expect(applications).toBe(0)
 expect(rejectedSaves).toBeGreaterThan(0)
 await applyProfessional(page)
 expect(applications).toBe(1)
 await expect(page.getByRole('button',{name:'Usar este plano',exact:true})).toHaveCount(0)
 await expect(page.locator('.plan-view > .training-plan-workspace .plan-day.on')).toHaveCount(7)
 const current=await page.evaluate(user=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${user}`)).state,USER)
 expect(current._syncBases.plan.schedule.assignedProgram.versionId).toBe(versionId)
 expect(current.routines.find(r=>r.id==='e2e-routine').name).toBe('Treino de teste')
})

import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

test('execution guidance transitions through rest to the next set', async ({page}, testInfo) => {
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({width:320,height:720})
  const state = stateFixture()
  state.routines[0].ex[0].sets = 2
  await seed(page, {state})
  await page.goto('/#/home')
  await page.locator('[data-tab-key="start"]').click()
  await page.getByRole('button', {name:'Começar treino', exact:true}).click()
  await expect(page.getByText('Execute a série 1 de 2', {exact:true})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('execution-guidance.png'),fullPage:true})
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
  await page.getByRole('button', {name:'Concluir série e descansar', exact:true}).click()
  await expect(page.locator('.exercise-phase')).toContainText('Descansando')
  await expect(page.locator('.exercise-phase button')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
  await page.locator('#timer .skip').click()
  await expect(page.getByText('Execute a série 2 de 2', {exact:true})).toBeVisible()
  await expect(page.getByRole('button', {name:'Concluir treino', exact:true})).toBeVisible()
})

test('student accepts invite, receives program and sends recorded workout events',async({page})=>{
  const programId='33333333-3333-4333-8333-333333333333',versionId='44444444-4444-4444-8444-444444444444',assignmentId='55555555-5555-4555-8555-555555555555'
  const plan=Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day=>[day,[{exerciseId:'0025',sets:1,reps:10,load:20,rest:15}]]))
  const version={id:versionId,program_id:programId,version_number:1,weekly_plan:plan,published_at:'2026-10-02T12:00:00Z'}
  let accepted=false;const events=[]
  await seed(page,{authenticated:true,rpc:{
    preview_professional_invite:[{professional_name:'Treinador de teste',bio:'Força e consistência',verification_status:'unverified',specialties:[]}],
    accept_professional_invite:()=>{accepted=true;return{id:'66666666-6666-4666-8666-666666666666'}},
    professional_student_relationships:()=>accepted?[{id:'66666666-6666-4666-8666-666666666666',status:'active',created_at:'2026-10-02T12:00:00Z'}]:[],
    program_assignments:()=>accepted?[{id:assignmentId,program_id:programId,version_id:versionId,status:'active',created_at:'2026-10-02T12:00:00Z'}]:[],
    program_versions:[version],
    student_program_overview:()=>accepted?{program:{title:'Programa recebido'},professional:{name:'Treinador de teste'},version:{weeklyPlan:plan,versionNumber:1},executions:[]}:{},
    start_workout_execution:args=>{events.push({type:'start',args});return{id:args.p_execution_id,status:'in_progress'}},
    complete_workout_execution:args=>{events.push({type:'complete',args});return{id:args.p_execution_id,status:'completed'}},
  }})
  await page.goto('/#/invite/A1B2C3D4E5')
  await expect(page.getByText('Treinador de teste',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Vincular a este profissional',exact:true}).click()
  await expect(page.getByText('Programa recebido',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Iniciar',exact:true}).first().click()
  await expect(page.locator('.workout-session-title')).toBeVisible()
  await page.getByRole('button',{name:'Começar treino',exact:true}).click()
  await page.getByRole('button',{name:'Concluir treino',exact:true}).click()
  const dialog=page.getByRole('dialog').last();await expect(dialog).toBeVisible()
  if(await dialog.getByRole('button',{name:'Salvar',exact:true}).count()) await dialog.getByRole('button',{name:'Salvar',exact:true}).click()
  await page.getByRole('dialog').last().getByRole('button',{name:'Terminar treino',exact:true}).click()
  await expect.poll(()=>events.some(event=>event.type==='complete')).toBe(true)
  const start=events.find(event=>event.type==='start'),complete=events.find(event=>event.type==='complete')
  expect(start.args.p_assignment_id).toBe(assignmentId)
  expect(complete.args.p_execution_id).toBe(start.args.p_execution_id)
  expect(complete.args.p_payload.entries[0].sets[0]).toMatchObject({done:true,w:20,r:10})
})

test('guest can start, discard, reload and keep the planned routine',async({page},testInfo)=>{
  await seed(page);await page.goto('/#/home')
  await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  await page.locator('[data-tab-key="start"]').click()
  await expect(page).toHaveURL(/workout/)
  await expect(page.locator('.workout-session-title')).toContainText('Treino de teste')
  await page.screenshot({path:testInfo.outputPath('workout.png'),fullPage:true})
  await page.getByRole('button',{name:'Descartar',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button',{name:'Descartar',exact:true}).click()
  await expect(page).toHaveURL(/home/)
  await page.reload();await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active)).toBeNull()
})

test('completed workout is persisted and remains in history after reload',async({page})=>{
  await seed(page);await page.goto('/#/home');await page.locator('[data-tab-key="start"]').click()
  await expect(page.locator('.workout-session-title')).toBeVisible()
  await page.getByRole('button',{name:'Começar treino',exact:true}).click()
  await page.getByRole('button',{name:'Concluir treino',exact:true}).click()
  const dialog=page.getByRole('dialog').last()
  await expect(dialog).toBeVisible()
  if(await dialog.getByRole('button',{name:'Salvar',exact:true}).count()) await dialog.getByRole('button',{name:'Salvar',exact:true}).click()
  await page.getByRole('dialog').last().getByRole('button',{name:'Terminar treino',exact:true}).click()
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts.length)).toBe(1)
  await page.reload();await page.goto('/#/history')
  await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].entries[0].sets[0].done)).toBe(true)
})

test('professional editor keeps a recoverable draft and publishes an explicit prescription',async({page},testInfo)=>{
  if(testInfo.project.name.includes('mobile')) await page.setViewportSize({width:320,height:720})
  const program={id:'33333333-3333-4333-8333-333333333333',professional_user_id:'11111111-1111-4111-8111-111111111111',title:'Programa de teste',description:'Força',archived:false}
  let published
  await seed(page,{professional:true,rpc:{programs:[program],program_versions:[],publish_program_version:args=>{published=args;return{id:'44444444-4444-4444-8444-444444444444',version_number:1}}}})
  await page.goto('/#/professional/programs')
  await page.getByRole('button',{name:'Editar programa',exact:true}).click()
  await page.getByRole('button',{name:'Adicionar exercício',exact:true}).click()
  await page.getByRole('dialog').getByRole('textbox').fill('supino')
  await page.getByRole('dialog').getByRole('button',{name:'Adicionar',exact:true}).first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.program-fields')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false)
  await page.screenshot({path:testInfo.outputPath('professional-editor.png'),fullPage:true})
  await page.reload();await page.getByRole('button',{name:'Editar programa',exact:true}).click()
  await expect(page.getByText('Rascunho recuperado.',{exact:true})).toBeVisible()
  await expect(page.locator('.program-fields')).toBeVisible()
  await page.getByRole('button',{name:'Publicar nova versão',exact:true}).click()
  await expect(page.getByText('Nova versão publicada.',{exact:true})).toBeVisible()
  expect(published.p_program_id).toBe(program.id)
  expect(published.p_weekly_plan.monday[0]).toMatchObject({sets:3,reps:8,load:0,rest:90})
})

test('settings distinguishes local cleanup, names switches and exports a usable backup',async({page})=>{
  await seed(page);await page.goto('/#/settings')
  await expect(page.getByRole('switch').first()).toHaveAccessibleName(/.+/)
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:/Exportar backup/}).click()
  await expect((await download).suggestedFilename()).toMatch(/\.json$/)
  await expect(page.getByRole('button',{name:/Limpar dados (?:neste|deste) dispositivo/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Excluir minha conta/})).toHaveCount(0)
})

test('plan and library work on narrow screens with reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seed(page);await page.goto('/#/library')
  await expect(page.locator('input').first()).toBeVisible()
  await page.locator('input').first().fill('supino')
  await expect(page.locator('.item').first()).toBeVisible()
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)
  expect(overflow).toBe(false)
  await page.goto('/#/plan');await expect(page.locator('.plan-routine-list .tt').filter({hasText:'Treino de teste'})).toBeVisible()
})

test('offline mode clearly indicates local changes',async({page,context})=>{
  await seed(page);await page.goto('/#/home')
  await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  await context.setOffline(true)
  await expect(page.locator('.app-status-global')).toContainText(/Offline|Sem conexão/)
  await context.setOffline(false)
  await expect(page.locator('.app-status-global')).toHaveCount(0)
})

test('professional dashboard explains attention reasons and supports student navigation',async({page})=>{
  await seed(page,{professional:true,rpc:{professional_client_summaries:[{student_user_id:'22222222-2222-4222-8222-222222222222',display_name:'Aluno de teste',active_assignment_id:null,last_execution_at:null}],professional_client_detail:[{student_user_id:'22222222-2222-4222-8222-222222222222',display_name:'Aluno de teste',assignments:[],executions:[]}]}})
  await page.goto('/#/professional')
  await expect(page.getByText('Aluno de teste',{exact:true}).first()).toBeVisible()
  await expect(page.getByText(/Sem programa|sem programa/).first()).toBeVisible()
  await page.getByText('Aluno de teste',{exact:true}).first().click()
  await expect(page).toHaveURL(/professional\/students\//)
})

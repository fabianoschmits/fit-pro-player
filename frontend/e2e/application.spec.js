import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

for (const width of [320, 390]) {
  test(`workout adjustments stay below series and leave execution unobstructed at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:720})
    await page.emulateMedia({reducedMotion:'reduce'})
    const state = stateFixture()
    state.routines[0].ex[0] = {id:'0025',sets:5,reps:10,weight:20}
    await seed(page, {state})
    await page.goto('/#/home')
    await page.locator('[data-tab-key="start"]').click()
    await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()

    const card = page.locator('.exercise-input-card')
    const tools = page.locator('details.workout-tools')
    const footer = page.locator('.workout-session-footer')
    await expect(card.locator('.setrow')).toHaveCount(5)
    await expect(tools).toBeVisible()
    await expect(tools).not.toHaveAttribute('open', '')
    await expect(tools.getByRole('button', {name:'Adicionar série', exact:true})).toBeHidden()
    for (const name of ['Adicionar série de aquecimento', 'Adicionar série', 'Remover série', 'Substituir', 'Remover exercício']) {
      await expect(card.getByRole('button', {name, exact:true})).toHaveCount(0)
    }
    await expect(page.locator('.workout-session-header .finish-hdr-btn')).toHaveCount(0)
    await expect(footer.getByRole('button', {name:'Terminar mais cedo', exact:true})).toHaveCount(1)

    await tools.locator('summary').filter({hasText:'Ajustes do treino'}).click()
    await expect(tools).toHaveAttribute('open', '')
    const group = tools.locator('.workout-tool-group[data-exidx="0"]')
    await expect(group.getByRole('heading')).toHaveText(await page.locator('.workout-exercise-name').textContent())
    await group.getByRole('button', {name:'Adicionar série de aquecimento', exact:true}).click()
    await expect(card.locator('.setrow')).toHaveCount(6)
    await group.getByRole('button', {name:'Adicionar série', exact:true}).click()
    await expect(card.locator('.setrow')).toHaveCount(7)
    await expect(card.locator('.setrow .iconbtn')).toHaveCount(0)

    await footer.scrollIntoViewIfNeeded()
    const geometry = await footer.evaluate(element => {
      const card = document.querySelector('.exercise-input-card')
      const tools = document.querySelector('.workout-tools')
      return {
        position:getComputedStyle(element).position,
        actionPosition:getComputedStyle(element.querySelector('.workout-primary-action')).position,
        footer:element.getBoundingClientRect().toJSON(),
        card:card.getBoundingClientRect().toJSON(),
        tools:tools.getBoundingClientRect().toJSON(),
        followsTools:!!(tools.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
        insideCard:!!element.closest('.exercise-input-card'),
        horizontalOverflow:document.documentElement.scrollWidth > innerWidth + 2,
      }
    })
    expect(['static', 'relative']).toContain(geometry.position)
    expect(['static', 'relative']).toContain(geometry.actionPosition)
    expect(geometry.followsTools).toBe(true)
    expect(geometry.insideCard).toBe(false)
    expect(geometry.footer.top).toBeGreaterThanOrEqual(geometry.tools.bottom)
    expect(geometry.footer.top).toBeGreaterThanOrEqual(geometry.card.bottom)
    expect(geometry.footer.left).toBeGreaterThanOrEqual(0)
    expect(geometry.footer.right).toBeLessThanOrEqual(width)
    expect(geometry.horizontalOverflow).toBe(false)

    const assertUnobstructed = async button => {
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeInViewport()
      await expect(button).toBeEnabled()
      expect(await button.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        return hit === element || element.contains(hit)
      })).toBe(true)
    }
    const play = page.locator('.set-start-action')
    await expect(play).toHaveAccessibleName('Iniciar série 1')
    await assertUnobstructed(play)
    await play.click()
    const stop = card.locator('.setrow .chk.is-executing')
    await expect(stop).toHaveAccessibleName('Parar série 1')
    await assertUnobstructed(stop)
    await stop.click()
    await expect(page.locator('#timer')).toBeVisible()
    await expect(card.locator('.chk.is-executing')).toHaveCount(0)
    await expect(page.locator('.set-start-action')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false,false,false,false,false,false])
    await page.locator('#timer .skip').click()
    await expect(page.locator('#timer')).toHaveCount(0)
    await expect(play).toHaveAccessibleName('Iniciar série 1')
    await assertUnobstructed(play)
    await expect(card.locator('.set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  })
}

test('execution guidance waits for play before each set and progresses after stop', async ({page}, testInfo) => {
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({width:320,height:720})
  const state = stateFixture()
  const longExerciseName = 'Extensão unilateral de tríceps com halter acima da cabeça em pé, com controle do movimento e amplitude completa para cada lado'
  state.customEx = [{id:'custom-long-name',name:longExerciseName,n:longExerciseName,bp:'upper arms',tg:'triceps',eq:'dumbbell',sm:[]}]
  state.routines[0].ex[0] = {id:'custom-long-name',sets:2,reps:10,weight:20}
  await seed(page, {state})
  await page.goto('/#/home')
  await page.locator('[data-tab-key="start"]').click()
  await expect(page.locator('.exercise-muscle-static svg')).toBeVisible()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()
  const firstPlay = page.locator('.set-start-action')
  await expect(firstPlay).toHaveAccessibleName('Iniciar série 1')
  await expect(firstPlay.locator('svg')).toBeVisible()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await expect(page.locator('.set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  expect(await firstPlay.evaluate(button => button.nextElementSibling.matches('.setrow.is-current'))).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([false,false])
  await firstPlay.click()
  await page.screenshot({path:testInfo.outputPath('execution-guidance.png'),fullPage:true})
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
  const currentField = page.locator('.setrow .chk.is-executing')
  await expect(currentField).toHaveAccessibleName('Parar série 1')
  await expect(currentField.locator('svg')).toBeVisible()
  await expect(page.locator('.set-start-action')).toHaveCount(0)
  await expect(page.locator('.set-execution-hint')).toContainText('Executando série')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([false,false])
  await currentField.click()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await expect(page.locator('.set-execution-hint')).toContainText('Descansando')
  await expect(page.locator('.set-start-action')).toHaveCount(0)
  await expect(page.locator('#timer .rest-label span')).toContainText(longExerciseName)
  // Read both rectangles in one frame so the entry animation cannot skew the comparison.
  const {labelBounds, timerBounds} = await page.locator('#timer').evaluate(timer => {
    const label = timer.querySelector('.rest-label').getBoundingClientRect()
    const clock = timer.querySelector('.t').getBoundingClientRect()
    return {labelBounds:label.toJSON(),timerBounds:clock.toJSON()}
  })
  expect(timerBounds.y).toBeGreaterThanOrEqual(labelBounds.y + labelBounds.height)
  expect(timerBounds.x).toBeGreaterThanOrEqual(0)
  expect(timerBounds.x + timerBounds.width).toBeLessThanOrEqual(page.viewportSize().width)
  expect(timerBounds.y).toBeGreaterThanOrEqual(0)
  expect(timerBounds.y + timerBounds.height).toBeLessThanOrEqual(page.viewportSize().height)
  for (const element of await page.locator('#timer, #timer .acts button').all()) {
    const bounds = await element.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
  await page.screenshot({path:testInfo.outputPath('rest-guidance.png'),fullPage:true})
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
  await page.locator('#timer .skip').click()
  await expect(page.locator('#timer')).toHaveCount(0)
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  const nextPlay = page.locator('.set-start-action')
  await expect(nextPlay).toHaveAccessibleName('Iniciar série 2')
  await expect(page.locator('.set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  expect(await nextPlay.evaluate(button => button.nextElementSibling.matches('.setrow.is-current'))).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
})

test('rest expiration leaves the next set waiting for play', async ({page}) => {
  const state = stateFixture()
  state.restSec = 1
  state.routines[0].ex[0] = {id:'0025',sets:2,reps:10,weight:20,rest:1}
  await seed(page, {state})
  await page.goto('/#/home')
  await page.locator('[data-tab-key="start"]').click()
  await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()
  await page.locator('.set-start-action').click()
  await page.getByRole('button', {name:'Parar série 1', exact:true}).click()
  await expect(page.locator('#timer')).toBeVisible()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await expect(page.locator('#timer')).toHaveCount(0, {timeout:5000})
  const nextPlay = page.locator('.set-start-action')
  await expect(nextPlay).toHaveAccessibleName('Iniciar série 2')
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await expect(page.locator('.set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
  await nextPlay.click()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveAccessibleName('Parar série 2')
  await expect(page.locator('.set-execution-hint')).toContainText('Executando série')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
})

test('timed sets keep stop accessible and wait for play after rest expires', async ({page}) => {
  const state = stateFixture()
  state.routines[0].ex[0] = {id:'0025',sets:2,mode:'time',sec:30,rest:1,bodyweight:true,weight:0}
  await seed(page, {state})
  await page.goto('/#/home')
  await page.locator('[data-tab-key="start"]').click()
  await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()
  await expect(page.locator('.work-set-overlay')).toHaveCount(0)
  await page.locator('.set-start-action').click()
  await expect(page.locator('.work-set-overlay__time')).toBeVisible()
  await expect(page.locator('.work-set-overlay__backdrop')).toHaveCount(0)
  const stop = page.locator('.setrow .chk.is-executing')
  await expect(stop).toHaveAccessibleName('Parar série 1')
  await expect(stop).toBeEnabled()
  const {seriesBottom, countdownTop} = await page.locator('.work-set-overlay').evaluate(overlay => ({
    seriesBottom:overlay.previousElementSibling.getBoundingClientRect().bottom,
    countdownTop:overlay.querySelector('.work-set-overlay__time').getBoundingClientRect().top,
  }))
  expect(countdownTop).toBeGreaterThanOrEqual(seriesBottom)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([false,false])
  await expect.poll(async () => {
    const remaining = await page.locator('.work-set-overlay__time').textContent()
    const [minutes, seconds] = remaining.split(':').map(Number)
    return minutes * 60 + seconds
  }, {timeout:5000}).toBeLessThanOrEqual(28)
  await stop.click()
  const sets = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets)
  expect(sets[0].done).toBe(true)
  expect(sets[0].sec).toBeGreaterThanOrEqual(2)
  expect(sets[0].sec).toBeLessThan(30)
  expect(sets[1]).toMatchObject({done:false,sec:30})
  await expect(page.locator('.work-set-overlay.is-rest')).toBeVisible()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await expect(page.locator('.work-set-overlay')).toHaveCount(0, {timeout:5000})
  const nextPlay = page.locator('.set-start-action')
  await expect(nextPlay).toHaveAccessibleName('Iniciar série 2')
  await expect(page.locator('.setrow .chk.is-executing')).toHaveCount(0)
  await expect(page.locator('.set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  expect(await nextPlay.evaluate(button => button.nextElementSibling.matches('.setrow.is-current'))).toBe(true)
  await nextPlay.click()
  await expect(page.locator('.setrow .chk.is-executing')).toHaveAccessibleName('Parar série 2')
  await expect(page.locator('.work-set-overlay__time')).toBeVisible()
  await expect(page.locator('.work-set-overlay__backdrop')).toHaveCount(0)
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
  await page.locator('.active-workout').getByRole('button',{name:'Começar treino',exact:true}).click()
  await page.locator('.set-start-action').click()
  await page.getByRole('button',{name:'Parar série 1',exact:true}).click()
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
  await page.locator('.active-workout').getByRole('button',{name:'Começar treino',exact:true}).click()
  await page.locator('.set-start-action').click()
  await page.getByRole('button',{name:'Parar série 1',exact:true}).click()
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

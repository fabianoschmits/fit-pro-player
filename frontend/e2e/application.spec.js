import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, openMainNavigation } from './fixtures.test.js'

for (const width of [320, 390]) {
  test(`workout adjustments stay below series and leave execution unobstructed at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:720})
    await page.emulateMedia({reducedMotion:'reduce'})
    const state = stateFixture()
    state.routines[0].ex[0] = {id:'0025',sets:5,reps:10,weight:20}
    await seed(page, {state})
    await page.goto('/#/home')
    await openMainNavigation(page)
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
      const card = document.querySelector('.wp-exercise-player')
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
    const stop = page.locator('.wp-main-action.is-executing')
    await expect(stop).toHaveAccessibleName('Concluir série 1')
    await assertUnobstructed(stop)
    await stop.click()
    await expect(page.locator('#timer')).toBeVisible()
    await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
    await expect(page.locator('.set-start-action')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false,false,false,false,false,false])
    await page.locator('#timer .skip').click()
    await expect(page.locator('#timer')).toHaveCount(0)
    await expect(play).toHaveAccessibleName('Iniciar série 1')
    await assertUnobstructed(play)
    await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  })
}

test('execution guidance waits for play before each set and progresses after stop', async ({page}, testInfo) => {
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({width:320,height:720})
  const state = stateFixture()
  const longExerciseName = 'Extensão unilateral de tríceps com halter acima da cabeça em pé, com controle do movimento e amplitude completa para cada lado'
  state.customEx = [{id:'custom-long-name',name:longExerciseName,n:longExerciseName,bp:'upper arms',tg:'triceps',eq:'dumbbell',sm:[],custom:true}]
  state.routines[0].ex[0] = {id:'custom-long-name',sets:2,reps:10,weight:20}
  await seed(page, {state})
  await page.goto('/#/home')
  await openMainNavigation(page)
  await page.locator('[data-tab-key="start"]').click()
  await expect(page.locator('.exercise-muscle-static svg')).toBeVisible()
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()
  const firstPlay = page.locator('.set-start-action')
  await expect(firstPlay).toHaveAccessibleName('Iniciar série 1')
  await expect(firstPlay.locator('svg')).toBeVisible()
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  await expect(page.locator('.wp-current-controls')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([false,false])
  await firstPlay.click()
  await page.screenshot({path:testInfo.outputPath('execution-guidance.png'),fullPage:true})
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
  const currentField = page.locator('.wp-main-action.is-executing')
  await expect(currentField).toHaveAccessibleName('Concluir série 1')
  await expect(currentField.locator('svg')).toBeVisible()
  await expect(page.locator('.set-start-action')).toHaveCount(0)
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Executando série')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([false,false])
  await currentField.click()
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Descansando')
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
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  const nextPlay = page.locator('.set-start-action')
  await expect(nextPlay).toHaveAccessibleName('Iniciar série 2')
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  await expect(page.locator('.wp-current-controls')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
})

test('rest expiration leaves the next set waiting for play', async ({page}) => {
  const state = stateFixture()
  state.restSec = 1
  state.routines[0].ex[0] = {id:'0025',sets:2,reps:10,weight:20,rest:1}
  await seed(page, {state})
  await page.goto('/#/home')
  await openMainNavigation(page)
  await page.locator('[data-tab-key="start"]').click()
  await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()
  await page.locator('.set-start-action').click()
  await page.getByRole('button', {name:'Concluir série 1', exact:true}).click()
  await expect(page.locator('#timer')).toBeVisible()
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await expect(page.locator('#timer')).toHaveCount(0, {timeout:5000})
  const nextPlay = page.locator('.set-start-action')
  await expect(nextPlay).toHaveAccessibleName('Iniciar série 2')
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
  await nextPlay.click()
  await expect(page.locator('.wp-main-action.is-executing')).toHaveAccessibleName('Concluir série 2')
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Executando série')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.map(set => set.done))).toEqual([true,false])
})

test('timed sets keep stop accessible and wait for play after rest expires', async ({page}) => {
  const state = stateFixture()
  state.routines[0].ex[0] = {id:'0025',sets:2,mode:'time',sec:30,rest:1,bodyweight:true,weight:0}
  await seed(page, {state})
  await page.goto('/#/home')
  await openMainNavigation(page)
  await page.locator('[data-tab-key="start"]').click()
  await page.locator('.active-workout').getByRole('button', {name:'Começar treino', exact:true}).click()
  await expect(page.locator('.work-set-overlay')).toHaveCount(0)
  await page.locator('.set-start-action').click()
  await expect(page.locator('.work-set-overlay__time')).toBeVisible()
  await expect(page.locator('.work-set-overlay__backdrop')).toHaveCount(0)
  const stop = page.locator('.wp-main-action.is-executing')
  await expect(stop).toHaveAccessibleName('Concluir série 1')
  await expect(stop).toBeEnabled()
  const {controlsBottom, countdownTop} = await page.locator('.work-set-overlay').evaluate(overlay => ({
    controlsBottom:document.querySelector('.wp-current-controls').getBoundingClientRect().bottom,
    countdownTop:overlay.querySelector('.work-set-overlay__time').getBoundingClientRect().top,
  }))
  expect(countdownTop).toBeGreaterThanOrEqual(controlsBottom)
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
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await expect(page.locator('.work-set-overlay')).toHaveCount(0, {timeout:5000})
  const nextPlay = page.locator('.set-start-action')
  await expect(nextPlay).toHaveAccessibleName('Iniciar série 2')
  await expect(page.locator('.wp-main-action.is-executing')).toHaveCount(0)
  await expect(page.locator('.wp-exercise-player > .set-execution-hint')).toContainText('Toque em Play para iniciar esta série.')
  await expect(page.locator('.wp-current-controls')).toBeVisible()
  await nextPlay.click()
  await expect(page.locator('.wp-main-action.is-executing')).toHaveAccessibleName('Concluir série 2')
  await expect(page.locator('.work-set-overlay__time')).toBeVisible()
  await expect(page.locator('.work-set-overlay__backdrop')).toHaveCount(0)
})

test('student receives a professional plan and applies it only after explicit confirmation',async({page})=>{
 const deliveryId='55555555-5555-4555-8555-555555555555',versionId='44444444-4444-4444-8444-444444444444'
 let requested=false,accepted=false,applied=false
 const weeklyPlan={monday:[{exerciseId:'0025',sets:1,reps:10,load:20,rest:15}]}
 await seed(page,{authenticated:true,rpc:{
  preview_professional_invite:[{professional_name:'Treinador de teste',bio:'Força',verification_status:'unverified',specialties:[]}],
  request_professional_link:()=>{requested=true;return{id:'66666666-6666-4666-8666-666666666666',status:'pending'}},
  student_link_requests:()=>requested?[{id:'request',status:accepted?'accepted':'pending',professional_name:'Treinador de teste',created_at:'2026-11-03'}]:[],
  athlete_plan_library_page:()=>({items:accepted?[{id:deliveryId,available:true,source_type:'professional',professional_name:'Treinador de teste',version:{id:versionId,weekly_plan:weeklyPlan,workout_titles:{monday:'Plano recebido'}}}]:[],total:accepted?1:0}),
  apply_library_plan:args=>{applied=true;return {routines:[...stateFixture().routines.map((routine,position)=>({id:routine.id,user_id:USER,revision:3,title:routine.name,position,prescription:routine,created_at:'2026-11-01',updated_at:'2026-11-01'})),{id:'professional-routine',user_id:USER,revision:3,title:'Plano recebido',position:1,prescription:{assigned:true,programVersionId:versionId,ex:[{id:'0025',sets:1,reps:10,weight:20}]},created_at:'2026-11-01',updated_at:'2026-11-01'}],schedule:{user_id:USER,revision:args.p_expected_revision+1,mode:'weekly',schedule:{week:{1:'professional-routine'},libraryId:deliveryId,assignedProgram:{versionId}},updated_at:'2026-11-01T12:00:00Z'}}},
 }})
 await page.goto('/#/invite/A1B2C3D4E5')
 await page.getByRole('button',{name:'Solicitar vínculo',exact:true}).click()
 await expect(page).toHaveURL(/student\/professionals/)
 await expect(page.getByText('Aguardando resposta',{exact:true})).toBeVisible()
 expect(accepted).toBe(false)
 // The dedicated SQL lifecycle E2E exercises the professional's decision UI.
 // This student-only scenario resumes after that explicit server decision.
 accepted=true
 await page.goto('/#/plan')
 await page.getByRole('button',{name:'Treino do profissional',exact:true}).click()
 // The complete-week calendar also contains this title, with compact labels
 // hidden on mobile. Verify the visible received workout, not DOM order.
 await expect(page.locator('.received-workout-main').getByText('Plano recebido',{exact:true})).toBeVisible()
 await expect(page.locator('.professional-plan-preview .plan-day')).toHaveCount(7)
 await expect(page.getByRole('button',{name:'Usar este plano',exact:true})).toHaveCount(1)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:11111111-1111-4111-8111-111111111111`)).state.routines[0].name)).toBe('Treino de teste')
 expect(applied).toBe(false)
 await page.getByRole('button',{name:'Usar este plano',exact:true}).first().click()
 expect(applied).toBe(false)
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar plano',exact:true}).click()
 await expect.poll(()=>applied).toBe(true)
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.locator('.plan-view > .training-plan-workspace .plan-day.on')).toHaveAttribute('aria-label','Segunda-feira: Plano recebido')
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fpp_account_cache_v1:11111111-1111-4111-8111-111111111111')).state.activeLibraryId)).toBe(deliveryId)
})

test('guest can start, discard, reload and keep the planned routine',async({page},testInfo)=>{
  await seed(page);await page.goto('/#/home')
  await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  await openMainNavigation(page)
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
  await seed(page);await page.goto('/#/home');await openMainNavigation(page);await page.locator('[data-tab-key="start"]').click()
  await expect(page.locator('.workout-session-title')).toBeVisible()
  await page.locator('.active-workout').getByRole('button',{name:'Começar treino',exact:true}).click()
  await page.locator('.set-start-action').click()
  await page.getByRole('button',{name:'Concluir série 1',exact:true}).click()
  const dialog=page.getByRole('dialog').last()
  await expect(dialog).toBeVisible()
  if(await dialog.getByRole('button',{name:'Salvar',exact:true}).count()) await dialog.getByRole('button',{name:'Salvar',exact:true}).click()
  await page.getByRole('button',{name:'Terminar treino',exact:true}).click()
  await page.getByRole('dialog').last().getByRole('button',{name:'Terminar treino',exact:true}).click()
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts.length)).toBe(1)
  await page.reload();await page.goto('/#/history')
  await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].entries[0].sets[0].done)).toBe(true)
})

test('professional template reloads its saved prescription and publishes explicitly',async({page})=>{
 const program={id:'33333333-3333-4333-8333-333333333333',title:'Programa de teste',description:'Força',archived:false}
 const weeklyPlan={monday:[{exerciseId:'0025',sets:3,reps:8,load:0,rest:90}]}
 let published
 await seed(page,{professional:true,rpc:{programs:[program],professional_programs_page:{items:[{...program,weekly_plan:weeklyPlan,workout_count:1,student_count:0}],total:1,offset:0,has_more:false},program_versions:[{id:'44444444-4444-4444-8444-444444444444',weekly_plan:weeklyPlan,workout_titles:{monday:'Treino A'}}],update_program_metadata:program,publish_program_version_with_titles:args=>{published=args;return{id:'44444444-4444-4444-8444-444444444445',version_number:2,weekly_plan:args.p_weekly_plan}}}})
 await page.goto('/#/professional/programs')
 await page.getByRole('link',{name:/Programa de teste/}).click()
 await expect(page.getByRole('button',{name:'Salvar modelo',exact:true})).toBeVisible()
 await page.reload()
 await expect(page.getByRole('button',{name:'Salvar modelo',exact:true})).toBeVisible()
 expect(published).toBeUndefined()
 await page.getByRole('button',{name:'Salvar modelo',exact:true}).click()
 await expect.poll(()=>published?.p_program_id).toBe(program.id)
 expect(published.p_weekly_plan.monday[0]).toMatchObject({sets:3,reps:8,load:0,rest:90})
})

test('settings distinguishes local cleanup, names switches and exports a usable backup',async({page})=>{
  await seed(page);await page.goto('/#/settings')
  await page.getByRole('button',{name:'Durante o treino',exact:true}).click()
  await expect(page.getByRole('switch').first()).toHaveAccessibleName(/.+/)
  await page.getByRole('button',{name:'Dados',exact:true}).click()
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

test('offline changes stay local without automatic save notices',async({page,context})=>{
  await seed(page);await page.goto('/#/home')
  await expect(page.getByText('Treino de teste',{exact:true}).first()).toBeVisible()
  await context.setOffline(true)
  await expect(page.locator('.app-status-global')).toHaveCount(0)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].name)).toBe('Treino de teste')
  await context.setOffline(false)
  await expect(page.locator('.app-status-global')).toHaveCount(0)
})

test('professional dashboard explains attention reasons and supports student navigation',async({page})=>{
  await seed(page,{professional:true,rpc:{professional_dashboard_summary:{active_students:1,attention_students:1,today_workouts:0,today:[],recent_activity:[]},professional_students_page:{items:[{student_user_id:'22222222-2222-4222-8222-222222222222',display_name:'Aluno de teste',active_assignment_id:null,last_execution_at:null}],total:1,offset:0,has_more:false},professional_client_detail:[{student_user_id:'22222222-2222-4222-8222-222222222222',display_name:'Aluno de teste',assignments:[],executions:[]}]}})
  await page.goto('/#/professional')
  await expect(page.getByText('Aluno de teste',{exact:true}).first()).toBeVisible()
  await expect(page.getByText(/Sem plano|sem plano/).first()).toBeVisible()
  await page.getByText('Aluno de teste',{exact:true}).first().click()
  await expect(page).toHaveURL(/professional\/students\//)
})

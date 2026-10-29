import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'

const PRO = '77777777-7777-4777-8777-777777777777', OTHER = '88888888-8888-4888-8888-888888888888'
const PROGRAM = '33333333-3333-4333-8333-333333333333', VERSION = '44444444-4444-4444-8444-444444444444', ASSIGNMENT = '55555555-5555-4555-8555-555555555555'
const name = 'Ana Carolina Albuquerque de Oliveira e Silva — acompanhamento individual de força e condicionamento'
const plan = { monday: [{ exerciseId:'0025', sets:3, reps:10, load:25, rest:90, notes:'Controle o movimento.' }] }
const professionals = [
  { professional_user_id:PRO, relationship_id:'relationship-a', professional_name:name, bio:'Acompanhamento individual com progressão de cargas.', specialties:['força','condicionamento físico'], city_region:'São Paulo e online', registration_type:'CREF', registration_number:'012345-G/SP', verification_status:'verified', linked_at:'2026-10-01T12:00:00Z', active_program_title:'Programa atual' },
  { professional_user_id:OTHER, relationship_id:'relationship-b', professional_name:'Bruno de teste', verification_status:'unverified', linked_at:'2026-09-01T12:00:00Z' },
]
const program = { id:PROGRAM, professional_user_id:USER, title:'Força e condicionamento para uma rotina consistente com progressão individual', description:'Progressão com atenção à técnica.', archived:false }
const version = { id:VERSION, program_id:PROGRAM, version_number:2, weekly_plan:plan, published_at:'2026-10-04T12:00:00Z' }
const material = { assignment_id:ASSIGNMENT, program_id:PROGRAM, version_id:VERSION, title:'Programa atual', status:'active', version_number:2, assigned_at:'2026-10-04T12:00:00Z', published_at:version.published_at, weekly_plan:plan }
const rpc = {
  professional_dashboard_summary:{active_students:1,attention_students:0,today_workouts:0,active_programs:1,pending_invites:0,today:[],recent_activity:[]},
  professional_students_page:{items:[{student_user_id:STUDENT,display_name:name,attention_reasons:[]}],total:1,offset:0,has_more:false},
  professional_programs_page:{items:[program],total:1,offset:0,has_more:false},
  professional_student_note:{body:'',updated_at:null},
  professional_profiles:{ user_id:USER, professional_name:name, bio:professionals[0].bio, specialties:professionals[0].specialties, city_region:professionals[0].city_region, verification_status:'verified' },
  professional_client_summaries:[{ student_user_id:STUDENT, display_name:name, relationship_created_at:'2026-10-01T12:00:00Z', program_id:PROGRAM, program_title:program.title }],
  professional_client_detail:[{ student_user_id:STUDENT, display_name:name, relationship_created_at:'2026-10-01T12:00:00Z', assignments:[], executions:[] }],
  professional_student_relationships:[{ id:'relationship', professional_user_id:USER, student_user_id:STUDENT, status:'active', created_at:'2026-10-01T12:00:00Z' }],
  professional_invites:[{ id:'personal-invite', code:'ANASOUZA', status:'pending', kind:'code', is_personal:true, is_custom:false, created_at:'2026-10-01T12:00:00Z' },{ id:'invite', code:'A1B2C3D4E5', status:'pending', kind:'code', is_personal:false, is_custom:false, created_at:'2026-10-04T12:00:00Z' },{ id:'accepted-invite', code:'ACCEPTED1', status:'active', kind:'code', is_personal:false, is_custom:false, created_at:'2026-10-03T12:00:00Z', accepted_at:'2026-10-03T13:00:00Z' },{ id:'revoked-invite', code:'REVOKED1', status:'revoked', kind:'code', is_personal:false, is_custom:false, created_at:'2026-10-02T12:00:00Z' }],
  save_professional_personal_invite:args=>({id:'personal-invite',code:'CODIGOFIT',status:'pending',kind:'code',is_personal:true,is_custom:true,created_at:'2026-10-01T12:00:00Z'}),
  revoke_professional_invite:args=>({id:args.p_invite_id,status:'revoked'}),
  programs:[program], program_versions:[version],
  student_professional_cards:professionals,
  student_professional_detail:args => { const person = professionals.find(item => item.professional_user_id === args.p_professional_user_id); return person ? [{ professional:person, relationship:{ id:person.relationship_id, status:'active', linked_at:person.linked_at }, materials:[person === professionals[0] ? material : { ...material, assignment_id:'old-assignment', title:'Corrida histórica', status:'revoked' }], executions:[] }] : [] },
  program_assignments:[{ id:ASSIGNMENT, professional_user_id:PRO, student_user_id:USER, program_id:PROGRAM, version_id:VERSION, status:'active', created_at:'2026-10-04T12:00:00Z' }],
  student_program_overview:{ assignment:{id:ASSIGNMENT}, program:{title:material.title}, professional:{id:PRO,name}, version:{id:VERSION,versionNumber:2,weeklyPlan:plan,publishedAt:version.published_at}, executions:[] },
  preview_professional_invite:[{ professional_name:name, bio:professionals[0].bio, specialties:['força'], verification_status:'verified' }],
}

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('fpp_privacy_consent_v1', JSON.stringify({version:'2026-10-13', necessary:true, preferences:false, analytics:false, communications:false, acceptedAt:'2026-10-15T12:00:00Z'})))
})

test('an account without professional access opens onboarding from More', async ({page}) => {
  await seed(page,{authenticated:true,rpc:{professional_profiles:null}})
  await page.goto('/#/more')
  const account = page.locator('.more-account-card')
  await expect(account).toContainText('Pessoa Teste')
  await expect(account).toContainText('browser-test@example.invalid')
  await expect(account).not.toContainText('Modo convidado')
  await page.getByRole('button',{name:/Tornar-se profissional/}).click()
  await expect(page).toHaveURL(/#\/professional\/profile$/)
  await expect(page.getByRole('heading',{name:'Tornar-se profissional',level:1,exact:true})).toBeVisible()
  await expect(page.getByRole('textbox',{name:'Nome profissional',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Criar perfil profissional',exact:true})).toBeVisible()
})

test('a narrow workspace displays professionals and links to the plan library', async ({page}) => {
 await page.setViewportSize({width:320,height:780});await seed(page,{professional:true,rpc});await page.goto('/#/student/professionals')
 await expect(page.getByRole('link',{name:'Planos recebidos · Abrir biblioteca'})).toBeVisible()
 await expect(page.locator('.management-person-link')).toHaveCount(2)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true)
 await page.getByRole('link',{name:'Voltar ao aplicativo',exact:true}).click();await expect(page).toHaveURL(/#\/home$/)
})

test('leaving the professional workspace returns to Home', async ({page}) => {
 await seed(page,{professional:true,rpc})
 await page.goto('/#/professional')
 await page.getByRole('link',{name:'Voltar ao aplicativo',exact:true}).click()
 await expect(page).toHaveURL(/#\/home$/)
 await expect(page.locator('.management-layout')).toHaveCount(0)
})

test('browser Back recovers a workspace after a failed page import', async ({page}) => {
  await seed(page,{professional:true,rpc})
  await page.route('**/src/views/ProfessionalPrograms.jsx*', route => route.fulfill({contentType:'application/javascript',body:'throw new Error("Fixture program unavailable"); export default function Page() { return null }'}))
  await page.goto('/#/professional')
  await page.locator('.management-nav').getByRole('link', { name: 'Modelos', exact: true }).click()
  await expect(page).toHaveURL(/#\/professional\/templates$/)
  await expect(page.locator('.management-layout')).toHaveCount(0)
  await expect(page.getByRole('button',{name:/Recarregar/})).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading',{name:'Área profissional',level:1,exact:true})).toBeVisible()
})

test('reserved routes, aliases and handoff queries resolve through the application shell', async ({page}) => {
  await seed(page,{professional:true,rpc})
  for (const route of ['/professional-profile?onboarding=1','/professional/profile/edit','/professional/programs/new','/student/professionals/materials','/student/professionals/add?code=A1B2C3D4E5','/connect?code=A1B2C3D4E5','/student/professionals?code=A1B2C3D4E5','/invite/A1B2C3D4E5']) {
    await page.goto(`/#${route}`)
    await expect(page.locator('.management-layout')).toBeVisible()
    if (route.includes('code=') || route.startsWith('/invite/')) await expect(page.getByRole('button',{name:'Vincular a este profissional',exact:true})).toBeVisible()
    if (route.startsWith('/connect') || route.startsWith('/student/professionals?code=')) await expect(page).toHaveURL(/student\/professionals\/add\?code=A1B2C3D4E5/)
    await page.reload(); await expect(page.locator('.management-layout')).toBeVisible()
  }
  await page.evaluate(() => sessionStorage.removeItem('fpp-pending-invite'))
  await page.goto(`/#/professional/students?program=${PROGRAM}&version=${VERSION}`)
  await page.locator('.management-record').first().click()
  await expect(page).toHaveURL(new RegExp(`/professional/students/${STUDENT}$`))
  await expect(page.getByRole('heading',{name:'Plano atual'})).toBeVisible()
  await page.reload();await expect(page.getByRole('heading',{name:'Plano atual'})).toBeVisible()
})

test('code entry remains accessible before onboarding and acceptance', async ({page}) => {
  const state = stateFixture(); state.onboardingDone = false
  await seed(page,{authenticated:true,state,rpc})
  await page.goto('/#/connect?code=A1B2C3D4E5')
  await expect(page.getByRole('button',{name:'Vincular a este profissional',exact:true})).toBeVisible()
  await expect(page).toHaveURL(/student\/professionals\/add\?code=/)
  await page.evaluate(() => sessionStorage.removeItem('fpp-pending-invite'))
  await page.goto('/#/connect')
  await expect(page).toHaveURL(/student\/professionals\/add$/)
  await expect(page.locator('#student-invite-code')).toBeVisible()
  await expect(page.getByRole('button',{name:'Vincular a este profissional',exact:true})).toHaveCount(0)
})

test('a direct invitation alias selects and reveals Add in the mobile management navigation', async ({page}) => {
  await page.setViewportSize({width:360,height:800})
  await seed(page,{authenticated:true,rpc})
  await page.goto('/#/invite/A1B2C3D4E5')
  const selected = page.locator('.management-nav [aria-current="page"]')
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveText('Adicionar profissional')
  await expect(page.getByRole('button',{name:'Vincular a este profissional',exact:true})).toBeVisible()
  const bounds = await selected.evaluate(link => {
    const selectedBounds = link.getBoundingClientRect(), navBounds = link.closest('nav').getBoundingClientRect()
    return {left:selectedBounds.left,right:selectedBounds.right,navLeft:navBounds.left,navRight:navBounds.right}
  })
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.navLeft - 1)
  expect(bounds.right).toBeLessThanOrEqual(bounds.navRight + 1)
})

test('professional dashboard quick actions use readable columns on narrow screens', async ({page}) => {
  for (const width of [320,360,390,430]) {
    await page.setViewportSize({width,height:800})
    await seed(page,{professional:true,rpc})
    await page.goto('/#/professional')
    const columns = await page.locator('.management-quick-actions').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    expect(columns,`${width}px quick action columns`).toBe(2)
  }
})

test('deep-linked management sections keep the selected tab in view', async ({page}) => {
  await seed(page,{professional:true,rpc})
  for (const width of [320,360,390,430]) {
    await page.setViewportSize({width,height:800})
    for (const route of [`/professional/students/${STUDENT}?section=relationship`,`/student/professionals/${PRO}?section=relationship`]) {
      await page.goto(`/#${route}`)
      const selected = page.locator('.management-section-nav [aria-current="page"]')
      await expect(selected).toBeVisible()
      const bounds = await selected.evaluate(link => {
        const selectedBounds = link.getBoundingClientRect(), navBounds = link.closest('nav').getBoundingClientRect()
        return {left:selectedBounds.left,right:selectedBounds.right,navLeft:navBounds.left,navRight:navBounds.right}
      })
      expect(bounds.left,`${width}px ${route}`).toBeGreaterThanOrEqual(bounds.navLeft - 1)
      expect(bounds.right,`${width}px ${route}`).toBeLessThanOrEqual(bounds.navRight + 1)
    }
  }
})

test('professional plan setup keeps the week grid usable on narrow phones', async ({page},testInfo) => {
  await seed(page,{professional:true,rpc:{...rpc,professional_plan_drafts:[{
    student_id:STUDENT,title:'Plano de treino',revision:1,sent_revision:1,updated_at:'2026-10-28T12:00:00Z',
    workspace:{routines:[{id:'routine-a',name:'Treino A',emoji:'dumbbell',ex:[{id:'0025',sets:3,reps:10,weight:25,rest:90}]}],week:{0:'routine-a'},dayPlan:{},planMode:'weekly',onboardingDone:true},
  }]}})
  for (const width of [320,360,390,430]) {
    await page.setViewportSize({width,height:860})
    await page.goto(`/#/professional/students/${STUDENT}/plan`)
    const grid = page.locator('.plan-week-grid')
    await expect(grid).toBeVisible()
    const days = grid.locator('.plan-day')
    await expect(days).toHaveCount(7)
    const boxes = await days.evaluateAll(elements => elements.map(element => element.getBoundingClientRect()))
    expect(boxes[0].left,`${width}px week start`).toBeGreaterThanOrEqual(0)
    expect(boxes.at(-1).right,`${width}px week end`).toBeLessThanOrEqual(width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 320 || width === 430) await page.screenshot({path:testInfo.outputPath(`professional-plan-setup-${width}.png`),fullPage:true})
    await page.locator('.management-plan-actions').getByRole('button',{name:'Enviar atualização',exact:true}).click()
    const confirmation = page.getByRole('dialog')
    await expect(confirmation).toBeVisible()
    const dialogBounds = await confirmation.boundingBox()
    expect(dialogBounds.x,`${width}px confirmation left`).toBeGreaterThanOrEqual(0)
    expect(dialogBounds.x+dialogBounds.width,`${width}px confirmation right`).toBeLessThanOrEqual(width+1)
    await confirmation.getByRole('button',{name:'Cancelar',exact:true}).click()
  }
})

test('unsent professional plan shows a compact red-outline warning', async ({page}) => {
  await seed(page,{professional:true,rpc:{...rpc,professional_plan_drafts:[{
    student_id:STUDENT,title:'Plano de treino',revision:2,sent_revision:1,updated_at:'2026-10-28T12:00:00Z',
    workspace:{routines:[{id:'routine-a',name:'Treino A',emoji:'dumbbell',ex:[{id:'0025',sets:3,reps:10,weight:25,rest:90}]}],week:{0:'routine-a'},dayPlan:{},planMode:'weekly',onboardingDone:true},
  }]}})
  await page.goto(`/#/professional/students/${STUDENT}/plan`)
  const warning=page.locator('.management-plan-status[data-pending="true"]')
  await expect(warning).toContainText('Alterações não enviadas')
  const style=await warning.evaluate(element=>({
    borders:['Top','Right','Bottom','Left'].map(side=>getComputedStyle(element)[`border${side}Color`]),
    fontSize:getComputedStyle(element).fontSize,
    padding:getComputedStyle(element).padding,
  }))
  expect(style.borders.every(color=>color===style.borders[0])).toBe(true)
  expect(style.borders[0]).not.toBe('rgba(0, 0, 0, 0)')
  expect(parseFloat(style.fontSize)).toBeLessThanOrEqual(12)
  expect(parseFloat(style.padding)).toBeLessThanOrEqual(10)
})


test('professional invitations separate reusable code and preserve generated invite history', async ({page}) => {
  await page.context().grantPermissions(['clipboard-read','clipboard-write'])
  await seed(page,{professional:true,rpc})
  await page.goto('/#/professional/invites')
  const personal = page.locator('.management-personal-invite-panel')
  await expect(personal).toContainText('ANASOUZA')
  await expect(personal).toContainText('Reutilizável')
  await expect(personal).not.toContainText('Pendente')
  await expect(page.getByText('ACCEPTED1')).toBeVisible()
  await expect(page.getByText('REVOKED1')).toBeVisible()
  await expect(page.getByRole('button',{name:'Revogar',exact:true})).toHaveCount(1)
  for (const width of [320,360,390,430]) {
    await page.setViewportSize({width,height:800})
    await expect(personal).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  }

  await personal.getByRole('button',{name:'Editar código',exact:true}).click()
  await personal.getByRole('textbox',{name:'Código pessoal',exact:true}).fill('Código Fit')
  await personal.getByRole('button',{name:'Salvar código',exact:true}).click()
  await expect(personal).toContainText('CODIGOFIT')
  await expect(personal).toContainText('Código personalizado')
  await personal.getByRole('button',{name:'Copiar código',exact:true}).click()
  await expect(page.locator('.management-notice')).toContainText('Código copiado.')

  await page.getByRole('button',{name:'Revogar',exact:true}).click()
  await expect(page.getByText('Revogar este convite?')).toBeVisible()
  await page.getByRole('button',{name:'Confirmar',exact:true}).click()
  await expect(page.getByText('Convite revogado.',{exact:true})).toBeVisible()
})
test('legacy program creation redirects to the shared template editor', async ({page}) => {
 let created=null
 await seed(page,{professional:true,rpc:{programs:()=>created?[created]:[],program_versions:[],create_program:args=>{created={...program,title:args.p_title};return created}}})
 await page.goto('/#/professional/programs/new')
 await page.getByRole('textbox',{name:'Nome do modelo',exact:true}).fill('Novo modelo integrado')
 await page.getByRole('button',{name:'Criar modelo',exact:true}).click()
 await expect(page).toHaveURL(new RegExp(`professional/templates/${PROGRAM}$`))
 await expect(page.locator('.training-plan-workspace').first()).toBeVisible()
 await page.reload();await expect(page.locator('.training-plan-workspace').first()).toBeVisible()
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page).toHaveURL(/professional\/templates$/)
})

test('professional model card shows the muscle preview from its latest published plan', async ({page}) => {
 const model={...program,workout_count:1,weekly_plan:plan}
 await seed(page,{professional:true,rpc:{professional_programs_page:{items:[model],total:1,offset:0,has_more:false}}})
 await page.goto('/#/professional/templates')
 await expect(page.getByRole('link',{name:/Força e condicionamento/})).toBeVisible()
 await expect(page.locator('.management-template-icon .plan-routine-body-thumb')).toHaveCount(1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})

test('professional model without a published workout keeps a neutral icon', async ({page}) => {
 const model={...program,workout_count:0,weekly_plan:{}}
 await seed(page,{professional:true,rpc:{professional_programs_page:{items:[model],total:1,offset:0,has_more:false}}})
 await page.goto('/#/professional/templates')
 await expect(page.locator('.management-template-icon .plan-routine-body-thumb')).toHaveCount(0)
 await expect(page.locator('.management-template-icon svg')).toHaveCount(1)
})

test('professional can delete an unused model from its detail after confirmation', async ({page}) => {
 const calls=[]
 await seed(page,{professional:true,rpc:{...rpc,programs:[{...program,archived:true}],delete_professional_program:args=>{calls.push(args);return null}}})
 await page.goto(`/#/professional/templates/${PROGRAM}`)
 await page.getByText('Histórico e opções do modelo',{exact:true}).click()
 await page.getByRole('button',{name:'Excluir modelo',exact:true}).click()
 await expect(page.getByText('Excluir modelo permanentemente?',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Excluir modelo',exact:true}).last().click()
 await expect.poll(()=>calls).toEqual([{p_program_id:PROGRAM}])
 await expect(page).toHaveURL(/#\/professional\/templates$/)
})

test('professional is directed to archive an assigned model when safe deletion is blocked', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'})
 const calls=[]
 await seed(page,{professional:true,rpc:{...rpc,programs:[program],delete_professional_program:args=>{calls.push(args);return {__error:{status:400,body:{code:'P0001',message:'program_in_use'}}}},update_program:args=>{calls.push(args);return program}}})
 await page.goto(`/#/professional/templates/${PROGRAM}`)
 await page.getByText('Histórico e opções do modelo',{exact:true}).click()
 await page.getByRole('button',{name:'Excluir modelo',exact:true}).click()
 await page.getByRole('button',{name:'Excluir modelo',exact:true}).last().click()
 await expect(page.getByRole('alert')).toContainText('precisa ser arquivado')
 await page.getByRole('alert').getByRole('button',{name:'Arquivar modelo',exact:true}).click()
 await page.getByRole('button',{name:'Arquivar',exact:true}).last().click()
 await expect(page).toHaveURL(/#\/professional\/templates$/)
 expect(calls[0]).toEqual({p_program_id:PROGRAM})
 expect(calls[1]).toMatchObject({p_program_id:PROGRAM,p_archived:true})
})

test('student profile loads workout history on entry and expands actual sets and total duration', async ({page}) => {
 const execution={id:'execution-a',student_user_id:STUDENT,day_key:'monday',status:'completed',started_at:'2026-10-28T10:00:00Z',completed_at:'2026-10-28T10:30:00Z',program_title:'Força',prescription_snapshot:{workoutTitle:'Treino A',exercises:[{exerciseId:'0025',sets:3,reps:8}]},payload:{entries:[{id:'0025',sets:[{done:true,w:20,r:8}]}]}}
 await seed(page,{professional:true,rpc:{professional_executions_page:{items:[execution],total:1,offset:0,has_more:false}}})
 await page.goto(`/#/professional/students/${STUDENT}?section=history`)
 const card=page.locator('.professional-execution-card')
 await expect(card).toBeVisible()
 await expect(card).toContainText('Supino com barra')
 await expect(page.getByRole('button',{name:'Histórico',exact:true})).toHaveCount(0)
 await card.locator('summary').click()
 await expect(card).toContainText('Realizado')
 await expect(card).toContainText('20 kg × 8')
 await expect(card).toContainText('Duração realizada (min): 30')
})

test('professional notes append privately with a visible date and time', async ({page}) => {
 let notes=[{id:'legacy-note',body:'Registro privado anterior',created_at:'2026-10-20T12:30:00Z'}]
 await seed(page,{professional:true,rpc:{list_professional_student_notes:()=>notes,add_professional_student_note:args=>{const note={id:`note-${notes.length+1}`,body:args.p_body,created_at:'2026-10-28T12:34:00Z'};notes=[note,...notes];return note}}})
 await page.goto(`/#/professional/students/${STUDENT}?section=notes`)
 await expect(page.getByText('Registro privado anterior',{exact:true})).toBeVisible()
 const composer=page.getByRole('textbox',{name:'Nova anotação privada'})
 await composer.fill('Orientar progressão de carga')
 await page.getByRole('button',{name:'Enviar anotação privada',exact:true}).click()
 await expect(page.getByText('Orientar progressão de carga',{exact:true})).toBeVisible()
 await expect(page.getByText('Registro privado anterior',{exact:true})).toBeVisible()
 await expect(composer).toHaveValue('')
 await expect(page.locator('.professional-private-note')).toHaveCount(2)
 const dateTime=new Date('2026-10-28T12:34:00Z').toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})
 await expect(page.locator('.professional-private-note').first()).toContainText(dateTime)
})

test('material selection stays independent and historical inspection preserves the current plan', async ({page}) => {
  await seed(page,{authenticated:true,rpc})
  await page.goto('/#/student/professionals')
  await expect(page.locator('.management-person-link')).toHaveCount(2)
  const currentAssignment = () => page.evaluate(userId => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${userId}`)).state.assignedProgram, USER)
  const initial = await currentAssignment()
  expect(initial).toBeNull()
  await page.getByRole('link',{name:'Ver materiais',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Bruno de teste',exact:true})).toBeVisible()
  await page.getByRole('link',{name:/Corrida histórica/}).click()
  await expect(page).toHaveURL(new RegExp(`${OTHER}\\?section=training&material=old-assignment`))
  await expect(page.locator('details[open]')).toContainText('Corrida histórica')
  await expect(page.getByRole('button',{name:'Iniciar',exact:true})).toHaveCount(0)
  await expect(page.getByRole('link',{name:'Abrir programa atual',exact:true})).toHaveCount(0)
  expect(await currentAssignment()).toEqual(initial)
  await page.reload(); await expect(page.locator('details[open]')).toContainText('Corrida histórica')
})

test('empty and failed management reads retain navigation, retry and keyboard focus', async ({page},testInfo) => {
  await page.setViewportSize({width:360,height:800}); await page.emulateMedia({reducedMotion:'reduce'})
  await seed(page,{authenticated:true,rpc:{student_professional_cards:[],student_program_overview:{}}})
  await page.goto('/#/student/professionals')
  await expect(page.getByText('Você ainda não possui profissionais vinculados.',{exact:true})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('management-empty-360.png'),fullPage:true})
  const failure = async route => route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture read failure'})})
  await page.route('**/rest/v1/rpc/student_professional_cards',failure)
  await page.reload()
  const retry = page.getByRole('button',{name:'Tentar novamente',exact:true})
  await expect(retry).toBeVisible()
  await page.keyboard.press('Tab'); await retry.focus()
  expect(await retry.evaluate(button => getComputedStyle(button).outlineWidth)).toBe('2px')
  await page.screenshot({path:testInfo.outputPath('management-error-focus-360.png'),fullPage:true})
  await page.unroute('**/rest/v1/rpc/student_professional_cards',failure)
  await retry.click(); await expect(page.getByText('Você ainda não possui profissionais vinculados.',{exact:true})).toBeVisible()
  await page.getByRole('link',{name:'Adicionar profissional',exact:true}).first().click()
  await expect(page.locator('#student-invite-code')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
})

for (const width of [320,360,390,430,1280,1440]) for (const theme of ['light','dark']) test(`management visual matrix ${width}px ${theme}`, async ({page},testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Matrix sizes are explicit; run once per size/theme.')
  test.setTimeout(90000)
  await page.setViewportSize({width,height:1000}); await page.emulateMedia({reducedMotion:'reduce'})
  const state = stateFixture(); state.theme = theme
  const errors = []; page.on('pageerror',error => errors.push(error.message))
  await seed(page,{professional:true,state,rpc})
  const routes = ['/professional','/professional/profile','/professional/profile/edit','/professional/students',`/professional/students/${STUDENT}`,`/professional/students/${STUDENT}?section=training`,`/professional/students/${STUDENT}/plan`,'/professional/invites','/professional/invites?section=create','/professional/invites?section=result&code=A1B2C3D4E5','/professional/programs','/professional/programs/new',`/professional/programs/${PROGRAM}`,`/professional/programs/${PROGRAM}/edit`,'/student/professionals','/student/professionals/add?code=A1B2C3D4E5',`/student/professionals/${PRO}`,`/student/professionals/${PRO}?section=training`,`/student/professionals/${PRO}?section=history`,`/student/professionals/${PRO}?section=relationship`,'/student/professionals/materials']
  for (const [index,route] of routes.entries()) {
    await page.goto(`/#${route}`)
    await expect(page.locator('.management-layout')).toBeVisible()
    await expect(page.locator('.management-content')).not.toContainText(/Carregando|Consultando convite/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2),route).toBe(false)
    expect(await page.locator('.management-content').evaluate(content => {
      const bounds=content.getBoundingClientRect()
      return [...content.children].every(child => child.getBoundingClientRect().right <= bounds.right + 2)
    }),`Content must not be clipped: ${route}`).toBe(true)
    const selected = page.locator('.management-nav [aria-current="page"]')
    if (await selected.count()) {
      await expect.poll(async () => selected.evaluate(link => {const a=link.getBoundingClientRect(),b=link.closest('nav').getBoundingClientRect();return a.left>=b.left-2 && a.right<=b.right+2}),{message:route}).toBe(true)
      expect(await selected.evaluate(el => getComputedStyle(el).color),route).not.toBe(await selected.evaluate(el => getComputedStyle(el.closest('nav')).color))
      expect(await selected.evaluate(el => getComputedStyle(el).boxShadow),route).toBe('none')
    }
    await page.screenshot({path:testInfo.outputPath(`management-${width}-${theme}-${index}.png`),fullPage:true})
    await page.evaluate(() => sessionStorage.removeItem('fpp-pending-invite'))
  }
  expect(errors).toEqual([])
})

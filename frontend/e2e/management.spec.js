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
  professional_profiles:{ user_id:USER, professional_name:name, bio:professionals[0].bio, specialties:professionals[0].specialties, city_region:professionals[0].city_region, verification_status:'verified' },
  professional_client_summaries:[{ student_user_id:STUDENT, display_name:name, relationship_created_at:'2026-10-01T12:00:00Z', program_id:PROGRAM, program_title:program.title }],
  professional_client_detail:[{ student_user_id:STUDENT, display_name:name, relationship_created_at:'2026-10-01T12:00:00Z', assignments:[], executions:[] }],
  professional_student_relationships:[{ id:'relationship', professional_user_id:USER, student_user_id:STUDENT, status:'active', created_at:'2026-10-01T12:00:00Z' }],
  professional_invites:[{ id:'invite', code:'A1B2C3D4E5', status:'pending', created_at:'2026-10-04T12:00:00Z' }],
  programs:[program], program_versions:[version],
  student_professional_summaries:professionals,
  student_professional_detail:args => { const person = professionals.find(item => item.professional_user_id === args.p_professional_user_id); return person ? [{ professional:person, relationship:{ id:person.relationship_id, status:'active', linked_at:person.linked_at }, materials:[person === professionals[0] ? material : { ...material, assignment_id:'old-assignment', title:'Corrida histórica', status:'revoked' }], executions:[] }] : [] },
  program_assignments:[{ id:ASSIGNMENT, professional_user_id:PRO, student_user_id:USER, program_id:PROGRAM, version_id:VERSION, status:'active', created_at:'2026-10-04T12:00:00Z' }],
  student_program_overview:{ assignment:{id:ASSIGNMENT}, program:{title:material.title}, professional:{id:PRO,name}, version:{id:VERSION,versionNumber:2,weeklyPlan:plan,publishedAt:version.published_at}, executions:[] },
  preview_professional_invite:[{ professional_name:name, bio:professionals[0].bio, specialties:['força'], verification_status:'verified' }],
}

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
  await page.locator('.management-student-record').first().click()
  await expect(page).toHaveURL(new RegExp(`program=${PROGRAM}&version=${VERSION}`))
  await expect(page.locator('.management-section-nav [aria-current="page"]')).toHaveText('Treino')
  await page.reload(); await expect(page.locator('.management-section-nav [aria-current="page"]')).toHaveText('Treino')
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

test('program creation opens its addressable editor and returns to its detail', async ({page}) => {
  let created = null
  await seed(page,{professional:true,rpc:{programs:() => created ? [created] : [], create_program:args => { created={...program,title:args.p_title,description:args.p_description};return created }}})
  await page.goto('/#/professional/programs/new')
  await page.getByRole('textbox',{name:'Nome do programa',exact:true}).fill('Novo programa integrado')
  await page.getByRole('textbox',{name:'Descrição do programa',exact:true}).fill('Progressão individual')
  await page.getByRole('button',{name:'Criar programa',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`professional/programs/${PROGRAM}/edit`))
  await expect(page.locator('.professional-program-editor')).toBeVisible()
  await page.reload(); await expect(page.locator('.professional-program-editor')).toBeVisible()
  await page.getByRole('button',{name:'Cancelar',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`professional/programs/${PROGRAM}$`))
  await expect(page.getByRole('heading',{name:'Novo programa integrado',exact:true,level:1})).toBeVisible()
})

test('material selection stays independent and historical inspection preserves the current plan', async ({page}) => {
  await seed(page,{authenticated:true,rpc})
  await page.goto('/#/student/professionals')
  await expect(page.getByRole('heading',{name:'Programa atual',exact:true,level:2})).toBeVisible()
  const currentAssignment = () => page.evaluate(userId => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${userId}`)).state.assignedProgram, USER)
  const initial = await currentAssignment()
  expect(initial.assignmentId).toBe(ASSIGNMENT)
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
  await seed(page,{authenticated:true,rpc:{student_professional_summaries:[],student_program_overview:{}}})
  await page.goto('/#/student/professionals')
  await expect(page.getByText('Você ainda não possui profissionais vinculados.',{exact:true})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('management-empty-360.png'),fullPage:true})
  const failure = async route => route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture read failure'})})
  await page.route('**/rest/v1/rpc/student_professional_summaries',failure)
  await page.reload()
  const retry = page.getByRole('button',{name:'Tentar novamente',exact:true})
  await expect(retry).toBeVisible()
  await page.keyboard.press('Tab'); await retry.focus()
  expect(await retry.evaluate(button => getComputedStyle(button).outlineWidth)).toBe('2px')
  await page.screenshot({path:testInfo.outputPath('management-error-focus-360.png'),fullPage:true})
  await page.unroute('**/rest/v1/rpc/student_professional_summaries',failure)
  await retry.click(); await expect(page.getByText('Você ainda não possui profissionais vinculados.',{exact:true})).toBeVisible()
  await page.getByRole('link',{name:'Adicionar profissional',exact:true}).first().click()
  await expect(page.locator('#student-invite-code')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
})

for (const width of [360,390,1280,1440]) for (const theme of ['light','dark']) test(`management visual matrix ${width}px ${theme}`, async ({page},testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Matrix sizes are explicit; run once per size/theme.')
  test.setTimeout(90000)
  await page.setViewportSize({width,height:1000}); await page.emulateMedia({reducedMotion:'reduce'})
  const state = stateFixture(); state.theme = theme
  const errors = []; page.on('pageerror',error => errors.push(error.message))
  await seed(page,{professional:true,state,rpc})
  const routes = ['/professional','/professional/profile','/professional/profile/edit','/professional/students',`/professional/students/${STUDENT}`,`/professional/students/${STUDENT}?section=training`,'/professional/invites','/professional/invites?section=create','/professional/invites?section=result&code=A1B2C3D4E5','/professional/programs','/professional/programs/new',`/professional/programs/${PROGRAM}`,`/professional/programs/${PROGRAM}/edit`,'/student/professionals','/student/professionals/add?code=A1B2C3D4E5',`/student/professionals/${PRO}`,`/student/professionals/${PRO}?section=training`,`/student/professionals/${PRO}?section=history`,`/student/professionals/${PRO}?section=relationship`,'/student/professionals/materials']
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
    if (await selected.count()) await expect.poll(async () => selected.evaluate(link => {const a=link.getBoundingClientRect(),b=link.closest('nav').getBoundingClientRect();return a.left>=b.left-2 && a.right<=b.right+2}),{message:route}).toBe(true)
    await page.screenshot({path:testInfo.outputPath(`management-${width}-${theme}-${index}.png`),fullPage:true})
    await page.evaluate(() => sessionStorage.removeItem('fpp-pending-invite'))
  }
  expect(errors).toEqual([])
})

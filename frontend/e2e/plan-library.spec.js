import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'
const programId='33333333-3333-4333-8333-333333333333'
const versionId='44444444-4444-4444-8444-444444444444'
const entryId='55555555-5555-4555-8555-555555555555'
const ownId='66666666-6666-4666-8666-666666666666'
const routineId='77777777-7777-4777-8777-777777777777'
const canonicalPlan = state => ({
 athlete_routines: state.routines.map((r,position)=>({id:r.id,user_id:USER,revision:1,title:r.name,position,prescription:{...r},created_at:'2026-10-27',updated_at:'2026-10-27'})),
 athlete_schedules: {user_id:USER,revision:1,mode:'weekly',schedule:{week:state.week,dayPlan:{}},updated_at:'2026-10-27'},
})
const delivered={id:entryId,user_id:USER,title:'Hipertrofia do profissional',source_type:'professional',assignment_id:'assignment',available:true,professional_name:'Fabiano',program_id:programId,created_at:'2026-10-27',version:{id:versionId,version_number:1,weekly_plan:{monday:[{exerciseId:'0025',sets:4,reps:8,load:80,rest:90}]},workout_titles:{monday:'Treino A'}}}

test('professional creates a routine, previews animation, saves privately and explicitly sends',async({page})=>{
 let draft=null,sends=0
 await seed(page,{professional:true,rpc:{professional_client_detail:[{student_user_id:STUDENT,display_name:'João',assignments:[],executions:[]}],professional_plan_drafts:()=>draft?[draft]:[],save_student_plan_draft:args=>{draft={professional_id:USER,student_id:STUDENT,program_id:programId,title:args.p_title,workspace:args.p_workspace,revision:(draft?.revision||0)+1,sent_revision:null,updated_at:new Date().toISOString()};return draft},send_student_plan:()=>{sends++;draft.sent_revision=draft.revision;return{id:'assignment'}}}})
 await page.goto(`/#/professional/students/${STUDENT}/plan`)
 await page.getByRole('button',{name:'Criar do zero',exact:true}).click()
 await page.locator('.plan-section-head button').click()
 await expect(page.locator('.routine-builder')).toBeVisible()
 await page.getByRole('button',{name:'Adicionar exercício',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('searchbox').fill('supino com barra')
 await dialog.locator('.picker-item-main').filter({hasText:'Supino com barra'}).first().click()
 await dialog.getByRole('button',{name:'Adicionar exercício',exact:true}).click()
 await expect(dialog.locator('.exercise-picker-preview')).toHaveCount(0)
 await dialog.getByRole('button',{name:'Pronto',exact:true}).click()
 const card=page.locator('.training-exercise-card').first()
 await expect(card.locator('[data-exercise-animation]')).toHaveCount(0)
 await card.locator('.routine-item-main').click()
 await expect(card.locator('[data-exercise-animation="0025"]')).toBeVisible()
 await page.locator('.routine-week-card button').first().click()
 await page.locator('.routine-completion-actions').getByRole('button',{name:'Pronto',exact:true}).click()
 await expect(page).toHaveURL(new RegExp(`/students/${STUDENT}/plan$`))
 expect(draft.workspace.routines[0].ex[0].id).toBe('0025');expect(sends).toBe(0)
 await page.reload();await expect(page.getByText('Alterações não enviadas',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Enviar ao aluno',exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:'Enviar plano',exact:true}).click()
 await expect.poll(()=>sends).toBe(1)
 await expect(page.getByText('Plano enviado ao aluno',{exact:true})).toBeVisible()
})

for(const theme of ['dark','light']) for(const width of [320,390,430]) test(`received plan stays inactive and preview fits ${width}px ${theme}`,async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','Explicit viewport matrix')
 await page.setViewportSize({width,height:800})
 const state=stateFixture();state.theme=theme
 await seed(page,{authenticated:true,state,rpc:{...canonicalPlan(state),athlete_plan_library_page:{items:[delivered],total:1,selectedId:null}}})
 await page.goto('/#/plan')
 await expect(page.locator('.app-header').getByRole('heading',{name:'Seu plano semanal',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Seus treinos criados',exact:true})).toBeVisible()
 await expect(page.getByText('Treinos anteriores',{exact:true})).toHaveCount(0)
 await expect(page.getByText('Treino de hoje',{exact:true})).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Treinos recebidos do profissional'})).toBeVisible()
 await page.getByRole('button',{name:'Treino A 1 exercícios · Prof. Fabiano',exact:true}).click()
 await expect(page.locator('.plan-view .training-plan-workspace')).toHaveCount(1)
 const preview=page.getByRole('dialog')
 await preview.locator('.plan-routine-list button').click()
 await preview.locator('.training-exercise-card .routine-item-main').click()
 await expect(preview.locator('[data-exercise-animation="0025"]')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:testInfo.outputPath(`library-${width}-${theme}.png`),fullPage:true})
 const local=await page.evaluate(user=>JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${user}`)).state,USER)
 expect(local.assignedProgram).toBeNull();expect(local.routines[0].name).toBe('Treino de teste')
})

test('daily plan manages routines without asking for today\'s workout',async({page})=>{
 const state=stateFixture()
 await seed(page,{authenticated:true,state,rpc:{...canonicalPlan(state),athlete_plan_library_page:{items:[],total:0,selectedId:null}}})
 await page.goto('/#/plan')
 await page.getByRole('button',{name:'Plano diário',exact:true}).click()
 await expect(page.locator('.app-header').getByRole('heading',{name:'Seu plano diário',exact:true})).toBeVisible()
 await expect(page.locator('.plan-routine-list')).toHaveCount(1)
 await expect(page.getByText('Treino de hoje',{exact:true})).toHaveCount(0)
 await expect(page.locator('.daily-plan-today')).toHaveCount(0)
})

test('plan groups created and received workouts in sections of five',async({page})=>{
 const state=stateFixture()
 state.routines=Array.from({length:6},(_,index)=>({id:`routine-${index}`,name:`Treino criado ${index+1}`,emoji:'dumbbell',ex:[{id:'0025',sets:3,reps:10}]}))
 state.week={1:'routine-0'}
 await seed(page,{authenticated:true,state,rpc:{...canonicalPlan(state),athlete_plan_library_page:{items:[delivered],total:1,selectedId:null}}})
 await page.goto('/#/plan')
 await expect(page.getByRole('heading',{name:'Seus treinos criados',exact:true})).toBeVisible()
 await expect(page.locator('.created-workouts .plan-routine-list .item')).toHaveCount(5)
 await page.getByRole('button',{name:'Mostrar mais',exact:true}).first().click()
 await expect(page.locator('.created-workouts .plan-routine-list .item')).toHaveCount(6)
 await expect(page.getByRole('heading',{name:'Treinos recebidos do profissional',exact:true})).toBeVisible()
 await expect(page.locator('.received-workouts').getByRole('button',{name:'Aplicar',exact:true})).toBeVisible()
})

test('explicitly applies a received plan without duplicating personal plan controls',async({page})=>{
 const state=stateFixture();state.routines[0].id=routineId;state.week={1:routineId}
 const own={id:ownId,title:'Meu ABC',source_type:'self',available:true,personal_plan:{mode:'weekly',schedule:{week:{1:routineId}},routines:[{id:routineId,title:'Meu ABC',prescription:{ex:[{id:'0025',sets:1,reps:10,weight:20}]}}]}}
 let selection=null,revision=1
 const result=selected=>({schedule:{user_id:USER,revision:++revision,mode:'weekly',schedule:{week:{1:routineId},dayPlan:{},libraryId:selected,libraryTitle:selected===entryId?delivered.title:own.title,...(selected===entryId?{assignedProgram:{assignmentId:'assignment',versionId,programId}}:{})},updated_at:'2026-10-27'},routines:[{id:routineId,user_id:USER,revision:1,title:selected===entryId?'Treino A':'Meu ABC',position:0,created_at:'2026-10-27',updated_at:'2026-10-27',prescription:{ex:[{id:'0025',sets:selected===entryId?4:1,reps:8,weight:80}],...(selected===entryId?{assigned:true,assignmentId:'assignment',programVersionId:versionId,assignedDayKey:'monday'}:{})}}]})
 await seed(page,{authenticated:true,state,rpc:{...canonicalPlan(state),athlete_plan_library_page:()=>({items:selection?[delivered,own]:[delivered],total:selection?2:1,selectedId:selection}),apply_library_plan:args=>{selection=args.p_plan_id;return result(selection)}}})
 await page.goto('/#/plan');await page.getByRole('button',{name:'Aplicar',exact:true}).click()
 await expect(page.getByRole('dialog')).toContainText('Seus treinos criados continuam salvos')
 await page.getByRole('dialog').getByRole('button',{name:'Aplicar plano',exact:true}).click()
 await expect.poll(()=>selection).toBe(entryId)
 await expect(page.locator('.app-header').getByRole('heading',{name:delivered.title,exact:true})).toBeVisible()
 await expect(page.locator('.plan-day-professional')).toHaveCount(1)
 await expect(page.getByText('Planos salvos',{exact:true})).toHaveCount(0)
 await expect(page.getByText('Salvar uma cópia do meu plano',{exact:true})).toHaveCount(0)
})

import { test, expect } from '@playwright/test'
import { seed, USER } from './fixtures.test.js'
const id='33333333-3333-4333-8333-333333333333'
const plan={monday:[{exerciseId:'0025',sets:3,reps:10,load:25,rest:90}]}
for(const width of [320,390,430]) test(`shared template editor and picker fit ${width}px`,async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','Explicit viewport matrix')
 await page.setViewportSize({width,height:900})
 let saved=null
 await seed(page,{professional:true,rpc:{programs:[{id,professional_user_id:USER,title:'Força e condicionamento com progressão individual',archived:false}],program_versions:[{id:'version',program_id:id,version_number:1,weekly_plan:plan}],update_program_metadata:args=>({id,title:args.p_title}),publish_program_version_with_titles:args=>{saved=args;return{id:'next',program_id:id,version_number:2,weekly_plan:args.p_weekly_plan}}}})
 await page.goto(`/#/professional/programs/${id}/edit`)
 await expect(page).toHaveURL(new RegExp(`/professional/templates/${id}/edit$`))
 await page.getByRole('textbox',{name:'Nome do modelo',exact:true}).fill('Força revisada')
 await page.locator('.plan-routine-list button').click()
 await expect(page.locator('.routine-builder')).toBeVisible()
 await page.getByRole('button',{name:'Adicionar exercício',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('searchbox').fill('supino com barra')
 await dialog.locator('.picker-item-main').first().click()
 await expect(dialog.locator('[data-exercise-animation="0025"]')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await dialog.getByRole('button',{name:'Pronto',exact:true}).click()
 const exerciseCard=page.locator('.training-exercise-card').filter({has:page.getByRole('button',{name:/Supino com barra 3 × 10/})})
 await exerciseCard.locator('.routine-item-main').click()
 await expect(exerciseCard.locator('[data-exercise-animation="0025"]')).toBeVisible()
 await page.locator('.routine-completion-actions').getByRole('button',{name:'Pronto',exact:true}).click()
 await page.getByRole('button',{name:'Salvar modelo',exact:true}).click()
 await expect.poll(()=>saved?.p_weekly_plan.monday[0].load).toBe(25)
 await expect(page).toHaveURL(/professional\/templates$/)
})

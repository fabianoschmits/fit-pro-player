import {test,expect} from '@playwright/test'
import {seed,USER,STUDENT} from './fixtures.test.js'
const id='33333333-3333-4333-8333-333333333333'

test('a professional previews animation, publishes a program and sends that exact version to a student', async ({page}) => {
  const versionId='44444444-4444-4444-8444-444444444444'
  let published=null, assignment=null
  const program={id,professional_user_id:USER,title:'Programa prático',archived:false}
  await seed(page,{professional:true,rpc:{programs:[program],program_versions:()=>published?[published]:[],publish_program_version:args=>{published={id:versionId,program_id:id,version_number:1,weekly_plan:args.p_weekly_plan};return published},professional_client_summaries:[{student_user_id:STUDENT,display_name:'Aluna teste'}],professional_client_detail:[{student_user_id:STUDENT,display_name:'Aluna teste',assignments:[],executions:[]}],professional_student_relationships:[{id:'relationship',student_user_id:STUDENT,professional_user_id:USER,status:'active'}],assign_program_version:args=>{assignment=args;return {}}}})
  await page.goto(`/#/professional/programs/${id}/edit`)
  await page.getByRole('button',{name:'Adicionar exercício',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('searchbox',{name:'Pesquisar exercício'}).fill('supino com barra')
  const row=dialog.locator('.professional-picker-row').filter({has:page.getByText('Supino com barra',{exact:true})})
  await row.locator('[aria-expanded]').click()
  const animation=row.locator('[data-exercise-animation="0025"]')
  await expect(animation).not.toHaveAttribute('aria-busy','true')
  await expect(animation.locator('[data-guide-frame]').first()).toBeAttached()
  await expect.poll(()=>animation.locator('.is-active').getAttribute('data-guide-frame')).not.toBe('0')
  await row.getByRole('button',{name:'Adicionar',exact:true}).click()
  await dialog.getByRole('button',{name:'Pronto',exact:true}).click()
  await page.getByRole('button',{name:'Publicar nova versão',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`professional/programs/${id}$`))
  expect(published.weekly_plan.monday[0]).toMatchObject({exerciseId:'0025',sets:3,reps:8,rest:90})
  await page.getByRole('link',{name:'Enviar para aluno · Versão 1',exact:true}).click()
  await page.getByRole('link',{name:/Aluna teste/}).click()
  await expect(page.getByRole('combobox',{name:'Versão do programa'})).toHaveValue(versionId)
  await page.getByRole('button',{name:'Enviar versão',exact:true}).click()
  await expect.poll(()=>assignment).toEqual({p_program_id:id,p_version_id:versionId,p_student_user_id:STUDENT})
  await expect(page.locator('.management-section-nav [aria-current="page"]')).toHaveText('Treino')
})

for (const width of [360,390,1280,1440]) test(`professional picker supports compact multi-add and inline previews at ${width}px`, async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit viewport matrix.')
  await page.setViewportSize({width,height:900})
  await seed(page,{professional:true,rpc:{programs:[{id,professional_user_id:USER,title:'Programa prático',archived:false}],program_versions:[]}})
  await page.goto(`/#/professional/programs/${id}/edit`)
  await page.getByRole('button',{name:'Adicionar exercício',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('searchbox',{name:'Pesquisar exercício'})).toBeVisible()
  await expect(dialog.getByRole('combobox',{name:'Filtrar por músculo'})).toBeVisible()
  const row=dialog.locator('.professional-picker-row').first()
  const title=await row.locator('strong').textContent()
  const preview=row.locator('[aria-expanded]')
  await preview.click()
  await expect(preview).toHaveAttribute('aria-expanded','true')
  await expect(row.locator('.professional-exercise-animation')).toBeVisible()
  await row.getByRole('button',{name:'Adicionar',exact:true}).click()
  await expect(row.getByRole('button',{name:'Selecionado',exact:true})).toBeDisabled()
  await expect(dialog).toBeVisible()
  const clipped=await dialog.evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('input,select,button,.professional-picker-name')].filter(x=>{const r=x.getBoundingClientRect();return r.width && (r.left<b.left-1 || r.right>b.right+1)}).map(x=>x.textContent)})
  expect(clipped).toEqual([])
  await page.screenshot({path:testInfo.outputPath(`professional-picker-${width}.png`)})
  await dialog.getByRole('button',{name:'Pronto',exact:true}).click()
  await expect(page.locator('.professional-prescription-heading')).toContainText(title)
  await expect(page.locator('.professional-prescription-advanced')).not.toHaveAttribute('open')
  await page.screenshot({path:testInfo.outputPath(`professional-editor-${width}.png`),fullPage:true})
})
test('long program names leave the editor fields and Cancel within the mobile workspace',async({page})=>{
  await seed(page,{professional:true,rpc:{programs:[{id,professional_user_id:USER,title:'Força e condicionamento para uma rotina consistente com progressão individual',description:'Progressão individual com atenção à técnica.',archived:false}],program_versions:[{id:'44444444-4444-4444-8444-444444444444',program_id:id,version_number:2,weekly_plan:{monday:[{exerciseId:'0025',sets:3,reps:10,load:25,rest:90}]}}]}})
  for(const width of [360,390]){
    await page.setViewportSize({width,height:900})
    for(const route of ['/professional/programs/new',`/professional/programs/${id}`,`/professional/programs/${id}/edit`]){
      await page.goto(`/#${route}`)
      await expect(page.locator('.management-layout')).toBeVisible()
      await expect(page.locator('.management-content')).not.toContainText('Carregando programas…')
      if(route.endsWith('/edit')) await expect(page.locator('.professional-program-editor')).toBeVisible()
      const clipped=await page.locator('.management-content').evaluate(content=>{
        const bounds=content.getBoundingClientRect()
        // Chips deliberately scroll; the editor itself and its form actions must fit.
        return [...content.querySelectorAll('.professional-program-editor,button,input,select,textarea')].filter(el=>!el.closest('.chips')).map(el=>({text:el.getAttribute('aria-label')||el.textContent?.slice(0,40)||el.tagName,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(rect=>rect.left<bounds.left-2||rect.right>bounds.right+2)
      })
      expect(clipped,`${width}px ${route}`).toEqual([])
      if(route.endsWith('/edit')){
        const cancel=page.getByRole('button',{name:'Cancelar',exact:true})
        await expect(cancel).toBeInViewport()
        // Locator click retries a detached target during the existing route transition;
        // a separate scroll action captures an element that may belong to the exiting page.
        await cancel.click()
        await expect(page).toHaveURL(new RegExp(`professional/programs/${id}$`))
      }
    }
  }
})

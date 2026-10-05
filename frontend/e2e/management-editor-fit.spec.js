import {test,expect} from '@playwright/test'
import {seed,USER} from './fixtures.test.js'
const id='33333333-3333-4333-8333-333333333333'
test('long program names leave the editor fields and Cancel within the mobile workspace',async({page})=>{
  await seed(page,{professional:true,rpc:{programs:[{id,professional_user_id:USER,title:'Força e condicionamento para uma rotina consistente com progressão individual',description:'Progressão individual com atenção à técnica.',archived:false}],program_versions:[{id:'44444444-4444-4444-8444-444444444444',program_id:id,version_number:2,weekly_plan:{monday:[{exerciseId:'0025',sets:3,reps:10,load:25,rest:90}]}}]}})
  for(const width of [360,390]){
    await page.setViewportSize({width,height:900})
    for(const route of ['/professional/programs/new',`/professional/programs/${id}`,`/professional/programs/${id}/edit`]){
      await page.goto(`/#${route}`)
      await expect(page.locator('.management-layout')).toBeVisible()
      await expect(page.locator('.management-content')).not.toContainText('Carregando programas…')
      const clipped=await page.locator('.management-content').evaluate(content=>{
        const bounds=content.getBoundingClientRect()
        // Chips deliberately scroll; the editor itself and its form actions must fit.
        return [...content.querySelectorAll('.professional-program-editor,button,input,select,textarea')].filter(el=>!el.closest('.chips')).map(el=>({text:el.getAttribute('aria-label')||el.textContent?.slice(0,40)||el.tagName,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(rect=>rect.left<bounds.left-2||rect.right>bounds.right+2)
      })
      expect(clipped,`${width}px ${route}`).toEqual([])
      if(route.endsWith('/edit')){
        const cancel=page.getByRole('button',{name:'Cancelar',exact:true})
        await cancel.scrollIntoViewIfNeeded()
        await expect(cancel).toBeInViewport()
        await cancel.click()
        await expect(page).toHaveURL(new RegExp(`professional/programs/${id}$`))
      }
    }
  }
})

import { test, expect } from '@playwright/test'
import { seed, STUDENT } from './fixtures.test.js'

test('student summary stays compact on mobile and expands the full body history', async ({ page }, testInfo) => {
  await seed(page, { professional:true, rpc: {
    professional_student_note: {body:''},
    professional_client_detail: [{student_user_id:STUDENT,display_name:'Teste',avatar_ref:'avatar-21',relationship_created_at:'2026-10-10T12:00:00Z',assignments:[],executions:[],
      profile:{heightCm:176,birthDate:'1992-10-10',sex:'male',goal:'lose_weight',experience:'intermediate',startWeight:85},
      weight_history:[{id:'legacy-weight-1',measured_on:'2026-10-10',weight_kg:85}],
      measurements:[{id:'m',measured_on:'2026-10-10',measurements_cm:{chest:95},note:'Referência'}]}],
  } })
  await page.goto(`/#/professional/students/${STUDENT}`)
  const card = page.getByRole('region',{name:'Resumo de Teste'})
  await expect(card).toContainText('1,76 m')
  await expect(card).toContainText('85 kg')
  for (const width of [390,360,320,430]) {
    await page.setViewportSize({width,height:844})
    const box = await card.boundingBox()
    expect(box.height).toBeLessThan(240)
    const tops = await card.locator('dt').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top))
    expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(2)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:testInfo.outputPath('compact-student.png')})
  await card.getByRole('button',{name:'Ver perfil completo de Teste'}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Perder peso')
  await expect(dialog).toContainText('Histórico de peso')
  await expect(dialog).toContainText('85 kg')
  await expect(dialog).toContainText('95 cm')
  await page.screenshot({path:testInfo.outputPath('expanded-student.png')})
  for (const width of [320,360,390,430]) {
    await page.setViewportSize({width,height:844})
    await expect.poll(async () => {
      const bounds = await dialog.boundingBox()
      const viewport = await page.evaluate(() => ({ width:innerWidth,height:innerHeight }))
      return bounds && bounds.x >= 0 && bounds.x+bounds.width <= viewport.width+1 && bounds.y+bounds.height <= viewport.height+1
    },{message:`profile sheet fits the viewport at ${width}px`}).toBe(true)
    await dialog.evaluate(element=>{element.scrollTop=element.scrollHeight})
    await expect(dialog.getByRole('button',{name:'Fechar',exact:true})).toBeVisible()
  }
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(card.getByRole('button')).toBeFocused()
})

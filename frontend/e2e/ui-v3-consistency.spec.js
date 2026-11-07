import { test, expect } from '@playwright/test'
import { seed, STUDENT } from './fixtures.test.js'

test('student section navigation keeps the current plan hidden outside summary and training', async ({ page }) => {
  await seed(page, { professional: true, rpc: {
    professional_client_detail: [{ student_user_id: STUDENT, display_name: 'Aluno Teste', assignments: [], executions: [] }],
  } })
  await page.goto(`/#/professional/students/${STUDENT}?section=notes`)
  const currentPlan = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Plano atual', exact: true, includeHidden: true }) })
  await expect(currentPlan).toBeHidden()
  await page.getByRole('link', { name: 'Plano', exact: true }).click()
  await expect(currentPlan).toBeVisible()
})

const model = { id: '33333333-3333-4333-8333-333333333333', title: 'Modelo de força com progressão individual' }
for (const scenario of ['empty', 'list-error', 'missing-version', 'valid-version']) {
  test(`template chooser handles ${scenario} without losing the creation flow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 780 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page, { professional: true, rpc: {
      professional_client_detail: [{ student_user_id: STUDENT, display_name: 'Aluno Teste', assignments: [], executions: [] }],
      professional_programs_page: scenario === 'list-error'
        ? { __error: { status: 500, body: { message: 'Fixture unavailable' } } }
        : { items: scenario === 'empty' ? [] : [model], total: scenario === 'empty' ? 0 : 1, offset: 0, has_more: false },
      program_versions: scenario === 'valid-version' ? [{ id: 'version', weekly_plan: { monday: [{ exerciseId: '0025', sets: 3, reps: 10, load: 25, rest: 90 }] } }] : [],
    } })
    await page.goto(`/#/professional/students/${STUDENT}/plan`)
    await page.getByRole('button', { name: 'Usar um modelo', exact: true }).click()
    if (scenario === 'list-error') {
      await expect(page.getByRole('alert')).toContainText('Este recurso está temporariamente indisponível. Tente novamente em instantes.')
    } else if (scenario === 'empty') {
      await expect(page.getByText(/Nenhum modelo disponível/)).toBeVisible()
    } else {
      await page.getByRole('button', { name: model.title, exact: true }).click()
      if (scenario === 'missing-version') {
        await expect(page.getByRole('alert')).toContainText('Não foi possível abrir este modelo.')
        await expect(page.getByRole('group', { name: 'Como criar o plano' })).toBeVisible()
      } else {
        await expect(page.getByRole('textbox', { name: 'Nome do plano', exact: true })).toHaveValue(model.title)
        await expect(page.locator('.training-plan-workspace')).toBeVisible()
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`template-${scenario}.png`), fullPage: true })
  })
}

test('scoped screen layouts fit mobile widths and both themes', async ({ page }, testInfo) => {
  test.setTimeout(180000)
  await seed(page, { professional: true })
  const routes = ['/home', '/plan', '/workout', '/library', '/progress', '/progress/history', '/progress/body', '/account', '/personal-data', '/settings', '/privacy-settings', '/support', '/support/tickets', '/professional', '/professional/students', '/professional/templates/new', '/student/professionals', '/student/professionals/add', '/community', '/community/messages']
  for (const path of routes) {
    await page.goto(`/#${path}`)
    await expect(page.locator('#root h1').first()).toBeVisible()
    for (const width of [320, 360, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${path} ${width} ${theme}`).toBe(true)
        if (width === 390) await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll('/', '_')}-${theme}.png`), animations: 'disabled' })
      }
    }
  }
})

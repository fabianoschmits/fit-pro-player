import { test, expect } from '@playwright/test'
import { seed, USER } from './fixtures.test.js'

const programId = '33333333-3333-4333-8333-333333333333'
const title = 'Preparação de força e condicionamento para a próxima semana de treinamento'
const entries = [{ exerciseId: '0025', sets: 3, reps: 10, load: 20, rest: 75, notes: 'Movimento controlado em toda a amplitude' }]
for (const width of [375, 1280]) test(`native workout editor ${width}px`, async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Explicit viewport and browser history checks.')
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const publications = [], assignments = []
  await seed(page, { professional: true, rpc: {
    programs: [{ id: programId, professional_user_id: USER, title, objective: 'Força e consistência', description: 'Plano semanal', archived: false }],
    program_versions: [{ id: '44444444-4444-4444-8444-444444444444', program_id: programId, version_number: 3, weekly_plan: { monday: entries, tuesday: entries }, workout_titles: { monday: 'Força A', tuesday: 'Força B' } }],
    update_program_metadata: args => ({ id: programId, professional_user_id: USER, title: args.p_title, objective: args.p_objective, description: args.p_description }),
    publish_program_version_with_titles: args => { publications.push(args); return { id: '55555555-5555-4555-8555-555555555555', program_id: programId, version_number: 4, weekly_plan: args.p_weekly_plan, workout_titles: args.p_workout_titles } },
    assign_program_version: args => { assignments.push(args); return {} },
  } })
  await page.goto(`/#/professional/programs/${programId}/edit`)
  await expect(page.locator('.professional-workout-day')).toHaveCount(7)
  await expect(page.locator('.professional-workout-day').first()).toHaveText('Segunda-feira')
  await page.screenshot({ path: info.outputPath(`week-${width}.png`), fullPage: true })
  await page.locator('.professional-compact-list a').first().click()
  await expect(page.locator('.professional-prescription-row')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Publicar nova versão', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`editor-${width}.png`), fullPage: true })
  await page.evaluate(() => document.documentElement.dataset.theme = 'light')
  await page.screenshot({ path: info.outputPath(`editor-${width}-light.png`), fullPage: true })
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark')
  const row = page.locator('.professional-prescription-edit')
  await row.click()
  const edit = page.getByRole('dialog', { name: 'Editar prescrição' })
  await expect(edit).toBeVisible()
  expect(await edit.locator('input').first().evaluate(el => getComputedStyle(el).fontSize)).toBe('16px')
  expect(await edit.getByRole('button', { name: 'Salvar', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(22, 200, 189)')
  await page.screenshot({ path: info.outputPath(`prescription-${width}.png`), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(edit).toHaveCount(0)
  await expect(row).toBeFocused()
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeFalsy()
  await page.getByRole('button', { name: 'Ações do exercício 1', exact: true }).click()
  await page.getByRole('button', { name: 'Notas', exact: true }).click()
  await expect(edit).toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeTruthy()
  await page.goBack()
  await expect(edit).toHaveCount(0)
  await page.getByRole('button', { name: 'Ações do exercício 1', exact: true }).click()
  await page.getByRole('button', { name: 'Remover', exact: true }).click()
  const removal = page.getByRole('dialog', { name: 'Remover exercício?', exact: true })
  await expect(removal).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('.professional-prescription-row')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeTruthy()
  await page.goBack()
  await expect(removal).toHaveCount(0)
  await expect(page.locator('.professional-prescription-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Copiar dia', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Substituir exercícios do dia?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeFalsy()
  await page.getByLabel('Nome do treino', { exact: true }).fill('Força A revisada')
  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Selecionar exercício' })
  await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
  await expect(picker).toBeVisible()
  await expect(page.locator('.professional-prescription-row')).toHaveCount(2)
  await picker.getByRole('button', { name: 'Pronto', exact: true }).click()
  await expect(picker).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeFalsy()
  await page.getByRole('link', { name: 'Concluir treino', exact: true }).click()
  await expect(page.locator('.professional-compact-list')).toContainText('Força A revisada')
  await page.reload()
  await expect(page.locator('.professional-compact-list')).toContainText('Força A revisada')
  await page.screenshot({ path: info.outputPath(`week-${width}.png`), fullPage: true })
  await page.locator('.professional-compact-list a').first().click()
  await expect(page.locator('.professional-prescription-row')).toHaveCount(2)
  for (const button of await page.locator('.professional-native .iconbtn').all()) {
    const bounds = await button.boundingBox()
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('link', { name: 'Concluir treino', exact: true }).click()
  await page.getByRole('button', { name: 'Publicar nova versão', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Revisar semana' }).locator('li')).toHaveCount(7)
  expect(publications).toHaveLength(0)
  await page.getByRole('button', { name: 'Publicar semana', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`#/professional/programs/${programId}$`))
  expect(publications).toHaveLength(1)
  expect(publications[0].p_weekly_plan.monday).toHaveLength(2)
  expect(publications[0].p_weekly_plan.tuesday).toHaveLength(1)
  expect(publications[0].p_workout_titles.monday).toBe('Força A revisada')
  expect(assignments).toHaveLength(0)
  expect(await page.evaluate(({ accountId, id }) => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${accountId}`)).state.professionalProgramDrafts[`${accountId}:${id}`] || null, { accountId: USER, id: programId })).toBeNull()
})

test('fresh historical editor preserves exact query and prescription across navigation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Explicit browser navigation regression.')
  const versionId = '66666666-6666-4666-8666-666666666666'
  const search = `?version=${versionId}&material=x%20y&student=student&section=training&code=A%2BB`
  await seed(page, { professional: true, rpc: {
    programs: [{ id: programId, professional_user_id: USER, title, archived: false }],
  } })
  await page.route('https://fitpp-test.supabase.co/rest/v1/program_versions*', async route => {
    const historical = new URL(route.request().url()).searchParams.has('id')
    const version = {
      id: historical ? versionId : '44444444-4444-4444-8444-444444444444',
      program_id: programId, version_number: historical ? 1 : 3,
      weekly_plan: { monday: [{ ...entries[0], notes: historical ? 'Histórico exato' : 'Latest diferente' }] },
      workout_titles: { monday: historical ? 'Treino histórico' : 'Treino atual' },
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([version]) })
  })
  await page.goto(`/#/professional/programs/${programId}/edit${search}`)
  await expect(page.locator('.professional-compact-list')).toContainText('Treino histórico')
  await expect(page.locator('.professional-compact-list a').first()).toHaveAttribute('href', `#/professional/programs/${programId}/edit/monday${search}`)
  await page.locator('.professional-compact-list a').first().click()
  await expect(page.locator('.professional-prescription-row')).toContainText('Histórico exato')
  await expect(page.locator('.professional-prescription-row')).not.toContainText('Latest diferente')
  await page.getByRole('link', { name: 'Concluir treino', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`version=${versionId}&material=x%20y&student=student&section=training&code=A%2BB$`))
  await expect(page.locator('.professional-compact-list')).toContainText('Treino histórico')
})

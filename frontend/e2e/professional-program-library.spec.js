import { test, expect } from '@playwright/test'
import { seed, USER, STUDENT } from './fixtures.test.js'
const programId = '33333333-3333-4333-8333-333333333333'
const oldId = '44444444-4444-4444-8444-444444444444'
const newId = '55555555-5555-4555-8555-555555555555'
const title = 'Preparação de força e condicionamento para a próxima semana de treinamento'
for (const width of [375, 1280]) test(`program library and exact assignment ${width}px`, async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Explicit 375/1280 actual App coverage.')
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const assignments = [], publications = []
  const versions = [
    { id: newId, program_id: programId, version_number: 2, weekly_plan: { monday: [{ exerciseId: '0025', sets: 3, reps: 10, load: 40, rest: 90, rir: 2, sg: 'A', notes: 'Prescrição atual' }] }, workout_titles: { monday: 'Força atual' } },
    { id: oldId, program_id: programId, version_number: 1, weekly_plan: { monday: [{ exerciseId: '0025', sets: 4, reps: 8, load: 30, unit: 'lb', rest: 75, rpe: 8, notes: 'Prescrição histórica exata' }] }, workout_titles: { monday: 'Força histórica' } },
  ]
  await seed(page, { professional: true, rpc: {
    programs: [{ id: programId, professional_user_id: USER, title, objective: 'Força e consistência', description: 'Plano semanal', archived: false }],
    professional_programs_page: args => ({ items: [{ id: programId, title, objective: 'Força e consistência', workout_count: 2, student_count: 603, last_changed_at: '2026-10-08', archived: !!args.p_archived }], total: 603, offset: args.p_offset, has_more: false }),
    professional_students_page: args => ({ items: args.p_offset === 0 ? [{ student_user_id: STUDENT, display_name: 'Ana', current_program: { id: 'other', title: 'Anterior', version_number: 8 } }] : [{ student_user_id: '66666666-6666-4666-8666-666666666666', display_name: 'Último aluno' }], total: 601, offset: args.p_offset, has_more: args.p_offset === 0 }),
    assign_program_version: args => { assignments.push(args); return { id: 'assigned' } },
    publish_program_version_with_titles: args => { publications.push(args); return {} },
  } })
  await page.route('https://fitpp-test.supabase.co/rest/v1/program_versions*', route => {
    const id = new URL(route.request().url()).searchParams.get('id')?.replace('eq.', '')
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(id ? versions.filter(version => version.id === id) : versions) })
  })
  await page.goto('/#/professional/programs?q=for%C3%A7a')
  await expect(page.locator('.professional-compact-list')).toContainText('603 alunos')
  await expect(page.getByRole('searchbox', { name: 'Buscar programa' })).toHaveValue('força')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`library-${width}.png`), fullPage: true })
  await page.locator('.professional-compact-list a').first().click()
  await expect(page.locator('.professional-workout-day')).toHaveCount(7)
  await page.locator('.app-header-back').click()
  await expect(page.getByRole('searchbox', { name: 'Buscar programa' })).toHaveValue('força')
  await page.locator('.professional-compact-list a').first().click()
  await page.getByRole('link', { name: 'Versões publicadas', exact: true }).click()
  await page.getByRole('link', { name: 'Comparar versões', exact: true }).click()
  await expect(page.locator('.professional-program-comparison')).toContainText('30 lb')
  await expect(page.locator('.professional-program-comparison')).toContainText('RPE 8')
  await page.locator('.app-header-back').click()
  await page.getByRole('link', { name: /Versão 1/ }).click()
  await expect(page.locator('.professional-compact-list')).toContainText('Força histórica')
  await page.locator('.professional-compact-list a').first().click()
  await expect(page.locator('.professional-prescription')).toContainText('Prescrição histórica exata')
  await expect(page.getByRole('button', { name: 'Adicionar exercício', exact: true })).toHaveCount(0)
  await page.locator('.app-header-back').click()
  await page.getByRole('button', { name: 'Ações do programa', exact: true }).click()
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Arquivar', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeFalsy()
  await page.getByRole('link', { name: 'Enviar para aluno', exact: true }).click()
  await page.getByRole('button', { name: 'Carregar mais', exact: true }).click()
  await page.getByRole('button', { name: /Último aluno/ }).click()
  expect(assignments).toHaveLength(0)
  await page.getByRole('button', { name: 'Revisar envio', exact: true }).click()
  await expect(page.locator('.professional-native-content')).toContainText('qualquer profissional')
  await expect(page.locator('.professional-compact-list')).toContainText('Força histórica')
  await page.screenshot({ path: info.outputPath(`assignment-${width}.png`), fullPage: true })
  await page.evaluate(() => document.documentElement.dataset.theme = 'light')
  await page.screenshot({ path: info.outputPath(`assignment-${width}-light.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Enviar para aluno', exact: true }).click()
  await expect(page.locator('.professional-native-content').getByRole('status')).toContainText('Programa enviado')
  expect(assignments).toEqual([{ p_program_id: programId, p_version_id: oldId, p_student_user_id: '66666666-6666-4666-8666-666666666666' }])
  expect(publications).toHaveLength(0)
  expect(await page.evaluate(account => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${account}`)).state.professionalProgramDrafts, USER)).toEqual({})
})

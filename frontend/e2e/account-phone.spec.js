import { test, expect } from '@playwright/test'
import { seed, USER, STUDENT } from './fixtures.test.js'

test('personal data contacts persist international numbers, load SVG flags and allow removal', async ({ page }, testInfo) => {
 let saved = '+5511912345678'
 const calls = []
 await seed(page, { authenticated: true, rpc: {
  account_contact_phone: args => args.p_user_id === USER ? saved : null,
  save_account_phone: args => { calls.push(args); saved = args.p_phone; return saved },
 } })
 await page.goto('/#/settings')
 await expect(page.getByLabel('Contato da conta')).toHaveCount(0)
 await page.goto('/#/personal-data')
 const field = page.getByLabel('Telefone / WhatsApp (opcional)', { exact: true })
 await expect(field).toHaveValue('(11) 91234-5678')
 await page.getByLabel('País do telefone: Brasil, +55', { exact: true }).click()
 await page.getByLabel('Buscar país').fill('Estados Unidos')
 const option = page.getByRole('button', { name: 'Estados Unidos +1', exact: true })
 await expect.poll(() => option.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
 await option.click()
 await field.fill('2025550123')
 await page.getByRole('button', { name: 'Salvar telefone', exact: true }).click()
 await expect.poll(() => saved).toBe('+12025550123')
 await page.reload()
 await expect(field).toHaveValue('(202) 555-0123')
 await expect(page.getByLabel('País do telefone: Estados Unidos, +1', { exact: true })).toBeVisible()
 for (const width of [320, 390, 1280]) {
  await page.setViewportSize({ width, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
 }
 await page.setViewportSize({ width: 390, height: 844 })
 await field.scrollIntoViewIfNeeded()
 await page.screenshot({ path: testInfo.outputPath('phone-settings.png') })
 await field.fill('123')
 await page.getByRole('button', { name: 'Salvar telefone', exact: true }).click()
 await expect(page.getByRole('alert').filter({ hasText: 'Informe um telefone válido' })).toBeVisible()
 expect(calls).toHaveLength(1)
 await field.fill('')
 await page.getByRole('button', { name: /Salvar telefone|Tentar novamente/ }).click()
 await expect.poll(() => saved).toBeNull()
 await page.reload()
 await expect(field).toHaveValue('')
 await page.goto('/#/settings')
 await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible()
 await expect(page.getByLabel('Contato da conta')).toHaveCount(0)
})

test('student sees professional WhatsApp only while authorized, and revalidates on focus', async ({ page }) => {
 let phone = '+5511912345678'
 await seed(page, { authenticated: true, rpc: {
  student_professional_detail: [{ professional: { professional_user_id: STUDENT, professional_name: 'Profissional Teste', city_region: 'Porto Alegre · RS' }, relationship: { id: 'relationship', status: 'active' }, materials: [], executions: [] }],
  account_contact_phone: args => args.p_user_id === STUDENT ? phone : null,
 } })
 await page.goto(`/#/student/professionals/${STUDENT}`)
 const link = page.getByRole('link', { name: 'Conversar pelo WhatsApp' })
 await expect(link).toHaveAttribute('href', 'https://wa.me/5511912345678')
 await expect(link).toHaveText('')
 await expect(page.locator('main')).not.toContainText('+55 11')
 await expect(link.locator('xpath=ancestor::section[1]')).toContainText('Porto Alegre · RS')
 await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
 phone = null
 await page.evaluate(() => window.dispatchEvent(new Event('focus')))
 await expect(link).toHaveCount(0)
})

test('professional sees linked student WhatsApp, and no action when the student has no number', async ({ page }) => {
 let phone = '+12025550123'
 await seed(page, { professional: true, rpc: {
  professional_client_detail: [{ student_user_id: STUDENT, display_name: 'Aluno Teste', assignments: [], executions: [] }],
  account_contact_phone: args => args.p_user_id === STUDENT ? phone : null,
 } })
 await page.goto(`/#/professional/students/${STUDENT}`)
 const link = page.getByRole('link', { name: 'Conversar pelo WhatsApp' })
 await expect(link).toHaveAttribute('href', 'https://wa.me/12025550123')
 phone = null
 await page.evaluate(() => window.dispatchEvent(new Event('professional-relationship-changed')))
 await expect(link).toHaveCount(0)
})

test('own professional profile shows a small WhatsApp icon inside the location card without phone text', async ({ page }) => {
 await seed(page, { professional: true, rpc: {
  professional_profiles: { user_id: USER, professional_name: 'Profissional Teste', state_uf: 'RS', city_name: 'Porto Alegre', specialties: [] },
  account_contact_phone: '+5511912345678',
 } })
 await page.goto('/#/professional/profile')
 const card = page.getByRole('region', { name: 'Atuação', exact: true })
 const link = card.getByRole('link', { name: 'Conversar pelo WhatsApp' })
 await expect(link).toHaveAttribute('href', 'https://wa.me/5511912345678')
 await expect(link).toHaveText('')
 await expect(card).toContainText('Porto Alegre')
 await expect(page.locator('main')).not.toContainText('+55 11')
 expect(await link.locator('svg').evaluate(icon => icon.getBoundingClientRect().width)).toBe(20)
})

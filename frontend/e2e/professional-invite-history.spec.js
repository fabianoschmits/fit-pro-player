import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'

const base = { kind: 'code', is_personal: false, created_at: '2026-11-05T12:00:00Z' }
const initial = [
  { ...base, id: 'available', code: 'AVAILABLE1', status: 'pending' },
  { ...base, id: 'direct', code: 'DIRECT1', status: 'active', is_used: true, used_by_name: 'Ana Oliveira', used_at: '2026-11-05T13:00:00Z' },
  { ...base, id: 'request', code: 'REQUEST1', status: 'revoked', is_used: true, used_by_name: 'Bruno Santos', used_at: '2026-11-05T14:00:00Z' },
  { ...base, id: 'revoked', code: 'REVOKED1', status: 'revoked' },
]

test('history distinguishes active, used and revoked invitations and identifies accepted users', async ({ page }, testInfo) => {
  await seed(page, { professional: true, rpc: { professional_generated_invites: initial } })
  await page.goto('/#/professional/invites')
  await expect(page.getByLabel('Resumo dos convites')).toContainText('Ativos (1)')
  await expect(page.getByLabel('Resumo dos convites')).toContainText('Utilizados (2)')
  await expect(page.getByLabel('Resumo dos convites')).toContainText('Revogados (1)')
  for (const [code, name] of [['DIRECT1', 'Ana Oliveira'], ['REQUEST1', 'Bruno Santos']]) {
    const card = page.locator('.management-invite').filter({ hasText: code })
    await expect(card.locator('summary')).toContainText('Utilizado')
    await expect(card.locator('[data-tone="used"]')).toBeVisible()
    await expect(card.getByText(`Utilizado por: ${name}`)).toBeHidden()
    await card.locator('summary').click()
    await expect(card.getByText(`Utilizado por: ${name}`)).toBeVisible()
    await expect(card).toContainText('Aceito em')
    await expect(card.getByRole('button', { name: 'Revogar', exact: true })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Excluir do histórico', exact: true })).toHaveCount(0)
  }
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('used-invites.png'), fullPage: true })
})

test('only a confirmed revoked invitation is deleted, and a failed delete can be retried', async ({ page }) => {
  let rows = [...initial], attempts = 0
  const calls = []
  await seed(page, { professional: true, rpc: {
    professional_generated_invites: () => rows,
    delete_revoked_professional_invite: args => {
      attempts++; calls.push(args)
      if (attempts === 1) return { __error: { status: 500, body: { message: 'Fixture unavailable' } } }
      rows = rows.filter(item => item.id !== args.p_invite_id); return true
    },
  } })
  await page.goto('/#/professional/invites')
  const card = page.locator('.management-invite').filter({ hasText: 'REVOKED1' })
  await card.locator('summary').click()
  await card.getByRole('button', { name: 'Excluir do histórico', exact: true }).click()
  await card.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect(attempts).toBe(0)
  await card.getByRole('button', { name: 'Excluir do histórico', exact: true }).click()
  await card.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Este recurso está temporariamente indisponível. Tente novamente em instantes.')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(card).toHaveCount(0)
  await expect(page.locator('.management-notice')).toContainText('Convite excluído do histórico.')
  await expect(page.getByLabel('Resumo dos convites')).toContainText('Revogados (0)')
  expect(calls).toEqual([{ p_invite_id: 'revoked' }, { p_invite_id: 'revoked' }])
  await page.reload()
  await expect(page.locator('.management-invite')).toHaveCount(3)
})

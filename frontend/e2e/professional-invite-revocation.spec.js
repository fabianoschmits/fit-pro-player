import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'

const invite = { id: 'generated-invite', code: 'PENDING123', status: 'pending', is_personal: false, created_at: '2026-11-05T12:00:00Z' }

for (const failFirst of [false, true]) test(`collapsed invites support confirmation, cancellation and revocation (retry=${failFirst})`, async ({ page }, testInfo) => {
  const calls = []
  let current = { ...invite }
  await seed(page, { professional: true, rpc: {
    professional_invites: () => [current, { ...invite, id: 'accepted', code: 'ACCEPTED123', status: 'active' }],
    revoke_professional_invite: args => {
      calls.push(args)
      if (failFirst && calls.length === 1) return { __error: { status: 500, body: { message: 'Fixture unavailable' } } }
      current = { ...current, status: 'revoked' }; return current
    },
  } })
  await page.goto('/#/professional/invites')
  const card = page.locator('.management-invite').filter({ hasText: invite.code })
  await expect(card.locator('summary')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Revogar', exact: true })).toBeHidden()
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await card.locator('summary').focus()
  await page.keyboard.press('Enter')
  await card.getByRole('button', { name: 'Revogar', exact: true }).click()
  await card.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect(calls).toEqual([])
  await card.getByRole('button', { name: 'Revogar', exact: true }).click()
  await card.getByRole('button', { name: 'Confirmar', exact: true }).click()
  if (failFirst) {
    await expect(page.getByRole('alert')).toContainText('Não foi possível revogar este convite.')
    await expect(card).toContainText('Pendente')
    await card.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  }
  await expect(page.locator('.management-notice')).toContainText('Convite revogado.')
  await expect(card).toContainText('Revogado')
  expect(calls).toEqual(Array(failFirst ? 2 : 1).fill({ p_invite_id: invite.id }))
  await card.locator('summary').click()
  await expect(card.getByRole('button', { name: 'Revogar', exact: true })).toHaveCount(0)
  const accepted = page.locator('.management-invite').filter({ hasText: 'ACCEPTED123' })
  await accepted.locator('summary').click()
  await expect(accepted.getByRole('button', { name: 'Revogar', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('invite-options.png'), fullPage: true })
  await page.reload()
  await expect(page.locator('.management-invite').filter({ hasText: invite.code })).toContainText('Revogado')
})

test('newly created invites open their sharing and revocation options', async ({ page }) => {
  let generated = []
  await seed(page, { professional: true, rpc: {
    professional_invites: () => generated,
    create_professional_invite: () => { generated = [{ ...invite }]; return invite },
    revoke_professional_invite: () => { generated = [{ ...invite, status: 'revoked' }]; return generated[0] },
  } })
  await page.goto('/#/professional/invites?section=create')
  await page.getByRole('button', { name: 'Gerar convite', exact: true }).click()
  await expect(page).toHaveURL(/section=result.*code=PENDING123/)
  const card = page.locator('.management-invite')
  await expect(card.locator('details')).toHaveAttribute('open', '')
  await expect(card.getByRole('button', { name: 'Copiar link', exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Revogar', exact: true }).click()
  await card.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(card).toContainText('Revogado')
})

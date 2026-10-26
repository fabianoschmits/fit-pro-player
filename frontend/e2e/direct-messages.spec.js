import { test, expect } from '@playwright/test'
import { seed, USER, STUDENT } from './fixtures.test.js'

test('opens inbox from community, reads a conversation and sends from profile', async ({ page }) => {
  const messages = [{ id: '1', sender_id: STUDENT, recipient_id: USER, body: 'Vamos treinar hoje?', created_at: '2026-10-25T18:00:00Z', read_at: null }]
  await seed(page, { authenticated: true, rpc: {
    is_current_user_suspended: false,
    community_message_unread_count: 1,
    community_message_inbox: [{ peer_id: STUDENT, display_name: 'Bruno', avatar_ref: 'avatar-05', body: messages[0].body, created_at: messages[0].created_at, unread_count: 1 }],
    community_message_history: () => messages,
    community_read_messages: null,
    community_send_message: args => { messages.push({ id: '2', sender_id: USER, recipient_id: STUDENT, body: args.p_body, created_at: new Date().toISOString() }); return '2' },
  } })
  await page.route('**/rest/v1/profiles?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: STUDENT, display_name: 'Bruno', avatar_ref: 'avatar-05' }) }))
  await page.goto('/#/community')
  await page.getByRole('button', { name: 'Mensagens: 1 não lidas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Conversas', exact: true })).toBeVisible()
  await expect(page.getByLabel('1 mensagens não lidas')).toBeVisible()
  await page.screenshot({ path: `test-results/dm-inbox-${test.info().project.name}.png` })
  await page.locator('.dm-inbox-row').click()
  await expect(page.locator('.chat-bubble')).toContainText('Vamos treinar hoje?')
  await page.getByLabel('Nova mensagem').fill('Sim, às 19h!')
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click()
  await expect(page.locator('.chat-bubble--user')).toContainText('Sim, às 19h!')
  await expect(page.getByLabel('Nova mensagem')).toHaveValue('')
  await page.screenshot({ path: `test-results/dm-chat-${test.info().project.name}.png` })
  await page.goto(`/#/community/user/${STUDENT}`)
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/community/messages/${STUDENT}`))
  await expect(page.locator('.chat-bubble--user')).toContainText('Sim, às 19h!')
})

import { test, expect } from '@playwright/test'
import { seed, USER, STUDENT } from './fixtures.test.js'

const TICKET = '99999999-9999-4999-8999-999999999999'
const message = { id: 'message-1', author_kind: 'user', body: 'Como posso organizar melhor as minhas rotinas de treino durante a semana?', created_at: '2026-10-15T12:00:00Z' }
async function seedConsole(page) {
  let status = 'pending', reply = null, read = false
  const rpc = {
    ops_overview: [{ user_count: 26, professional_count: 8, pending_verification_count: 3, new_users_7d: 5 }],
    ops_support_overview: [{ unread_count: 4, pending_count: 100, answered_count: 2, resolved_count: 1 }],
    support_list_categories: [{ slug: 'question', label: 'Dúvida' }, { slug: 'technical', label: 'Problema técnico' }],
    ops_support_list_tickets: [{ ticket_id: TICKET, user_id: STUDENT, display_name: 'Ana de teste', email: 'ana@example.invalid', subject: 'Dúvida sobre meu plano semanal e a organização dos exercícios', category_label: 'Dúvida', status, priority: 'normal', last_message_at: message.created_at }],
    ops_support_ticket_detail: () => ({ ticket: { id: TICKET, user_id: STUDENT, subject: 'Dúvida sobre meu plano semanal e a organização dos exercícios', status, priority: 'normal', created_at: message.created_at, assigned_admin_id: USER }, category: { slug: 'question', label: 'Dúvida' }, messages: [message, ...(reply ? [{ ...message, id: 'reply-1', body: reply, author_kind: 'admin' }] : [])], events: [] }),
    ops_support_mark_read: null,
    ops_support_reply: args => { reply = args.p_body; status = 'answered'; return null },
    ops_support_update_ticket: args => { status = args.p_status; return null },
    ops_user_detail: [{ user_id: STUDENT, display_name: 'Ana de teste', email: 'ana@example.invalid', roles: [] }],
    ops_list_users: [{ user_id: STUDENT, display_name: 'Ana de teste', email: 'ana@example.invalid', roles: [], account_kind: 'account' }],
    ops_list_professionals: [],
    ops_user_training: { has_snapshot: false },
    ops_support_list_faq: [{ article_id: 'faq-1', question: 'Como começar a treinar?', answer: 'Abra Plano e escolha uma rotina.', category_slug: 'question', category_label: 'Dúvida', sort_order: 10, is_published: true }],
    ops_list_notifications: () => ({ items: [{ id: 'support:message-1', kind: 'support', title: 'Mensagem recebida', body: 'Ana: dúvida sobre o plano semanal', target_path: `/console/support/${TICKET}`, created_at: message.created_at, read_at: read ? message.created_at : null }], unread_count: read ? 0 : 1, has_more: false }),
    ops_mark_notifications_read: () => { read = true; return null },
  }
  await seed(page, { authenticated: true, rpc })
  await page.addInitScript(() => localStorage.setItem('fpp_privacy_consent_v1', JSON.stringify({ version: '2026-10-13', necessary: true, preferences: false, analytics: false, communications: false, acceptedAt: '2026-10-15T12:00:00Z' })))
  await page.route('**/rest/v1/user_roles*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ role: 'admin' }]) }))
}

test('the platform workspace exposes messages, navigates from notifications and sends a reply', async ({ page }, testInfo) => {
  await seedConsole(page)
  await page.goto('/#/console')
  await expect(page.getByRole('heading', { name: 'Central da plataforma', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Mensagens dos usuários/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('console-overview.png'), fullPage: true })
  await page.getByRole('button', { name: /Notificações da plataforma/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Notificações da plataforma' })
  await expect(dialog).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('console-notifications.png') })
  await dialog.getByRole('link', { name: /Mensagem recebida/ }).click()
  await expect(page).toHaveURL(new RegExp(`console/support/${TICKET}`))
  await expect(page.getByRole('heading', { name: /Dúvida sobre meu plano semanal/ })).toBeVisible()
  await expect(page.getByText(message.body, { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Sua resposta' }).fill('Abra o Plano e distribua suas rotinas entre os dias da semana.')
  await page.getByRole('button', { name: 'Enviar resposta', exact: true }).click()
  await expect(page.getByText('Resposta enviada ao usuário.', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('console-conversation.png'), fullPage: true })
  await page.getByRole('link', { name: 'Caixa de entrada', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mensagens dos usuários', level: 1 })).toBeVisible()
})

test('the test laboratory groups experiments and returns each one to its hub', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedConsole(page)
  const width = testInfo.project.name.includes('mobile') ? 320 : 1440
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/#/console')
  const tests = page.locator('.console-navigation-group').filter({ has: page.getByText('Testes', { exact: true }) })
  await expect(tests.getByRole('link')).toHaveCount(1)
  await expect(tests.getByRole('link', { name: /Laboratório de testes/ })).toHaveAttribute('href', '#/console/laboratory')
  await page.locator('.console-main').getByRole('link', { name: /Laboratório de testes/ }).click()

  const expectHub = async () => {
    await expect(page).toHaveURL(/#\/console\/laboratory$/)
    await expect(page.getByRole('heading', { name: 'Laboratório de testes', level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toHaveCount(0)
    await expect(page.locator('[data-tab-key]')).toHaveCount(0)
    const overflow = await page.locator('.console-main').evaluate(main => ({
      document: document.documentElement.scrollWidth > innerWidth + 2,
      links: [...main.querySelectorAll('a')].filter(link => {
        const rect = link.getBoundingClientRect()
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
      }).map(link => link.textContent.trim()),
    }))
    expect(overflow.document).toBe(false)
    expect(overflow.links).toEqual([])
  }
  await expectHub()
  await page.screenshot({ path: testInfo.outputPath(`console-laboratory-${width}.png`), fullPage: true })
  await page.locator('.console-main').getByRole('link', { name: /Laboratório de interações/ }).click()
  await expect(page).toHaveURL(/#\/motion-feedback$/)
  await expect(page.locator('[data-motion-showcase]')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  await expectHub()
  await page.locator('.console-main').getByRole('link', { name: /Home Glass/ }).click()
  await expect(page).toHaveURL(/#\/tests\/home-glass$/)
  await expect(page.locator('.home-glass-experiment')).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao laboratório de testes', exact: true }).click()
  await expectHub()
})

test('the central pages fit small and large viewports and the FAQ has a separate editor', async ({ page }, testInfo) => {
  await seedConsole(page)
  const widths = testInfo.project.name.includes('mobile') ? [320, 390] : [1440]
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/console', '/console/laboratory', '/console/users', '/console/professionals', '/console/support', '/console/faq', '/console/faq/faq-1', `/console/users/${STUDENT}?section=training`]) {
      await page.goto('/#' + route)
      await expect(page.locator('.console-main')).toBeVisible()
      await expect(page.locator('.console-main')).not.toContainText('Verificando acesso…')
      const clipped = await page.locator('.console-main').evaluate(main => {
        const bounds = main.getBoundingClientRect()
        return [...main.querySelectorAll('input,select,textarea,button')].filter(el => { const rect = el.getBoundingClientRect(); return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) }).map(el => el.getAttribute('aria-label') || el.tagName)
      })
      expect(clipped, route).toEqual([])
      if (route.endsWith('faq-1')) await expect(page.getByRole('textbox', { name: 'Resposta', exact: true })).toHaveValue('Abra Plano e escolha uma rotina.')
      if (route === '/console/support') {
        await expect(page.locator('.console-message-copy').first()).toBeVisible()
        expect(await page.locator('.console-message-copy').first().evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(140)
        await page.screenshot({ path: testInfo.outputPath(`console-inbox-${width}.png`), fullPage: true })
      }
    }
  }
})

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { seed, USER } from './fixtures.test.js'

test('personal data saves without changing training and the legacy editor redirects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, { authenticated: true })
  await page.goto('/#/plan?profile=edit')
  await expect(page).toHaveURL(/settings\?profile=edit/)
  await expect(page.locator('.settings-group').nth(1).locator('summary')).toContainText('browser-test@example.invalid')
  await page.locator('input[name="name"]').fill('Maria Silva')
  await page.locator('input[name="weight"]').fill('76,5')
  await expect(page.locator('input[name="name"]')).toHaveValue('Maria Silva')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.locator('.personal-settings')).toContainText('Maria Silva')
  await page.reload()
  await expect(page.locator('input[name="name"]')).toHaveValue('Maria Silva')
  const state = await page.evaluate(id => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${id}`)).state, USER)
  expect(state.routines[0].id).toBe('e2e-routine')
  expect(state.week['1']).toBe('e2e-routine')
  expect(state.workouts).toEqual([])
  expect(state.bodyweight.at(-1).w).toBe(76.5)
})

test('mobile settings and role menus fit narrow screens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page, { professional: true })
  await page.route('**/rest/v1/user_roles?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{role:'professional'}, {role:'admin'}]) }))
  await page.goto('/#/more')
  await expect(page.locator('[data-menu-group="professional"]')).toBeVisible()
  await expect(page.locator('[data-menu-group="admin"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('more-mobile.png'), fullPage: true })
  await page.locator('.menu-profile').click()
  await expect(page.locator('.settings-group')).toHaveCount(8)
  for (const group of await page.locator('.settings-group').all()) {
    if (!(await group.getAttribute('open'))) { if (await group.getAttribute('open') === null) await group.locator(':scope > summary').click() }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('settings-mobile.png'), fullPage: true })
})

test('professional can upload a photo and an invited user sees it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  const csp = config.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value
  const imagePolicy = csp.match(/img-src[^;]+/)[0].replace('bgqavxoxwgheloeubbpf.supabase.co', 'fitpp-test.supabase.co')
  await page.route('http://127.0.0.1:8080/', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': imagePolicy } })
  })
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64')
  const profile = { user_id: USER, professional_name: 'Profissional Teste', bio: 'Treinos personalizados', specialties: [], verification_status: 'unverified', photo_path: null }
  await seed(page, { professional: true, rpc: {
    professional_profiles: profile,
    set_professional_photo: ({p_path}) => { profile.photo_path = p_path; return {...profile} },
    preview_professional_invite: () => [{ ...profile, professional_user_id: USER, invite_id: 'fixture-invite' }],
  } })
  await page.route('**/storage/v1/**', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'image/png', body: image })
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({Key:'photo'}) }))
  await page.goto('/#/professional/profile')
  await page.locator('input[type="file"][aria-label="Foto profissional"]').setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: image })
  await expect(page.locator('.management-photo-editor [role="status"]')).toContainText('Foto atualizada.')
  expect(profile.photo_path).toMatch(new RegExp(`^${USER}/.+\\.png$`))
  await expect(page.locator('.management-photo-editor img')).toBeVisible()
  await expect.poll(() => page.locator('.management-photo-editor img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  await page.goto('/#/student/professionals/add?code=PHOTO123')
  await expect(page.locator('.management-photo-editor')).toHaveCount(0)
  await expect(page.locator('.management-avatar img')).toBeVisible()
  await expect(page.getByText('Profissional Teste', { exact: true })).toBeVisible()
})

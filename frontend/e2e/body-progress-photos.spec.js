import { test, expect } from '@playwright/test'
import { seed, USER } from './fixtures.test.js'

// Only network transport is stubbed. The actual UI, image decoder, canvas,
// worker, controls and account state are exercised in desktop and mobile browsers.
test('private photo history works without circumference check-ins', async ({ page }) => {
  const photos = []
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, { authenticated: true, rpc: {
    'body-progress-photo-cleanup': args => {
      if (args.action === 'photo') {
        const index = photos.findIndex(photo => photo.id === args.photoId)
        if (index >= 0) photos.splice(index, 1)
      }
      return { ok: true }
    },
    body_progress_photos: (_args, { request }) => {
      if (request.method() === 'POST') { photos.push({ ...request.postDataJSON(), upload_pending: true }); return null }
      if (request.method() === 'PATCH') {
        const id = new URL(request.url()).searchParams.get('id')?.slice(3)
        const photo = photos.find(item => item.id === id)
        Object.assign(photo, request.postDataJSON())
        return request.headers().accept?.includes('vnd.pgrst.object') ? { id } : null
      }
      return photos
    },
  } })
  await page.route('https://fitpp-test.supabase.co/storage/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/object/sign/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/body-progress-photos/test?token=fixture' }) })
    if (route.request().method() === 'POST') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Key: 'fixture', Id: 'fixture' }) })
    return route.fulfill({ contentType: 'image/png', body: image })
  })
  await page.goto('/#/progress/body')
  await page.getByRole('button', { name: 'Comparar', exact: true }).click()
  await expect(page.getByText('Faça pelo menos dois check-ins')).toBeVisible()
  await page.getByRole('button', { name: 'Fotos', exact: true }).click()
  await expect(page.getByText('Nenhuma fotografia cadastrada')).toBeVisible()
  for (const date of ['2026-01-01', '2026-02-01']) {
    await page.getByRole('button', { name: 'Adicionar foto', exact: true }).click()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: image })
    await expect(page.locator('.bp-photo-preview')).toBeVisible()
    await page.getByLabel('Data do registro').fill(date)
    await page.getByRole('button', { name: 'Salvar fotografia', exact: true }).click()
    await expect(page.locator('.bp-photo-upload')).toHaveCount(0, { timeout: 55000 })
  }
  const slider = page.getByRole('slider', { name: 'Divisor antes e depois' })
  await expect(slider).toHaveAttribute('aria-valuenow', '50')
  const geometry = await page.locator('.bp-photo-stage img').evaluateAll(images => images.map(image => image.getAttribute('style')))
  await slider.focus(); await slider.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '100')
  expect(await page.locator('.bp-photo-stage img').evaluateAll(images => images.map(image => image.getAttribute('style')))).toEqual(geometry)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: 'Centralizar divisor', exact: true }).click()
  await expect(slider).toHaveAttribute('aria-valuenow', '50')
  await page.getByRole('button', { name: 'Ajustar depois', exact: true }).click()
  const zoom = page.getByLabel('Zoom', { exact: true })
  await zoom.focus(); await zoom.press('ArrowRight')
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.locator('.bp-photo-adjust')).toHaveCount(0)
  expect(photos[0].manual_transform).toBeNull()
  expect(photos[1].manual_transform.scale).toBeGreaterThan(0)
  await page.reload()
  await page.getByRole('button', { name: 'Comparar', exact: true }).click()
  await page.getByRole('button', { name: 'Fotos', exact: true }).click()
  await expect(page.locator('.bp-photo-record')).toHaveCount(2)
  expect(photos.every(photo => photo.user_id === USER && !photo.upload_pending)).toBe(true)
  await page.locator('.bp-photo-record').first().getByRole('button', { name: 'Excluir', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.locator('.bp-photo-record')).toHaveCount(1)
  await expect(page.getByText('Adicione outra foto deste ângulo para comparar sua evolução.')).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { seed, USER } from './fixtures.test.js'

// Only network transport is stubbed. The actual UI, image decoder, canvas,
// worker, controls and account state are exercised in desktop and mobile browsers.
test('private photo history works without circumference check-ins', async ({ page }) => {
  const photos = []
  const dataURL = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 360; canvas.height = 640
    const context = canvas.getContext('2d')
    context.fillStyle = '#d9ddd9'; context.fillRect(0, 0, 360, 640)
    context.fillStyle = '#a9b5b1'; context.fillRect(0, 590, 360, 50)
    context.fillStyle = '#b38f74'; context.beginPath(); context.arc(180, 85, 29, 0, Math.PI * 2); context.fill()
    context.fillRect(101, 146, 25, 207); context.fillRect(234, 146, 25, 207)
    context.fillRect(136, 372, 35, 216); context.fillRect(189, 372, 35, 216)
    context.fillStyle = '#42616b'; context.fillRect(124, 125, 112, 212)
    context.fillStyle = '#2d3e44'; context.fillRect(129, 337, 102, 73)
    return canvas.toDataURL('image/png')
  })
  const image = Buffer.from(dataURL.split(',')[1], 'base64')
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
    if (route.request().method() === 'POST' && path.includes('/object/sign/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/body-progress-photos/test?token=fixture' }) })
    if (route.request().method() === 'POST') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Key: 'fixture', Id: 'fixture' }) })
    return route.fulfill({ contentType: 'image/png', body: image })
  })
  await page.goto('/#/progress')
  await expect(page.getByRole('button', { name: 'Comparação', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stats-photo-progress input,.stats-photo-progress select,.stats-photo-progress details')).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar fotos', exact: true }).click()
  await expect(page).toHaveURL(/#\/progress\/photos$/)
  await expect(page.getByText('Check-in desta semana')).toHaveCount(0)
  await expect(page.getByText('Demonstração · modelo masculino')).toBeVisible()
  for (const date of ['2026-01-01', '2026-02-01']) {
    await page.getByRole('button', { name: 'Adicionar foto', exact: true }).click()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: image })
    await expect(page.locator('.bp-photo-preview')).toBeVisible()
    await page.getByLabel('Data do registro').fill(date)
    await page.getByRole('button', { name: 'Salvar fotografia', exact: true }).click()
    await expect(page.locator('.bp-photo-upload')).toHaveCount(0, { timeout: 55000 })
  }
  const slider = page.getByRole('slider', { name: 'Divisor antes e depois' })
  const waitForImages = async () => {
    await expect(page.locator('.bp-photo-stage img')).toHaveCount(2)
    await expect.poll(() => page.locator('.bp-photo-stage img').evaluateAll(images => images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    await expect(page.locator('.bp-photo-loading')).toHaveCount(0)
  }
  await expect(slider).toHaveAttribute('aria-valuenow', '50')
  await waitForImages()
  const geometry = await page.locator('.bp-photo-stage img').evaluateAll(images => images.map(image => image.getAttribute('style')))
  await slider.focus(); await slider.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '100')
  expect(await page.locator('.bp-photo-stage img').evaluateAll(images => images.map(image => image.getAttribute('style')))).toEqual(geometry)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('summary').filter({ hasText: /^Ajustar alinhamento$/ }).click()
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
  await expect(slider).toBeVisible()
  await waitForImages()
  await expect(page.locator('.bp-photo-angle')).not.toHaveAttribute('open', '')
  await expect(page.locator('.bp-photo-dates')).not.toHaveAttribute('open', '')
  await page.locator('.bp-photo-editor-page').screenshot({ path: test.info().outputPath('photo-editor.png') })
  await page.locator('.bp-photo-history-disclosure>summary').click()
  await expect(page.locator('.bp-photo-record')).toHaveCount(2)
  expect(photos.every(photo => photo.user_id === USER && !photo.upload_pending)).toBe(true)
  await page.locator('.bp-photo-record').first().getByRole('button', { name: 'Excluir', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.locator('.bp-photo-record')).toHaveCount(1)
  await expect(page.getByText('Adicione outra foto deste ângulo para comparar sua evolução.')).toBeVisible()
  // Add a second photo again and confirm the main page contains only the demonstrator.
  await page.getByRole('button', { name: 'Adicionar foto', exact: true }).click()
  await page.locator('input[type=file]').first().setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: image })
  await page.getByRole('button', { name: 'Salvar fotografia', exact: true }).click()
  await expect(page.locator('.bp-photo-upload')).toHaveCount(0, { timeout: 55000 })
  await page.getByRole('button', { name: 'Comparação', exact: true }).click()
  await expect(page).toHaveURL(/#\/progress$/)
  await expect(slider).toBeVisible()
  await waitForImages()
  const demo = page.locator('.stats-photo-progress')
  await expect(demo.getByRole('button', { name: 'Adicionar foto', exact: true })).toHaveCount(0)
  await expect(demo.locator('input,select,details')).toHaveCount(0)
  expect(await demo.evaluate(element => element.nextElementSibling.classList.contains('stats-balance-card'))).toBe(true)
  await demo.screenshot({ path: test.info().outputPath('comparison-main-dark.png') })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  await demo.screenshot({ path: test.info().outputPath('comparison-main-light.png') })
  await page.getByRole('button', { name: 'Medidas', exact: true }).click()
  await expect(page).toHaveURL(/#\/progress\/body$/)
  await expect(page.getByText('Check-in desta semana')).toBeVisible()
})

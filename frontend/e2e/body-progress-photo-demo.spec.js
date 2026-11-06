import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

for (const [body, label] of [['male', 'masculino'], ['female', 'feminino']]) {
  test(`demo ${body} follows account silhouette without creating photos`, async ({ page }) => {
    const state = stateFixture()
    state.body = body
    let reads = 0, writes = 0, poseRequests = 0
    page.on('request', request => { if (request.url().includes('/pose/')) poseRequests++ })
    await seed(page, { authenticated: true, state, rpc: {
      body_progress_photos: (_args, { request }) => {
        if (request.method() === 'GET') reads++
        else writes++
        return []
      },
    } })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/progress')
    await expect(page.getByText(`Demonstração · modelo ${label}`)).toBeVisible()
    const slider = page.getByRole('slider', { name: 'Divisor antes e depois' })
    await expect(slider).toHaveAttribute('aria-valuenow', '50')
    await expect.poll(() => page.locator('.bp-photo-stage img').evaluateAll(images => images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    await expect(page.locator('.bp-photo-label')).toContainText([/ANTES\s*Imagem de exemplo/, /DEPOIS\s*Imagem de exemplo/])
    const sources = await page.locator('.bp-photo-stage img').evaluateAll(images => images.map(image => image.getAttribute('src')))
    expect(sources.every(source => source.includes(`${body}-`))).toBe(true)
    await page.locator('.stats-photo-progress').screenshot({ path: test.info().outputPath(`${body}-demo.png`) })
    await slider.focus(); await slider.press('End')
    await expect(slider).toHaveAttribute('aria-valuenow', '100')
    await slider.press('Home')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await slider.press('ArrowRight')
    await page.getByRole('button', { name: 'Editar fotos', exact: true }).click()
    await expect(page).toHaveURL(/#\/progress\/photos$/)
    await expect(page.getByText(`Demonstração · modelo ${label}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Adicionar foto', exact: true })).toBeVisible()
    await expect(page.locator('.bp-photo-history-disclosure summary')).toContainText('0 fotos')
    expect(reads).toBeGreaterThan(0)
    expect(writes).toBe(0)
    expect(poseRequests).toBe(0)
  })
}

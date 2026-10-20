import { test, expect } from '@playwright/test'
import { seed, openMainNavigation } from './fixtures.test.js'

const height = 720
const pivotWidth = 56
const nav = page => page.locator('.corner-nav')
const toggle = page => page.locator('.corner-nav-toggle')
const main = page => page.locator('.corner-nav-main')

async function load(page, width, reducedMotion = 'reduce') {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion })
  await seed(page)
  await page.goto('/#/home')
  await expect(toggle(page)).toBeVisible()
}

async function settle(page) {
  await expect.poll(() => nav(page).evaluate(element =>
    element.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')
  )).toBe(false)
}

async function reloadNavigation(page) {
  await page.reload()
  await expect(toggle(page)).toBeVisible()
  await settle(page)
}

async function expectMoreClosed(page) {
  const panel = page.locator('.corner-nav-more')
  await expect(page.locator('.corner-nav-more-trigger')).toHaveAttribute('aria-expanded', 'false')
  await expect(panel).not.toHaveClass(/is-visible/)
  await expect(panel).toHaveAttribute('aria-hidden', 'true')
  expect(await panel.evaluate(element => element.inert)).toBe(true)
}

async function expectPosition(page, position) {
  const box = await toggle(page).boundingBox()
  expect(box.x).toBeCloseTo(position.x, 0)
  expect(box.y).toBeCloseTo(position.y, 0)
}

async function dragBy(page, dx, dy) {
  const box = await toggle(page).boundingBox()
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 })
  await page.mouse.up()
}

async function expectUpwardMore(page, { activateFirst = false } = {}) {
  const trigger = page.locator('.corner-nav-more-trigger')
  const triggerBox = await trigger.boundingBox()
  const toggleBox = await toggle(page).boundingBox()
  expect(triggerBox.width).toBeCloseTo(42, 0)
  expect(triggerBox.height).toBeCloseTo(24, 0)
  expect(toggleBox.y - triggerBox.y - triggerBox.height).toBeCloseTo(6, 0)
  const radii = await trigger.evaluate(element => {
    const style = getComputedStyle(element)
    return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(parseFloat)
  })
  expect(radii.every(radius => radius >= triggerBox.height / 2)).toBe(true)
  // Inspect the rendered chevron in screen coordinates, including any SVG rotation.
  expect(await trigger.locator('path').evaluate(path => {
    const length = path.getTotalLength()
    const matrix = path.getScreenCTM()
    const points = [0, length / 2, length].map(distance => {
      const point = path.getPointAtLength(distance)
      return new DOMPoint(point.x, point.y).matrixTransform(matrix)
    })
    return points[1].y < Math.min(points[0].y, points[2].y)
  })).toBe(true)
  await trigger.click()
  const panel = page.locator('.corner-nav-more')
  await expect(panel).toHaveClass(/is-visible/)
  await settle(page)
  const panelBox = await panel.boundingBox()
  const viewport = page.viewportSize()
  expect(panelBox.x).toBeGreaterThanOrEqual(0)
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(panelBox.height).toBeGreaterThanOrEqual(88)
  expect(panelBox.y).toBeGreaterThanOrEqual(7)
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(triggerBox.y + 1)
  const firstItem = panel.getByRole('menuitem').first()
  await expect(firstItem).toBeFocused()
  const itemBox = await firstItem.boundingBox()
  expect(itemBox.height).toBeGreaterThanOrEqual(44)
  expect(itemBox.y).toBeGreaterThanOrEqual(panelBox.y)
  expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height)
  if (activateFirst) {
    await firstItem.click()
    await expect(page).toHaveURL(/#\/personal-data$/)
    await expect(panel).not.toHaveClass(/is-visible/)
    return
  }
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(panel).not.toHaveClass(/is-visible/)
}

for (const width of [320, 390, 600]) {
  test(`mobile ${width}px starts compact and unfolds across the bottom with aligned icons`, async ({ page }) => {
    await load(page, width)
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(main(page)).toHaveAttribute('aria-hidden', 'true')
    expect(await main(page).evaluate(element => element.inert)).toBe(true)
    await expect(page.locator('.corner-nav-more-trigger')).toBeHidden()
    await expect(nav(page).getByRole('button')).toHaveCount(1)
    const closed = await nav(page).boundingBox()
    expect(closed.width).toBeCloseTo(pivotWidth, 0)
    expect(closed.height).toBeLessThan(64)
    expect(closed.x).toBeCloseTo(0, 0)
    expect(closed.y + closed.height).toBeCloseTo(height, 0)

    await openMainNavigation(page)
    await settle(page)
    const opened = await page.locator('.corner-nav-shell').boundingBox()
    expect(opened.x).toBeCloseTo(0, 0)
    expect(opened.width).toBeCloseTo(width, 0)
    expect(opened.height).toBeLessThan(64)
    expect(opened.y + opened.height).toBeCloseTo(height, 0)
    await expect(main(page)).toHaveAttribute('aria-hidden', 'false')
    expect(await main(page).evaluate(element => element.inert)).toBe(false)
    await expect(main(page).getByRole('button')).toHaveCount(4)
    const shape = await nav(page).evaluate(element => {
      const surfaces = [...element.querySelectorAll('.corner-nav-shell, .corner-nav-toggle, .corner-nav-main')].map(surface => getComputedStyle(surface))
      const material = getComputedStyle(element.querySelector('.corner-nav-main'))
      // Canvas accepts computed rgb(), color(srgb ...), and other browser color syntaxes.
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')
      context.fillStyle = material.backgroundColor
      context.fillRect(0, 0, 1, 1)
      const icons = [...element.querySelectorAll('.corner-nav-toggle .corner-nav-icon > .icn, .corner-nav-main .corner-nav-icon > .icn')]
      return {
        topCorners: surfaces.flatMap(surface => [surface.borderTopLeftRadius, surface.borderTopRightRadius].map(parseFloat)),
        materialAlpha: context.getImageData(0, 0, 1, 1).data[3] / 255,
        backdropFilter: material.backdropFilter || material.webkitBackdropFilter,
        centers: icons.map(icon => { const box = icon.getBoundingClientRect(); return box.top + box.height / 2 }),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }
    })
    expect(shape.topCorners.every(radius => radius === 0)).toBe(true)
    expect(shape.materialAlpha).toBeGreaterThan(0)
    expect(shape.materialAlpha).toBeLessThan(0.4)
    expect(shape.backdropFilter).toMatch(/blur\(/)
    expect(shape.centers).toHaveLength(5)
    expect(Math.max(...shape.centers) - Math.min(...shape.centers)).toBeLessThanOrEqual(1)
    expect(shape.overflow).toBe(false)
    await expectUpwardMore(page)
    await toggle(page).click()
    await settle(page)
    expect((await nav(page).boundingBox()).width).toBeCloseTo(pivotWidth, 0)
  })
}

test('desktop navigation floats above the bottom when closed and open', async ({ page }) => {
  await load(page, 1280)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  for (const open of [false, true]) {
    if (open) await openMainNavigation(page)
    await settle(page)
    const box = await page.locator('.corner-nav-shell').boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(16)
    expect(height - box.y - box.height).toBeGreaterThanOrEqual(16)
    expect(box.width).toBeLessThan(1280 - 32)
  }
  await expectUpwardMore(page)
})

test('small pointer movement keeps the mobile bar docked', async ({ page }) => {
  await load(page, 390)
  await dragBy(page, 3, -2)
  await expect(nav(page)).not.toHaveClass(/is-free/)
  const box = await page.locator('.corner-nav-shell').boundingBox()
  expect(box.x).toBeCloseTo(0, 0)
  expect(box.y + box.height).toBeCloseTo(height, 0)
})

test('dragging detaches without a jump and preserves the chosen position across menu and route changes', async ({ page }) => {
  await load(page, 390)
  const before = await toggle(page).boundingBox()
  await dragBy(page, 8, -8)
  await expect(nav(page)).toHaveClass(/is-free/)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  await expectPosition(page, { x: before.x + 8, y: before.y - 8 })
  // Leave enough space above for the always-upward options panel.
  const current = await toggle(page).boundingBox()
  await dragBy(page, 16 - current.x, 280 - current.y)
  const chosen = await toggle(page).boundingBox()
  await page.waitForTimeout(320) // Drag release intentionally suppresses its following click.
  await openMainNavigation(page)
  await settle(page)
  await expectPosition(page, chosen)
  await expectUpwardMore(page)
  await page.locator('[data-tab-key="plan"]').click()
  await expect(page).toHaveURL(/#\/plan$/)
  await expectPosition(page, chosen)
  await toggle(page).click()
  await settle(page)
  await expectPosition(page, chosen)
  await openMainNavigation(page)
  await settle(page)
  await expectPosition(page, chosen)
})

test('a pivot moved toward the right stays anchored and keeps upward options usable near the top', async ({ page }) => {
  await load(page, 390)
  const initial = await toggle(page).boundingBox()
  await dragBy(page, 200 - initial.x, 280 - initial.y)
  await expect(nav(page)).toHaveClass(/is-free/)
  const chosen = await toggle(page).boundingBox()
  expect(chosen.x).toBeCloseTo(200, 0)
  expect(chosen.y).toBeCloseTo(280, 0)
  await page.waitForTimeout(320)
  await openMainNavigation(page)
  await settle(page)
  await expectPosition(page, chosen)
  expect((await nav(page).boundingBox()).width).toBeCloseTo(pivotWidth, 0)
  await expectUpwardMore(page, { activateFirst: true })
  await expectPosition(page, chosen)
  await toggle(page).click()
  await settle(page)
  await expectPosition(page, chosen)
  await openMainNavigation(page)
  await settle(page)
  await expectPosition(page, chosen)

  // Overshoot the viewport: enough room must remain for real, clickable options above.
  await dragBy(page, 0, -600)
  await settle(page)
  const constrained = await toggle(page).boundingBox()
  expect(constrained.x).toBeCloseTo(chosen.x, 0)
  expect(constrained.y).toBeGreaterThanOrEqual(0)
  expect(constrained.y).toBeLessThan(chosen.y)
  await expectUpwardMore(page, { activateFirst: true })
  await expectPosition(page, constrained)
})

test('resizing a moved desktop menu constrains only its compact pivot', async ({ page }) => {
  await load(page, 1280)
  const initial = await toggle(page).boundingBox()
  await dragBy(page, 1000 - initial.x, 280 - initial.y)
  await page.setViewportSize({ width: 390, height })
  await settle(page)
  await expect.poll(async () => (await toggle(page).boundingBox()).x).toBeCloseTo(390 - pivotWidth, 0)
  const fitted = await toggle(page).boundingBox()
  await page.waitForTimeout(320)
  await openMainNavigation(page)
  await settle(page)
  await expectPosition(page, fitted)
  await expectUpwardMore(page, { activateFirst: true })
  await page.setViewportSize({ width: 1280, height })
  await settle(page)
  await expectPosition(page, fitted)
})

test('reload restores an open docked bar while always closing its extra options', async ({ page }) => {
  await load(page, 390)
  await openMainNavigation(page)
  await page.locator('.corner-nav-more-trigger').click()
  await expect(page.locator('.corner-nav-more')).toHaveClass(/is-visible/)
  await settle(page)

  await reloadNavigation(page)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(main(page)).toHaveAttribute('aria-hidden', 'false')
  expect(await main(page).evaluate(element => element.inert)).toBe(false)
  await expect(nav(page)).not.toHaveClass(/is-free/)
  await expectMoreClosed(page)
  await expectUpwardMore(page)
})

for (const open of [false, true]) {
  test(`reload preserves a moved pivot with the main bar ${open ? 'open' : 'closed'}`, async ({ page }) => {
    await load(page, 390)
    if (open) await openMainNavigation(page)
    const initial = await toggle(page).boundingBox()
    await dragBy(page, 100 - initial.x, 280 - initial.y)
    await expect(nav(page)).toHaveClass(/is-free/)
    await settle(page)
    const chosen = await toggle(page).boundingBox()

    await reloadNavigation(page)
    await expect(nav(page)).toHaveClass(/is-free/)
    await expect(toggle(page)).toHaveAttribute('aria-expanded', String(open))
    await expect(main(page)).toHaveAttribute('aria-hidden', String(!open))
    await expectPosition(page, chosen)
    await expectMoreClosed(page)
    if (open) await expectUpwardMore(page)
  })
}

test('reattaching a moved menu persists its default docked position after reload', async ({ page }) => {
  await load(page, 390)
  await openMainNavigation(page)
  const initial = await toggle(page).boundingBox()
  await dragBy(page, 100 - initial.x, 280 - initial.y)
  await expect(nav(page)).toHaveClass(/is-free/)
  await settle(page)
  await page.locator('.corner-nav-more-trigger').click()
  await expect(page.locator('.corner-nav-more')).toHaveClass(/is-visible/)
  await page.locator('.corner-nav-drag-toggle').click()
  await expect(nav(page)).not.toHaveClass(/is-free/)
  await settle(page)

  await reloadNavigation(page)
  await expect(nav(page)).not.toHaveClass(/is-free/)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expectMoreClosed(page)
  const docked = await page.locator('.corner-nav-shell').boundingBox()
  expect(docked.x).toBeCloseTo(0, 0)
  expect(docked.y + docked.height).toBeCloseTo(height, 0)
  expect(docked.width).toBeCloseTo(390, 0)
})

test('the mounted main menu folds in both directions and respects reduced motion', async ({ page }) => {
  await load(page, 390, 'no-preference')
  await expect(main(page)).toHaveCount(1)
  const original = await main(page).elementHandle()
  const startTransition = async () => toggle(page).evaluate(async button => {
    button.click()
    await new Promise(requestAnimationFrame)
    return document.querySelector('.corner-nav-main').getAnimations({ subtree: true }).map(animation => ({
      duration: animation.effect.getTiming().duration,
      transforms: animation.effect.getKeyframes().map(frame => frame.transform).filter(Boolean),
    }))
  })
  for (const expanded of ['true', 'false']) {
    const animations = await startTransition()
    await expect(toggle(page)).toHaveAttribute('aria-expanded', expanded)
    expect(animations.some(animation => animation.duration > 0 && new Set(animation.transforms).size > 1)).toBe(true)
    expect(await main(page).evaluate((element, first) => element === first, original)).toBe(true)
    await settle(page)
  }
  await expect(main(page)).toHaveAttribute('aria-hidden', 'true')
  expect(await main(page).evaluate(element => element.inert)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openMainNavigation(page)
  await settle(page)
  const durations = await main(page).evaluate(element => [element, ...element.querySelectorAll('*')].flatMap(node => {
    const style = getComputedStyle(node)
    return [...style.transitionDuration.split(','), ...style.animationDuration.split(',')].map(parseFloat)
  }))
  expect(durations.every(duration => duration <= 0.01)).toBe(true)
  await expect(main(page).getByRole('button')).toHaveCount(4)
})

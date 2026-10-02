import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'
test('production PWA downloads plan, survives offline reload and keeps its active workout',async({page,context},testInfo)=>{
  await seed(page);await page.goto('/#/settings')
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))})
  await page.locator('.offline-controls[data-ready] button').click()
  await expect(page.locator('.offline-controls[data-ready]')).toHaveAttribute('data-ready','true',{timeout:20000})
  const cached=await page.evaluate(async()=>{const cache=await caches.open('fit-pro-player-plan-media-v1');return(await cache.keys()).map(request=>request.url)})
  expect(cached.some(url=>/\/assets\/index-.*\.js$/.test(url))).toBe(true)
  expect(cached.some(url=>url.endsWith('.webp'))).toBe(true)
  await page.goto('/#/home');await page.locator('[data-tab-key="start"]').click()
  await expect(page.locator('.workout-session-title')).toContainText('Treino de teste')
  await context.setOffline(true);await page.reload()
  await expect(page.locator('.workout-session-title')).toContainText('Treino de teste')
  await expect(page.locator('.app-status-global')).toContainText(/Offline|Sem conexão/)
  await expect(page.locator('.exercise-guide-motion img').first()).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('offline-workout.png'),fullPage:true})
})

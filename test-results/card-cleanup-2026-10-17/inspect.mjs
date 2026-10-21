import { chromium } from '../../frontend/node_modules/@playwright/test/index.mjs'
import { seed, stateFixture } from '../../frontend/e2e/fixtures.test.js'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true })
const report = []
const output = new URL('./', import.meta.url)
const selectors = '.exercise-muscle-thumb,.plan-routine-body-thumb,.lrow-i:has(>.plan-routine-body-thumb),.daily-plan-icon:has(>.plan-routine-body-thumb),.routine-builder-head-thumb,.exmedia:has(>.exercise-muscle-static),.workout-last-values,.setrow.is-current,.set-execution-hint,.item.in-ss'
const inspect = async (page, screen) => {
  const details = await page.evaluate(selector => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    nodes: [...document.querySelectorAll(selector)].map(element => {
      const style = getComputedStyle(element)
      return { class: element.className, background: style.backgroundColor,
        borderLeft: style.borderLeftWidth, borderRadius: style.borderRadius,
        shadow: style.boxShadow, width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        svg: element.querySelectorAll('svg').length }
    })
  }), selectors)
  report.push({ screen, ...details })
}
try {
  for (const [theme, width] of [['light', 390], ['dark', 390], ['light', 1280], ['dark', 1280]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const page = await context.newPage()
    const state = stateFixture()
    state.theme = theme
    state.accent = 'teal'
    state.mediaSize = 'full'
    state.customEx = [{id:'custom-silhouette',n:'Exercício de costas',name:'Exercício de costas',tg:'lats',bp:'back',eq:'dumbbell',sm:[]}]
    state.routines[0].name = 'Treino de revisão visual'
    state.routines[0].ex = [{id:'0025',sets:3,reps:10,weight:20,sg:'superset'}, {id:'custom-silhouette',sets:3,reps:10,weight:20,sg:'superset'}]
    state.workouts = [{id:'visual-history',d:'2026-10-15',routineId:'e2e-routine',name:'Treino anterior',duration:1200,entries:[{id:'0025',sets:[{weight:20,reps:10,done:true}]}]}]
    await seed(page, { state })
    await page.goto('http://127.0.0.1:8087/#/plan')
    await page.locator('.plan-routine-list .bm-v').first().waitFor()
    await inspect(page, `${theme}-${width}-plan`)
    await page.screenshot({ path: new URL(`${theme}-${width}-plan.png`, output).pathname.slice(1), fullPage: true })
    await page.goto('http://127.0.0.1:8087/#/plan/r/e2e-routine')
    await page.locator('.routine-builder .exercise-muscle-thumb svg').first().waitFor()
    await inspect(page, `${theme}-${width}-routine`)
    await page.screenshot({ path: new URL(`${theme}-${width}-routine.png`, output).pathname.slice(1), fullPage: true })
    await page.goto('http://127.0.0.1:8087/#/library')
    await page.locator('.library-list .exercise-muscle-thumb svg').first().waitFor()
    await inspect(page, `${theme}-${width}-library`)
    await page.goto('http://127.0.0.1:8087/#/home')
    await page.locator('[data-tab-key="start"]').click()
    await page.locator('.active-workout').getByRole('button', { name:'Começar treino', exact:true }).click()
    await page.locator('.setrow.is-current').waitFor()
    await inspect(page, `${theme}-${width}-workout`)
    await page.screenshot({ path: new URL(`${theme}-${width}-workout.png`, output).pathname.slice(1), fullPage: true })
    await page.locator('.exercise-muscle-static svg').waitFor()
    await inspect(page, `${theme}-${width}-static`)
    await page.screenshot({ path: new URL(`${theme}-${width}-static.png`, output).pathname.slice(1), fullPage: true })
    await context.close()
  }
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width:390, height:844 }, reducedMotion:'reduce', serviceWorkers:'block' })
    const page = await context.newPage()
    const state = stateFixture()
    state.theme = theme
    state.planMode = 'daily'
    await seed(page, { state })
    await page.goto('http://127.0.0.1:8087/#/plan')
    await page.locator('.daily-plan-icon svg').waitFor()
    await inspect(page, `${theme}-390-daily-plan`)
    await page.goto('http://127.0.0.1:8087/#/workout')
    await page.locator('.lrow-i .plan-routine-body-thumb svg').first().waitFor()
    await inspect(page, `${theme}-390-chooser`)
    await context.close()
  }
  await writeFile(new URL('computed-styles.json', output), JSON.stringify(report, null, 2))
  const summary = report.map(({screen,overflow,nodes}) => ({
    screen, overflow, count:nodes.length,
    framedSilhouettes:nodes.filter(node => /thumb|muscle-static|daily-plan-icon|exmedia/.test(node.class) && (node.background !== 'rgba(0, 0, 0, 0)' || node.shadow !== 'none' || node.borderLeft !== '0px' || node.borderRadius !== '0px')),
    stripedRows:nodes.filter(node => /workout-last-values|setrow|set-execution-hint|in-ss/.test(node.class) && (node.shadow !== 'none' || node.borderLeft !== '0px')),
  }))
  console.log(JSON.stringify(summary, null, 2))
} finally {
  await browser.close()
}

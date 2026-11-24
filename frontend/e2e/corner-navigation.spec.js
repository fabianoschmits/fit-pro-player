import { test, expect } from '@playwright/test'
import { seed, stateFixture, openMainNavigation } from './fixtures.test.js'
const bar = page => page.locator('#tabbar')
const main = page => page.locator('.corner-nav-main')
const more = page => page.locator('.corner-nav-more-trigger')
async function load(page, width=390, {theme='dark',position=null,reducedMotion='reduce',active=null}={}) {
  await page.setViewportSize({width,height:800});await page.emulateMedia({reducedMotion})
  const state=stateFixture();state.theme=theme;state.active=active
  await seed(page,{state})
  await page.addInitScript(position=>{if(sessionStorage.getItem('layout-seeded'))return;sessionStorage.setItem('layout-seeded','1');localStorage.setItem('fpp_navigation_layout_v1',JSON.stringify({open:false,position}))},position)
  await page.goto('/#/home',{waitUntil:'domcontentloaded'});await openMainNavigation(page)
  await expect(more(page)).not.toHaveAttribute('inert')
}
async function fits(page,locator) {
  const r=await locator.boundingBox(),size=page.viewportSize();expect(r).not.toBeNull()
  expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.y).toBeGreaterThanOrEqual(-1)
  expect(r.x+r.width).toBeLessThanOrEqual(size.width+1);expect(r.y+r.height).toBeLessThanOrEqual(size.height+1)
}
async function closed(page) {
  await expect(more(page)).toHaveAttribute('aria-expanded','false')
  await expect(page.locator('.corner-nav-more')).toHaveAttribute('aria-hidden','true')
  expect(await page.locator('.corner-nav-more').evaluate(el=>el.inert)).toBe(true)
}
async function drag(page,dx,dy) {
  const r=await more(page).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down()
  await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:8});await page.mouse.up()
}
async function settle(page) {
  await expect.poll(()=>bar(page).evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'))).toBe(false)
}
for(const width of [320,390,600,768,1024,1280])for(const theme of ['dark','light'])test(`always-open ${width}px navigation keeps geometry, safe area and icons accessible in ${theme}`,async({page},info)=>{
  await load(page,width,{theme});if(width<768)await page.addStyleTag({content:':root{--sab:24px}'})
  await expect(bar(page)).toHaveClass(/is-open/);await expect(main(page)).not.toHaveAttribute('inert')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fpp_navigation_layout_v1')))).toEqual({open:true,position:null})
  await fits(page,main(page));const tabs=main(page).locator('.corner-nav-tab')
  for(const tab of await tabs.all()){
    if(width<768)for(const content of await tab.locator('.dock-slot-layer--current > span').all())expect((await content.boundingBox()).y+(await content.boundingBox()).height).toBeLessThanOrEqual(776)
    const glyph=tab.locator('.dock-slot-layer--current svg')
    await expect(glyph).toHaveAttribute('viewBox','0 0 24 24')
    expect(await glyph.evaluate(el=>getComputedStyle(el).stroke===getComputedStyle(el).color)).toBe(true)
    await fits(page,tab);const r=await tab.boundingBox();expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44)
    expect(await tab.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const centers=await tabs.evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect();return r.y+r.height/2}))
  expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(2)
  expect((await bar(page).boundingBox()).y).toBeGreaterThan(600)
  if(width===320||width===1280)await page.screenshot({path:info.outputPath('navigation-'+width+'-'+theme+'.png'),fullPage:true})
  await page.locator('[data-tab-key="plan"]').click();await expect(page).toHaveURL(/#\/plan$/)
  await expect(page.locator('[data-tab-key="plan"]')).toHaveAttribute('aria-current','page')
  await page.locator('.created-workouts').scrollIntoViewIfNeeded();await expect(page.locator('.created-workouts')).toBeVisible()
})
test('More uses keyboard focus, Escape restoration and an inert closed panel',async({page})=>{
  await load(page);await closed(page);await more(page).focus();await page.keyboard.press('Enter')
  await expect(more(page)).toHaveAttribute('aria-expanded','true');await fits(page,page.locator('.corner-nav-more'))
  await expect(page.getByRole('menuitem').first()).toBeFocused();await page.keyboard.press('Escape');await closed(page);await expect(more(page)).toBeFocused()
  await page.keyboard.press('Tab');await expect(page.locator('[data-tab-key="home"]')).toBeFocused()
})
test('movement arms explicitly, ignores jitter, persists position and reattaches after reload',async({page})=>{
  await load(page);await more(page).click();await page.getByRole('menuitem',{name:/Mover menu livremente/}).click()
  await expect(bar(page)).toHaveClass(/is-move-ready/);await expect(more(page)).toBeFocused()
  await drag(page,2,-1);await expect(bar(page)).not.toHaveClass(/is-free/)
  await page.keyboard.press('Escape');await closed(page)
  await drag(page,70,-220);await expect(bar(page)).toHaveClass(/is-free/);await closed(page);await fits(page,main(page))
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fpp_navigation_layout_v1')));expect(saved.position.y).toBeLessThan(650)
  await page.reload({waitUntil:'domcontentloaded'});await openMainNavigation(page);await expect(bar(page)).toHaveClass(/is-free/);await closed(page)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fpp_navigation_layout_v1')))).toEqual(saved)
  await more(page).click();await page.getByRole('menuitem',{name:/Prender menu ao rodapé/}).click();await expect(bar(page)).not.toHaveClass(/is-free/)
  await page.reload({waitUntil:'domcontentloaded'});await openMainNavigation(page)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fpp_navigation_layout_v1')).position)).toBeNull()
})
for(const position of [{x:0,y:160},{x:360,y:200},{x:9000,y:9000}])test(`restored position ${position.x},${position.y} keeps More reachable after resizing`,async({page})=>{
  await load(page,390,{position});await fits(page,main(page));await more(page).click();await fits(page,page.locator('.corner-nav-more'))
  await page.keyboard.press('Escape');await page.setViewportSize({width:320,height:640});await fits(page,main(page));await more(page).click();await fits(page,page.locator('.corner-nav-more'))
})
test('context follows Home, Plan, Exercises, History and Progress without remounting navigation',async({page})=>{
  await load(page);await bar(page).evaluate(el=>{el.dataset.identity='persistent'})
  await page.locator('[data-tab-key="plan"]').click();await page.locator('[data-tab-key="library"]').click();await expect(page).toHaveURL(/#\/library$/)
  await page.locator('[data-tab-key="history"]').click();await expect(page).toHaveURL(/#\/progress\/history$/)
  await expect(page.locator('[data-tab-key="progress"]')).toHaveAttribute('aria-current','page');await page.locator('[data-tab-key="progress"]').click()
  await expect(page).toHaveURL(/#\/progress$/);await expect(bar(page)).toHaveAttribute('data-identity','persistent')
})
test('Retomar preserves the active workout and the dumbbell/play artwork',async({page})=>{
  const active={id:'resume-fixture',name:'Treino ativo',d:'2026-11-24',start:1795521600000,cur:0,entries:[{id:'0025',sets:[{r:10,w:20,done:false}]}]}
  await load(page,390,{active});const button=page.locator('[data-tab-key="start"]');await expect(button).toContainText('Retomar')
  await expect(button.locator('.nav-icon__dumbbell')).toHaveCount(1);await expect(button.locator('.nav-icon__play')).toHaveCount(1)
  await button.click();await expect(page).toHaveURL(/#\/workout$/);await expect(page.locator('.workout-session-title strong')).toHaveText('Treino ativo')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.id)).toBe(active.id)
})
for(const reducedMotion of ['reduce','no-preference'])test(`context and pointer icon animations settle without blocking with motion ${reducedMotion}`,async({page})=>{
  await load(page,390,{reducedMotion});await page.locator('[data-tab-key="progress"]').click();await expect(page).toHaveURL(/#\/progress$/);await settle(page)
  await page.locator('[data-tab-key="home"]').click();await expect(page).toHaveURL(/#\/home$/);await settle(page)
  for(const icon of await main(page).locator('svg.nav-icon').all()){expect(await icon.getAttribute('viewBox')).toBe('0 0 24 24');expect(await icon.evaluate(el=>getComputedStyle(el).stroke)).not.toBe('none')}
  const home=page.locator('[data-tab-key="home"]')
  await home.evaluate(el=>{
    el.dataset.animationStarts='0';el.dataset.animationTimings='[]'
    el.addEventListener('animationstart',event=>{
      if(!event.target.closest('.nav-icon'))return
      el.dataset.animationStarts=String(Number(el.dataset.animationStarts)+1)
      const timings=event.target.getAnimations().filter(a=>a.animationName===event.animationName).map(a=>({duration:a.effect.getTiming().duration,iterations:a.effect.getTiming().iterations}))
      el.dataset.animationTimings=JSON.stringify([...JSON.parse(el.dataset.animationTimings),...timings])
    })
  })
  await home.click()
  if(reducedMotion==='no-preference'){
    await expect.poll(async()=>Number(await home.getAttribute('data-animation-starts'))).toBeGreaterThan(0)
    const timings=JSON.parse(await home.getAttribute('data-animation-timings'))
    expect(timings.length).toBeGreaterThan(0)
    expect(timings.every(item=>Number.isFinite(item.duration)&&item.duration>0&&item.duration<=500&&item.iterations===1)).toBe(true)
  }else{
    expect(await home.getAttribute('data-animation-starts')).toBe('0')
    await expect(home.locator('.nav-icon__house')).toBeVisible()
    expect(await main(page).locator('.nav-icon__motion').evaluateAll(items=>items.every(el=>Number(getComputedStyle(el).opacity)>0))).toBe(true)
  }
  await settle(page);await openMainNavigation(page)
})

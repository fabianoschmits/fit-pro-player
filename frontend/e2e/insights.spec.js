import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'
const empty = { insufficient:true,rows:[],updated_at:'2026-11-08T12:00:00Z' }
test('Insights access, filters and independent empty sections fit mobile and desktop', async ({page},testInfo) => {
 await page.emulateMedia({reducedMotion:'reduce'})
 await seed(page,{authenticated:true,roles:['admin'],rpc:{ops_insights_workout_engagement:empty,ops_insights:args=> args.p_section==='workouts' ? {started:0,updated_at:empty.updated_at} : empty}})
 await page.setViewportSize({width:testInfo.project.name.includes('mobile')?320:1440,height:900})
 await page.goto('/#/console/insights')
 await expect(page.getByRole('heading',{name:'FPP Insights',exact:true})).toBeVisible()
 await expect(page.getByText('Dados insuficientes').first()).toBeVisible()
 await page.getByRole('button',{name:'30 dias',exact:true}).click()
 await expect(page).toHaveURL(/period=30/)
 await page.getByLabel('Plataforma',{exact:true}).selectOption('pwa')
 await expect(page).toHaveURL(/platform=pwa/)
 await page.getByRole('navigation',{name:'Seções do FPP Insights'}).getByRole('button',{name:'Treinos',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Inteligência de treinos'})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:testInfo.outputPath('insights-empty.png'),fullPage:true})
 await page.getByRole('navigation',{name:'Seções do FPP Insights'}).getByRole('button',{name:'Retenção',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Ativação e recorrência de treinos'})).toBeVisible()
})
test('ordinary users cannot query the Insights dashboard',async({page})=>{
 let requests=0
 await seed(page,{authenticated:true,roles:[],rpc:{ops_insights:()=>{requests++;return empty}}})
 await page.goto('/#/console/insights')
 await expect(page.getByText('Esta área está disponível apenas para a equipe autorizada.')).toBeVisible()
 expect(requests).toBe(0)
})
test('real aggregate contract renders proportional bars and persists alert actions',async({page},testInfo)=>{
 let alertState='open'
 const alert={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Falhas recorrentes: salvar plano',description:'Sinais observados; investigar a causa.',affected_users:18,occurrences:36,platform:'pwa',app_version:'1.2.9',first_seen:'2026-11-07T12:00:00Z',last_seen:'2026-11-08T12:00:00Z'}
 await seed(page,{authenticated:true,roles:['admin'],rpc:{
  ops_insights_refresh_alerts:null,
  ops_insights_alert_state:args=>{alertState=args.p_state;return null},
  ops_insights:args=>({updated_at:empty.updated_at,sample:50,...(args.p_section==='overview'?{active_users:50,sessions:70,affected_users:18,technical_errors:4,response_ms:300,workout_completion_rate:80,retention:40,previous:{active_users:40}}:args.p_section==='friction'?{rows:[{label:'Criação de planos',count:36,users:18,rate:36,platform:'pwa',app_version:'1.2.9'}]}:args.p_section==='alerts'?{rows:[{...alert,state:alertState}]}:args.p_section==='funnels'?{rows:[{flow:'onboarding',steps:[{label:'personal',count:50},{label:'avatar',count:40},{label:'body',count:30}]}]}:{rows:[],trend:[]} )}),
 }})
 await page.setViewportSize({width:testInfo.project.name.includes('mobile')?390:1440,height:900})
 await page.goto('/#/console/insights')
 await expect(page.locator('.fi-kpi')).toHaveCount(8)
 const bar=page.locator('.fi-bar').first()
 await expect(bar.locator('summary strong')).toHaveText('36%')
 await expect(bar.locator('.fi-track i')).toHaveAttribute('style',/width: 36%/)
 await bar.locator('summary').click()
 await expect(bar).toContainText('36 ocorrências')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:testInfo.outputPath('insights-populated.png'),fullPage:true})
 await page.getByRole('link',{name:'Precisa de atenção',exact:true}).click()
 await page.locator('.fi-alert summary').click()
 await page.getByRole('button',{name:'Resolver',exact:true}).click()
 await expect(page.locator('.fi-alert summary')).toContainText('Resolvido')
})

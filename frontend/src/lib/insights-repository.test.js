import { describe, expect, it, vi } from 'vitest'
import { createInsightsRepository, resolveInsightsFilters } from './insights-repository.js'
import { insightsFilters } from '../features/console/insights/InsightsFilters.jsx'
describe('Insights query contract',()=>{
 it('advances rolling cutoffs on refresh while preserving custom dates',()=>{
  const template={period:'7',from:'2026-10-01T00:00:00Z',to:'2026-10-08T00:00:00Z'}
  const resolved=resolveInsightsFilters(template,new Date('2026-11-08T15:00:00Z'))
  expect(resolved.to).toBe('2026-11-08T15:00:00.000Z')
  expect(resolved.from).toBe('2026-11-01T15:00:00.000Z')
  const custom={...template,period:'custom'}
  expect(resolveInsightsFilters(custom)).toBe(custom)
 })
 it('normalizes period, platform, version and bounded pagination',()=>{
  const f=insightsFilters(new URLSearchParams('period=30&platform=pwa&device=ios&version=1.2.9&offset=999999'),new Date('2026-11-08T15:00:00Z'))
  expect(f.platform).toBe('pwa');expect(f.device).toBe('ios');expect(f.offset).toBe(10000)
  expect((Date.parse(f.to)-Date.parse(f.from))/86400000).toBe(30)
  expect(insightsFilters(new URLSearchParams('platform=invalid&version=bad%20value')).platform).toBe('')
 })
 it('keeps timezone boundaries and rejects inverted custom dates',()=>{
  const f=insightsFilters(new URLSearchParams('period=1'),new Date('2026-11-08T15:00:00Z'))
  expect(f.from).toBe('2026-11-08T03:00:00.000Z')
  const invalid=insightsFilters(new URLSearchParams('period=custom&from=2026-11-08&to=2026-10-01'),new Date('2026-11-08T15:00:00Z'))
  expect(Date.parse(invalid.to)).toBeGreaterThan(Date.parse(invalid.from))
 })
 it('passes cancellation, caches briefly and invalidates on alert mutation',async()=>{
  const abortSignal=vi.fn().mockResolvedValue({data:{rows:[]},error:null})
  const rpc=vi.fn((name)=>name==='ops_insights_alert_state'?Promise.resolve({error:null}):{abortSignal})
  const repo=createInsightsRepository({rpc}), signal=new AbortController().signal
  await repo.getInsightsOverview({platform:'pwa'},{signal})
  await repo.getInsightsOverview({platform:'pwa'},{signal})
  expect(rpc).toHaveBeenCalledTimes(1);expect(abortSignal).toHaveBeenCalledWith(signal)
  await repo.setAlertState('id','resolved');await repo.getInsightsOverview({platform:'pwa'},{signal})
  expect(rpc).toHaveBeenCalledTimes(3)
 })
})

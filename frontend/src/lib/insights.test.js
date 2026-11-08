import { describe, expect, it } from 'vitest'
import { normalizeInsight } from './insights-events.js'
import { createInsightsCollector } from './insights-collector.js'
import { classifyFriction } from './insights-detector.js'
import { funnelRates, retentionRate } from './insights-metrics.js'

describe('Insights privacy and correctness', () => {
  it('rejects unknown events and strips sensitive properties and routes', () => {
    expect(normalizeInsight('unknown', {})).toBeNull()
    const event = normalizeInsight('action_failed', { route: '/invite/secret?token=x', message: 'private', weight: 90, action: 'save' })
    expect(event.route).toBe('/other')
    expect(event).not.toHaveProperty('message')
    expect(event).not.toHaveProperty('weight')
  })
  it('does not collect without consent, discards on revocation and isolates accounts', async () => {
    let consent = false
    const sent = []
    const c = createInsightsCollector({ permitted: () => consent, send: async events => sent.push(events), online: () => true })
    c.setAccount('a'); c.track('screen_viewed', { event_id: 'one' }); expect(c.size()).toBe(0)
    consent = true; c.track('screen_viewed', { event_id: 'one' }); c.track('screen_viewed', { event_id: 'one' }); expect(c.size()).toBe(2)
    consent = false; await c.flush(); expect(c.size()).toBe(0); expect(sent).toHaveLength(0)
    consent = true; c.track('screen_viewed'); c.setAccount('b'); expect(c.size()).toBe(0)
  })
  it('retains a bounded queue offline and silently retries transport errors', async () => {
    let online = false, fail = true
    const c = createInsightsCollector({ permitted: () => true, online: () => online, send: async () => { if (fail) throw Error('offline') } })
    c.setAccount('a'); for (let i = 0; i < 150; i++) c.track('action_failed')
    expect(c.size()).toBe(100); await c.flush(); expect(c.size()).toBe(100)
    online = true; await expect(c.flush()).resolves.toBeUndefined(); expect(c.size()).toBe(100)
    fail = false; await c.flush(); expect(c.size()).toBe(75)
  })
  it('classifies retries without treating offline work as definitive failure', () => {
    expect(classifyFriction({ failures: 3, windowMs: 60000 })).toBe('medium')
    expect(classifyFriction({ exhausted: true })).toBe('high')
    expect(classifyFriction({ exhausted: true, queuedOffline: true })).toBeNull()
    expect(classifyFriction({ abandoned: true })).toBeNull()
  })
  it('uses eligible denominators and clamps funnel percentages', () => {
    expect(funnelRates([10, 12, 4]).map(x => x.rate)).toEqual([100, 100, 40])
    expect(retentionRate(2, 0)).toBeNull(); expect(retentionRate(2, 10)).toBe(20)
    expect(funnelRates([])).toEqual([])
  })
})

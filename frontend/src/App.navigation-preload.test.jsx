// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { preloadCoreRoutes } from './App.jsx'

it('preloads the current navigation routes without calling the removed More page loader', async () => {
  const results = await preloadCoreRoutes()
  expect(results.length).toBeGreaterThan(0)
  expect(results.filter(result => result.status === 'rejected')).toEqual([])
})

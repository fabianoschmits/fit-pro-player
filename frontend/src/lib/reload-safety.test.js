import { expect, it } from 'vitest'
import { canReloadForUpdate } from './reload-safety.js'
it('defers application reload during an unfinished workout',()=>{
  expect(canReloadForUpdate({active:{id:'session'}})).toBe(false)
  expect(canReloadForUpdate({active:null})).toBe(true)
})

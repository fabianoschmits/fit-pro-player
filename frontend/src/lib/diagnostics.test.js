import { beforeEach, expect, it } from 'vitest'
import { recordDiagnostic, readDiagnostics } from './diagnostics.js'
const values = new Map(), storage = { getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value) }
beforeEach(()=>values.clear())
it('never persists arbitrary strings, account data, messages or tokens',()=>{
  recordDiagnostic('runtime-error',{message:'secret@example.com',token:'private',duration:15,url:'https://private.example'},storage)
  const report=readDiagnostics(storage)
  expect(JSON.stringify(report)).not.toMatch(/secret|private|example/)
  expect(report[0].duration).toBe(15)
})
it('bounds diagnostic retention and tolerates unavailable storage',()=>{
  for(let i=0;i<75;i++)recordDiagnostic('navigation',{duration:i},storage)
  expect(readDiagnostics(storage)).toHaveLength(50)
  expect(()=>recordDiagnostic('runtime-error',{}, {getItem(){throw Error()},setItem(){throw Error()}})).not.toThrow()
})

import { expect, it } from 'vitest'
import { mergeChanges } from './three-way-merge.js'
it('merges independent routines by stable id', () => {
 const base = {routines:[{id:'a',name:'A'},{id:'b',name:'B'}]}
 expect(mergeChanges(base,{routines:[{id:'a',name:'AA'},{id:'b',name:'B'}]},{routines:[{id:'a',name:'A'},{id:'b',name:'BB'}]})).toEqual({routines:[{id:'a',name:'AA'},{id:'b',name:'BB'}]})
})
it('rejects incompatible edits and delete versus edit', () => {
 expect(() => mergeChanges({x:1},{x:2},{x:3})).toThrow('sync-conflict')
 expect(() => mergeChanges([{id:'a',x:1}],[],[{id:'a',x:2}])).toThrow('sync-conflict')
})
it('merges per field, preserves remote additions and treats unkeyed arrays atomically', () => {
 expect(mergeChanges({a:1,b:1},{a:2,b:1},{a:1,b:2,c:3})).toEqual({a:2,b:2,c:3})
 expect(() => mergeChanges([1],[2],[3])).toThrow('sync-conflict')
})

it('preserves reordering combined with deletion and an independent remote edit',()=>{
 const base=[{id:'a',name:'A'},{id:'b'},{id:'c'}]
 expect(mergeChanges(base,[base[1],base[0]],[{id:'a',name:'Changed'},base[1],base[2]])).toEqual([{id:'b'},{id:'a',name:'Changed'}])
})

it('preserves insertion anchors during a remote field edit',()=>{
 const base=[{id:'a',name:'A'},{id:'b'}]
 expect(mergeChanges(base,[base[0],{id:'c'},base[1]],[{id:'a',name:'Changed'},base[1]])).toEqual([{id:'a',name:'Changed'},{id:'c'},{id:'b'}])
})

import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPrecacheManifest, injectServiceWorker } from '../scripts/precache-manifest.mjs'

const roots = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fpp-precache-')); roots.push(root)
  mkdirSync(join(root, 'dist/assets'), {recursive:true}); mkdirSync(join(root, 'dist/icons'), {recursive:true}); mkdirSync(join(root,'public'))
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, {recursive:true,force:true}) })

it('keeps the shell and excludes private photos, optional languages, exercise media and avatars', () => {
  const root=fixture(), dist=join(root,'dist')
  const included=['index.html','manifest.json','favicon.ico','apple-touch-icon.png','icons/app.svg','assets/index-ab.js','assets/index.css','assets/bg.webp']
  const excluded=['sw.js','assets/ProgressPhotoGallery-x.js','assets/progress-photo-pose-x.js','assets/frames-0025.js','assets/frame-0025.webp','assets/avatar-01.webp','assets/hi-x.js','assets/ru-x.js','debug.txt']
  for (const file of [...included,...excluded]) writeFileSync(join(dist,file), 'fixture')
  const result=buildPrecacheManifest(dist)
  expect(result.manifest.map(entry=>entry.url).sort()).toEqual(included.sort())
  expect(result.manifest.every(entry=>/^[a-f0-9]{32}$/.test(entry.revision))).toBe(true)
  writeFileSync(join(dist,'assets/index-ab.js'),'changed')
  expect(buildPrecacheManifest(dist).manifest.find(entry=>entry.url==='assets/index-ab.js').revision).not.toBe(result.manifest.find(entry=>entry.url==='assets/index-ab.js').revision)
})

it('skips oversized files and injects a deterministic cache identity and exercise catalogue', () => {
  const root=fixture(), dist=join(root,'dist')
  writeFileSync(join(dist,'index.html'),'shell'); writeFileSync(join(dist,'assets/big.js'),Buffer.alloc(5*1024*1024+1))
  writeFileSync(join(dist,'assets/frames-0025.js'),'sprite')
  writeFileSync(join(root,'public/sw.js'),'const shell=self.__WB_MANIFEST; const cache="__BUILD_ID__"; const exercises=/* exercise-catalogue */ [];')
  const result=injectServiceWorker(root)
  expect(result.count).toBe(1)
  const first=readFileSync(join(dist,'sw.js'),'utf8')
  expect(first).toContain('/assets/frames-0025.js')
  expect(first).not.toMatch(/__BUILD_ID__|self\.__WB_MANIFEST|big\.js/)
  injectServiceWorker(root)
  expect(readFileSync(join(dist,'sw.js'),'utf8')).toBe(first)
})

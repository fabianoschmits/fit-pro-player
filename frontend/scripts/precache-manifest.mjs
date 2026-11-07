import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const shellFile = name => /^(?:index\.html|manifest\.json|favicon[^/]*\.(?:ico|png)|apple-touch-icon[^/]*\.png)$/.test(name)
  || /^icons\/.+\.(?:png|ico|svg)$/.test(name)
  || /^assets\/[^/]+\.(?:js|css|png|webp)$/.test(name)
const optionalFile = name => /^assets\/(?:ProgressPhoto|progress-photo|frames-|hi-|zh-|ko-|ru-|ar-)[^/]*\.js$/.test(name)
  || /^assets\/(?:frame-[^/]*\.(?:webp|png)|avatar-[^/]*\.webp)$/.test(name)

export function buildPrecacheManifest(dist) {
  const manifest=[]
  let size=0
  for (const name of readdirSync(dist, {recursive:true}).map(name=>name.replaceAll('\\','/')).sort()) {
    if (!shellFile(name) || optionalFile(name)) continue
    const file=join(dist,name), info=statSync(file)
    if (!info.isFile() || info.size>5*1024*1024) continue
    manifest.push({url:name,revision:createHash('md5').update(readFileSync(file)).digest('hex')})
    size+=info.size
  }
  return {manifest,count:manifest.length,size}
}

export function injectServiceWorker(root) {
  const dist=join(root,'dist'), result=buildPrecacheManifest(dist)
  let sw=readFileSync(join(root,'public/sw.js'),'utf8')
  if (sw.split('self.__WB_MANIFEST').length!==2) throw new Error('Expected one service worker manifest injection point')
  sw=sw.replace('self.__WB_MANIFEST',JSON.stringify(result.manifest))
  const catalogue=readdirSync(join(dist,'assets')).filter(name=>/^(frame-.*\.(webp|png)|frames-.*\.js)$/.test(name)).sort().map(name=>'/assets/'+name)
  const buildId=createHash('sha256').update(sw).digest('hex').slice(0,16)
  sw=sw.replace('__BUILD_ID__',buildId).replace('/* exercise-catalogue */ []',JSON.stringify(catalogue))
  if (sw.includes('self.__WB_MANIFEST') || sw.includes('__BUILD_ID__')) throw new Error('Uninjected service worker')
  writeFileSync(join(dist,'sw.js'),sw)
  return result
}

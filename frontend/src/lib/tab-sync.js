// Only revision metadata crosses account-scoped tab channels.
export function createTabSync({accountId,refresh,getRevision,channelFactory=undefined}) {
 if (!channelFactory && typeof BroadcastChannel === 'undefined') return {publish(){},dispose(){}}
 const channel = (channelFactory || (name=>new BroadcastChannel(name)))(`fpp-domain-sync:${accountId}`)
 const seen = new Map(), pending = new Map()
 let disposed=false
 channel.onmessage = event => {
  const {domain,revision} = event.data || {}
  if (!['plan','preferences'].includes(domain) || !Number.isSafeInteger(revision) || revision<1
   || revision<=Math.max(getRevision(domain),seen.get(domain)||0)) return
  seen.set(domain,revision)
  if (pending.has(domain)) return
  const task=Promise.resolve().then(async()=>{
   // Each additional read requires a genuinely newer commit received during a read.
   let requested
   do {
    requested=seen.get(domain)
    await refresh(domain)
   } while(!disposed && seen.get(domain)>requested && seen.get(domain)>getRevision(domain))
  }).catch(()=>{}).finally(()=>pending.delete(domain))
  pending.set(domain,task)
 }
 return {publish:(domain,revision)=>channel.postMessage({domain,revision}),dispose:()=>{disposed=true;channel.onmessage=null;channel.close()}}
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function conflict(path) {
 const error = new Error('sync-conflict')
 return Object.assign(error, { kind: 'sync-conflict', retryable: false, path })
}
/** Three-way merge. Deletions are represented by undefined; unkeyed arrays are atomic. */
export function mergeChanges(base, local, remote, path = '') {
 if (same(local, remote)) return local
 if (same(local, base)) return remote
 if (same(remote, base)) return local
 if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
  const keyed = rows => rows.every(row => object(row) && typeof row.id === 'string') && new Set(rows.map(row => row.id)).size === rows.length
  if (![base, local, remote].every(keyed)) throw conflict(path)
  const ids = [...new Set([...remote, ...local].map(row => row.id))]
  const byId = rows => new Map(rows.map(row => [row.id, row]))
  const [b,l,r] = [base,local,remote].map(byId)
  // Concurrent reordering is incompatible; retain the ordering changed by either side.
  const order = rows => rows.filter(row => b.has(row.id)).map(row => row.id)
  const bo = base.map(row => row.id), lo = order(local), ro = order(remote)
  const reordered = order => !same(order, bo.filter(id => order.includes(id)))
  if (reordered(lo) && reordered(ro) && !same(lo, ro)) throw conflict(path)
  const rows=ids.map(id => mergeChanges(b.get(id),l.get(id),r.get(id),`${path}/${id}`)).filter(row => row !== undefined)
  const surviving=new Set(rows.map(row=>row.id)), edges=new Map(rows.map(row=>[row.id,new Set()]))
  const addEdges=(order,includeBase)=>{
   const kept=order.filter(id=>surviving.has(id))
   for(let i=1;i<kept.length;i++) if(includeBase || !b.has(kept[i-1]) || !b.has(kept[i])) edges.get(kept[i-1]).add(kept[i])
  }
  const preferred=reordered(lo)?local:remote
  addEdges(preferred.map(row=>row.id),true)
  addEdges(local.map(row=>row.id),reordered(lo))
  addEdges(remote.map(row=>row.id),reordered(ro))
  const ranked=[...preferred.map(row=>row.id),...ids].filter((id,index,all)=>surviving.has(id)&&all.indexOf(id)===index)
  const sorted=[]
  while(sorted.length<rows.length){
   const next=ranked.find(id=>!sorted.includes(id)&&![...edges].some(([from,to])=>!sorted.includes(from)&&to.has(id)))
   if(next===undefined)throw conflict(path)
   sorted.push(next)
  }
  const mergedById=byId(rows)
  return sorted.map(id=>mergedById.get(id))
 }
 if (object(base) && object(local) && object(remote)) {
  return Object.fromEntries([...new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])]
   .map(key => [key,mergeChanges(base[key],local[key],remote[key],`${path}/${key}`)])
   .filter(([,value]) => value !== undefined))
 }
 throw conflict(path)
}

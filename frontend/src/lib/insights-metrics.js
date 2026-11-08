export function retentionRate(returned, eligible) { return eligible > 0 ? Math.min(100, Math.max(0, returned / eligible * 100)) : null }
export function funnelRates(counts) {
  let previous = Math.max(0, counts[0] || 0)
  return counts.map(count => {
    const value = Math.min(previous, Math.max(0, count)), rate = retentionRate(value, counts[0])
    const loss = previous - value; previous = value
    return { count: value, rate, loss }
  })
}

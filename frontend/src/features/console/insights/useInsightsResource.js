import { useCallback, useEffect, useRef, useState } from 'react'
export default function useInsightsResource(repo, method, filters, enabled = true, targetId = null) {
  const [state, setState] = useState({ identity: '', data: null, error: '', busy: true })
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify(filters)
  const current = useRef('')
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController(), identity = method + key + targetId
    current.current = identity
    setState(previous => ({ identity, data: previous.identity === identity ? previous.data : null, error: '', busy: true }))
    const options = { signal: controller.signal, fresh: revision > 0 }
    const request = targetId ? repo[method](targetId, JSON.parse(key), options) : repo[method](JSON.parse(key), options)
    request.then(data => { if (!controller.signal.aborted) setState({ identity, data, error: '', busy: false }) }).catch(() => { if (!controller.signal.aborted) setState(previous => ({ ...previous, busy: false, error: navigator.onLine ? 'Não foi possível consultar este bloco.' : 'Sem conexão. Os dados não puderam ser atualizados.' })) })
    return () => { controller.abort(); current.current = '' }
  }, [repo, method, key, enabled, targetId, revision])
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 60000)
    return () => clearInterval(timer)
  }, [enabled, refresh])
  return { ...(state.identity === method + key + targetId ? state : {data:null,error:'',busy:true}), refresh }
}

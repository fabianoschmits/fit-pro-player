import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMessageRepository } from '../../lib/direct-messages.js'
import Icon from '../Icon.jsx'

export default function MessageButton({ client, userId }) {
  const navigate = useNavigate(), repo = useMemo(() => createMessageRepository(client), [client])
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    setCount(0)
    const refresh = async () => {
      if (!userId || document.visibilityState === 'hidden') return
      try { const next = await repo.unread(); if (active) setCount(Number(next) || 0) } catch { /* Next refresh retries. */ }
    }
    void refresh()
    const interval = setInterval(refresh, 10000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [repo, userId])
  return <button className="community-notifications community-message-button" aria-label={count ? `Mensagens: ${count} não lidas` : 'Mensagens'} onClick={() => navigate('/community/messages')}><Icon name="message" />{count > 0 && <span className="dm-badge">{count > 99 ? '99+' : count}</span>}</button>
}

import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

/** One-time tip banner — dismissed state lives in S.seenTips. */
export default function TipOnce({ id, children }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  if (S.seenTips?.[id]) return null
  return (
    <div className="tip-banner" role="note">
      <Icon name="info" className="tip-ico" />
      <div className="tip-body">{children}</div>
      <button className="tip-dismiss" onClick={() => update(s => { s.seenTips = { ...(s.seenTips || {}), [id]: true } })}>
        {t('Got it')}
      </button>
    </div>
  )
}

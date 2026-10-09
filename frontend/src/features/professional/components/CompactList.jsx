import { Children } from 'react'
import { t } from '../../../lib/i18n.js'
import Skeleton from './Skeleton.jsx'

export default function CompactList({ children, status = 'success', empty, onLoadMore, hasMore = false }) {
  const rows = Children.toArray(children)
  const busy = ['loading', 'refreshing', 'loading_more'].includes(status)
  if (status === 'loading' && !rows.length) return <Skeleton />
  return <div className="professional-list" aria-busy={busy}>
    {rows.length ? <ul className="professional-compact-list">{rows}</ul> : status === 'success' ? empty : null}
    {busy && <span className="sr-only" role="status">{t('Loading…')}</span>}
    {hasMore && onLoadMore && <button type="button" className="professional-load-more" disabled={busy} onClick={onLoadMore}>{t('Carregar mais')}</button>}
  </div>
}

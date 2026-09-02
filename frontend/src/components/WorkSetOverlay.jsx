import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

export default function WorkSetOverlay({ entryIdx, onStartNext }) {
  const work = useUI(s => s.work)
  const { finishWorkEarly, stopWork, skipWorkRest } = useUI()

  if (!work || work.entryIdx !== entryIdx) return null

  const isRest = work.phase === 'rest'
  const left = isRest ? work.restLeft : work.left
  const total = isRest ? work.restTotal : work.total
  const pct = total ? (left / total) * 100 : 0

  const startNext = () => {
    skipWorkRest()
    onStartNext?.()
  }

  return (
    <div className={'work-set-overlay' + (isRest ? ' is-rest' : '')}>
      <button type="button" className="work-set-overlay__backdrop" aria-label={t('Cancel')} onClick={stopWork} />
      <div className={'work-set-overlay__card' + (isRest ? ' is-rest' : '')}>
        {isRest ? (
          <>
            <div className="work-set-overlay__phase">{t('Rest now')}</div>
            <div className="work-set-overlay__time">{clock(left)}</div>
            {work.label && <div className="work-set-overlay__label">{work.label}</div>}
          </>
        ) : (
          <>
            <div className="work-set-overlay__time">{clock(left)}</div>
            {work.label && <div className="work-set-overlay__label">{work.label}</div>}
          </>
        )}
        <div className="work-set-overlay__bar" aria-hidden="true">
          <i style={{ '--progress': pct / 100 }} />
        </div>
        <div className="work-set-overlay__actions">
          {isRest ? (
            <>
              <Button variant="ghost" onClick={skipWorkRest}>{t('Skip')}</Button>
              <Button variant="primary" icon="play" onClick={startNext}>{t('Start set')}</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={stopWork}>{t('Cancel')}</Button>
              <Button variant="primary" icon="check" onClick={finishWorkEarly}>{t('Done')}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

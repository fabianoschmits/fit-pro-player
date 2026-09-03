import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

export default function WorkSetOverlay({ entryIdx, onStartNext }) {
  const work = useUI(s => s.work)
  const { finishWorkEarly, stopWork, skipWorkRest } = useUI()

  if (!work || work.entryIdx !== entryIdx) return null

  const phase = work.phase // 'work' | 'rest' | 'done'
  const isRest = phase === 'rest'
  const isDone = phase === 'done'
  const left = isRest ? work.restLeft : work.left
  const total = isRest ? work.restTotal : work.total
  const pct = total ? (left / total) * 100 : 0

  const handleStartNext = () => {
    // onNext is set by startTimed when there are more sets; it starts the next timed set
    if (work.onNext) {
      work.onNext()
    } else if (onStartNext) {
      skipWorkRest()
      onStartNext()
    }
  }

  // 'done' phase: set just finished, overlay stays open
  if (isDone) {
    const hasNext = !!work.onNext
    return (
      <div className="work-set-overlay is-done">
        <button type="button" className="work-set-overlay__backdrop" aria-label={t('Close')} onClick={stopWork} />
        <div className="work-set-overlay__card is-done">
          <div className="work-set-overlay__done-icon">
            <Icon name="check" />
          </div>
          <div className="work-set-overlay__done-title">
            {hasNext ? t('Set complete!') : t('Exercise done!')}
          </div>
          <div className="work-set-overlay__done-sub">
            {hasNext
              ? t('Rest up — start the next set when ready')
              : t('All sets completed. Great work!')}
          </div>
          <div className="work-set-overlay__actions">
            <Button variant="ghost" onClick={stopWork}>{t('Close')}</Button>
            {hasNext && (
              <Button variant="primary" icon="play" onClick={handleStartNext}>
                {t('Next set')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={'work-set-overlay' + (isRest ? ' is-rest' : '')}>
      <button type="button" className="work-set-overlay__backdrop" aria-label={t('Cancel')} onClick={stopWork} />
      <div className={'work-set-overlay__card' + (isRest ? ' is-rest' : '')}>
        {isRest ? (
          <>
            <div className="work-set-overlay__phase">
              <Icon name="moon" />
              {t('Rest now')}
            </div>
            <div className="work-set-overlay__time">{clock(left)}</div>
            {work.label && <div className="work-set-overlay__label">{work.label}</div>}
          </>
        ) : (
          <>
            <div className="work-set-overlay__phase">
              <Icon name="flame" />
              {t('Hold it!')}
            </div>
            <div className="work-set-overlay__time">{clock(left)}</div>
            {work.label && <div className="work-set-overlay__label">{work.label}</div>}
          </>
        )}
        <div className="work-set-overlay__bar" aria-hidden="true">
          <i style={{ '--progress': isRest ? 1 - pct / 100 : pct / 100 }} />
        </div>
        <div className="work-set-overlay__actions">
          {isRest ? (
            <>
              <Button variant="ghost" onClick={skipWorkRest}>{t('Skip rest')}</Button>
              <Button variant="primary" icon="play" onClick={handleStartNext}>{t('Next set')}</Button>
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

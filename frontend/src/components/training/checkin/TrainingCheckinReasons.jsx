import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { checkinReasonLabel } from '../../../lib/training-checkin.js'
export default function TrainingCheckinReasons({ reasons, selected, onToggle }) {
 const [expanded, setExpanded] = useState(false)
 return <fieldset className="training-checkin-reasons"><legend>{t('What motivated the changes?')}</legend><div className="training-checkin-options">{(expanded ? reasons : reasons.slice(0, 6)).map(reason => <button type="button" key={reason} aria-pressed={selected.includes(reason)} onClick={() => onToggle(reason)}>{t(checkinReasonLabel(reason))}</button>)}</div>
  {!expanded && <button type="button" className="training-checkin-text-action" onClick={() => setExpanded(true)}>{t('More reasons')}</button>}
 </fieldset>
}

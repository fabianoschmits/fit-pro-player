import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { t } from '../lib/i18n.js'
import { DAYN } from '../lib/format.js'
import { MOBILE } from '../lib/mobile.js'
import { normalizeNotificationPreferences } from '../lib/notification-preferences.js'
import { useNotificationStatus, enableBackgroundNotifications, disableBackgroundNotifications } from '../lib/notification-client.js'
import { Section, Row, SelectRow, Switch } from './ui.jsx'

export default function NotificationSettings({ S, update, toast }) {
  const auth = useAuth()
  const status = useNotificationStatus()
  const [changing, setChanging] = useState(false)
  const [actionError, setActionError] = useState(false)
  const preferences = normalizeNotificationPreferences(S.notifications, S.reminder)
  const signedIn = auth.status === 'authenticated' && !!auth.user?.id
  const busy = changing || status.busy
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const setPreference = (key, value) => update(state => { state.notifications = { ...normalizeNotificationPreferences(state.notifications, state.reminder), [key]: value } })
  const setQuiet = (key, value) => update(state => {
    const current = normalizeNotificationPreferences(state.notifications, state.reminder)
    state.notifications = { ...current, quietHours: { ...current.quietHours, [key]: value } }
  })
  const changeBackground = async () => {
    if (busy) return
    setChanging(true)
    setActionError(false)
    try {
      // Call immediately from the click so the browser permission request retains the user gesture.
      const result = await (status.enabled ? disableBackgroundNotifications() : enableBackgroundNotifications())
      if (!result) setActionError(true)
    } catch { setActionError(true); toast?.(t('Could not change notification settings. Try again.')) }
    finally { setChanging(false) }
  }
  let deliveryStatus = t('Not enabled on this device')
  if (!signedIn) deliveryStatus = t('Sign in to receive notifications with the app closed.')
  else if (status.native && !status.ready) deliveryStatus = t('Background notifications will be available after the Android service is configured.')
  else if (!status.supported) deliveryStatus = t('Background notifications are not supported on this device.')
  else if (status.ready === false) deliveryStatus = t('Background delivery is paused until the service is ready.')
  else if (status.permission === 'denied') deliveryStatus = t('Allow notifications in your device or browser settings, then try again.')
  else if (status.enabled) deliveryStatus = t('Enabled on this device')

  return <div className="notification-settings" role="group" aria-label={t('Notifications')}>
    <div role="group" aria-label={t('Local timer alerts')}>
      <Section title={t('Local timer alerts')} footer={MOBILE ? t('In the Android app, local timer alerts can arrive while minimized. Notification permission and system settings apply.') : t('Timer alerts require the browser to keep running. On iPhone, they may wait until you return to the app.')}>
        <Row icon="timer" iconTint="var(--orange)" title={t('Rest completed')}>
          <Switch ariaLabel={t('Rest completed')} checked={preferences.rest} onChange={value => setPreference('rest', value)} />
        </Row>
        <Row icon="clock" iconTint="var(--purple)" title={t('Timed set completed')}>
          <Switch ariaLabel={t('Timed set completed')} checked={preferences.timedSet} onChange={value => setPreference('timedSet', value)} />
        </Row>
      </Section>
    </div>
    <div role="group" aria-label={t('Background reminders and updates')}>
    <Section title={t('Background reminders and updates')} footer={t('Background delivery depends on your connection and device.')}>
      <div className="notification-delivery">
        <Row icon="bell" iconTint="var(--pink)" title={t('Background notifications')} subtitle={deliveryStatus} />
        {signedIn && status.supported && <button type="button" className="btn notification-device-action" disabled={busy || !status.enabled && (status.ready === false || status.permission === 'denied')} onClick={changeBackground}>
          {busy ? t('Updating…') : status.enabled ? t('Disable on this device') : t('Enable on this device')}
        </button>}
        {!status.supported && iPhone && <p className="notification-note">{t('On iPhone, add this app to the Home Screen in Safari and open it there to enable notifications.')}</p>}
        {(actionError || status.error) && <p className="notification-note notification-error" role="alert">{t('Could not change notification settings. Try again.')}</p>}
      </div>
      <Row icon="calendar" iconTint="var(--blue)" title={t('Planned workout reminder')} subtitle={t('Follows your calendar and skips rest days and workouts already started.')}>
        <Switch ariaLabel={t('Planned workout reminder')} checked={preferences.workoutReminder} onChange={value => setPreference('workoutReminder', value)} />
      </Row>
      {preferences.workoutReminder && <>
        <Row className="notification-time-row" icon="clock" iconTint="var(--purple)" title={t('Training time')}>
          <input type="time" className="timef" aria-label={t('Training time')} value={preferences.trainingTime} onChange={event => setPreference('trainingTime', event.target.value)} />
        </Row>
        <SelectRow icon="bell" iconTint="var(--pink)" title={t('Notify before training')} value={preferences.leadMinutes} onChange={value => setPreference('leadMinutes', value)}
          options={[0, 15, 30, 60, 120, 180, 360].map(value => ({ value, label: value === 0 ? t('At training time') : t('{0} minutes before', value) }))} />
      </>}
      <Row icon="scale" iconTint="var(--teal)" title={t('Weight reminder')}>
        <Switch ariaLabel={t('Weight reminder')} checked={preferences.weightReminder} onChange={value => setPreference('weightReminder', value)} />
      </Row>
      <Row icon="person" iconTint="var(--teal)" title={t('Body measurement reminder')}>
        <Switch ariaLabel={t('Body measurement reminder')} checked={preferences.measurementReminder} onChange={value => setPreference('measurementReminder', value)} />
      </Row>
      {(preferences.weightReminder || preferences.measurementReminder) && <>
        <SelectRow icon="calendar" iconTint="var(--blue)" title={t('Weekly check-in day')} value={preferences.checkinDay} onChange={value => setPreference('checkinDay', value)} options={DAYN.map((name, value) => ({ value, label: t(name) }))} />
        <Row className="notification-time-row" icon="clock" iconTint="var(--purple)" title={t('Weekly check-in time')} subtitle={t('Skips reminders when you have already recorded this week.')}>
          <input type="time" className="timef" aria-label={t('Weekly check-in time')} value={preferences.checkinTime} onChange={event => setPreference('checkinTime', event.target.value)} />
        </Row>
      </>}
      <Row icon="personCircle" iconTint="var(--purple)" title={t('Professional updates')} subtitle={t('Plans, connections, student workouts and verification updates.')}>
        <Switch ariaLabel={t('Professional updates')} checked={preferences.professional} onChange={value => setPreference('professional', value)} />
      </Row>
      <Row icon="moon" iconTint="var(--indigo)" title={t('Quiet hours')} subtitle={t('Reminders and professional updates are silent during these hours.')}>
        <Switch ariaLabel={t('Quiet hours')} checked={preferences.quietHours.enabled} onChange={value => setQuiet('enabled', value)} />
      </Row>
      {preferences.quietHours.enabled && <>
        <Row className="notification-time-row" title={t('Quiet hours start')}><input type="time" className="timef" aria-label={t('Quiet hours start')} value={preferences.quietHours.start} onChange={event => setQuiet('start', event.target.value)} /></Row>
        <Row className="notification-time-row" title={t('Quiet hours end')}><input type="time" className="timef" aria-label={t('Quiet hours end')} value={preferences.quietHours.end} onChange={event => setQuiet('end', event.target.value)} /></Row>
      </>}
    </Section>
    <p className="sect-f notification-privacy">{t('Lock-screen notifications never include body values, prescriptions or student names.')}</p>
    </div>
  </div>
}

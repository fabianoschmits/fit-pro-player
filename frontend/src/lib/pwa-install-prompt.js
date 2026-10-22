export const PWA_INSTALL_SNOOZE_MS = 7 * 86400000

export function normalizePwaInstallPrompt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.dismissForever === true) return { dismissForever: true }
  const snoozeUntil = Number(value.snoozeUntil)
  if (Number.isFinite(snoozeUntil) && snoozeUntil > 0) return { snoozeUntil }
  return null
}

export function shouldShowPwaInstallPrompt(state = {}, installer = {}, now = Date.now()) {
  if (!state.onboardingDone) return false
  if (installer.installed) return false
  const tip = normalizePwaInstallPrompt(state.pwaInstallPrompt)
  if (tip?.dismissForever) return false
  if (tip?.snoozeUntil && tip.snoozeUntil > now) return false
  return true
}

export function dismissPwaInstallForever() {
  return { dismissForever: true }
}

export function snoozePwaInstall(now = Date.now(), ms = PWA_INSTALL_SNOOZE_MS) {
  return { snoozeUntil: now + ms }
}

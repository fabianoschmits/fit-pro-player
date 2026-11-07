// Independent, dependency-free entry: a failed application module must not
// disable recovery. The existing assets/*.js precache includes this file.
// External script preserves CSP and location.reload preserves callback URLs.
function connectFppLaunchRecovery() {
  const reload = document.getElementById('fpp-launch-reload')
  if (!reload) return false
  reload.addEventListener('click', () => window.location.reload())
  reload.hidden = false
  document.getElementById('fpp-launch-manual-recovery')?.setAttribute('hidden', '')
  return true
}
// An async script can run before body parsing. DOMContentLoaded may be delayed
// by a stalled application module, so observe only until the button exists.
if (!connectFppLaunchRecovery()) {
  const observer = new MutationObserver(() => { if (connectFppLaunchRecovery()) observer.disconnect() })
  observer.observe(document, { childList: true, subtree: true })
}

// Browser-only shell of the i18n module. The runtime-agnostic state and readers live
// in i18n-core.js (plain Node-loadable); this file adds the two pieces that genuinely need
// the browser: `setLang` (which lazy-loads locale packs via import.meta.glob) and the React
// subscription hook `useLang`.

import { useSyncExternalStore } from 'react'
import {
  LANGS, DEFAULT_LANG, INSTR_LANGS, DATE_LOCALES,
  getLang, dateLocale, t, instrFor, getVersion, _setLangState
} from './i18n-core.js'

export { LANGS, DEFAULT_LANG, INSTR_LANGS, DATE_LOCALES, getLang, dateLocale, t, instrFor }

// pt-BR is already bundled by i18n-core so the default first paint never flashes English.
// Excluding it from this glob avoids a redundant dynamic-import edge and its build warning;
// every non-default locale and every instruction catalogue remains lazy-loaded.
const localePacks = import.meta.glob(['../locales/*.js', '!../locales/pt.js'])
const instrPacks = import.meta.glob('../instr/*.js')

// React subscription bookkeeping — kept here, not in core, so core has zero React coupling.
const subs = new Set()
const notify = () => { subs.forEach(f => f()) }

export async function setLang(l) {
  if (!LANGS[l]) l = DEFAULT_LANG
  if (l === getLang() && getVersion() > 0) return
  let dict = {}, instr = null
  try {
    dict = l === 'en' ? {} : l === DEFAULT_LANG ? null : (await localePacks['../locales/' + l + '.js']()).default
    instr = l === 'en' || !INSTR_LANGS.includes(l) ? null : (await instrPacks['../instr/' + l + '.js']()).default
  } catch (e) { dict = {}; instr = null }
  _setLangState(l, dict, instr)
  notify()
}

// Re-renders the subscribing component (and its children) whenever the language changes.
export function useLang() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, getVersion)
}

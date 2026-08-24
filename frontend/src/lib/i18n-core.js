// Runtime-agnostic core of the i18n module: state, constants and readers (t, dateLocale,
// instrFor, getLang). Plain Node-loadable — the browser-only pieces (import.meta.glob lazy
// loads, the React subscription hook) live in i18n.js and re-export from here.

import ptBR from '../locales/pt.js'

export const LANGS = {
  pt: 'Português (Brasil)', en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français', it: 'Italiano',
  pl: 'Polski', tr: 'Türkçe', ru: 'Русский', zh: '中文',
  ko: '한국어', hi: 'हिन्दी'
}
export const DEFAULT_LANG = 'pt'
export const INSTR_LANGS = ['pt', 'en', 'es', 'fr', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko']
export const DATE_LOCALES = {
  pt: 'pt-BR', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
  pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', zh: 'zh-CN', ko: 'ko-KR', hi: 'hi-IN'
}

let lang = DEFAULT_LANG         // set only by _setLangState, called from i18n.js setLang
let dict = ptBR                 // pt-BR is bundled so the first paint never flashes English
let instr = null                // { exId: [steps] } for the current language, null = English
let version = 0                 // bumped on every setLang; drives the React subscription selector

export const getLang = () => lang
export const dateLocale = () => DATE_LOCALES[lang] || DATE_LOCALES[DEFAULT_LANG]
export const getVersion = () => version

// Translate a source string; {0},{1}… are replaced with args (also on the English fallback).
export function t(s, ...args) {
  let v = dict[s] || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}

// Instructions for an exercise in the current language (English steps as fallback).
export const instrFor = ex => (instr && instr[ex.id]) || ex.st || []

// Called by i18n.js's setLang once the locale pack has been loaded — kept here rather than
// exported as setLang because loading packs requires import.meta.glob, which is Vite-only.
// Both `dict` and `instr` may be null to reset to English.
export function _setLangState(newLang, newDict, newInstr) {
  lang = LANGS[newLang] ? newLang : DEFAULT_LANG
  dict = lang === 'en' ? {} : (newDict || (lang === DEFAULT_LANG ? ptBR : {}))
  instr = lang === 'en' || !INSTR_LANGS.includes(lang) ? null : (newInstr || null)
  version++
  return version
}

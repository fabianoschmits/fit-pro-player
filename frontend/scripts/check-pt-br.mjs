#!/usr/bin/env node
// Regression guard for the Brazilian Portuguese default and the complete exercise catalogue.

import assert from 'node:assert/strict'
import pt from '../src/locales/pt.js'
import instructions from '../src/instr/pt.js'
import names from '../src/generated/pt-exercise-names.js'
import { EXDB } from '../src/lib/exercises-data.js'
import { DEFAULT_LANG, DATE_LOCALES, LANGS, getLang, t } from '../src/lib/i18n-core.js'

assert.equal(DEFAULT_LANG, 'pt')
assert.equal(getLang(), 'pt')
assert.equal(DATE_LOCALES.pt, 'pt-BR')
assert.equal(LANGS.pt, 'Português (Brasil)')
assert.equal(t('Settings'), 'Configurações')

const ids = new Set(EXDB.map(ex => ex.id))
assert.equal(ids.size, EXDB.length, 'Exercise ids must be unique')
assert.equal(Object.keys(names).length, EXDB.length, 'Every exercise needs a pt-BR name')
assert.equal(Object.keys(instructions).length, EXDB.length, 'Every exercise needs pt-BR instructions')

for (const ex of EXDB) {
  assert.equal(typeof names[ex.id], 'string', `Missing name for ${ex.id}`)
  assert.ok(names[ex.id].trim(), `Blank name for ${ex.id}`)
  assert.ok(Array.isArray(instructions[ex.id]) && instructions[ex.id].length, `Missing instructions for ${ex.id}`)
  assert.ok(instructions[ex.id].every(step => typeof step === 'string' && step.trim()), `Blank instruction for ${ex.id}`)
}

const validIdentities = new Set([
  'Cardio', 'Jan', 'Mar', 'Jun', 'Jul', 'Nov', 'Reps', 'Volume', 'cardio',
  'kettlebell', 'core', 'Greyskull LP', 'RIR', 'RPE',
])
const untranslated = Object.entries(pt)
  .filter(([key, value]) => key === value && !validIdentities.has(key))
  .map(([key]) => key)
assert.deepEqual(untranslated, [], `Untranslated pt-BR UI strings: ${untranslated.join(', ')}`)

const portugalOnly = /\b(telemóvel|ecrã|ficheiro|palavra-passe|definições|utilizador(?:es)?|eliminar|guardar|repor|registar|gémeos|abdómen|ergómetro|escadora|anca)\b|\w+-(?:te|vos)\b/i
const regional = Object.entries(pt).filter(([, value]) => portugalOnly.test(value))
assert.deepEqual(regional, [], `European Portuguese terms found: ${regional.map(([key]) => key).join(', ')}`)

console.log(`pt-BR complete: ${Object.keys(pt).length} UI strings and ${EXDB.length} localized exercises.`)

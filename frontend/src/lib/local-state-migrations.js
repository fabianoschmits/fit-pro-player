import { ensureBodyIds } from './body-sync-state.js'
import { STATE_SCHEMA_VERSION, MASS_UNIT } from './mass.js'
const migrations = {
 1: state => ({ ...state, displayUnit: state.displayUnit || state.unit || 'kg', massUnit: MASS_UNIT, stateSchemaVersion: 2 }),
}
export function migrateLocalState(source) {
 let state = source && typeof source === 'object' && !Array.isArray(source) ? { ...source } : {}
 let version = Number.isInteger(state.stateSchemaVersion) ? state.stateSchemaVersion : 1
 if (version > STATE_SCHEMA_VERSION || version < 1) throw new Error('unsupported-local-schema')
 while (version < STATE_SCHEMA_VERSION) { state = migrations[version](state); version++ }
 return ensureBodyIds({ ...state, stateSchemaVersion: STATE_SCHEMA_VERSION, massUnit: MASS_UNIT })
}

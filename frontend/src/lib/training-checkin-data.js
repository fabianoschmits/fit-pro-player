export const TRAINING_CHECKIN_REASONS = ['time_constraint', 'fatigue', 'equipment_unavailable', 'pain_or_discomfort', 'personal_preference', 'unexpected_event', 'flex_adjustment', 'professional_guidance', 'training_felt_easy', 'felt_good_to_continue', 'other']
export const CHECKIN_NOTE_LIMIT = 280
export const CHECKIN_REASON_LABELS = {
 time_constraint: 'Not enough time', fatigue: 'Tiredness', equipment_unavailable: 'Equipment unavailable', pain_or_discomfort: 'Pain or discomfort', personal_preference: 'Personal preference', unexpected_event: 'Unexpected event', flex_adjustment: 'FPP Flex adjustment', professional_guidance: 'Professional guidance', training_felt_easy: 'Training felt easy', felt_good_to_continue: 'Felt good to continue', other: 'Another reason',
}
export function normalizeTrainingCheckin(value) {
 if (!value || value.version !== 1 || !['answered', 'dismissed', 'removed'].includes(value.status)) return null
 const clean = { version: 1, status: value.status, sharing: 'private' }
 for (const key of ['answeredAt', 'updatedAt', 'dismissedAt', 'removedAt', 'operationId']) if (typeof value[key] === 'string') clean[key] = value[key]
 if (value.status === 'answered') {
  clean.reasons = [...new Set(Array.isArray(value.reasons) ? value.reasons.filter(reason => TRAINING_CHECKIN_REASONS.includes(reason)) : [])]
  clean.note = typeof value.note === 'string' ? value.note.trim().slice(0, CHECKIN_NOTE_LIMIT) : ''
  if (!clean.reasons.length && !clean.note) return null
 }
 return clean
}
export function normalizeTrainingCheckinMap(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
 return Object.fromEntries(Object.entries(value).filter(([id]) => /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,255}$/.test(id)).flatMap(([id, record]) => { const parsed = normalizeTrainingCheckin(record); return parsed ? [[id, parsed]] : [] }))
}

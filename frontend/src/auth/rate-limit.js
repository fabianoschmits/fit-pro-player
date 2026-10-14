const SIGN_UP_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
}

const states = new Map()

function keyFor(identifier, operation) {
  return `${operation}:${String(identifier || '').trim().toLowerCase()}`
}

function freshState(now) {
  return { attempts: 0, resetAt: now + SIGN_UP_LIMIT.windowMs, blockedUntil: 0 }
}

export function getSignUpRateLimitState(identifier) {
  const normalized = String(identifier || '').trim().toLowerCase()
  if (!normalized) return { ...freshState(Date.now()), remaining: SIGN_UP_LIMIT.maxAttempts, blocked: false }

  const now = Date.now()
  const key = keyFor(normalized, 'sign_up')
  const stored = states.get(key)
  if (!stored || stored.resetAt <= now) {
    const next = freshState(now)
    states.set(key, next)
    return { ...next, remaining: SIGN_UP_LIMIT.maxAttempts, blocked: false }
  }

  if (stored.blockedUntil && stored.blockedUntil <= now) {
    stored.blockedUntil = 0
    stored.attempts = 0
  }

  return {
    ...stored,
    remaining: Math.max(0, SIGN_UP_LIMIT.maxAttempts - stored.attempts),
    blocked: stored.blockedUntil > now,
  }
}

export function recordSignUpAttempt(identifier) {
  const normalized = String(identifier || '').trim().toLowerCase()
  if (!normalized) return getSignUpRateLimitState('')

  const now = Date.now()
  const current = getSignUpRateLimitState(normalized)
  const next = {
    attempts: current.attempts + 1,
    resetAt: current.resetAt,
    blockedUntil: current.attempts + 1 >= SIGN_UP_LIMIT.maxAttempts
      ? now + SIGN_UP_LIMIT.blockDurationMs
      : current.blockedUntil,
  }
  states.set(keyFor(normalized, 'sign_up'), next)
  return getSignUpRateLimitState(normalized)
}

export function clearSignUpRateLimit(identifier) {
  const normalized = String(identifier || '').trim().toLowerCase()
  if (normalized) states.delete(keyFor(normalized, 'sign_up'))
}

export function signUpRateLimitConfig() {
  return { ...SIGN_UP_LIMIT }
}

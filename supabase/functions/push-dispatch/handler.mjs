import {
  createWebPushRequest, ExpiredJobError, isKnownNotificationKind,
  validatePushSubscription, validateVapid,
} from './web-push.mjs';
import { createFcmSender, validateFcmSubscription } from './fcm.mjs';

const BATCH_SIZE = 25;
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 8000;

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(status === 405 ? { Allow: 'POST' } : {}) },
  });
}

async function secretsMatch(supplied, expected) {
  // Hash both inputs to fixed size, then compare all bytes without early exits.
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied ?? '')),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function validIdentity(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function validJob(job, now) {
  return job && [job.id, job.claimToken, job.deviceId, job.ownerId, job.deviceKey].every(validIdentity)
    && Number.isSafeInteger(job.subscriptionRevision) && job.subscriptionRevision > 0
    && isKnownNotificationKind(job.kind)
    && typeof job.expiresAt === 'string' && Number.isFinite(Date.parse(job.expiresAt))
    && Date.parse(job.expiresAt) - now >= 1000;
}

function classifyStatus(status) {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'invalid';
  if (status === 429 || status >= 500) return 'retry';
  return 'failed';
}

async function confirm(db, job, outcome, status) {
  try {
    const result = await db.rpc('confirm_notification_job', {
      p_job_id: job.id, p_claim_token: job.claimToken, p_outcome: outcome, p_status: status,
    });
    return !result.error && result.data === true;
  } catch {
    return false;
  }
}

async function currentClaim(db, job) {
  const current = await db.rpc('notification_job_is_current', { p_job_id: job.id, p_claim_token: job.claimToken });
  if (current.error || typeof current.data !== 'boolean') throw new Error('Current job check failed');
  return current.data;
}

async function dispatchOne({ job, db, config, generateRequestDetails, fetchImpl, now, timeoutMs, fcmSender, nativeReady }) {
  let outcome = 'cancelled';
  let status = null;
  if (validJob(job, now())) {
    if (job.subscription?.type === 'fcm') {
      if (!validateFcmSubscription(job.subscription)) outcome = 'invalid';
      else if (!nativeReady) outcome = 'retry';
      else {
        try {
          const result = await fcmSender.send(job, { beforeSend: () => currentClaim(db, job) });
          outcome = result.outcome;
          status = result.status;
        } catch (error) {
          outcome = error instanceof ExpiredJobError ? 'cancelled' : 'failed';
        }
      }
    } else if (!validatePushSubscription(job.subscription)) outcome = 'invalid';
    else {
      let current;
      try {
        current = await currentClaim(db, job);
      } catch {
        outcome = 'retry';
      }
      if (current === true) {
        let details;
        try {
          details = createWebPushRequest({ job, vapid: config.vapid, generateRequestDetails, now: now() });
        } catch (error) {
          outcome = error instanceof ExpiredJobError ? 'cancelled' : 'failed';
        }
        if (details) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const result = await fetchImpl(details.endpoint, {
              method: details.method, headers: details.headers, body: details.body,
              redirect: 'error', signal: controller.signal,
            });
            status = result.status;
            outcome = classifyStatus(status);
            await result.body?.cancel().catch(() => {});
          } catch {
            outcome = 'retry';
          } finally {
            clearTimeout(timeout);
          }
        }
      }
    }
  }
  const acknowledged = await confirm(db, job, outcome, status);
  return { outcome, acknowledged };
}

export function createDispatchHandler({ db, config, generateRequestDetails, fetchImpl = fetch,
  now = Date.now, timeoutMs = FETCH_TIMEOUT_MS }) {
  const configured = db && typeof db.rpc === 'function' && typeof generateRequestDetails === 'function'
    && typeof config?.dispatchSecret === 'string' && config.dispatchSecret.length > 0
    && validateVapid(config.vapid);
  const boundedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, FETCH_TIMEOUT_MS) : FETCH_TIMEOUT_MS;
  const fcmSender = createFcmSender({ serviceAccount: config?.firebase, fetchImpl, now, timeoutMs: boundedTimeout });
  return async (request) => {
    if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });
    if (!configured) return response(503, { error: 'Dispatch unavailable' });
    if (!await secretsMatch(request.headers.get('x-push-dispatch-secret'), config.dispatchSecret)) {
      return response(401, { error: 'Unauthorized' });
    }
    let jobs;
    const nativeReady = await fcmSender.isReady();
    try {
      const claim = await db.rpc('claim_notification_jobs', { p_limit: BATCH_SIZE, p_native_ready: nativeReady });
      if (claim.error || !Array.isArray(claim.data)) throw new Error('Claim failed');
      jobs = claim.data.slice(0, BATCH_SIZE);
    } catch {
      return response(503, { error: 'Dispatch unavailable' });
    }
    const counts = { processed: jobs.length, sent: 0, retry: 0, invalid: 0, failed: 0, cancelled: 0 };
    let next = 0;
    let allAcknowledged = true;
    async function worker() {
      while (next < jobs.length) {
        const job = jobs[next++];
        try {
          const result = await dispatchOne({ job, db, config, generateRequestDetails, fetchImpl, now,
            timeoutMs: boundedTimeout, fcmSender, nativeReady });
          counts[result.outcome] += 1;
          if (!result.acknowledged) allAcknowledged = false;
        } catch {
          allAcknowledged = false;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker()));
    return allAcknowledged ? response(200, counts) : response(503, { error: 'Dispatch unavailable' });
  };
}

import { buildPushPayload, ExpiredJobError, InvalidSubscriptionError } from './web-push.mjs';

const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const encoder = new TextEncoder();
const MAX_RESPONSE_BYTES = 16384;

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

export function validateFcmSubscription(subscription) {
  if (subscription?.type !== 'fcm' || typeof subscription.token !== 'string'
    || !/^[A-Za-z0-9_:-]{40,4096}$/u.test(subscription.token)
    || typeof subscription.installationProof !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/u.test(subscription.installationProof)) return false;
  try {
    const bytes = Uint8Array.from(atob(subscription.installationProof.replace(/-/gu, '+').replace(/_/gu, '/')), value => value.charCodeAt(0));
    return bytes.length === 32 && base64url(bytes) === subscription.installationProof;
  } catch { return false; }
}

function credentialBytes(account) {
  if (!account || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(account.project_id)
    || typeof account.client_email !== 'string' || account.client_email.length > 256
    || !/^[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9-]*\.iam\.gserviceaccount\.com$/u.test(account.client_email)
    || typeof account.private_key !== 'string' || account.private_key.length > 16384) return null;
  const pem = /^-----BEGIN PRIVATE KEY-----\s*([A-Za-z0-9+/=\s]+)\s*-----END PRIVATE KEY-----\s*$/u.exec(account.private_key);
  if (!pem) return null;
  try { return Uint8Array.from(atob(pem[1].replace(/\s/gu, '')), value => value.charCodeAt(0)); } catch { return null; }
}

async function readJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

function remainingSeconds(job, now) {
  const remaining = Math.floor((Date.parse(job.expiresAt) - now) / 1000);
  if (!Number.isFinite(remaining) || remaining < 1) throw new ExpiredJobError();
  return Math.min(remaining, 86400);
}

function outcomeFor(response) {
  if (response.status >= 200 && response.status < 300) return 'sent';
  const details = response.data?.error?.details;
  const unregistered = Array.isArray(details) && details.some(detail =>
    detail?.['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' && detail.errorCode === 'UNREGISTERED');
  if (response.status === 404 || response.status === 410 || unregistered) return 'invalid';
  if (response.status === 401 || response.status === 429 || response.status >= 500) return 'retry';
  return 'failed';
}

export function createFcmSender({ serviceAccount, fetchImpl = fetch, now = Date.now, timeoutMs = 8000 }) {
  const bytes = credentialBytes(serviceAccount);
  const boundedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 8000) : 8000;
  let keyTask;
  let cached;
  let tokenTask;

  function signingKey() {
    if (!keyTask) keyTask = bytes ? crypto.subtle.importKey('pkcs8', bytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
      .then(key => key.algorithm.modulusLength >= 2048 ? key : null).catch(() => null) : Promise.resolve(null);
    return keyTask;
  }

  async function post(url, headers, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), boundedTimeout);
    try {
      const response = await fetchImpl(url, { method: 'POST', headers, body, redirect: 'error', signal: controller.signal });
      return { status: response.status, data: await readJson(response) };
    } finally { clearTimeout(timeout); }
  }

  async function accessToken() {
    if (cached && cached.refreshAt > now()) return cached.value;
    if (!tokenTask) {
      tokenTask = (async () => {
        const key = await signingKey();
        if (!key) throw new Error('Native delivery unavailable');
        const iat = Math.floor(now() / 1000);
        const header = base64url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
        const claims = base64url(encoder.encode(JSON.stringify({ iss: serviceAccount.client_email,
          scope: FCM_SCOPE, aud: OAUTH_URL, iat, exp: iat + 3600 })));
        const input = `${header}.${claims}`;
        const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(input));
        const form = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: `${input}.${base64url(signature)}` });
        const issuedAt = now();
        const response = await post(OAUTH_URL, { 'Content-Type': 'application/x-www-form-urlencoded' }, form.toString());
        const token = response.data;
        if (response.status !== 200 || typeof token?.access_token !== 'string'
          || !/^[\x21-\x7E]{1,8192}$/u.test(token.access_token) || token.token_type !== 'Bearer'
          || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('Native authorization unavailable');
        cached = { value: token.access_token, refreshAt: issuedAt + Math.max(0, Math.min(token.expires_in, 3600) - 60) * 1000 };
        return token.access_token;
      })().finally(() => { tokenTask = null; });
    }
    return tokenTask;
  }

  return {
    async isReady() { return Boolean(await signingKey()); },
    async send(job, { beforeSend } = {}) {
      const payload = buildPushPayload(job);
      if (!validateFcmSubscription(job.subscription)) throw new InvalidSubscriptionError();
      remainingSeconds(job, now());
      try {
        const token = await accessToken();
        // OAuth can take time; only the current durable claim may reach the provider.
        if (typeof beforeSend !== 'function' || !await beforeSend()) return { outcome: 'cancelled', status: null };
        const ttl = remainingSeconds(job, now());
        const response = await post(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, JSON.stringify({ message: {
            token: job.subscription.token, notification: { title: payload.title, body: payload.body },
            data: Object.fromEntries(Object.entries(payload).map(([name, value]) => [name, String(value)])),
            android: { priority: 'NORMAL', ttl: `${ttl}s`, notification: { tag: `fit-pro-player:${payload.id}` } },
          } }));
        if (response.status === 401 && cached?.value === token) cached = null;
        return { outcome: outcomeFor(response), status: response.status };
      } catch (error) {
        if (error instanceof ExpiredJobError) throw error;
        return { outcome: 'retry', status: null };
      }
    },
  };
}

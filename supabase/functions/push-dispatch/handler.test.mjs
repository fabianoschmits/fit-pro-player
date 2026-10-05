import assert from 'node:assert/strict';
import test from 'node:test';
import { createECDH, randomBytes, generateKeyPairSync } from 'node:crypto';
import webPush from 'web-push';

const now = Date.parse('2026-10-04T15:00:00Z');
const browser = createECDH('prime256v1');
browser.generateKeys();
const subscription = { endpoint: 'https://web.push.apple.com/device-token', keys: {
  p256dh: browser.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url'),
} };
const config = { dispatchSecret: 'dispatcher-only-secret', vapid: {
  ...webPush.generateVAPIDKeys(), subject: 'mailto:push@example.com',
} };
const nativeRsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const nativeConfig = { ...config, firebase: { project_id: 'fitpro-player-123',
  client_email: 'dispatcher@fitpro-player-123.iam.gserviceaccount.com',
  private_key: nativeRsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() } };
const nativeSubscription = { type: 'fcm', token: 'device-token_1234567890:abcdefghijklmnopqrstuv',
  installationProof: randomBytes(32).toString('base64url') };
const job = (extra = {}) => ({ id: 'job-1', claimToken: 'claim-1', deviceId: 'device-1', ownerId: 'owner-1',
  deviceKey: 'browser-1', subscriptionRevision: 1, kind: 'workout_reminder', subscription,
  expiresAt: '2026-10-04T15:01:00Z', href: '/#/workout', lang: 'pt', ...extra });
const request = (extra = {}) => new Request('https://service.test/push-dispatch', {
  method: 'POST', headers: { 'x-push-dispatch-secret': config.dispatchSecret }, ...extra,
});

async function harness({ jobs = [], rpcImpl, fetchImpl, generateRequestDetails, settings = config, clock = () => now, timeoutMs } = {}) {
  const { createDispatchHandler } = await import('./handler.mjs').catch(() => ({}));
  assert.equal(typeof createDispatchHandler, 'function', 'Authenticated dispatcher must be implemented');
  const calls = [];
  const fetches = [];
  const generations = [];
  const handler = createDispatchHandler({
    db: { async rpc(name, args) {
      calls.push({ name, args });
      if (rpcImpl) return rpcImpl(name, args);
      return { data: name === 'claim_notification_jobs' ? jobs : true, error: null };
    } },
    config: settings, now: clock, timeoutMs,
    generateRequestDetails: (sub, payload, options) => {
      generations.push({ sub, payload, options });
      return generateRequestDetails ? generateRequestDetails(sub, payload, options)
        : webPush.generateRequestDetails(sub, payload, options);
    },
    fetchImpl: async (url, options) => {
      fetches.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : new Response(null, { status: 201 });
    },
  });
  return { handler, calls, fetches, generations };
}

test('rejects non-POST requests and a missing or incorrect dedicated secret before any database work', async () => {
  const h = await harness();
  for (const req of [request({ method: 'GET' }), request({ method: 'OPTIONS' }),
    request({ headers: {} }), request({ headers: { Authorization: `Bearer ${config.dispatchSecret}` } }),
    request({ headers: { 'x-push-dispatch-secret': 'dispatcher-only-secreu' } })]) {
    const response = await h.handler(req);
    assert.equal(response.status, req.method === 'POST' ? 401 : 405);
    assert.doesNotMatch(await response.text(), /dispatcher-only|mailto:|privateKey/u);
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.fetches.length, 0);
});

test('an authenticated idle invocation makes one bounded claim and no push requests', async () => {
  const h = await harness();
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 0, sent: 0, retry: 0, invalid: 0, failed: 0, cancelled: 0 });
  assert.deepEqual(h.calls, [{ name: 'claim_notification_jobs', args: { p_limit: 25, p_native_ready: false } }]);
  assert.equal(h.fetches.length, 0);
});

test('missing or invalid server VAPID configuration fails closed before claiming jobs', async () => {
  for (const settings of [
    { ...config, dispatchSecret: '' },
    { ...config, vapid: { ...config.vapid, privateKey: 'INVALID PRIVATE KEY' } },
    { ...config, vapid: { ...config.vapid, publicKey: '' } },
    { ...config, vapid: { ...config.vapid, subject: 'javascript:alert(1)' } },
  ]) {
    const h = await harness({ settings, jobs: [job()] });
    const response = await h.handler(request());
    assert.equal(response.status, 503);
    assert.equal(h.calls.length, 0);
    assert.equal(h.fetches.length, 0);
    assert.doesNotMatch(await response.text(), /INVALID|PRIVATE|javascript|dispatcher-only|mailto:/u);
  }
});

test('a public HTTPS VAPID contact can dispatch an encrypted notification', async () => {
  const h = await harness({ settings: { ...config, vapid: { ...config.vapid, subject: 'https://www.fitpp.com.br' } }, jobs: [job()] });
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent, 1);
  assert.equal(h.fetches.length, 1);
  assert.equal(h.generations[0].options.vapidDetails.subject, 'https://www.fitpp.com.br');
});

test('valid jobs recheck their claim immediately before native fetch and confirm delivery with the claim token', async () => {
  const sequence = [];
  const h = await harness({ jobs: [job()], rpcImpl(name) {
    sequence.push(name);
    return { data: name === 'claim_notification_jobs' ? [job()] : true, error: null };
  }, fetchImpl() { sequence.push('fetch'); return new Response(null, { status: 201 }); } });
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent, 1);
  assert.deepEqual(sequence, ['claim_notification_jobs', 'notification_job_is_current', 'fetch', 'confirm_notification_job']);
  assert.deepEqual(h.calls[1].args, { p_job_id: 'job-1', p_claim_token: 'claim-1' });
  assert.deepEqual(h.calls[2].args, { p_job_id: 'job-1', p_claim_token: 'claim-1', p_outcome: 'sent', p_status: 201 });
  assert.equal(h.fetches[0].options.redirect, 'error');
  assert.equal(h.fetches[0].options.method, 'POST');
  assert.equal(h.fetches[0].options.signal.aborted, false);
  assert.equal(JSON.parse(h.generations[0].payload).href, '/#/workout');
});

test('changed account or subscription claims are cancelled without sending', async () => {
  const h = await harness({ jobs: [job()], rpcImpl(name) {
    return { data: name === 'claim_notification_jobs' ? [job()]
      : name === 'notification_job_is_current' ? false : true, error: null };
  } });
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cancelled, 1);
  assert.equal(h.fetches.length, 0);
  assert.equal(h.calls.at(-1).args.p_outcome, 'cancelled');
});

test('expired jobs, malformed subscription revisions and retired timer kinds never send a notification', async () => {
  for (const extra of [{ expiresAt: '2026-10-04T14:59:59Z' }, { expiresAt: 'invalid' },
    { subscriptionRevision: 0 }, { subscriptionRevision: 1.5 }, { subscriptionRevision: '1' },
    { kind: 'rest', timerRevision: 1 }, { kind: 'timed_set', timerRevision: 1 },
    { kind: 'unknown-kind' }, { ownerId: null }, { deviceKey: '' }]) {
    const h = await harness({ jobs: [job(extra)] });
    const response = await h.handler(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).cancelled, 1);
    assert.equal(h.fetches.length, 0);
    assert.equal(h.calls.some(({ name }) => name === 'notification_job_is_current'), false);
  }
});

test('untrusted endpoints and malformed subscription keys invalidate the exact claimed subscription without generating a request', async () => {
  for (const badSubscription of [
    { ...subscription, endpoint: 'https://private.example/api' },
    { ...subscription, keys: { ...subscription.keys, auth: 'not-a-key' } },
  ]) {
    const h = await harness({ jobs: [job({ subscription: badSubscription })] });
    const response = await h.handler(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).invalid, 1);
    assert.equal(h.generations.length, 0);
    assert.equal(h.fetches.length, 0);
    assert.deepEqual(h.calls.at(-1).args, { p_job_id: 'job-1', p_claim_token: 'claim-1', p_outcome: 'invalid', p_status: null });
  }
});

test('push status classifications are confirmed once and never retried in the running dispatcher', async () => {
  for (const [status, outcome] of [[200, 'sent'], [201, 'sent'], [404, 'invalid'], [410, 'invalid'],
    [429, 'retry'], [500, 'retry'], [503, 'retry'], [400, 'failed'], [401, 'failed'], [403, 'failed'], [302, 'failed']]) {
    const h = await harness({ jobs: [job()], fetchImpl: () => new Response(null, { status }) });
    const response = await h.handler(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json())[outcome], 1);
    assert.equal(h.fetches.length, 1);
    assert.deepEqual(h.calls.at(-1).args, { p_job_id: 'job-1', p_claim_token: 'claim-1', p_outcome: outcome, p_status: status });
  }
});

test('network errors, redirect rejections and request timeout acknowledge a retry without leaking the provider error', async () => {
  for (const fetchImpl of [
    () => { throw new Error('SECRET PROVIDER ENDPOINT'); },
    (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  ]) {
    const h = await harness({ jobs: [job()], timeoutMs: 15, fetchImpl });
    const response = await h.handler(request());
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.doesNotMatch(text, /SECRET|PROVIDER|ENDPOINT/u);
    assert.equal(JSON.parse(text).retry, 1);
    assert.deepEqual(h.calls.at(-1).args, { p_job_id: 'job-1', p_claim_token: 'claim-1', p_outcome: 'retry', p_status: null });
    assert.equal(h.fetches.length, 1);
  }
});

test('a job expiring while its current-claim check runs is cancelled before fetch', async () => {
  let currentTime = now;
  const h = await harness({ jobs: [job({ expiresAt: '2026-10-04T15:00:02Z' })], clock: () => currentTime,
    rpcImpl(name) {
      if (name === 'notification_job_is_current') currentTime += 2100;
      return { data: name === 'claim_notification_jobs' ? [job({ expiresAt: '2026-10-04T15:00:02Z' })] : true, error: null };
    } });
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cancelled, 1);
  assert.equal(h.fetches.length, 0);
});

test('database claim and current-check failures are generic and do not send', async () => {
  const failedClaim = await harness({ rpcImpl() { return { data: null, error: { message: 'PRIVATE DATABASE SECRET' } }; } });
  const response = await failedClaim.handler(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE|DATABASE|SECRET/u);
  assert.equal(failedClaim.fetches.length, 0);
  const failedCheck = await harness({ jobs: [job()], rpcImpl(name) {
    if (name === 'notification_job_is_current') throw new Error('SECRET');
    return { data: name === 'claim_notification_jobs' ? [job()] : true, error: null };
  } });
  const checkResponse = await failedCheck.handler(request());
  assert.equal(checkResponse.status, 200);
  assert.equal((await checkResponse.json()).retry, 1);
  assert.equal(failedCheck.fetches.length, 0);
});

test('failure to acknowledge a sent job returns a generic service failure without re-sending or changing its outcome', async () => {
  for (const confirmation of [{ data: false, error: null }, { data: null, error: { message: 'SECRET' } }, null]) {
    const h = await harness({ jobs: [job()], rpcImpl(name) {
      if (name === 'confirm_notification_job') {
        if (!confirmation) throw new Error('SECRET');
        return confirmation;
      }
      return { data: name === 'claim_notification_jobs' ? [job()] : true, error: null };
    } });
    const response = await h.handler(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /SECRET|claim-1|job-1/u);
    assert.equal(h.fetches.length, 1);
    assert.equal(h.calls.filter(({ name }) => name === 'confirm_notification_job').length, 1);
    assert.equal(h.calls.at(-1).args.p_outcome, 'sent');
  }
});

test('one invocation processes at most 25 jobs and at most four fetches concurrently', async () => {
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 30 }, (_, i) => job({ id: `job-${i}`, claimToken: `claim-${i}` }));
  const h = await harness({ jobs, fetchImpl: async () => {
    active += 1; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 8));
    active -= 1;
    return new Response(null, { status: 201 });
  } });
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).processed, 25);
  assert.equal(h.fetches.length, 25);
  assert.equal(peak, 4);
  assert.ok(h.calls.filter(({ name }) => name === 'confirm_notification_job').every(({ args }) => args.p_claim_token === args.p_job_id.replace('job-', 'claim-')));
});

test('missing or malformed optional Firebase configuration excludes native claims and preserves web delivery', async () => {
  for (const firebase of [undefined, {}, { ...nativeConfig.firebase, private_key: 'SECRET INVALID' }]) {
    const h = await harness({ settings: { ...config, firebase }, jobs: [job()] });
    const result = await h.handler(request());
    assert.equal(result.status, 200);
    assert.equal((await result.json()).sent, 1);
    assert.equal(h.calls[0].args.p_native_ready, false);
    assert.equal(h.fetches.length, 1);
  }
});

test('a native transport claim obtains OAuth before current-account check and confirms only its exact claim token', async () => {
  const sequence = [];
  const nativeJob = job({ subscription: nativeSubscription });
  const h = await harness({ settings: nativeConfig, jobs: [nativeJob], rpcImpl(name) {
    sequence.push(name);
    return { data: name === 'claim_notification_jobs' ? [nativeJob] : true, error: null };
  }, fetchImpl(url) {
    sequence.push(url.endsWith('/token') ? 'oauth' : 'fcm');
    return url.endsWith('/token') ? Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 })
      : Response.json({ name: 'message-1' });
  } });
  const result = await h.handler(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).sent, 1);
  assert.deepEqual(sequence, ['claim_notification_jobs', 'oauth', 'notification_job_is_current', 'fcm', 'confirm_notification_job']);
  assert.equal(h.calls[0].args.p_native_ready, true);
  assert.equal(h.generations.length, 0);
  assert.deepEqual(h.calls.at(-1).args, { p_job_id: 'job-1', p_claim_token: 'claim-1', p_outcome: 'sent', p_status: 200 });
});

test('changed native accounts cancel after OAuth and malformed native subscriptions never fetch credentials', async () => {
  const nativeJob = job({ subscription: nativeSubscription });
  const h = await harness({ settings: nativeConfig, jobs: [nativeJob], rpcImpl(name) {
    return { data: name === 'claim_notification_jobs' ? [nativeJob] : name === 'notification_job_is_current' ? false : true, error: null };
  }, fetchImpl: () => Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 }) });
  assert.equal((await (await h.handler(request())).json()).cancelled, 1);
  assert.equal(h.fetches.length, 1);
  assert.equal(h.fetches[0].url, 'https://oauth2.googleapis.com/token');
  const bad = await harness({ settings: nativeConfig, jobs: [job({ subscription: { ...nativeSubscription, token: 'short' } })] });
  assert.equal((await (await bad.handler(request())).json()).invalid, 1);
  assert.equal(bad.fetches.length, 0);
});

test('an unexpectedly claimed native job without Firebase remains retryable without invalidating its device', async () => {
  const h = await harness({ jobs: [job({ subscription: nativeSubscription })] });
  assert.equal((await (await h.handler(request())).json()).retry, 1);
  assert.equal(h.fetches.length, 0);
  assert.equal(h.calls.at(-1).args.p_outcome, 'retry');
});

test('mixed native/web batches share OAuth and retain the four-way send concurrency bound', async () => {
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 12 }, (_, i) => job({ id: `job-${i}`, claimToken: `claim-${i}`,
    subscription: i % 2 ? nativeSubscription : subscription }));
  const h = await harness({ settings: nativeConfig, jobs, fetchImpl: async (url) => {
    active += 1; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    return url.endsWith('/token') ? Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 })
      : Response.json({ name: 'message' });
  } });
  assert.equal((await (await h.handler(request())).json()).sent, 12);
  assert.equal(peak, 4);
  assert.equal(h.fetches.filter(call => call.url.endsWith('/token')).length, 1);
  assert.equal(h.generations.length, 6);
});

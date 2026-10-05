import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, verify, randomBytes } from 'node:crypto';

const now = Date.parse('2026-10-04T15:00:00Z');
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { project_id: 'fitpro-player-123', client_email: 'dispatcher@fitpro-player-123.iam.gserviceaccount.com',
  private_key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const subscription = { type: 'fcm', token: 'device-token_1234567890:abcdefghijklmnopqrstuv',
  installationProof: randomBytes(32).toString('base64url') };
const job = (extra = {}) => ({ id: 'job-1', ownerId: 'owner-a', deviceKey: 'device-a', kind: 'workout_reminder',
  expiresAt: '2026-10-04T15:01:30Z', href: '/#/workout', lang: 'pt', subscription,
  studentName: 'PRIVATE NAME', weight: 75, timerRevision: 999, ...extra });

async function moduleUnderTest() {
  const module = await import('./fcm.mjs').catch(() => ({}));
  assert.equal(typeof module.createFcmSender, 'function', 'FCM transport must be implemented');
  return module;
}

async function harness({ settings = account, fetchImpl, clock = () => now, timeoutMs = 100 } = {}) {
  const { createFcmSender } = await moduleUnderTest();
  const calls = [];
  const sender = createFcmSender({ serviceAccount: settings, now: clock, timeoutMs,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (fetchImpl) return fetchImpl(url, options);
      return url === 'https://oauth2.googleapis.com/token'
        ? Response.json({ access_token: 'access-token-secret', token_type: 'Bearer', expires_in: 3600 })
        : Response.json({ name: 'projects/fitpro-player-123/messages/message-1' });
    } });
  return { sender, calls };
}

test('FCM OAuth signs an RS256 assertion for the fixed Firebase scope and sends only generic notification/string routing data', async () => {
  const h = await harness();
  assert.equal(await h.sender.isReady(), true);
  let checked = false;
  const result = await h.sender.send(job(), { beforeSend: async () => { checked = true; return true; } });
  assert.deepEqual(result, { outcome: 'sent', status: 200 });
  assert.equal(checked, true);
  assert.equal(h.calls.length, 2);
  const oauth = h.calls[0];
  assert.equal(oauth.url, 'https://oauth2.googleapis.com/token');
  assert.equal(oauth.options.redirect, 'error');
  assert.equal(oauth.options.method, 'POST');
  const form = new URLSearchParams(oauth.options.body);
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const [header, payload, signature] = form.get('assertion').split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), {
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: 1791126000, exp: 1791129600,
  });
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), rsa.publicKey, Buffer.from(signature, 'base64url')), true);
  const send = h.calls[1];
  assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/fitpro-player-123/messages:send');
  assert.equal(send.options.headers.Authorization, 'Bearer access-token-secret');
  assert.equal(send.options.redirect, 'error');
  assert.equal(send.options.signal.aborted, false);
  assert.deepEqual(JSON.parse(send.options.body), { message: {
    token: subscription.token, notification: { title: 'FitProPlayer', body: 'Seu treino planejado está chegando.' },
    data: { id: 'job-1', ownerId: 'owner-a', deviceKey: 'device-a', kind: 'workout_reminder',
      expiresAt: '2026-10-04T15:01:30Z', title: 'FitProPlayer', body: 'Seu treino planejado está chegando.', href: '/#/workout' },
    android: { priority: 'NORMAL', ttl: '90s', notification: { tag: 'fit-pro-player:job-1' } },
  } });
  assert.doesNotMatch(send.options.body, /PRIVATE NAME|weight|timerRevision|installationProof|private_key/);
});

test('FCM configuration rejects malformed or weak credentials and ignores untrusted token URI overrides', async () => {
  const smallRsa = generateKeyPairSync('rsa', { modulusLength: 1024 });
  for (const settings of [null, {}, { ...account, project_id: '../evil' },
    { ...account, client_email: 'fake@evil.example' }, { ...account, private_key: 'SECRET' },
    { ...account, private_key: smallRsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }]) {
    const h = await harness({ settings });
    assert.equal(await h.sender.isReady(), false);
    assert.equal(h.calls.length, 0);
  }
  const h = await harness({ settings: { ...account, token_uri: 'https://evil.example/' } });
  await h.sender.send(job(), { beforeSend: async () => true });
  assert.equal(h.calls[0].url, 'https://oauth2.googleapis.com/token');
});

test('FCM requires a valid native token and canonical 32-byte installation proof before requesting OAuth', async () => {
  for (const extra of [{ type: 'web' }, { token: 'short' }, { token: `x${'a'.repeat(4096)}` },
    { token: `token\n${'a'.repeat(50)}` }, { token: `token/${'a'.repeat(50)}` },
    { installationProof: 'A'.repeat(42) }, { installationProof: 'A'.repeat(42) + 'B' }]) {
    const h = await harness();
    await assert.rejects(h.sender.send(job({ subscription: { ...subscription, ...extra } })), { name: 'InvalidSubscriptionError' });
    assert.equal(h.calls.length, 0);
  }
});

test('native retired timer and expired jobs never obtain credentials or send', async () => {
  for (const extra of [{ kind: 'rest' }, { kind: 'timed_set' }, { expiresAt: '2026-10-04T14:59:59Z' }]) {
    const h = await harness();
    await assert.rejects(h.sender.send(job(extra)), { name: extra.kind ? 'InvalidJobError' : 'ExpiredJobError' });
    assert.equal(h.calls.length, 0);
  }
});

test('native claim/account checks run after OAuth and cancellation prevents the provider send', async () => {
  const h = await harness();
  const result = await h.sender.send(job(), { beforeSend: async () => {
    assert.equal(h.calls.length, 1);
    return false;
  } });
  assert.deepEqual(result, { outcome: 'cancelled', status: null });
  assert.equal(h.calls.length, 1);
});

test('native jobs expiring during OAuth are rejected and normal TTL is capped at one day', async () => {
  let time = now;
  const h = await harness({ clock: () => time });
  await assert.rejects(h.sender.send(job(), { beforeSend: async () => { time += 91000; return true; } }), { name: 'ExpiredJobError' });
  assert.equal(h.calls.length, 1);
  const valid = await harness();
  await valid.sender.send(job({ kind: 'program_updated', expiresAt: '2026-10-07T15:00:00Z' }), { beforeSend: async () => true });
  assert.deepEqual(JSON.parse(valid.calls[1].options.body).message.android, {
    priority: 'NORMAL', ttl: '86400s', notification: { tag: 'fit-pro-player:job-1' },
  });
});

test('concurrent native sends share one OAuth request and refresh before expiry', async () => {
  let time = now;
  const h = await harness({ clock: () => time });
  await Promise.all(Array.from({ length: 4 }, (_, i) => h.sender.send(job({ id: `job-${i}` }), { beforeSend: async () => true })));
  assert.equal(h.calls.filter(call => call.url === 'https://oauth2.googleapis.com/token').length, 1);
  time += 3550000;
  await h.sender.send(job({ expiresAt: new Date(time + 90000).toISOString() }), { beforeSend: async () => true });
  assert.equal(h.calls.filter(call => call.url === 'https://oauth2.googleapis.com/token').length, 2);
});

test('FCM provider errors distinguish dead tokens, backoff and terminal failures without sending again', async () => {
  for (const [status, body, outcome] of [
    [404, { error: { status: 'NOT_FOUND' } }, 'invalid'],
    [400, { error: { details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } }, 'invalid'],
    [429, { error: {} }, 'retry'], [503, { error: {} }, 'retry'], [401, { error: {} }, 'retry'],
    [403, { error: { status: 'PERMISSION_DENIED' } }, 'failed'], [400, { error: {} }, 'failed'],
    [400, { error: { details: {} } }, 'failed'],
  ]) {
    const h = await harness({ fetchImpl: url => url.endsWith('/token')
      ? Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 }) : Response.json(body, { status }) });
    assert.deepEqual(await h.sender.send(job(), { beforeSend: async () => true }), { outcome, status });
    assert.equal(h.calls.length, 2);
  }
});

test('a native 401 clears cached OAuth for the next durable retry without a hot loop', async () => {
  let sends = 0;
  const h = await harness({ fetchImpl: url => url.endsWith('/token')
    ? Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 })
    : Response.json(sends++ ? { name: 'message-ok' } : { error: {} }, { status: sends === 1 ? 401 : 200 }) });
  assert.equal((await h.sender.send(job(), { beforeSend: async () => true })).outcome, 'retry');
  assert.equal(h.calls.length, 2);
  assert.equal((await h.sender.send(job(), { beforeSend: async () => true })).outcome, 'sent');
  assert.equal(h.calls.filter(call => call.url.endsWith('/token')).length, 2);
});

test('OAuth and native HTTP failures use bounded aborts and never include secret provider text in results', async () => {
  for (const phase of ['oauth', 'send']) {
    const h = await harness({ timeoutMs: 15, fetchImpl: (url, options) => {
      if (phase === 'send' && url.endsWith('/token')) return Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 });
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('SECRET PROVIDER TOKEN')), { once: true }));
    } });
    assert.deepEqual(await h.sender.send(job(), { beforeSend: async () => true }), { outcome: 'retry', status: null });
    assert.equal(h.calls.at(-1).options.signal.aborted, true);
  }
});

test('malformed OAuth responses never reach FCM and failed token requests are not cached', async () => {
  for (const body of [{ access_token: 'token\nSECRET', expires_in: 3600 }, { access_token: 'token', expires_in: 0 },
    { access_token: 'token', token_type: 'wrong', expires_in: 3600 }, { error: 'SECRET' }]) {
    const h = await harness({ fetchImpl: () => Response.json(body) });
    assert.deepEqual(await h.sender.send(job(), { beforeSend: async () => true }), { outcome: 'retry', status: null });
    assert.deepEqual(await h.sender.send(job(), { beforeSend: async () => true }), { outcome: 'retry', status: null });
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls.every(call => call.url.endsWith('/token')), true);
  }
});

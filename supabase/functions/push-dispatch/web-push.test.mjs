import assert from 'node:assert/strict';
import test from 'node:test';
import { createECDH, randomBytes, createHmac, createDecipheriv, createPublicKey, verify } from 'node:crypto';
import { isAllowedPushEndpoint } from './web-push.mjs';

const clock = Date.parse('2026-10-04T15:00:00Z');
const receiver = createECDH('prime256v1');
receiver.generateKeys();
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/device-token',
  keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
};
const makeJob = (extra = {}) => ({
  id: 'job-1', claimToken: 'claim-1', deviceId: 'device-1', ownerId: 'owner-1', deviceKey: 'browser-1',
  subscription, subscriptionRevision: 1, kind: 'workout_reminder',
  expiresAt: '2026-10-04T15:01:30Z', href: '/workout', lang: 'pt', ...extra,
});

test('accepts only trusted HTTPS push services without URL escape hatches', async () => {
  const api = await import('./web-push.mjs').catch(() => ({}));
  assert.equal(typeof api.isAllowedPushEndpoint, 'function', 'Push endpoint validation must be implemented');
  for (const endpoint of [
    'https://web.push.apple.com/QH/token',
    'https://push.apple.com/token',
    'https://fcm.googleapis.com/fcm/send/token',
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://wns2-par02p.notify.windows.com/w/?token=opaque',
  ]) assert.equal(api.isAllowedPushEndpoint(endpoint), true, endpoint);
  for (const endpoint of [
    'http://fcm.googleapis.com/token',
    'https://fcm.googleapis.com.evil.test/token',
    'https://evilpush.apple.com/token',
    'https://push.apple.com.evil.test/token',
    'https://push.apple.com/token#fragment',
    'https://push.apple.com/token#',
    'https://user:password@push.apple.com/token',
    'https://@push.apple.com/token',
    'https://:@push.apple.com/token',
    'https://fcm.googleapis.com:8443/token',
    'https://updates.push.services.mozilla.com./token',
    'https://127.0.0.1/token',
    'https://evilnotify.windows.com/token',
    'https://notify.windows.com.evil.test/token',
    'https://fcm.googleapis.com\\@evil.test/token',
    ' https://fcm.googleapis.com/token',
    'https://fcm.googleapis.com/token\n',
    '', null,
  ]) assert.equal(api.isAllowedPushEndpoint(endpoint), false, String(endpoint));
});

test('subscription keys must decode to an uncompressed P-256 key and 16-byte authentication secret', async () => {
  const { validatePushSubscription } = await import('./web-push.mjs');
  assert.equal(typeof validatePushSubscription, 'function', 'Subscription validation must be implemented');
  assert.equal(validatePushSubscription(subscription), true);
  for (const keys of [
    { ...subscription.keys, p256dh: randomBytes(64).toString('base64url') },
    { ...subscription.keys, p256dh: Buffer.concat([Buffer.from([3]), randomBytes(64)]).toString('base64url') },
    { ...subscription.keys, p256dh: subscription.keys.p256dh + '!' },
    { ...subscription.keys, auth: randomBytes(15).toString('base64url') },
    { ...subscription.keys, auth: randomBytes(17).toString('base64url') },
    { ...subscription.keys, auth: '!!!!!!!!!!!!!!!!!!!!!!' },
  ]) assert.equal(validatePushSubscription({ ...subscription, keys }), false);
  assert.equal(validatePushSubscription({ ...subscription, endpoint: 'https://localhost/push' }), false);
  assert.equal(validatePushSubscription({ ...subscription, keys: null }), false);
});

test('payloads expose only routing and generic localized copy without timer metadata or personal event contents', async () => {
  const { buildPushPayload } = await import('./web-push.mjs');
  assert.equal(typeof buildPushPayload, 'function', 'Safe payload generation must be implemented');
  const payload = buildPushPayload(makeJob({ studentName: 'PRIVATE NAME', weight: 'PRIVATE WEIGHT', body: 'PRIVATE BODY' }));
  assert.deepEqual(payload, {
    id: 'job-1', ownerId: 'owner-1', deviceKey: 'browser-1', kind: 'workout_reminder',
    expiresAt: '2026-10-04T15:01:30Z', title: 'FitProPlayer',
    body: 'Seu treino planejado está chegando.', href: '/workout',
  });
  assert.equal(buildPushPayload(makeJob({ href: 'https://evil.test' })).href, '/');
  assert.equal(buildPushPayload(makeJob({ href: '//evil.test' })).href, '/');
  assert.equal(buildPushPayload(makeJob({ href: '/\\evil.test' })).href, '/');
  assert.equal(buildPushPayload(makeJob({ lang: 'missing' })).body, 'Your planned workout is coming up.');
  assert.equal(buildPushPayload(makeJob({ lang: 'pt-BR' })).body, 'Seu treino planejado está chegando.');
  assert.equal(Object.hasOwn(buildPushPayload(makeJob({ timerRevision: 123 })), 'timerRevision'), false);
  const languages = ['pt', 'de', 'es', 'fr', 'hi', 'it', 'ko', 'pl', 'ru', 'tr', 'zh'];
  const kinds = ['workout_reminder', 'weight_reminder', 'measurement_reminder',
    'program_updated', 'program_removed', 'relationship_accepted', 'relationship_ended',
    'student_workout_completed', 'student_workout_abandoned', 'verification_changed'];
  for (const kind of kinds) {
    const english = buildPushPayload(makeJob({ kind, lang: 'en' })).body;
    for (const lang of languages) {
      const localized = buildPushPayload(makeJob({ kind, lang })).body;
      assert.ok(localized && localized !== english, `${kind}/${lang} must use localized copy`);
    }
  }
});

test('VAPID accepts public HTTPS contact URLs and mailto while rejecting private or malformed subjects', async () => {
  const { validateVapid } = await import('./web-push.mjs');
  const { default: webPush } = await import('web-push');
  const keys = webPush.generateVAPIDKeys();
  for (const subject of ['mailto:push@example.com', 'https://www.fitpp.com.br', 'https://www.fitpp.com.br/contact']) {
    assert.equal(validateVapid({ ...keys, subject }), true, subject);
  }
  for (const subject of ['http://www.fitpp.com.br', 'https://localhost', 'https://foo.localhost',
    'https://127.0.0.1', 'https://10.0.0.1', 'https://192.168.1.2', 'https://[::1]',
    'https://2130706433', 'https://0x7f000001', 'https://host.local', 'https://host.internal',
    'https://host.lan', 'https://host.test', 'https://host.invalid', 'https://host.example',
    'https://user:secret@www.fitpp.com.br', 'https://@www.fitpp.com.br', 'https:////www.fitpp.com.br',
    'https://www.fitpp.com.br\\contact', 'https://www.fitpp.com.br\n', '//www.fitpp.com.br',
    'mailto:push@localhost', 'mailto:push@127.0.0.1', 'mailto:push@host.local', 'mailto:missing', '', null]) {
    assert.equal(validateVapid({ ...keys, subject }), false, String(subject));
  }
});

for (const subject of ['mailto:push@example.com', 'https://www.fitpp.com.br']) {
test(`request generation encrypts the safe payload and signs VAPID with ${subject}`, async () => {
  const { createWebPushRequest } = await import('./web-push.mjs');
  assert.equal(typeof createWebPushRequest, 'function', 'Encrypted Web Push generation must be implemented');
  const { default: webPush } = await import('web-push');
  const vapid = { ...webPush.generateVAPIDKeys(), subject };
  const details = createWebPushRequest({ job: makeJob(), vapid, now: clock,
    generateRequestDetails: webPush.generateRequestDetails.bind(webPush) });
  assert.equal(details.endpoint, subscription.endpoint);
  assert.equal(details.method, 'POST');
  assert.equal(details.headers.TTL, 90);
  assert.equal(details.headers.Urgency, 'normal');
  assert.equal(details.headers['Content-Encoding'], 'aes128gcm');
  assert.ok(details.body.length > 100);
  assert.ok(!details.body.includes(Buffer.from('Seu treino')));

  const body = Buffer.from(details.body);
  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.equal(body[20], 65);
  const senderKey = body.subarray(21, 86);
  const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
  const auth = Buffer.from(subscription.keys.auth, 'base64url');
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), senderKey]);
  const ikm = hmac(hmac(auth, receiver.computeSecret(senderKey)), Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const encrypted = body.subarray(86);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(encrypted.subarray(-16));
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
  assert.equal(plaintext.at(-1), 2);
  const payload = JSON.parse(plaintext.subarray(0, -1).toString());
  assert.equal(payload.ownerId, 'owner-1');
  assert.equal(payload.kind, 'workout_reminder');
  assert.equal(payload.body, 'Seu treino planejado está chegando.');
  assert.equal(Object.hasOwn(payload, 'timerRevision'), false);

  const authorization = details.headers.Authorization;
  const token = /(?:^|[ ,])t=([^,]+)/u.exec(authorization)?.[1];
  assert.ok(token, 'VAPID authorization must carry a JWT');
  const [header, claims, signature] = token.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'ES256');
  const decoded = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.equal(decoded.aud, 'https://fcm.googleapis.com');
  assert.equal(decoded.sub, subject);
  const publicKeyBytes = Buffer.from(vapid.publicKey, 'base64url');
  const key = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256',
    x: publicKeyBytes.subarray(1, 33).toString('base64url'), y: publicKeyBytes.subarray(33).toString('base64url') } });
  assert.equal(verify('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
});
}

test('all background reminders and professional updates use normal urgency with TTL bounded by expiry and one day', async () => {
  const { createWebPushRequest } = await import('./web-push.mjs');
  assert.equal(typeof createWebPushRequest, 'function');
  const { default: webPush } = await import('web-push');
  const vapid = { ...webPush.generateVAPIDKeys(), subject: 'mailto:push@example.com' };
  const create = (job) => createWebPushRequest({ job, vapid, now: clock, generateRequestDetails: webPush.generateRequestDetails.bind(webPush) });
  const short = create(makeJob({ expiresAt: '2026-10-04T15:00:03.900Z' }));
  assert.equal(short.headers.TTL, 3);
  assert.equal(short.headers.Urgency, 'normal');
  const professional = create(makeJob({ kind: 'program_updated' }));
  assert.equal(professional.headers.TTL, 90);
  assert.equal(professional.headers.Urgency, 'normal');
  const long = create(makeJob({ kind: 'measurement_reminder', expiresAt: '2026-10-07T15:00:00Z' }));
  assert.equal(long.headers.TTL, 86400);
  assert.equal(long.headers.Urgency, 'normal');
  assert.throws(() => create(makeJob({ expiresAt: '2026-10-04T14:59:59Z' })), { name: 'ExpiredJobError' });
});

test('retired rest and timed-set jobs cannot generate an encrypted background request', async () => {
  const { createWebPushRequest, buildPushPayload } = await import('./web-push.mjs');
  let generated = 0;
  for (const kind of ['rest', 'timed_set']) {
    assert.throws(() => createWebPushRequest({ job: makeJob({ kind }), vapid: {}, now: clock,
      generateRequestDetails: () => { generated += 1; return {}; } }), { name: 'InvalidJobError' });
    assert.throws(() => buildPushPayload(makeJob({ kind })), { name: 'InvalidJobError' });
  }
  assert.equal(generated, 0);
});

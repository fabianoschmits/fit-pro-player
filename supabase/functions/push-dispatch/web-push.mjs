export function isAllowedPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 4096 || /[\s\\#]/u.test(endpoint)) return false;
  const authority = /^https:\/\/([^/?#]+)/iu.exec(endpoint)?.[1];
  if (!authority || authority.includes('@')) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && (url.hostname === 'push.apple.com' || url.hostname.endsWith('.push.apple.com')
        || url.hostname === 'fcm.googleapis.com'
        || url.hostname === 'updates.push.services.mozilla.com'
        || url.hostname.endsWith('.notify.windows.com'));
  } catch {
    return false;
  }
}

function decodeKey(value) {
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9_-]+={0,2}$/u.test(value)) return null;
  try {
    const raw = value.replace(/=+$/u, '');
    const bytes = Uint8Array.from(atob(raw.replace(/-/gu, '+').replace(/_/gu, '/')), (character) => character.charCodeAt(0));
    const canonical = btoa(String.fromCharCode(...bytes)).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
    return canonical === raw ? bytes : null;
  } catch {
    return null;
  }
}

export function validatePushSubscription(subscription) {
  if (!subscription || !isAllowedPushEndpoint(subscription.endpoint)) return false;
  const publicKey = decodeKey(subscription.keys?.p256dh);
  const auth = decodeKey(subscription.keys?.auth);
  return publicKey?.length === 65 && publicKey[0] === 4 && auth?.length === 16;
}

export function validateVapid(vapid) {
  const publicKey = decodeKey(vapid?.publicKey);
  const privateKey = decodeKey(vapid?.privateKey);
  return publicKey?.length === 65 && publicKey[0] === 4 && privateKey?.length === 32
    && validVapidSubject(vapid.subject);
}

function publicHostname(hostname) {
  // A contact must name a public DNS host, never a literal IP or local-only name.
  const labels = hostname.toLowerCase().split('.');
  const suffix = labels.at(-1);
  return hostname.length <= 253 && labels.length >= 2
    && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
    && /^[a-z][a-z0-9-]*$/u.test(suffix)
    && !['localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home',
      'arpa', 'test', 'invalid', 'example', 'corp', 'onion', 'alt', 'private'].includes(suffix);
}

function validVapidSubject(subject) {
  if (typeof subject !== 'string' || subject.length > 2048 || /[\s\\]/u.test(subject)) return false;
  const email = /^mailto:([^@/?#]+)@([^@/?#]+)$/iu.exec(subject);
  if (email) return publicHostname(email[2]);
  const authority = /^https:\/\/([^/?#]+)/iu.exec(subject)?.[1];
  if (!authority || authority.includes('@')) return false;
  try {
    const url = new URL(subject);
    return url.protocol === 'https:' && !url.username && !url.password && publicHostname(url.hostname);
  } catch {
    return false;
  }
}

// Background copy is fixed and contains no event data. Workout timers stay local.
const copy = {
  en: ['Your planned workout is coming up.', 'Time to update your records.', 'You have an update in FitProPlayer.'],
  pt: ['Seu treino planejado está chegando.', 'Hora de atualizar seus registros.', 'Você tem uma atualização no FitProPlayer.'],
  de: ['Dein geplantes Training steht an.', 'Zeit, deine Einträge zu aktualisieren.', 'Du hast eine neue Mitteilung in FitProPlayer.'],
  es: ['Tu entrenamiento planificado se acerca.', 'Es hora de actualizar tus registros.', 'Tienes una actualización en FitProPlayer.'],
  fr: ['Votre entraînement prévu approche.', 'Il est temps de mettre à jour vos données.', 'Vous avez une mise à jour dans FitProPlayer.'],
  hi: ['आपका नियोजित वर्कआउट जल्द शुरू होगा।', 'अपने रिकॉर्ड अपडेट करने का समय है।', 'FitProPlayer में आपके लिए एक अपडेट है।'],
  it: ['Il tuo allenamento programmato si avvicina.', 'È ora di aggiornare i tuoi registri.', 'Hai un aggiornamento in FitProPlayer.'],
  ko: ['예정된 운동 시간이 다가옵니다.', '기록을 업데이트할 시간입니다.', 'FitProPlayer에 새 알림이 있습니다.'],
  pl: ['Zbliża się twój zaplanowany trening.', 'Czas zaktualizować swoje wpisy.', 'Masz aktualizację w FitProPlayer.'],
  ru: ['Приближается запланированная тренировка.', 'Пора обновить свои записи.', 'У вас новое уведомление в FitProPlayer.'],
  tr: ['Planlanan antrenmanınız yaklaşıyor.', 'Kayıtlarınızı güncelleme zamanı.', "FitProPlayer'da yeni bir güncellemeniz var."],
  zh: ['您计划的训练即将开始。', '该更新您的记录了。', '您在 FitProPlayer 中有新的更新。'],
};

const kindCopy = {
  workout_reminder: 0, weight_reminder: 1, measurement_reminder: 1,
  program_updated: 2, program_removed: 2, relationship_accepted: 2, relationship_ended: 2,
  student_workout_completed: 2, student_workout_abandoned: 2, verification_changed: 2,
};

export function isKnownNotificationKind(kind) {
  return Object.hasOwn(kindCopy, kind);
}

function safeHref(value) {
  return typeof value === 'string' && value.length <= 512 && /^\/(?!\/)/u.test(value)
    && !/[\\\s]/u.test(value) && !/%(?:5c|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(value) ? value : '/';
}

export function buildPushPayload(job) {
  if (!isKnownNotificationKind(job.kind)) throw new InvalidJobError();
  const language = typeof job.lang === 'string' ? job.lang.toLowerCase().split(/[-_]/u)[0] : 'en';
  const messages = Object.hasOwn(copy, language) ? copy[language] : copy.en;
  const body = messages[kindCopy[job.kind]];
  return {
    id: job.id, ownerId: job.ownerId, deviceKey: job.deviceKey, kind: job.kind,
    expiresAt: job.expiresAt, title: 'FitProPlayer', body, href: safeHref(job.href),
  };
}

export class ExpiredJobError extends Error {
  constructor() { super('Notification expired'); this.name = 'ExpiredJobError'; }
}

export class InvalidJobError extends Error {
  constructor() { super('Invalid notification job'); this.name = 'InvalidJobError'; }
}

export class InvalidSubscriptionError extends Error {
  constructor() { super('Invalid push subscription'); this.name = 'InvalidSubscriptionError'; }
}

export function createWebPushRequest({ job, vapid, generateRequestDetails, now }) {
  if (!isKnownNotificationKind(job.kind)) throw new InvalidJobError();
  if (!validatePushSubscription(job.subscription)) throw new InvalidSubscriptionError();
  const remaining = Math.floor((Date.parse(job.expiresAt) - now) / 1000);
  if (!Number.isFinite(remaining) || remaining < 1) throw new ExpiredJobError();
  const details = generateRequestDetails({ endpoint: job.subscription.endpoint, keys: {
    p256dh: job.subscription.keys.p256dh, auth: job.subscription.keys.auth,
  } }, JSON.stringify(buildPushPayload(job)), {
    vapidDetails: vapid, TTL: Math.min(remaining, 86400),
    urgency: 'normal', contentEncoding: 'aes128gcm',
  });
  // Native fetch is used by the handler; the library performs encryption/signing only.
  return { endpoint: job.subscription.endpoint, method: 'POST', headers: details.headers, body: details.body };
}

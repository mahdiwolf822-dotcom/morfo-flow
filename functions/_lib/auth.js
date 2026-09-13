// کتابخانه مشترک برای هش کردن رمز عبور و ساخت/بررسی نشست (session)
// از Web Crypto API استفاده می‌کند که به‌صورت رایگان روی Cloudflare Workers/Pages در دسترس است.

const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return {
    hash: toBase64Url(new Uint8Array(bits)),
    salt: toBase64Url(salt),
  };
}

export async function verifyPassword(password, saltB64, expectedHashB64) {
  const salt = fromBase64Url(saltB64);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const gotHash = toBase64Url(new Uint8Array(bits));
  return timingSafeEqual(gotHash, expectedHashB64);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

// یک نشست ساده و امضاشده می‌سازد: payload + امضای HMAC، بدون نیاز به دیتابیس نشست
export async function createSession(secret, payload) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

export async function verifySession(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expectedSig = await hmac(secret, body);
  if (!timingSafeEqual(sig, expectedSig)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return `morfo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `morfo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function newId() {
  return crypto.randomUUID();
}

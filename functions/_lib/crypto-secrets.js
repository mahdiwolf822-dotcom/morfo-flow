// رمزنگاری متقارن (AES-GCM) برای کلیدهای API که مشتری خودش وارد می‌کنه (مثل کلید Gemini).
// هیچ‌وقت این کلیدها خام داخل دیتابیس ذخیره نمی‌شن — فقط رمزنگاری‌شده.
// نیازمندی: یک متغیر محیطی ENCRYPTION_KEY (رشته تصادفی طولانی) در Cloudflare تنظیم بشه.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(secret) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes) {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str);
}

function fromBase64(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// خروجی: "<iv_base64>.<ciphertext_base64>" — یک رشته ساده که می‌شه مستقیم در یک ستون TEXT ذخیره کرد
export async function encryptSecret(plainText, encryptionKey) {
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY تنظیم نشده است');
  const key = await deriveKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plainText));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipherBuf))}`;
}

export async function decryptSecret(stored, encryptionKey) {
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY تنظیم نشده است');
  const [ivB64, cipherB64] = stored.split('.');
  if (!ivB64 || !cipherB64) throw new Error('فرمت داده رمزنگاری‌شده نامعتبر است');
  const key = await deriveKey(encryptionKey);
  const iv = fromBase64(ivB64);
  const cipherBytes = fromBase64(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return decoder.decode(plainBuf);
}

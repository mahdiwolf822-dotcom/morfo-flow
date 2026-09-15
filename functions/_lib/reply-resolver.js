import { findMatchingRule } from './matcher.js';
import { decryptSecret } from './crypto-secrets.js';
import { generateAiReply } from './ai.js';

// منطق مشترک «چه جوابی بدیم»: اول قانون‌های کلیدواژه‌ای، بعد (اگه مشتری کلید AI وصل کرده) هوش مصنوعی.
// اگه چند ارائه‌دهنده وصل باشه و «حالت هوشمند» روشن باشه، به ترتیب امتحان می‌کنیم تا یکی جواب بده.
// این تابع هم برای وبهوک تلگرام، هم ویجت وب‌سایت و هم تست زنده داشبورد استفاده می‌شه.
export async function resolveReply({ automation, rules, message, encryptionKey, credentials = [], fallbackEnabled = false }) {
  const match = findMatchingRule(rules, message);
  if (match) {
    return { text: match.reply, source: 'rule' };
  }

  if (!credentials.length) {
    return { text: null, source: 'none' };
  }

  const tryList = buildTryOrder(credentials, fallbackEnabled);
  let lastError = null;
  const attempted = [];

  for (const cred of tryList) {
    attempted.push(cred.provider);
    try {
      const apiKey = await decryptSecret(cred.api_key_encrypted, encryptionKey);
      const text = await generateAiReply({
        provider: cred.provider,
        apiKey,
        instructions: automation.ai_instructions,
        userMessage: message,
      });
      return { text, source: 'ai', provider: cred.provider, attempted };
    } catch (err) {
      lastError = err;
      // اگه حالت هوشمند خاموشه، فقط همین یکی رو امتحان می‌کنیم و دیگه ادامه نمی‌دیم
      if (!fallbackEnabled) break;
      // در غیر این صورت می‌ریم سراغ ارائه‌دهنده بعدی در لیست
    }
  }

  return { text: null, source: 'ai_error', error: lastError ? lastError.message : 'خطای نامشخص', attempted };
}

// ترتیب امتحان: اول ارائه‌دهنده فعال (سوییچ‌شده)، بعد (فقط اگه حالت هوشمند روشن بود) بقیه به ترتیب اولویت
function buildTryOrder(credentials, fallbackEnabled) {
  const active = credentials.find((c) => c.is_active);
  if (!fallbackEnabled) {
    return active ? [active] : [credentials[0]];
  }
  const rest = credentials
    .filter((c) => c !== active)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  return active ? [active, ...rest] : [...credentials].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

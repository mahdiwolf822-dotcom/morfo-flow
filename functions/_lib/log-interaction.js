import { newId } from './auth.js';

// فقط پیام‌های واقعی (از تلگرام یا ویجت) ثبت می‌شن، نه پیام‌های تستی داخل داشبورد.
// اگه ثبتش به هر دلیلی خطا بده، نباید جلوی جواب دادن به مشتری رو بگیره — پس silent fail.
export async function logInteraction(env, automationId, source) {
  try {
    await env.MORFO_DB
      .prepare('INSERT INTO interactions (id, automation_id, source, created_at) VALUES (?, ?, ?, ?)')
      .bind(newId(), automationId, source, new Date().toISOString())
      .run();
  } catch (err) {
    console.log('logInteraction failed:', err.message);
  }
}

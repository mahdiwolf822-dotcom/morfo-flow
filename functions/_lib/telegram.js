// کتابخانه مشترک برای اطلاع‌رسانی آنی به تلگرام هنگام ثبت درخواست جدید
// نیازمندی: TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID در Cloudflare Environment Variables
// اگر این متغیرها تنظیم نشده باشن، این تابع بی‌سروصدا کاری نمی‌کنه (سایت خراب نمی‌شه)

export async function notifyTelegram(env, { title, lines }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const text = [`🔔 ${title}`, '', ...lines].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    // اطلاع‌رسانی تلگرام هیچ‌وقت نباید باعث شکست ثبت درخواست مشتری بشه
    console.log('telegram notify failed:', err.message);
  }
}

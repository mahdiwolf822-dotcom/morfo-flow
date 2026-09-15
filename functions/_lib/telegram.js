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

// ---------- توابع عمومی موتور اتوماسیون: هرکدوم با توکن ربات خود مشتری کار می‌کنن ----------
// این توابع برای هر سرویسی که از الگوی «Bot API تلگرام» پیروی کنه کار می‌کنن (تلگرام خودش، و بله که
// دقیقاً همین ساختار رو کپی کرده: docs.bale.ai). فقط baseUrl فرق می‌کنه.

export const BOT_API_BASE_URLS = {
  telegram: 'https://api.telegram.org',
  bale: 'https://tapi.bale.ai',
};

// یک درخواست خام به Bot API می‌زنه (تلگرام یا بله) و پاسخ JSON رو برمی‌گردونه
export async function telegramApi(token, method, params = {}, baseUrl = BOT_API_BASE_URLS.telegram) {
  const res = await fetch(`${baseUrl}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { httpOk: res.ok, ...data };
}

// اعتبارسنجی توکن ربات مشتری و گرفتن یوزرنیم ربات (برای نمایش در داشبورد)
export async function getBotInfo(token, baseUrl = BOT_API_BASE_URLS.telegram) {
  const data = await telegramApi(token, 'getMe', {}, baseUrl);
  if (!data.ok) throw new Error('توکن ربات نامعتبر است');
  return data.result; // { id, username, first_name, ... }
}

// وصل کردن وبهوک ربات مشتری به endpoint خودمون، با یک secret برای جلوگیری از جعل درخواست
export async function setWebhook(token, url, secretToken, baseUrl = BOT_API_BASE_URLS.telegram) {
  const data = await telegramApi(token, 'setWebhook', { url, secret_token: secretToken }, baseUrl);
  if (!data.ok) throw new Error(data.description || 'اتصال وبهوک ناموفق بود');
  return data;
}

export async function deleteWebhookFor(token, baseUrl = BOT_API_BASE_URLS.telegram) {
  try {
    await telegramApi(token, 'deleteWebhook', {}, baseUrl);
  } catch (err) {
    // اگر توکن دیگه معتبر نبود هم مشکلی نیست، فقط ادامه بده
  }
}

export async function sendMessage(token, chatId, text, baseUrl = BOT_API_BASE_URLS.telegram) {
  return telegramApi(token, 'sendMessage', { chat_id: chatId, text }, baseUrl);
}

import { resolveReply } from '../../_lib/reply-resolver.js';
import { sendMessage, BOT_API_BASE_URLS } from '../../_lib/telegram.js';
import { logInteraction } from '../../_lib/log-interaction.js';
import { getAiCredentials } from '../../_lib/get-ai-credentials.js';

// POST /api/bot/:automationId — تلگرام یا بله آپدیت‌های ربات هر مشتری رو اینجا می‌فرسته
// امنیت: تلگرام هدر X-Telegram-Bot-Api-Secret-Token رو دقیقاً همون secret ای می‌فرسته
// که موقع setWebhook تنظیم کردیم. بله این هدر رو پشتیبانی نمی‌کنه (تایید نشده)، پس براش
// فقط به غیرقابل‌حدس بودن خودِ آدرس (UUID اتوماسیون در URL) تکیه می‌کنیم.

export async function onRequestPost(context) {
  const { request, env, params } = context;

  const automation = await env.MORFO_DB
    .prepare('SELECT id, channel_type, bot_token, webhook_secret, status, ai_instructions, ai_fallback_enabled FROM automations WHERE id = ?')
    .bind(params.automationId)
    .first();

  if (!automation) {
    // به سرور پیام‌رسان 200 برمی‌گردونیم تا دوباره retry نکنه، ولی کاری انجام نمی‌دیم
    return new Response('ok');
  }

  if (automation.channel_type === 'telegram') {
    const incomingSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (incomingSecret !== automation.webhook_secret) {
      return new Response('forbidden', { status: 403 });
    }
  }
  // برای بله فعلاً این بررسی رو نداریم (به مستندات هدر معادل نیاز داره)؛
  // امنیتش فعلاً روی غیرقابل‌حدس بودن UUID توی مسیر URL تکیه می‌کنه.

  if (automation.status !== 'active') {
    return new Response('ok');
  }

  let update;
  try {
    update = await request.json();
  } catch (e) {
    return new Response('ok');
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text;

  if (!chatId || !text) {
    return new Response('ok');
  }

  const baseUrl = BOT_API_BASE_URLS[automation.channel_type] || BOT_API_BASE_URLS.telegram;

  if (text === '/start') {
    await sendMessage(automation.bot_token, chatId, 'سلام! چطور می‌تونم کمکتون کنم؟', baseUrl);
    return new Response('ok');
  }

  const { results: rules } = await env.MORFO_DB
    .prepare('SELECT keyword, reply FROM automation_rules WHERE automation_id = ?')
    .bind(automation.id)
    .all();

  const credentials = await getAiCredentials(env, automation.id);
  const result = await resolveReply({
    automation,
    rules,
    message: text,
    encryptionKey: env.ENCRYPTION_KEY,
    credentials,
    fallbackEnabled: !!automation.ai_fallback_enabled,
  });
  await logInteraction(env, automation.id, result.source);

  // اگه نه قانونی مچ شد نه AI فعاله (یا AI خطا داد)، عمداً هیچی نمی‌فرستیم —
  // بهتره ربات ساکت بمونه تا اینکه هر پیام نامرتبطی رو با یه جواب گیج‌کننده جواب بده
  if (result.text) {
    await sendMessage(automation.bot_token, chatId, result.text, baseUrl);
  }

  return new Response('ok');
}

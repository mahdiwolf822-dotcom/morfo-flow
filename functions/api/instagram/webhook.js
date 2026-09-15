import { resolveReply } from '../../_lib/reply-resolver.js';
import { sendInstagramMessage } from '../../_lib/instagram.js';
import { logInteraction } from '../../_lib/log-interaction.js';
import { getAiCredentials } from '../../_lib/get-ai-credentials.js';
import { decryptSecret } from '../../_lib/crypto-secrets.js';

// GET /api/instagram/webhook — تایید اولیه وبهوک نزد متا (فقط یک‌بار موقع ثبت در Meta App Dashboard)
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const verifyToken = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && verifyToken === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

// POST /api/instagram/webhook — همه پیام‌های دایرکت همه مشتری‌ها از همینجا رد می‌شه
// (برخلاف تلگرام/بله که هر مشتری URL جدا داره، متا فقط یک وبهوک برای کل اپ ما قبول می‌کنه)
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response('ok');
  }

  if (body.object !== 'instagram') {
    return new Response('ok');
  }

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      await handleMessagingEvent(env, event);
    }
  }

  return new Response('ok');
}

async function handleMessagingEvent(env, event) {
  const igAccountId = event.recipient?.id;
  const senderId = event.sender?.id;
  const text = event.message?.text;
  const isEcho = !!event.message?.is_echo;

  // is_echo یعنی این پیام رو خودِ اکانت بیزینسی فرستاده (نه مشتری)؛ اگه جوابشو بدیم حلقه بی‌نهایت می‌شه
  if (!igAccountId || !senderId || !text || isEcho) return;

  const automation = await env.MORFO_DB
    .prepare("SELECT id, ig_account_id, ig_access_token_encrypted, ai_instructions, ai_fallback_enabled, status FROM automations WHERE ig_account_id = ? AND channel_type = 'instagram'")
    .bind(igAccountId)
    .first();

  if (!automation || automation.status !== 'active') return;

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

  if (!result.text) return;

  try {
    const accessToken = await decryptSecret(automation.ig_access_token_encrypted, env.ENCRYPTION_KEY);
    await sendInstagramMessage({ igAccountId: automation.ig_account_id, accessToken, recipientId: senderId, text: result.text });
  } catch (err) {
    console.log('instagram sendMessage failed:', err.message);
  }
}

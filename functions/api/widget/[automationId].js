import { resolveReply } from '../../_lib/reply-resolver.js';
import { checkRateLimit } from '../../_lib/rate-limit.js';
import { logInteraction } from '../../_lib/log-interaction.js';
import { getAiCredentials } from '../../_lib/get-ai-credentials.js';

// این endpoint از دامنه‌های دلخواه (سایت هر مشتری) صدا زده می‌شه، پس CORS باز لازمه.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const RATE_LIMIT = { maxRequests: 15, windowSeconds: 60 }; // هر بازدیدکننده حداکثر ۱۵ پیام در دقیقه

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/widget/:automationId   { message }
export async function onRequestPost(context) {
  const { request, env, params } = context;

  const automation = await env.MORFO_DB
    .prepare("SELECT id, status, ai_instructions, ai_fallback_enabled FROM automations WHERE id = ? AND channel_type = 'website'")
    .bind(params.automationId)
    .first();

  if (!automation || automation.status !== 'active') {
    return json({ ok: false, error: 'این ویجت در دسترس نیست' }, 404);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rate = await checkRateLimit(env, `widget:${automation.id}:${clientIp}`, RATE_LIMIT);
  if (!rate.allowed) {
    return json({ ok: false, error: 'پیام زیاده؛ کمی صبر کن و دوباره امتحان کن.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const message = (body.message || '').trim().slice(0, 1000);
  if (!message) {
    return json({ ok: false, error: 'پیام خالی است' }, 400);
  }

  const { results: rules } = await env.MORFO_DB
    .prepare('SELECT keyword, reply FROM automation_rules WHERE automation_id = ?')
    .bind(automation.id)
    .all();

  const credentials = await getAiCredentials(env, automation.id);
  const result = await resolveReply({
    automation,
    rules,
    message,
    encryptionKey: env.ENCRYPTION_KEY,
    credentials,
    fallbackEnabled: !!automation.ai_fallback_enabled,
  });
  await logInteraction(env, automation.id, result.source);

  return json({
    ok: true,
    reply: result.text || 'متوجه نشدم؛ لطفاً سوالتون رو واضح‌تر بپرسید یا با ما در تماس باشید.',
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

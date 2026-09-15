import { verifySession, readCookie } from '../../../_lib/auth.js';
import { resolveReply } from '../../../_lib/reply-resolver.js';
import { getAiCredentials } from '../../../_lib/get-ai-credentials.js';

// POST /api/automations/:id/test   { message }
// برای پیش‌نمایش رفتار اتوماسیون از همون داشبورد، بدون نیاز به تلگرام یا نصب ویجت واقعی.
// عمداً در جدول interactions ثبت نمی‌شه چون پیام واقعی مشتری نیست.
export async function onRequestPost(context) {
  const { request, env, params } = context;

  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  const automation = await env.MORFO_DB
    .prepare('SELECT id, user_id, ai_instructions, ai_fallback_enabled FROM automations WHERE id = ?')
    .bind(params.id)
    .first();
  if (!automation || automation.user_id !== payload.uid) {
    return json({ ok: false, error: 'اتوماسیونی پیدا نشد' }, 404);
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

  let reply;
  if (result.text) {
    reply = result.text;
  } else if (result.source === 'ai_error') {
    reply = `⚠️ خطای هوش مصنوعی (${(result.attempted || []).join(', ')}): ${result.error}`;
  } else {
    reply = '(هیچ قانونی مچ نشد و AI فعال نیست — این پیام برای مشتری واقعی بی‌جواب می‌ماند)';
  }

  return json({ ok: true, reply, source: result.source });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

import { verifySession, readCookie } from '../../../../_lib/auth.js';

// PATCH /api/automations/:id/ai/active   { provider }
// سوییچ اصلی: کدوم ارائه‌دهنده متصل‌شده به‌عنوان «فعال» انتخاب بشه.
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  const automation = await env.MORFO_DB.prepare('SELECT id, user_id FROM automations WHERE id = ?').bind(params.id).first();
  if (!automation || automation.user_id !== payload.uid) {
    return json({ ok: false, error: 'اتوماسیونی پیدا نشد' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const provider = (body.provider || '').trim();
  const cred = await env.MORFO_DB
    .prepare('SELECT id FROM ai_credentials WHERE automation_id = ? AND provider = ?')
    .bind(automation.id, provider)
    .first();

  if (!cred) {
    return json({ ok: false, error: 'ابتدا کلید این ارائه‌دهنده را وصل کنید' }, 400);
  }

  await env.MORFO_DB.prepare('UPDATE ai_credentials SET is_active = 0 WHERE automation_id = ?').bind(automation.id).run();
  await env.MORFO_DB.prepare('UPDATE ai_credentials SET is_active = 1 WHERE id = ?').bind(cred.id).run();

  return json({ ok: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

import { verifySession, readCookie } from '../../../../_lib/auth.js';

// PATCH /api/automations/:id/ai/fallback   { enabled: boolean }
// «حالت هوشمند»: اگه روشن باشه، وقتی ارائه‌دهنده فعال جواب نداد، خودکار سراغ بقیه‌ی کلیدهای وصل‌شده می‌رویم.
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

  await env.MORFO_DB
    .prepare('UPDATE automations SET ai_fallback_enabled = ? WHERE id = ?')
    .bind(body.enabled ? 1 : 0, automation.id)
    .run();

  return json({ ok: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

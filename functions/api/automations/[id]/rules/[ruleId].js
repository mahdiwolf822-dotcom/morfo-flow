import { verifySession, readCookie } from '../../../../_lib/auth.js';

async function getAuthedUserId(request, env) {
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  return payload ? payload.uid : null;
}

// DELETE /api/automations/:id/rules/:ruleId
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const uid = await getAuthedUserId(request, env);
  if (!uid) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  const automation = await env.MORFO_DB
    .prepare('SELECT id, user_id FROM automations WHERE id = ?')
    .bind(params.id)
    .first();
  if (!automation || automation.user_id !== uid) {
    return json({ ok: false, error: 'اتوماسیونی پیدا نشد' }, 404);
  }

  await env.MORFO_DB
    .prepare('DELETE FROM automation_rules WHERE id = ? AND automation_id = ?')
    .bind(params.ruleId, automation.id)
    .run();

  return json({ ok: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

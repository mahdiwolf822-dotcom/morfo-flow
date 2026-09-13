import { verifySession, readCookie } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) {
    return json({ ok: false }, 401);
  }
  const user = await env.MORFO_DB
    .prepare('SELECT id, name, email, avatar_url FROM users WHERE id = ?')
    .bind(payload.uid)
    .first();
  if (!user) return json({ ok: false }, 401);
  return json({ ok: true, user });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

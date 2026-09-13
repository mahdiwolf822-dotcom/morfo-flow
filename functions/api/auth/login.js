import { verifyPassword, createSession, sessionCookie } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) {
    return json({ ok: false, error: 'ایمیل و رمز عبور الزامی است' }, 400);
  }

  const user = await env.MORFO_DB
    .prepare('SELECT id, name, email, password_hash, password_salt FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user || !user.password_hash) {
    return json({ ok: false, error: 'ایمیل یا رمز عبور اشتباه است' }, 401);
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) {
    return json({ ok: false, error: 'ایمیل یا رمز عبور اشتباه است' }, 401);
  }

  const token = await createSession(env.SESSION_SECRET, { uid: user.id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });

  return new Response(JSON.stringify({ ok: true, user: { id: user.id, name: user.name, email: user.email } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': sessionCookie(token),
    },
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

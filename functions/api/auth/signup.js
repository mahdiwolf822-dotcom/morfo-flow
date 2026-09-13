import { hashPassword, createSession, sessionCookie, newId } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!name || !email || !password) {
    return json({ ok: false, error: 'همه فیلدها الزامی است' }, 400);
  }
  if (password.length < 8) {
    return json({ ok: false, error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'ایمیل معتبر نیست' }, 400);
  }

  const existing = await env.MORFO_DB
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (existing) {
    return json({ ok: false, error: 'این ایمیل قبلاً ثبت شده است' }, 409);
  }

  const { hash, salt } = await hashPassword(password);
  const id = newId();

  await env.MORFO_DB
    .prepare('INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, name, email, hash, salt, new Date().toISOString())
    .run();

  const token = await createSession(env.SESSION_SECRET, { uid: id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });

  return new Response(JSON.stringify({ ok: true, user: { id, name, email } }), {
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

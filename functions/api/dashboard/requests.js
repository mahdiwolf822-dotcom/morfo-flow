import { verifySession, readCookie, newId } from '../../_lib/auth.js';
import { notifyTelegram } from '../../_lib/telegram.js';

async function getAuthedUser(request, env) {
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  return payload ? payload.uid : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const uid = await getAuthedUser(request, env);
  if (!uid) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  const { results } = await env.MORFO_DB
    .prepare('SELECT id, business, type, description, status, created_at FROM requests WHERE user_id = ? ORDER BY created_at DESC')
    .bind(uid)
    .all();

  return json({ ok: true, requests: results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const uid = await getAuthedUser(request, env);
  if (!uid) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const business = (body.business || '').trim();
  const type = (body.type || '').trim();
  const description = (body.description || '').trim();

  if (!business || !description) {
    return json({ ok: false, error: 'نام کسب‌وکار و توضیح الزامی است' }, 400);
  }

  const id = newId();
  await env.MORFO_DB
    .prepare('INSERT INTO requests (id, user_id, business, type, description, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, uid, business, type || null, description, 'در انتظار بررسی', 'dashboard', new Date().toISOString())
    .run();

  const user = await env.MORFO_DB.prepare('SELECT name, email FROM users WHERE id = ?').bind(uid).first();
  await notifyTelegram(env, {
    title: 'درخواست جدید از داشبورد مشتری',
    lines: [
      `مشتری: ${user?.name || uid} (${user?.email || '-'})`,
      `کسب‌وکار: ${business}${type ? ' (' + type + ')' : ''}`,
      `توضیح: ${description}`,
    ],
  });

  return json({ ok: true, id });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

import { verifySession, readCookie, newId } from '../../../_lib/auth.js';
import { limitsFor } from '../../../_lib/plans.js';

async function getAuthedUser(request, env) {
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) return null;
  return env.MORFO_DB.prepare('SELECT id, plan FROM users WHERE id = ?').bind(payload.uid).first();
}

// POST /api/automations/:id/rules   { keyword, reply }
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const user = await getAuthedUser(request, env);
  if (!user) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  const automation = await env.MORFO_DB
    .prepare('SELECT id, user_id FROM automations WHERE id = ?')
    .bind(params.id)
    .first();
  if (!automation || automation.user_id !== user.id) {
    return json({ ok: false, error: 'اتوماسیونی پیدا نشد' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const keyword = (body.keyword || '').trim();
  const reply = (body.reply || '').trim();
  if (!keyword || !reply) {
    return json({ ok: false, error: 'کلیدواژه و متن پاسخ الزامی است' }, 400);
  }

  const limits = limitsFor(user.plan);
  const countRow = await env.MORFO_DB
    .prepare('SELECT COUNT(*) as c FROM automation_rules WHERE automation_id = ?')
    .bind(automation.id)
    .first();
  if (countRow.c >= limits.maxRulesPerAutomation) {
    return json({
      ok: false,
      error: `پلن رایگان شما اجازه بیش از ${limits.maxRulesPerAutomation} قانون برای هر ربات را نمی‌دهد`,
      upgradeRequired: true,
    }, 403);
  }

  const id = newId();
  await env.MORFO_DB
    .prepare('INSERT INTO automation_rules (id, automation_id, keyword, reply, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, automation.id, keyword, reply, new Date().toISOString())
    .run();

  return json({ ok: true, rule: { id, keyword, reply } });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

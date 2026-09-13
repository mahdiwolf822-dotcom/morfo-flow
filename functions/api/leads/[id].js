// PATCH /api/leads/:id   headers: { 'X-Admin-Token': '...' }   body: { status: '...' }
// برای امنیت بیشتر (نسبت به GET که توکن رو در URL می‌گیره)، این endpoint توکن رو از هدر می‌خونه
// تا در لاگ‌های سرور یا تاریخچه مرورگر ثبت نشه.

const ALLOWED_STATUSES = ['در انتظار بررسی', 'در حال انجام', 'تکمیل‌شده'];

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const token = request.headers.get('X-Admin-Token');

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: 'دسترسی مجاز نیست' }, 401);
  }

  const id = params.id;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const status = (body.status || '').trim();
  if (!ALLOWED_STATUSES.includes(status)) {
    return json({ ok: false, error: 'وضعیت نامعتبر است' }, 400);
  }

  const result = await env.MORFO_DB
    .prepare('UPDATE requests SET status = ? WHERE id = ?')
    .bind(status, id)
    .run();

  if (!result.meta || result.meta.changes === 0) {
    return json({ ok: false, error: 'درخواستی با این شناسه پیدا نشد' }, 404);
  }

  return json({ ok: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

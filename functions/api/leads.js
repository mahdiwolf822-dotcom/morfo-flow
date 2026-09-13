// GET /api/leads?token=YOUR_ADMIN_TOKEN
// همه درخواست‌ها (چه از فرم عمومی سایت، چه از داشبورد مشتری) رو یکجا برمی‌گردونه.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: 'دسترسی مجاز نیست' }, 401);
  }

  const { results } = await env.MORFO_DB
    .prepare(
      `SELECT
         r.id,
         r.business,
         r.type,
         r.description,
         r.status,
         r.source,
         r.created_at AS createdAt,
         COALESCE(r.contact_name, u.name)  AS name,
         r.contact_phone                   AS phone,
         u.email                           AS email
       FROM requests r
       LEFT JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT 200`
    )
    .all();

  return json({ ok: true, count: results.length, leads: results });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

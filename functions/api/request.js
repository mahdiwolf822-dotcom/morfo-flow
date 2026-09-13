import { newId } from '../_lib/auth.js';
import { notifyTelegram } from '../_lib/telegram.js';

// POST /api/request — فرم درخواست مشاوره صفحه اصلی (بدون نیاز به حساب کاربری)
// در همون جدول D1 «requests» ذخیره می‌شه که داشبورد مشتری هم استفاده می‌کنه،
// تا پنل ادمین یک منبع واحد برای همه درخواست‌ها داشته باشه.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const name = sanitize(body.name);
  const business = sanitize(body.business);
  const phone = sanitize(body.phone);
  const type = sanitize(body.type);
  const description = sanitize(body.description);

  if (!name || !business || !phone || !description) {
    return json({ ok: false, error: 'فیلدهای الزامی خالی است' }, 400);
  }

  const id = newId();
  const createdAt = new Date().toISOString();

  try {
    await env.MORFO_DB
      .prepare(
        `INSERT INTO requests (id, user_id, contact_name, contact_phone, business, type, description, status, source, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 'در انتظار بررسی', 'landing', ?)`
      )
      .bind(id, name, phone, business, type || null, description, createdAt)
      .run();
  } catch (err) {
    return json({ ok: false, error: 'خطا در ذخیره‌سازی' }, 500);
  }

  await notifyTelegram(env, {
    title: 'درخواست جدید از سایت Morfo Flow',
    lines: [
      `نام: ${name}`,
      `کسب‌وکار: ${business}${type ? ' (' + type + ')' : ''}`,
      `تماس: ${phone}`,
      `توضیح: ${description}`,
    ],
  });

  return json({ ok: true });
}

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 2000);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

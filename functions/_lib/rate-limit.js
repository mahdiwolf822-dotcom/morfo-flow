// محدودیت نرخ ساده با پنجره ثابت (fixed window)، روی همون D1 که داریم — بدون نیاز به KV یا Durable Object جدید.
// برای endpoint هایی که عمومی و بدون احراز هویت هستن (مثل ویجت وب‌سایت) که در معرض سوءاستفاده‌ان.

export async function checkRateLimit(env, key, { maxRequests, windowSeconds }) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const row = await env.MORFO_DB.prepare('SELECT count, window_start FROM rate_limits WHERE rate_key = ?').bind(key).first();

  if (!row) {
    await env.MORFO_DB
      .prepare('INSERT INTO rate_limits (rate_key, count, window_start) VALUES (?, 1, ?)')
      .bind(key, new Date(now).toISOString())
      .run();
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const windowStart = new Date(row.window_start).getTime();
  const windowExpired = now - windowStart > windowMs;

  if (windowExpired) {
    await env.MORFO_DB
      .prepare('UPDATE rate_limits SET count = 1, window_start = ? WHERE rate_key = ?')
      .bind(new Date(now).toISOString(), key)
      .run();
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (row.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  await env.MORFO_DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE rate_key = ?').bind(key).run();
  return { allowed: true, remaining: maxRequests - row.count - 1 };
}

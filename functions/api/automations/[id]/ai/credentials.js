import { verifySession, readCookie, newId } from '../../../../_lib/auth.js';
import { encryptSecret } from '../../../../_lib/crypto-secrets.js';
import { isSupportedProvider, generateAiReply, PROVIDER_META } from '../../../../_lib/ai.js';

async function getAuthedAutomation(request, env, id) {
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) return { error: json({ ok: false, error: 'ابتدا وارد شوید' }, 401) };

  const automation = await env.MORFO_DB.prepare('SELECT id, user_id FROM automations WHERE id = ?').bind(id).first();
  if (!automation || automation.user_id !== payload.uid) {
    return { error: json({ ok: false, error: 'اتوماسیونی پیدا نشد' }, 404) };
  }
  return { automation };
}

// POST /api/automations/:id/ai/credentials   { provider, apiKey, instructions? }
// یک کلید ارائه‌دهنده رو اعتبارسنجی، رمزنگاری و ذخیره می‌کنه. اگه اولین کلید این اتوماسیونه، خودکار فعالش می‌کنه.
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { automation, error } = await getAuthedAutomation(request, env, params.id);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const provider = (body.provider || '').trim();
  const apiKey = (body.apiKey || '').trim();
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim().slice(0, 1000) : undefined;

  if (!isSupportedProvider(provider)) {
    return json({ ok: false, error: 'این ارائه‌دهنده هوش مصنوعی پشتیبانی نمی‌شود' }, 400);
  }
  if (!apiKey) {
    return json({ ok: false, error: 'کلید API الزامی است' }, 400);
  }
  if (!env.ENCRYPTION_KEY) {
    return json({ ok: false, error: 'سرور برای ذخیره امن کلید آماده نیست؛ بعداً دوباره امتحان کنید' }, 500);
  }

  // قبل از ذخیره، کلید رو با یک پیام تست واقعی اعتبارسنجی می‌کنیم
  try {
    await generateAiReply({ provider, apiKey, instructions: instructions || '', userMessage: 'سلام' });
  } catch (err) {
    return json({ ok: false, error: `کلید ${PROVIDER_META[provider].label} معتبر نیست: ${err.message}` }, 400);
  }

  const encrypted = await encryptSecret(apiKey, env.ENCRYPTION_KEY);

  const existingCount = await env.MORFO_DB
    .prepare('SELECT COUNT(*) as c FROM ai_credentials WHERE automation_id = ?')
    .bind(automation.id)
    .first();
  const isFirstCredential = existingCount.c === 0;

  const existing = await env.MORFO_DB
    .prepare('SELECT id FROM ai_credentials WHERE automation_id = ? AND provider = ?')
    .bind(automation.id, provider)
    .first();

  if (existing) {
    await env.MORFO_DB
      .prepare('UPDATE ai_credentials SET api_key_encrypted = ? WHERE id = ?')
      .bind(encrypted, existing.id)
      .run();
  } else {
    await env.MORFO_DB
      .prepare(
        'INSERT INTO ai_credentials (id, automation_id, provider, api_key_encrypted, is_active, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(newId(), automation.id, provider, encrypted, isFirstCredential ? 1 : 0, existingCount.c, new Date().toISOString())
      .run();
  }

  if (instructions !== undefined) {
    await env.MORFO_DB.prepare('UPDATE automations SET ai_instructions = ? WHERE id = ?').bind(instructions || null, automation.id).run();
  }

  return json({ ok: true });
}

// DELETE /api/automations/:id/ai/credentials   { provider }
// اگه ارائه‌دهنده حذف‌شده همون فعال (سوییچ‌شده) بود، خودکار یکی دیگه از باقی‌مونده‌ها رو فعال می‌کنیم (اگه بود)
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { automation, error } = await getAuthedAutomation(request, env, params.id);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const provider = (body.provider || '').trim();
  const cred = await env.MORFO_DB
    .prepare('SELECT id, is_active FROM ai_credentials WHERE automation_id = ? AND provider = ?')
    .bind(automation.id, provider)
    .first();

  if (!cred) {
    return json({ ok: false, error: 'این ارائه‌دهنده وصل نبود' }, 404);
  }

  await env.MORFO_DB.prepare('DELETE FROM ai_credentials WHERE id = ?').bind(cred.id).run();

  if (cred.is_active) {
    const next = await env.MORFO_DB
      .prepare('SELECT id FROM ai_credentials WHERE automation_id = ? ORDER BY priority ASC LIMIT 1')
      .bind(automation.id)
      .first();
    if (next) {
      await env.MORFO_DB.prepare('UPDATE ai_credentials SET is_active = 1 WHERE id = ?').bind(next.id).run();
    }
  }

  return json({ ok: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

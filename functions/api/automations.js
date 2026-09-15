import { verifySession, readCookie, newId } from '../_lib/auth.js';
import { getBotInfo, setWebhook, BOT_API_BASE_URLS } from '../_lib/telegram.js';
import { limitsFor } from '../_lib/plans.js';

const VALID_CHANNELS = ['telegram', 'bale', 'website', 'instagram'];
const TOKEN_BASED_CHANNELS = ['telegram', 'bale']; // این‌ها الگوی «توکن + وبهوک» تلگرام رو دارن

const CHANNEL_LABELS = { telegram: 'تلگرام', bale: 'بله' };

async function getAuthedUser(request, env) {
  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) return null;
  const user = await env.MORFO_DB.prepare('SELECT id, plan FROM users WHERE id = ?').bind(payload.uid).first();
  return user || null;
}

// GET /api/automations — لیست اتوماسیون‌های کاربر (هر کانالی) به همراه قوانین و وضعیت مصرف پلن
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getAuthedUser(request, env);
  if (!user) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  const { results: automations } = await env.MORFO_DB
    .prepare('SELECT id, name, channel_type, bot_username, status, ai_instructions, ai_fallback_enabled, created_at FROM automations WHERE user_id = ? ORDER BY created_at ASC')
    .bind(user.id)
    .all();

  for (const a of automations) {
    const { results: rules } = await env.MORFO_DB
      .prepare('SELECT id, keyword, reply FROM automation_rules WHERE automation_id = ? ORDER BY created_at ASC')
      .bind(a.id)
      .all();
    a.rules = rules;

    const { results: aiCredentials } = await env.MORFO_DB
      .prepare('SELECT provider, is_active FROM ai_credentials WHERE automation_id = ? ORDER BY priority ASC')
      .bind(a.id)
      .all();
    a.aiCredentials = aiCredentials; // فقط اسم ارائه‌دهنده و فعال بودنش؛ کلید هیچ‌وقت به فرانت نمی‌ره

    const { results: statRows } = await env.MORFO_DB
      .prepare('SELECT source, COUNT(*) as c FROM interactions WHERE automation_id = ? GROUP BY source')
      .bind(a.id)
      .all();
    a.stats = { rule: 0, ai: 0, none: 0, ai_error: 0 };
    for (const row of statRows) {
      a.stats[row.source] = row.c;
    }
    a.stats.total = statRows.reduce((sum, row) => sum + row.c, 0);
  }

  const limits = limitsFor(user.plan);

  return json({
    ok: true,
    plan: user.plan,
    limits,
    automations,
  });
}

// POST /api/automations — اتصال کانال جدید {name, channelType, botToken?}
// channelType='telegram' نیاز به botToken داره؛ channelType='website' نیاز به هیچی نداره
// (خودش بعد از ساخته‌شدن، کد نصب رو برمی‌گردونه)
export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getAuthedUser(request, env);
  if (!user) return json({ ok: false, error: 'ابتدا وارد شوید' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'بدنه درخواست نامعتبر است' }, 400);
  }

  const name = (body.name || '').trim();
  const channelType = VALID_CHANNELS.includes(body.channelType) ? body.channelType : 'telegram';
  const botToken = (body.botToken || '').trim();

  if (!name) {
    return json({ ok: false, error: 'نام کسب‌وکار الزامی است' }, 400);
  }
  if (channelType === 'instagram') {
    return json({ ok: false, error: 'اتصال اینستاگرام از این مسیر انجام نمی‌شه؛ از دکمه اتصال اینستاگرام استفاده کن.' }, 400);
  }
  if (TOKEN_BASED_CHANNELS.includes(channelType) && !botToken) {
    return json({ ok: false, error: 'توکن ربات الزامی است' }, 400);
  }

  const limits = limitsFor(user.plan);
  const countRow = await env.MORFO_DB
    .prepare('SELECT COUNT(*) as c FROM automations WHERE user_id = ?')
    .bind(user.id)
    .first();
  if (countRow.c >= limits.maxAutomations) {
    return json({
      ok: false,
      error: `پلن رایگان شما اجازه اتصال بیش از ${limits.maxAutomations} کانال را نمی‌دهد`,
      upgradeRequired: true,
    }, 403);
  }

  const id = newId();
  const origin = new URL(request.url).origin;
  let botUsername = null;
  let webhookSecret = null;

  if (TOKEN_BASED_CHANNELS.includes(channelType)) {
    const baseUrl = BOT_API_BASE_URLS[channelType];
    let botInfo;
    try {
      botInfo = await getBotInfo(botToken, baseUrl);
    } catch (err) {
      return json({ ok: false, error: `توکن ربات معتبر نیست. لطفاً توکن ${CHANNEL_LABELS[channelType]} رو بررسی کن.` }, 400);
    }
    webhookSecret = newId();
    try {
      await setWebhook(botToken, `${origin}/api/bot/${id}`, webhookSecret, baseUrl);
    } catch (err) {
      return json({ ok: false, error: 'اتصال وبهوک به ربات ناموفق بود. دوباره تلاش کنید.' }, 502);
    }
    botUsername = botInfo.username || null;
  }

  await env.MORFO_DB
    .prepare(
      `INSERT INTO automations (id, user_id, name, channel_type, bot_token, bot_username, webhook_secret, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .bind(id, user.id, name, channelType, TOKEN_BASED_CHANNELS.includes(channelType) ? botToken : null, botUsername, webhookSecret, new Date().toISOString())
    .run();

  return json({
    ok: true,
    automation: { id, name, channel_type: channelType, bot_username: botUsername, status: 'active', rules: [] },
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

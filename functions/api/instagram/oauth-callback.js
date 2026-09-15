import { verifySession, readCookie, newId } from '../../_lib/auth.js';
import { encryptSecret } from '../../_lib/crypto-secrets.js';
import { limitsFor } from '../../_lib/plans.js';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getManagedPages,
  getInstagramAccountInfo,
} from '../../_lib/instagram.js';

// GET /api/instagram/oauth-callback — متا بعد از تایید کاربر به اینجا برمی‌گرده
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = readCookie(request, 'morfo_ig_oauth_state');

  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) return redirect('/login.html');

  if (!code || !state || state !== savedState) {
    return redirect('/dashboard.html?ig_error=state');
  }

  const user = await env.MORFO_DB.prepare('SELECT id, plan FROM users WHERE id = ?').bind(payload.uid).first();
  if (!user) return redirect('/login.html');

  const limits = limitsFor(user.plan);
  const countRow = await env.MORFO_DB.prepare('SELECT COUNT(*) as c FROM automations WHERE user_id = ?').bind(user.id).first();
  if (countRow.c >= limits.maxAutomations) {
    return redirect('/dashboard.html?ig_error=limit');
  }

  let shortToken, longToken, pages;
  try {
    shortToken = await exchangeCodeForToken({
      code,
      appId: env.INSTAGRAM_APP_ID,
      appSecret: env.INSTAGRAM_APP_SECRET,
      redirectUri: env.INSTAGRAM_REDIRECT_URI,
    });
    longToken = await getLongLivedToken({
      shortLivedToken: shortToken,
      appId: env.INSTAGRAM_APP_ID,
      appSecret: env.INSTAGRAM_APP_SECRET,
    });
    pages = await getManagedPages(longToken);
  } catch (err) {
    return redirect('/dashboard.html?ig_error=oauth');
  }

  const pageWithInstagram = pages.find((p) => p.instagram_business_account?.id);
  if (!pageWithInstagram) {
    // رایج‌ترین دلیل شکست: پیج فیسبوک به یک حساب اینستاگرام Business/Creator وصل نیست
    return redirect('/dashboard.html?ig_error=no_ig_account');
  }

  const igAccountId = pageWithInstagram.instagram_business_account.id;
  const pageAccessToken = pageWithInstagram.access_token; // برای ارسال پیام از توکن خودِ پیج استفاده می‌شه

  let igInfo;
  try {
    igInfo = await getInstagramAccountInfo(igAccountId, pageAccessToken);
  } catch (err) {
    return redirect('/dashboard.html?ig_error=oauth');
  }

  if (!env.ENCRYPTION_KEY) {
    return redirect('/dashboard.html?ig_error=server');
  }
  const encryptedToken = await encryptSecret(pageAccessToken, env.ENCRYPTION_KEY);

  const id = newId();
  await env.MORFO_DB
    .prepare(
      `INSERT INTO automations (id, user_id, name, channel_type, ig_page_id, ig_account_id, ig_access_token_encrypted, status, created_at)
       VALUES (?, ?, ?, 'instagram', ?, ?, ?, 'active', ?)`
    )
    .bind(id, user.id, `اینستاگرام @${igInfo.username}`, pageWithInstagram.id, igAccountId, encryptedToken, new Date().toISOString())
    .run();

  return redirect('/dashboard.html?ig_connected=1');
}

function redirect(path) {
  return new Response(null, { status: 302, headers: { Location: path } });
}

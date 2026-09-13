import { createSession, sessionCookie, readCookie, newId } from '../../_lib/auth.js';

// GET /api/auth/google-callback — گوگل بعد از تایید کاربر به اینجا برمی‌گردد
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = readCookie(request, 'morfo_oauth_state');

  if (!code || !state || state !== savedState) {
    return redirectTo('/login.html?error=google_state');
  }

  // تبادل کد با توکن گوگل
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return redirectTo('/login.html?error=google_token');
  }
  const tokenData = await tokenRes.json();

  // گرفتن اطلاعات کاربر از گوگل
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileRes.ok) {
    return redirectTo('/login.html?error=google_profile');
  }
  const profile = await profileRes.json();
  // profile: { sub, email, name, picture, email_verified }

  let user = await env.MORFO_DB
    .prepare('SELECT id, name, email FROM users WHERE google_id = ? OR email = ?')
    .bind(profile.sub, profile.email)
    .first();

  if (!user) {
    const id = newId();
    await env.MORFO_DB
      .prepare('INSERT INTO users (id, name, email, google_id, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, profile.name || profile.email, profile.email, profile.sub, profile.picture || null, new Date().toISOString())
      .run();
    user = { id, name: profile.name, email: profile.email };
  } else {
    // اگر کاربر قبلاً با ایمیل ثبت‌نام کرده بود، google_id را وصل کن
    await env.MORFO_DB
      .prepare('UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?')
      .bind(profile.sub, profile.picture || null, user.id)
      .run();
  }

  const token = await createSession(env.SESSION_SECRET, { uid: user.id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard.html',
      'Set-Cookie': sessionCookie(token),
    },
  });
}

function redirectTo(path) {
  return new Response(null, { status: 302, headers: { Location: path } });
}

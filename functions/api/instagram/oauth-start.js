import { verifySession, readCookie } from '../../_lib/auth.js';

// GET /api/instagram/oauth-start — کاربر رو به صفحه تایید فیسبوک/اینستاگرام هدایت می‌کنه
// نیازمندی: INSTAGRAM_APP_ID و INSTAGRAM_REDIRECT_URI در Cloudflare Environment Variables
// (اپ متا باید نوع Business باشه و دسترسی instagram_manage_messages ازش گرفته بشه — یک‌بار برای همیشه)

export async function onRequestGet(context) {
  const { request, env } = context;

  const token = readCookie(request, 'morfo_session');
  const payload = await verifySession(env.SESSION_SECRET, token);
  if (!payload) {
    return new Response(null, { status: 302, headers: { Location: '/login.html' } });
  }

  if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_REDIRECT_URI) {
    return new Response('اتصال اینستاگرام هنوز تنظیم نشده است.', { status: 500 });
  }

  // state شامل uid کاربره تا در callback بفهمیم این اتصال برای کدوم حسابه، امضاشده با نشست خودش نه یه چیز جعلی
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    response_type: 'code',
    scope: 'instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging',
    state,
  });

  const url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': `morfo_ig_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

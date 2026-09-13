// GET /api/auth/google-start — کاربر را به صفحه ورود گوگل هدایت می‌کند
// نیازمندی: ساخت OAuth Client در Google Cloud Console (رایگان) و تنظیم متغیرهای
// GOOGLE_CLIENT_ID و GOOGLE_REDIRECT_URI در Cloudflare Pages Environment Variables

export async function onRequestGet(context) {
  const { env, request } = context;

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    return new Response('ورود با گوگل هنوز تنظیم نشده است. GOOGLE_CLIENT_ID را در Cloudflare اضافه کنید.', { status: 500 });
  }

  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': `morfo_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

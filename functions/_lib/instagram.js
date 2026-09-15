// تعامل با Instagram Graph API (متا) — مسیر رسمی، نه دور زدن قوانین.
// هر مشتری حساب اینستاگرام Business/Creator خودش رو با OAuth به اپ متای ما وصل می‌کنه.

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// مرحله ۱ از تبادل OAuth: کد موقت رو به توکن دسترسی کوتاه‌مدت تبدیل می‌کنه
export async function exchangeCodeForToken({ code, appId, appSecret, redirectUri }) {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'تبادل کد OAuth ناموفق بود');
  return data.access_token;
}

// مرحله ۲: توکن کوتاه‌مدت رو به توکن بلندمدت (حدود ۶۰ روزه) تبدیل می‌کنه
export async function getLongLivedToken({ shortLivedToken, appId, appSecret }) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'گرفتن توکن بلندمدت ناموفق بود');
  return data.access_token;
}

// پیج‌های فیسبوکی که این کاربر مدیریتشون می‌کنه رو برمی‌گردونه (برای پیدا کردن پیج متصل به اینستاگرام)
export async function getManagedPages(userAccessToken) {
  const res = await fetch(`${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'گرفتن لیست پیج‌ها ناموفق بود');
  return data.data || [];
}

// اطلاعات حساب اینستاگرام بیزینسی متصل به یک پیج (یوزرنیم و غیره)
export async function getInstagramAccountInfo(igAccountId, accessToken) {
  const res = await fetch(`${GRAPH_BASE}/${igAccountId}?fields=username&access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'گرفتن اطلاعات حساب اینستاگرام ناموفق بود');
  return data; // { id, username }
}

// ارسال پاسخ به یک پیام دایرکت اینستاگرام
export async function sendInstagramMessage({ igAccountId, accessToken, recipientId, text }) {
  const res = await fetch(`${GRAPH_BASE}/${igAccountId}/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'ارسال پیام اینستاگرام ناموفق بود');
  return data;
}

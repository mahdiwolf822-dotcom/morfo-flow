import { clearSessionCookie } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}

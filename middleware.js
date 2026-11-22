// Login gate (Vercel Routing Middleware): Sign in with Google, school accounts only.
// Anyone with a verified Google Workspace account on ALLOWED_DOMAIN (default annaisd.org) gets in.
// Environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, optional ALLOWED_DOMAIN.
// The server only learns the teacher's email. Student names stay in each teacher's browser.

export const config = { matcher: '/:path*' };

const DAYS = 30; // how long a sign-in lasts
const enc = new TextEncoder();
const domain = () => (process.env.ALLOWED_DOMAIN || 'annaisd.org').toLowerCase();

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => new TextDecoder().decode(Uint8Array.from(
  atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0)));

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function getCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? m[1] : null;
}

async function sessionEmail(request) {
  const [payload, sig] = (getCookie(request, 'sc_session') || '').split('.');
  if (!payload || !sig || !sameText(await sign(payload), sig)) return null;
  try {
    const { e, x } = JSON.parse(fromB64url(payload));
    return x > Date.now() ? e : null;
  } catch { return null; }
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  cookies.forEach(c => headers.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers });
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function page(message, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Seat Check · Sign in</title>
<style>
:root{--bg:#f2f5f3;--fg:#1b2520;--muted:#5a6a61;--line:#d3dcd6;--surface:#fff;--accent:#2e6b4e;--accent-fg:#fff;--warn:#b8322a;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#121815;--fg:#e4ebe7;--muted:#9aaba2;--line:#2d3a33;--surface:#1b2420;--accent:#5fae88;--accent-fg:#0d1511;--warn:#ff8a80;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;padding:0 16px;box-sizing:border-box}
main{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:28px 24px;max-width:360px;width:100%;box-sizing:border-box;text-align:center}
h1{font-size:1.5rem;margin:0 0 4px}p{color:var(--muted);margin:0 0 20px}
a.btn{display:inline-block;background:var(--accent);color:var(--accent-fg);text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px}
a.btn:focus-visible{outline:3px solid var(--fg);outline-offset:2px}
.msg{color:var(--warn);margin:16px 0 0}
</style></head><body><main>
<h1>Seat Check</h1><p>Sign in with your @${esc(domain())} Google account.</p>
<a class="btn" href="/auth/login">Sign in with Google</a>
${message ? `<p class="msg">${esc(message)}</p>` : ''}
</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default async function middleware(request) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, SESSION_SECRET: secret } = process.env;
  if (!clientId || !clientSecret || !secret) return page('Seat Check is not set up yet. The Google sign-in settings are missing.', 503);

  const url = new URL(request.url);
  const callback = url.origin + '/auth/callback';
  const cookieFlags = 'HttpOnly; Secure; SameSite=Lax';

  if (url.pathname === '/auth/login') {
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    google.search = new URLSearchParams({
      client_id: clientId, redirect_uri: callback, response_type: 'code',
      scope: 'openid email', hd: domain(), prompt: 'select_account', state,
    });
    return redirect(google.toString(), [`sc_state=${state}; Path=/auth; Max-Age=600; ${cookieFlags}`]);
  }

  if (url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code'), state = url.searchParams.get('state');
    if (!code || !state || state !== getCookie(request, 'sc_state')) return page('That sign-in expired. Please try again.', 400);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callback, grant_type: 'authorization_code' }),
    });
    if (!res.ok) return page('Google sign-in did not finish. Please try again.', 502);

    // The ID token came straight from Google's token endpoint over HTTPS using our client secret,
    // so Google's guidance allows skipping the signature check. The claims are still checked.
    let claims;
    try { claims = JSON.parse(fromB64url((await res.json()).id_token.split('.')[1])); }
    catch { return page('Google sign-in did not finish. Please try again.', 502); }

    const email = String(claims.email || '').toLowerCase();
    const allowed = claims.aud === clientId
      && ['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)
      && claims.exp * 1000 > Date.now()
      && claims.email_verified === true
      && claims.hd === domain()                    // a Workspace account owned by the district
      && email.endsWith('@' + domain());
    if (!allowed) return page(`Only @${domain()} school accounts can use Seat Check. Sign in with your school Google account.`, 403);

    const payload = b64url(enc.encode(JSON.stringify({ e: email, x: Date.now() + DAYS * 864e5 })));
    return redirect('/', [
      `sc_session=${payload}.${await sign(payload)}; Path=/; Max-Age=${DAYS * 86400}; ${cookieFlags}`,
      `sc_state=; Path=/auth; Max-Age=0; ${cookieFlags}`,
    ]);
  }

  if (url.pathname === '/auth/logout') {
    return redirect('/', [`sc_session=; Path=/; Max-Age=0; ${cookieFlags}`]);
  }

  if (await sessionEmail(request)) return; // signed in: serve the app
  return page(null, 401);
}

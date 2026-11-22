// Self-check for the Google sign-in gate, with Google's token endpoint faked. Run: node scripts/check-login.mjs
import assert from 'node:assert/strict';
import middleware from '../middleware.js';

Object.assign(process.env, { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret', SESSION_SECRET: 'test-secret' });
const ORIGIN = 'https://seat.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const req = (path, cookie) => new Request(ORIGIN + path, { headers: cookie ? { cookie } : {} });
const cookiesOf = res => res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');

let claims;
globalThis.fetch = async () => new Response(JSON.stringify({ id_token: `x.${b64(claims)}.y` }));
const good = { aud: 'cid', iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 600, email_verified: true, hd: 'annaisd.org', email: 'Teacher@annaisd.org' };

async function signIn(c) {
  claims = c;
  const login = await middleware(req('/auth/login'));
  assert.equal(login.status, 302);
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  return middleware(req(`/auth/callback?code=abc&state=${state}`, cookiesOf(login)));
}

// Not signed in: sign-in page.
assert.equal((await middleware(req('/'))).status, 401);

// School account: gets a session and then the app.
const ok = await signIn(good);
assert.equal(ok.status, 302);
const session = cookiesOf(ok);
assert.equal(await middleware(req('/', session)), undefined);

// Tampered session is refused.
assert.equal((await middleware(req('/', session.replace(/\.(.)/, (m, c) => '.' + (c === 'A' ? 'B' : 'A'))))).status, 401);

// Wrong accounts are refused.
assert.equal((await signIn({ ...good, hd: undefined, email: 'someone@gmail.com' })).status, 403);
assert.equal((await signIn({ ...good, hd: 'other.org', email: 'x@other.org' })).status, 403);
assert.equal((await signIn({ ...good, email_verified: false })).status, 403);
assert.equal((await signIn({ ...good, aud: 'someone-else' })).status, 403);

// State mismatch is refused.
assert.equal((await middleware(req('/auth/callback?code=abc&state=forged', 'sc_state=real'))).status, 400);

// Sign out clears the session.
assert.match((await middleware(req('/auth/logout', session))).headers.getSetCookie()[0], /Max-Age=0/);

console.log('login check passed');

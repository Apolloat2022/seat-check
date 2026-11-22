// Login gate (Vercel Routing Middleware). Every request needs a teacher's username and password.
// Accounts live in the TEACHER_ACCOUNTS environment variable, comma-separated:
//   username:salt:hash,username2:salt2:hash2
// Make an entry with: node scripts/add-teacher.mjs <username> <password>
// Student names never reach the server; they stay in each teacher's browser.
// ponytail: no lockout or rate limit on wrong passwords; add one if the link is shared widely.

export const config = { matcher: '/:path*' };

const enc = new TextEncoder();

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signedIn(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), c => c.charCodeAt(0))); }
  catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 1) return false;
  const user = decoded.slice(0, i).trim().toLowerCase(), pass = decoded.slice(i + 1);
  for (const entry of (process.env.TEACHER_ACCOUNTS || '').split(',')) {
    const [name, salt, hash] = entry.trim().split(':');
    if (name && salt && hash && name === user) return sameText(await hashPassword(pass, salt), hash);
  }
  return false;
}

export default async function middleware(request) {
  if (await signedIn(request)) return; // nothing returned = serve the page
  return new Response('Sign in with your Seat Check username and password.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Seat Check", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}

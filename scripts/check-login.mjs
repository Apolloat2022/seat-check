// Self-check for the login gate. Run: node scripts/check-login.mjs
import assert from 'node:assert/strict';
import middleware, { hashPassword } from '../middleware.js';

process.env.TEACHER_ACCOUNTS = `anna:salt1:${await hashPassword('right-pw', 'salt1')}, ben:salt2:${await hashPassword('ben-pw', 'salt2')}`;
const req = creds => new Request('https://example.test/', { headers: creds ? { authorization: 'Basic ' + btoa(creds) } : {} });

assert.equal(await middleware(req('anna:right-pw')), undefined);      // let in
assert.equal(await middleware(req('Anna:right-pw')), undefined);      // username is not case-sensitive
assert.equal(await middleware(req('ben:ben-pw')), undefined);         // second account, space after comma
assert.equal((await middleware(req('anna:wrong'))).status, 401);
assert.equal((await middleware(req('anna:ben-pw'))).status, 401);     // someone else's password
assert.equal((await middleware(req('nobody:right-pw'))).status, 401);
assert.equal((await middleware(req(null))).status, 401);
console.log('login check passed');

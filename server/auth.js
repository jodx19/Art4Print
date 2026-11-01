'use strict';
const crypto = require('node:crypto');
const { q } = require('./db');

const COOKIE = 'sid';
const SESSION_MS = 7 * 24 * 3600 * 1000;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Express 4 does not catch async errors — wrap handlers. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ── Passwords ── */
function hashPassword(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
    const [salt, hash] = String(stored).split(':');
    if (!salt || !hash) return false;
    const a = Buffer.from(hash, 'hex');
    const b = crypto.scryptSync(pw, salt, 64);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const DUMMY_HASH = hashPassword('dummy'); // equalise timing for unknown users

/* ── Admin account: ADMIN_USERNAME / ADMIN_PASSWORD env vars are the source of truth.
      Created if missing; password hash updated whenever the env password changes. ── */
async function seedAdmin() {
    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    let password = (process.env.ADMIN_PASSWORD || '').trim();

    if (password) {
        const [user] = await q('SELECT id, password_hash FROM users WHERE username = $1', [username]);
        if (!user) {
            await q('INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING', [username, hashPassword(password)]);
            console.log(`Admin account created: ${username}`);
        } else if (!verifyPassword(password, user.password_hash)) {
            await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), user.id]);
            await q('DELETE FROM sessions WHERE user_id = $1', [user.id]);
            console.log(`Admin password updated from env: ${username}`);
        }
        return;
    }

    // No password configured: create a random one only if there is no admin at all.
    const [{ c }] = await q('SELECT COUNT(*)::int c FROM users');
    if (c > 0) return;
    password = crypto.randomBytes(9).toString('base64url');
    await q('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hashPassword(password)]);
    console.log('──── ADMIN ACCOUNT CREATED ────');
    console.log(`username: ${username}`);
    console.log(`password: ${password}  (generated — set ADMIN_PASSWORD to choose your own)`);
}

/* ── Login throttling: 5 failures / 15 min per IP (per server instance) ── */
const fails = new Map();
const WINDOW = 15 * 60 * 1000;
const throttled = (ip) => { const e = fails.get(ip); return !!e && e.count >= 5 && Date.now() - e.first < WINDOW; };
function noteFail(ip) {
    const e = fails.get(ip);
    if (!e || Date.now() - e.first >= WINDOW) fails.set(ip, { count: 1, first: Date.now() });
    else e.count++;
}

/* ── Sessions (stored in Postgres so they survive serverless cold starts) ── */
function parseCookies(req) {
    const out = {};
    (req.headers.cookie || '').split(';').forEach((p) => {
        const i = p.indexOf('=');
        if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
}
function cookieOpts(maxAge) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAge / 1000)}${secure}`;
}
async function createSession(res, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    await q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [sha(token), userId, Date.now() + SESSION_MS]);
    await q('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]); // housekeeping
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieOpts(SESSION_MS)}`);
}
async function destroySession(req, res) {
    const t = parseCookies(req)[COOKIE];
    if (t) await q('DELETE FROM sessions WHERE token_hash = $1', [sha(t)]);
    res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOpts(0)}`);
}
async function currentUser(req) {
    const t = parseCookies(req)[COOKIE];
    if (!t) return null;
    const [row] = await q(
        `SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`, [sha(t)]);
    if (!row) return null;
    if (Number(row.expires_at) < Date.now()) {
        await q('DELETE FROM sessions WHERE token_hash = $1', [sha(t)]);
        return null;
    }
    return { id: row.id, username: row.username };
}

/* ── Middleware ── */
const requireAdminApi = wrap(async (req, res, next) => {
    const u = await currentUser(req);
    if (!u) return res.status(401).json({ error: 'غير مصرح' });
    req.user = u;
    next();
});
/** For HTML pages: non-admins are silently sent to the home page. */
const requireAdminPage = wrap(async (req, res, next) => {
    const u = await currentUser(req);
    if (!u) return res.redirect('/');
    req.user = u;
    res.setHeader('Cache-Control', 'no-store');
    next();
});

const login = wrap(async (req, res) => {
    const ip = req.ip;
    if (throttled(ip)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد 15 دقيقة' });
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'بيانات غير صحيحة' });
    }
    const [user] = await q('SELECT id, password_hash FROM users WHERE username = $1', [username]);
    const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH) && !!user;
    if (!ok) { noteFail(ip); return res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' }); }
    fails.delete(ip);
    await createSession(res, user.id);
    res.json({ ok: true });
});

module.exports = { wrap, seedAdmin, login, destroySession, currentUser, requireAdminApi, requireAdminPage };

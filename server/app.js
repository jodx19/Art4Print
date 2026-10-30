'use strict';
const path = require('node:path');
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const api = require('./api');

const app = express();
app.disable('x-powered-by');
if (process.env.VERCEL || process.env.TRUST_PROXY) app.set('trust proxy', 1);

app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
});
app.use(express.json({ limit: '100kb' }));

// Make sure tables exist (once per cold start) before handling any dynamic request.
app.use(auth.wrap(async (_req, _res, next) => { await db.init(); next(); }));

app.use('/api', api);

// Admin dashboard — only reachable with a valid admin session, otherwise redirected home.
app.use('/admin', auth.requireAdminPage,
    express.static(path.join(__dirname, '..', 'private', 'admin'), { index: 'index.html' }));

// Local development only: on Vercel the static storefront in /public is served by the CDN.
if (!process.env.VERCEL) {
    app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', extensions: ['html'] }));
}

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
});

module.exports = app;

'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { put, del } = require('@vercel/blob');
const { q } = require('./db');
const auth = require('./auth');

const router = express.Router();
const { wrap } = auth;

/* ── Upload handling ──
   Vercel Functions cap request bodies at ~4.5MB, so files are limited to 4MB.
   Files go to Vercel Blob (permanent public CDN URLs); metadata lives in Postgres. */
const MAX_UPLOAD = 4 * 1024 * 1024;
const TYPES = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain', '.zip': 'application/zip'
};
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const extOf = (n) => path.extname(String(n).split('?')[0]).toLowerCase();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD, files: 10 },
    fileFilter: (_req, file, cb) =>
        TYPES[extOf(file.originalname)] ? cb(null, true) : cb(new Error('نوع الملف غير مسموح'))
});

const fixName = (n) => Buffer.from(n, 'latin1').toString('utf8'); // multer decodes names as latin1
const uploadRow = (r) => ({
    id: r.id, name: r.original_name, url: r.url, mime: r.mime, size: r.size,
    isImage: IMAGE_EXT.has(extOf(r.url)), createdAt: r.created_at
});

/* ── Validation ── */
function cleanProduct(b = {}) {
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const p = {
        name: str(b.name, 150), category: str(b.category, 60), price: str(b.price, 60),
        description: str(b.description, 1000), image: str(b.image, 500), emoji: str(b.emoji, 8)
    };
    if (!p.name) return { error: 'اسم المنتج مطلوب' };
    if (!p.price) return { error: 'السعر مطلوب' };
    if (p.image && !/^https?:\/\/\S+$/i.test(p.image)) return { error: 'رابط الصورة غير صحيح' };
    return { value: p };
}
const toId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };

/* ── Auth ── */
router.post('/auth/login', auth.login);
router.post('/auth/logout', wrap(async (req, res) => { await auth.destroySession(req, res); res.json({ ok: true }); }));
router.get('/auth/me', wrap(async (req, res) => {
    const u = await auth.currentUser(req);
    res.json(u ? { admin: true, username: u.username } : { admin: false });
}));

/* ── Public catalogue ── */
router.get('/products', wrap(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await q('SELECT id, name, category, price, description, image, emoji FROM products ORDER BY id DESC'));
}));
router.get('/categories', wrap(async (_req, res) => {
    res.json(await q('SELECT id, name, emoji FROM categories ORDER BY sort, id'));
}));

/* ── Admin: products ── */
router.post('/products', auth.requireAdminApi, wrap(async (req, res) => {
    const { value: v, error } = cleanProduct(req.body);
    if (error) return res.status(400).json({ error });
    const [row] = await q(
        'INSERT INTO products (name, category, price, description, image, emoji) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [v.name, v.category, v.price, v.description, v.image, v.emoji]);
    res.status(201).json({ id: row.id, ...v });
}));
router.put('/products/:id', auth.requireAdminApi, wrap(async (req, res) => {
    const id = toId(req.params.id);
    const { value: v, error } = cleanProduct(req.body);
    if (error) return res.status(400).json({ error });
    const r = await q(
        'UPDATE products SET name=$1, category=$2, price=$3, description=$4, image=$5, emoji=$6 WHERE id=$7 RETURNING id',
        [v.name, v.category, v.price, v.description, v.image, v.emoji, id]);
    if (!r.length) return res.status(404).json({ error: 'المنتج غير موجود' });
    res.json({ id, ...v });
}));
router.delete('/products/:id', auth.requireAdminApi, wrap(async (req, res) => {
    const r = await q('DELETE FROM products WHERE id = $1 RETURNING id', [toId(req.params.id)]);
    if (!r.length) return res.status(404).json({ error: 'المنتج غير موجود' });
    res.json({ ok: true });
}));

/* ── Admin: files & images ── */
router.get('/uploads', auth.requireAdminApi, wrap(async (_req, res) => {
    res.json((await q('SELECT * FROM uploads ORDER BY id DESC')).map(uploadRow));
}));
router.post('/uploads', auth.requireAdminApi, (req, res, next) => {
    upload.array('files', 10)(req, res, wrap(async (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE' ? 'الملف أكبر من 4MB' : err.message;
            return res.status(400).json({ error: msg });
        }
        if (!req.files?.length) return res.status(400).json({ error: 'لم يتم اختيار ملف' });
        const out = [];
        for (const f of req.files) {
            const ext = extOf(f.originalname);
            const blob = await put(`uploads/${crypto.randomBytes(12).toString('hex')}${ext}`, f.buffer, {
                access: 'public', contentType: TYPES[ext], addRandomSuffix: false
            });
            const [row] = await q(
                'INSERT INTO uploads (original_name, url, mime, size) VALUES ($1,$2,$3,$4) RETURNING *',
                [fixName(f.originalname).slice(0, 200), blob.url, TYPES[ext], f.size]);
            out.push(uploadRow(row));
        }
        res.status(201).json(out);
    }, next));
});
router.delete('/uploads/:id', auth.requireAdminApi, wrap(async (req, res) => {
    const [row] = await q('DELETE FROM uploads WHERE id = $1 RETURNING url', [toId(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'الملف غير موجود' });
    try { await del(row.url); } catch (e) { console.error('blob delete failed', e.message); }
    res.json({ ok: true });
}));

router.use((_req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = router;

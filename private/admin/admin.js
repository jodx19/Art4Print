'use strict';
/* ─── Helpers ─── */
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMOJIS = { 'ملزمات': '📒', 'أقلام': '✏️', 'أوراق': '📄', 'مستلزمات': '🛒' };

async function api(url, opts = {}) {
    const init = { credentials: 'same-origin', ...opts };
    if (opts.json !== undefined) {
        init.method = init.method || 'POST';
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(opts.json);
    }
    const res = await fetch(url, init);
    if (res.status === 401) { location.href = '/'; throw new Error('unauthorized'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
}

let toastTimer;
function toast(msg) {
    const el = $('adminToast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

/* ─── Theme ─── */
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('artprint_theme', t);
    $('themeIcon').className = t === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
}
applyTheme(localStorage.getItem('artprint_theme') || 'light');
$('themeToggle').addEventListener('click', () =>
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

/* ─── Auth ─── */
$('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    location.href = '/';
});

/* ─── Tabs ─── */
$('adminTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.admin-tab');
    if (!b) return;
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t === b));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    if (b.dataset.tab === 'media') loadMedia();
});

/* ─── Confirm dialog ─── */
let onConfirm = null;
function confirmDialog(text, fn) {
    $('confirmText').textContent = text;
    onConfirm = fn;
    $('confirmOverlay').classList.add('active');
}
function closeConfirm() { onConfirm = null; $('confirmOverlay').classList.remove('active'); }
$('confirmCancel').addEventListener('click', closeConfirm);
$('confirmOk').addEventListener('click', async () => { const fn = onConfirm; closeConfirm(); if (fn) await fn(); });
$('confirmOverlay').addEventListener('click', (e) => { if (e.target.id === 'confirmOverlay') closeConfirm(); });

/* ═════════ Products ═════════ */
let products = [];
let categories = [];
let media = [];
let editingId = null;
let currentImage = '';
let currentEmoji = '';

async function loadProducts() {
    products = await api('/api/products');
    renderProducts();
}

function renderStats() {
    const cats = [...new Set(products.map((p) => p.category))];
    $('statsBar').innerHTML = `
        <div class="stat-box stat-total"><div class="stat-box-label">إجمالي المنتجات</div><div class="stat-box-val">${products.length}</div></div>
        <div class="stat-box stat-cat"><div class="stat-box-label">عدد الأصناف</div><div class="stat-box-val">${cats.length}</div></div>
        ${cats.map((c) => `<div class="stat-box"><div class="stat-box-label">${esc(c)}</div>
            <div class="stat-box-val" style="font-size:1.4rem">${products.filter((p) => p.category === c).length}</div></div>`).join('')}`;
}

function renderProducts() {
    renderStats();
    const grid = $('adminProductsGrid');
    if (!products.length) {
        grid.innerHTML = `<div class="admin-empty"><i class="ti ti-package-off"></i>
            <h3>لا توجد منتجات حتى الآن</h3><p>اضغط "إضافة منتج جديد" لبدء إضافة منتجاتك</p></div>`;
        return;
    }
    grid.innerHTML = `<div class="products-admin-grid">${products.map((p) => {
        const ph = `<div class="admin-card-placeholder">${esc(p.emoji || EMOJIS[p.category] || '📦')}</div>`;
        const img = p.image
            ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" class="admin-card-img" onerror="this.outerHTML=this.dataset.ph" data-ph="${esc(ph)}">`
            : ph;
        return `<div class="admin-product-card">${img}
            <div class="admin-card-body">
                <div class="admin-card-top"><div class="admin-card-name">${esc(p.name)}</div>
                    <span class="admin-cat-badge">${esc(p.category)}</span></div>
                <div class="admin-card-desc">${esc(p.description) || '—'}</div>
                <div class="admin-card-price">${esc(p.price)}</div>
                <div class="admin-card-actions">
                    <button class="btn-edit-card" data-act="edit" data-id="${p.id}"><i class="ti ti-pencil"></i> تعديل</button>
                    <button class="btn-del-card" data-act="del" data-id="${p.id}"><i class="ti ti-trash"></i> حذف</button>
                </div></div></div>`;
    }).join('')}</div>`;
}

$('adminProductsGrid').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const p = products.find((x) => x.id === Number(b.dataset.id));
    if (!p) return;
    if (b.dataset.act === 'edit') openForm(p);
    else confirmDialog(`هل أنت متأكد من حذف "${p.name}"؟ لا يمكن التراجع عن هذا الإجراء.`, async () => {
        try { await api('/api/products/' + p.id, { method: 'DELETE' }); toast('🗑️ تم حذف المنتج'); await loadProducts(); }
        catch (err) { toast('⚠️ ' + err.message); }
    });
});

/* ─── Form ─── */
function fillCategories(selected) {
    const names = categories.map((c) => c.name);
    if (selected && !names.includes(selected)) names.push(selected);
    $('fCategory').innerHTML = names.map((n) =>
        `<option value="${esc(n)}"${n === selected ? ' selected' : ''}>${esc((categories.find((c) => c.name === n)?.emoji || '') + ' ' + n)}</option>`).join('');
}

function setImage(url, label) {
    currentImage = url || '';
    $('imagePreview').classList.toggle('show', !!url);
    $('previewThumb').src = url || '';
    $('previewName').textContent = label || '';
    renderLibraryPicker();
}

function switchImgTab(panel) {
    document.querySelectorAll('.img-tab').forEach((t) => t.classList.toggle('active', t.dataset.panel === panel));
    document.querySelectorAll('.img-tab-panel').forEach((p) =>
        p.classList.toggle('active', p.id === 'panel' + panel[0].toUpperCase() + panel.slice(1)));
    if (panel === 'library') loadMedia();
}

function openForm(p) {
    editingId = p ? p.id : null;
    currentEmoji = p?.emoji || '';
    $('formTitle').innerHTML = p
        ? '<i class="ti ti-pencil" style="color:var(--violet)"></i> تعديل المنتج'
        : '<i class="ti ti-plus-circle" style="color:var(--violet)"></i> إضافة منتج جديد';
    $('fName').value = p?.name || '';
    $('fPrice').value = p?.price || '';
    $('fDesc').value = p?.description || '';
    $('fImgUrl').value = p?.image && !p.image.startsWith('/uploads/') ? p.image : '';
    $('fileInput').value = '';
    fillCategories(p?.category || categories[0]?.name);
    document.querySelectorAll('.emoji-opt').forEach((b) => b.classList.toggle('selected', b.dataset.emoji === currentEmoji));
    setImage(p?.image || '', p?.image ? 'الصورة الحالية' : '');
    switchImgTab(p?.image && !p.image.startsWith('/uploads/') ? 'url' : 'upload');
    $('formPanel').classList.add('active');
    $('formPanel').scrollIntoView({ behavior: 'smooth' });
    $('fName').focus({ preventScroll: true });
}
function closeForm() { $('formPanel').classList.remove('active'); editingId = null; }

$('btnAddNew').addEventListener('click', () => openForm(null));
$('cancelFormBtn').addEventListener('click', closeForm);
$('removeImgBtn').addEventListener('click', () => { $('fImgUrl').value = ''; $('fileInput').value = ''; setImage('', ''); });
document.querySelector('.image-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.img-tab');
    if (t) switchImgTab(t.dataset.panel);
});
$('fImgUrl').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    setImage(v, v ? 'رابط خارجي' : '');
});
$('emojiPicker').addEventListener('click', (e) => {
    const b = e.target.closest('.emoji-opt');
    if (!b) return;
    const was = b.classList.contains('selected');
    document.querySelectorAll('.emoji-opt').forEach((x) => x.classList.remove('selected'));
    currentEmoji = was ? '' : b.dataset.emoji;
    if (!was) b.classList.add('selected');
});

$('saveBtn').addEventListener('click', async () => {
    const body = {
        name: $('fName').value.trim(), category: $('fCategory').value, price: $('fPrice').value.trim(),
        description: $('fDesc').value.trim(), image: currentImage, emoji: currentEmoji
    };
    if (!body.name) return toast('⚠️ أدخل اسم المنتج أولاً');
    if (!body.price) return toast('⚠️ أدخل السعر أولاً');
    $('saveBtn').disabled = true;
    try {
        await api(editingId ? '/api/products/' + editingId : '/api/products', { method: editingId ? 'PUT' : 'POST', json: body });
        toast(editingId ? '✅ تم تعديل المنتج بنجاح' : '✅ تم إضافة المنتج بنجاح');
        closeForm();
        await loadProducts();
    } catch (err) { toast('⚠️ ' + err.message); }
    finally { $('saveBtn').disabled = false; }
});

/* ═════════ Uploads ═════════ */
async function uploadFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return [];
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    toast('⏳ جاري الرفع...');
    const out = await api('/api/uploads', { method: 'POST', body: fd });
    toast(`✅ تم رفع ${out.length} ملف`);
    return out;
}

async function pickProductImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('⚠️ اختر ملف صورة');
    try {
        const [up] = await uploadFiles([file]);
        setImage(up.url, up.name);
        loadMedia();
    } catch (err) { toast('⚠️ ' + err.message); }
}
$('fileInput').addEventListener('change', (e) => pickProductImage(e.target.files[0]));

function wireDrop(zone, onFiles) {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
    });
}
wireDrop($('dropZone'), (f) => pickProductImage(f[0]));
wireDrop($('mediaDrop'), (f) => doMediaUpload(f));

async function doMediaUpload(files) {
    try { await uploadFiles(files); await loadMedia(); }
    catch (err) { toast('⚠️ ' + err.message); }
    $('mediaInput').value = '';
}
$('mediaInput').addEventListener('change', (e) => doMediaUpload(e.target.files));

async function loadMedia() {
    try { media = await api('/api/uploads'); } catch { return; }
    renderMedia();
    renderLibraryPicker();
}

function renderMedia() {
    const g = $('mediaGrid');
    if (!media.length) {
        g.innerHTML = `<div class="admin-empty" style="grid-column:1/-1"><i class="ti ti-folder-off"></i>
            <h3>لا توجد ملفات مرفوعة</h3><p>ارفع صوراً أو ملفات لتظهر هنا</p></div>`;
        return;
    }
    g.innerHTML = media.map((m) => `
        <div class="media-card">
            ${m.isImage ? `<img src="${esc(m.url)}" alt="${esc(m.name)}" loading="lazy">`
                        : `<div class="media-file-icon"><i class="ti ti-file-text"></i></div>`}
            <div class="media-info">
                <div class="media-name" title="${esc(m.name)}">${esc(m.name)}</div>
                <div class="media-meta">${fmtSize(m.size)}</div>
                <div class="media-actions">
                    <button class="btn-edit-card" data-act="copy" data-id="${m.id}"><i class="ti ti-copy"></i> نسخ الرابط</button>
                    <button class="btn-del-card" data-act="del" data-id="${m.id}"><i class="ti ti-trash"></i></button>
                </div>
            </div>
        </div>`).join('');
}
$('mediaGrid').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const m = media.find((x) => x.id === Number(b.dataset.id));
    if (!m) return;
    if (b.dataset.act === 'copy') {
        try { await navigator.clipboard.writeText(location.origin + m.url); toast('📋 تم نسخ الرابط'); }
        catch { toast(location.origin + m.url); }
    } else {
        confirmDialog(`هل أنت متأكد من حذف "${m.name}"؟ لن تظهر الصورة في أي منتج يستخدمها.`, async () => {
            try { await api('/api/uploads/' + m.id, { method: 'DELETE' }); toast('🗑️ تم حذف الملف'); await loadMedia(); }
            catch (err) { toast('⚠️ ' + err.message); }
        });
    }
});

function renderLibraryPicker() {
    const imgs = media.filter((m) => m.isImage);
    $('libraryPicker').innerHTML = imgs.length
        ? imgs.map((m) => `<button type="button" class="library-item${m.url === currentImage ? ' selected' : ''}" data-url="${esc(m.url)}" data-name="${esc(m.name)}">
              <img src="${esc(m.url)}" alt="${esc(m.name)}" loading="lazy"></button>`).join('')
        : '<p class="library-empty">لا توجد صور في المكتبة بعد — ارفع صورة من تبويب «رفع من الجهاز».</p>';
}
$('libraryPicker').addEventListener('click', (e) => {
    const b = e.target.closest('.library-item');
    if (b) setImage(b.dataset.url, b.dataset.name);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeConfirm(); closeForm(); } });

/* ─── Boot ─── */
(async function init() {
    try {
        categories = await api('/api/categories');
        await Promise.all([loadProducts(), loadMedia()]);
    } catch (err) { toast('⚠️ ' + err.message); }
})();

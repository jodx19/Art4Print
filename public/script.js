/* ============================================================
   Art Print — script.js
   Products System + Dark Mode + UI Features
   ============================================================ */

/* ─── Constants ─────────────────────────────────── */
const WA_NUMBER  = '201141431662';
const TG_LINK    = 'https://t.me/+201141431662';
const WA_LINK    = `https://wa.me/${WA_NUMBER}`;
const API_PRODUCTS = '/api/products';

/** Escape untrusted text before injecting it into HTML */
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ─── Loading Screen ─────────────────────────────── */
function hideLoader() {
    const screen = document.getElementById('loadingScreen');
    const fill   = document.getElementById('loaderFill');
    if (!screen) return;
    if (fill) fill.style.width = '100%';
    setTimeout(() => screen.classList.add('hidden'), 150);
}
window.addEventListener('load', hideLoader);
setTimeout(hideLoader, 1500); // safety fallback if a CDN is slow

/* ─── Dark Mode ─────────────────────────────────── */
const darkToggle = document.getElementById('darkToggle');
const darkIcon   = document.getElementById('darkIcon');
const htmlEl     = document.documentElement;

function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('artprint_theme', theme);
    if (darkIcon) {
        darkIcon.className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    }
}

// Load saved theme
const savedTheme = localStorage.getItem('artprint_theme') || 'light';
applyTheme(savedTheme);

if (darkToggle) {
    darkToggle.addEventListener('click', () => {
        const current = htmlEl.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });
}

/* ─── Scroll Progress Bar ───────────────────────── */
const progressBar = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
    if (!progressBar) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
}, { passive: true });

/* ─── Nav Scroll Effect ──────────────────────────── */
const mainNav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
    if (!mainNav) return;
    mainNav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* ─── Mobile Menu Toggle ─────────────────────────── */
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('active');
        navToggle.querySelector('i').className = isOpen ? 'ti ti-x' : 'ti ti-menu-2';
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            navToggle.querySelector('i').className = 'ti ti-menu-2';
            document.body.style.overflow = '';
        });
    });
}

/* ─── Scroll Reveal Animation ────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            revealObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.anim-up, .anim-left, .anim-right, .anim-scale')
    .forEach(el => revealObserver.observe(el));

/* ─── Stat Counter Animation ─────────────────────── */
const statEl = document.querySelector('.stat-val[data-target]');
if (statEl) {
    const heroVisual = document.querySelector('.hero-visual');
    const statObs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
            let n = 0;
            const target = parseInt(statEl.dataset.target);
            const step = () => {
                n += Math.ceil(target / 60);
                if (n >= target) { statEl.textContent = '5K+'; return; }
                statEl.textContent = n;
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            statObs.unobserve(heroVisual);
        }
    }, { threshold: 0.5 });
    if (heroVisual) statObs.observe(heroVisual);
}

/* ─── Back to Top ────────────────────────────────── */
const backToTopBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
    if (!backToTopBtn) return;
    backToTopBtn.classList.toggle('visible', window.scrollY > 500);
}, { passive: true });

if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ─── Toast Notification ─────────────────────────── */
function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toastNotif');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

/** Copy text to clipboard (with legacy fallback). Resolves true on success */
async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (_) { /* fall through */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch (_) { return false; }
}

/* ─── Products System ────────────────────────────── */
/* المنتجات تُحمَّل من الخادم (/api/products) وتُدار من لوحة الإدارة */
let productsCache = [];

async function fetchProducts() {
    try {
        const res = await fetch(API_PRODUCTS, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status);
        productsCache = await res.json();
    } catch (_) {
        productsCache = [];
        showToast('⚠️ تعذّر تحميل المنتجات، حاول لاحقاً');
    }
    return productsCache;
}

function loadProducts() { return productsCache; }

/** Get category emoji fallback */
const CATEGORY_EMOJI = {
    'ملزمات': '📒',
    'أقلام':  '✏️',
    'أوراق':  '📄',
    'مستلزمات': '🛒'
};

/** Render a single product card */
function renderProductCard(product, delay = 0) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.animationDelay = delay + 'ms';
    card.setAttribute('data-category', product.category);
    card.setAttribute('data-id', product.id);

    const imgHTML = product.image
        ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" class="product-card-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="product-card-placeholder" style="display:none">${esc(product.emoji || CATEGORY_EMOJI[product.category] || '📦')}</div>`
        : `<div class="product-card-placeholder">${esc(product.emoji || CATEGORY_EMOJI[product.category] || '📦')}</div>`;

    card.innerHTML = `
        ${imgHTML}
        <div class="product-card-body">
            <span class="product-card-category">${esc(product.category)}</span>
            <h3 class="product-card-name">${esc(product.name)}</h3>
            <p class="product-card-desc">${esc(product.description)}</p>
            <div class="product-card-footer">
                <span class="product-card-price">${esc(product.price)}</span>
                <button class="product-order-btn" onclick="openProductModal(${product.id})">
                    <i class="ti ti-shopping-cart"></i> اطلب
                </button>
            </div>
        </div>`;

    card.addEventListener('click', (e) => {
        if (!e.target.closest('.product-order-btn')) {
            openProductModal(product.id);
        }
    });

    return card;
}

/** Render all products (with optional category filter) */
function renderProducts(filterCategory = 'all') {
    const grid     = document.getElementById('productsGrid');
    const empty    = document.getElementById('productsEmpty');
    const noData   = document.getElementById('productsNoData');
    const ctaBar   = document.getElementById('productsCTABar');
    if (!grid) return;

    const all = loadProducts();
    const filtered = filterCategory === 'all'
        ? all
        : all.filter(p => p.category === filterCategory);

    // Clear grid
    grid.innerHTML = '';

    if (all.length === 0) {
        // No products at all
        noData && (noData.style.display = 'block');
        empty  && (empty.style.display  = 'none');
        ctaBar && (ctaBar.style.display = 'none');
        return;
    }

    noData && (noData.style.display = 'none');
    ctaBar && (ctaBar.style.display = '');

    if (filtered.length === 0) {
        empty && (empty.style.display = 'block');
        return;
    }

    empty && (empty.style.display = 'none');

    filtered.forEach((product, i) => {
        const card = renderProductCard(product, i * 80);
        grid.appendChild(card);
    });
}

/* ─── Filter Tabs ────────────────────────────────── */
const filterTabs = document.getElementById('filterTabs');
if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProducts(btn.dataset.filter);
    });
}

/* ─── Product Modal ──────────────────────────────── */
let allProducts = [];

function openProductModal(productId) {
    allProducts = loadProducts();
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const overlay   = document.getElementById('productModal');
    const imgWrap   = document.getElementById('modalImgWrap');
    const category  = document.getElementById('modalCategory');
    const name      = document.getElementById('modalProductName');
    const desc      = document.getElementById('modalProductDesc');
    const price     = document.getElementById('modalProductPrice');
    const waBtn     = document.getElementById('modalWaBtn');
    const tgBtn     = document.getElementById('modalTgBtn');

    // Image
    if (imgWrap) {
        imgWrap.innerHTML = product.image
            ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" style="width:100%;height:240px;object-fit:cover;display:block;">`
            : `<div class="modal-img-placeholder">${esc(product.emoji || CATEGORY_EMOJI[product.category] || '📦')}</div>`;
    }

    if (category) category.textContent = product.category;
    if (name)     name.textContent     = product.name;
    if (desc)     desc.textContent     = product.description;
    if (price)    price.textContent    = product.price;

    // Order message
    const msg = encodeURIComponent(`مرحباً 👋، أريد طلب: *${product.name}*\nالسعر: ${product.price}\n\nمن موقع Art Print`);

    if (waBtn) waBtn.href = `${WA_LINK}?text=${msg}`;
    if (tgBtn) tgBtn.href = TG_LINK;

    overlay && overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close modal
const modalClose   = document.getElementById('modalClose');
const modalOverlay = document.getElementById('productModal');

function closeModal() {
    modalOverlay && modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (modalClose)   modalClose.addEventListener('click', closeModal);
if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

/* ─── Order Form with WhatsApp + Telegram ─────── */
const orderForm = document.getElementById('orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const name    = document.getElementById('formName')?.value    || '';
        const phone   = document.getElementById('formPhone')?.value   || '';
        const service = document.getElementById('formService')?.value || '';
        const details = document.getElementById('formDetails')?.value || '';
        const via     = document.querySelector('input[name="sendVia"]:checked')?.value || 'whatsapp';

        const msgText = `*طلب جديد من Art Print* 🎨\n` +
                        `─────────────────\n` +
                        `*الاسم:* ${name}\n` +
                        `*رقم الهاتف:* ${phone}\n` +
                        `*نوع الخدمة:* ${service}\n` +
                        `*تفاصيل الطلب:*\n${details}`;

        const btn = document.getElementById('formSubmitBtn');
        if (!btn) return;

        const originalHTML = btn.innerHTML;
        btn.innerHTML  = '<i class="ti ti-loader-2"></i> جاري الإرسال...';
        btn.disabled   = true;

        setTimeout(() => {
            if (via === 'telegram') {
                copyText(msgText.replace(/\*/g, '')).then(ok => {
                    showToast(ok ? '✅ تم نسخ الطلب — الصقه في محادثة تيليجرام' : '⚠️ تعذّر النسخ، اكتب طلبك يدوياً في تيليجرام', 5000);
                    window.open(TG_LINK, '_blank');
                });
            } else {
                const url = `${WA_LINK}?text=${encodeURIComponent(msgText)}`;
                window.open(url, '_blank');
                showToast('✅ تم التحويل إلى واتساب بنجاح');
            }

            btn.innerHTML = '✓ تم الإرسال';
            btn.style.background = 'var(--lime)';

            setTimeout(() => {
                btn.innerHTML  = originalHTML;
                btn.style.background = '';
                btn.disabled   = false;
                orderForm.reset();
            }, 3000);
        }, 800);
    });
}

/* ─── Hero Button Ripple ─────────────────────────── */
document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', function (e) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        const rect = this.getBoundingClientRect();
        ripple.style.cssText = `
            width: 60px; height: 60px;
            left: ${e.clientX - rect.left - 30}px;
            top:  ${e.clientY - rect.top  - 30}px;
        `;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });
});

/* ─── FAB Stack Animation ────────────────────────── */
const fabStack = document.getElementById('fabStack');
if (fabStack) {
    window.addEventListener('scroll', () => {
        fabStack.style.opacity = window.scrollY > 200 ? '1' : '0.7';
    }, { passive: true });
}

/* ─── Admin login (no admin link is exposed on the page) ───
   زر القفل في الفوتر يفتح نافذة الدخول، وعند نجاح الدخول يتم التوجيه تلقائياً للوحة الإدارة. */
(function initAdminLogin() {
    const trigger = document.getElementById('adminLoginBtn');
    const modal   = document.getElementById('loginModal');
    const form    = document.getElementById('loginForm');
    const errEl   = document.getElementById('loginError');
    const submit  = document.getElementById('loginSubmit');
    if (!trigger || !modal || !form) return;

    const open  = () => { modal.classList.add('active'); document.body.style.overflow = 'hidden'; setTimeout(() => document.getElementById('loginUser').focus(), 50); };
    const close = () => { modal.classList.remove('active'); document.body.style.overflow = ''; errEl.textContent = ''; form.reset(); };

    // لو كان الأدمن مسجلاً دخوله مسبقاً، يذهب مباشرة للوحة
    trigger.addEventListener('click', async () => {
        try {
            const me = await (await fetch('/api/auth/me')).json();
            if (me.admin) { location.href = '/admin'; return; }
        } catch (_) { /* fall through to login modal */ }
        open();
    });
    document.getElementById('loginClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        errEl.textContent = '';
        submit.disabled = true;
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: document.getElementById('loginUser').value.trim(),
                    password: document.getElementById('loginPass').value
                })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) { location.href = '/admin'; return; }
            errEl.textContent = data.error || 'تعذّر تسجيل الدخول';
            document.getElementById('loginPass').value = '';
        } catch (_) {
            errEl.textContent = 'تعذّر الاتصال بالخادم';
        } finally { submit.disabled = false; }
    });
})();

/* ─── Init: load products from the server ─────────── */
fetchProducts().then(() => {
    const active = document.querySelector('.filter-btn.active');
    renderProducts(active ? active.dataset.filter : 'all');
});

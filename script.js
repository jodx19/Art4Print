/* --- Scroll Reveal Animation --- */
const observerOptions = {
    threshold: 0.15,
    rootMargin: "0px"
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Once visible, no need to observe anymore
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Elements to observe
document.querySelectorAll('.anim-up, .anim-left, .anim-right, .anim-scale').forEach(el => {
    observer.observe(el);
});

/* --- Mobile Menu Toggle --- */
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');
const navLinksItems = document.querySelectorAll('.nav-link');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.replace('ti-menu-2', 'ti-x');
        } else {
            icon.classList.replace('ti-x', 'ti-menu-2');
        }
    });
}

// Close menu when clicking a link
navLinksItems.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = navToggle.querySelector('i');
        icon.classList.replace('ti-x', 'ti-menu-2');
    });
});

/* --- Stat Counter Animation --- */
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start) + (end > 1000 ? "K+" : "");
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

const statObj = document.querySelector('.stat-val[data-target]');
if(statObj) {
    const targetVal = parseInt(statObj.getAttribute('data-target'));
    // Trigger animation when the hero visual becomes visible
    const heroVisual = document.querySelector('.hero-visual');
    const statObserver = new IntersectionObserver((entries) => {
        if(entries[0].isIntersecting) {
            animateValue(statObj, 0, 5, 2000); // For "5K+"
            statObserver.unobserve(heroVisual);
        }
    }, { threshold: 0.5 });
    statObserver.observe(heroVisual);
}

/* --- Form Submission (WhatsApp Integration) --- */
document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get form values
    const name = this.querySelector('input[type="text"]').value;
    const phone = this.querySelector('input[type="tel"]').value;
    const service = this.querySelector('select').value;
    const details = this.querySelector('textarea').value;
    
    // Construct WhatsApp message
    const whatsappNumber = "201141431662";
    const message = `*طلب جديد من Art4Print* 🎨%0A` +
                    `-------------------------%0A` +
                    `*الاسم:* ${name}%0A` +
                    `*رقم الهاتف:* ${phone}%0A` +
                    `*نوع الخدمة:* ${service}%0A` +
                    `*تفاصيل الطلب:*%0A${details}`;
    
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    
    // Visual feedback
    const btn = this.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = "جاري تحويلك لواتساب...";
    btn.disabled = true;
    
    setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        btn.innerHTML = "تم التحويل ✓";
        btn.style.background = "var(--lime)";
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = "var(--grad-primary)";
            btn.disabled = false;
            this.reset();
        }, 3000);
    }, 1000);
});

/* --- Hero Button Ripple Effect --- */
document.querySelectorAll('.btn-primary').forEach(button => {
    button.addEventListener('click', function(e) {
        let ripple = document.createElement('span');
        ripple.classList.add('ripple-effect');
        this.appendChild(ripple);
        
        let x = e.clientX - e.target.offsetLeft;
        let y = e.clientY - e.target.offsetTop;
        
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

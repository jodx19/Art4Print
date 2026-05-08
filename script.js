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

/* --- Form Submission (Mock) --- */
document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = "جاري الإرسال...";
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = "تم الإرسال بنجاح! ✓";
        btn.style.background = "var(--lime)";
        this.reset();
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = "var(--grad-primary)";
            btn.disabled = false;
        }, 3000);
    }, 1500);
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

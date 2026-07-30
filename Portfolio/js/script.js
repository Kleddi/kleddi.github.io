// Typing effect (homepage hero only)
const typingEl = document.getElementById('typing');
if (typingEl) {
    const t = "Kled";
    let i = 0;
    const typingTimer = setInterval(() => {
        if (i <= t.length) {
            typingEl.textContent = t.slice(0, i++);
        } else {
            clearInterval(typingTimer);
        }
    }, 150);
}

// Theme toggle
// Default (no class) = dark/gray theme. .light class = bright blue/white theme.
// Saved to localStorage so the choice carries across pages (an inline script
// in <head> on each page applies it immediately to avoid a flash on load).
document.getElementById('theme').onclick = () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
};

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.onclick = () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
};

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', false);
    });
});

// Scroll to top button: fixed button, id "top" collides with window.top
// (a built-in read-only browser property), so getElementById is required here.
const topBtn = document.getElementById('top');

topBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.addEventListener('scroll', () => {
    topBtn.classList.toggle('visible', window.scrollY > 400);
});

// Scroll-reveal for sections
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

revealEls.forEach(el => revealObserver.observe(el));

// Contact form validation (contact page only)
const form = document.getElementById('f');
if (form) {
    const nameInput = document.getElementById('n');
    const emailInput = document.getElementById('e');
    const messageInput = document.getElementById('m');
    const msg = document.getElementById('msg');

    form.onsubmit = (event) => {
        event.preventDefault();
        msg.textContent = (nameInput.value && emailInput.value && messageInput.value)
            ? 'Message validated!'
            : 'Please fill all fields.';
    };
}

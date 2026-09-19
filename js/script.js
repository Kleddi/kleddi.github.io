'use strict';

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

// ---------------------------------------------------------------
// Interactive project gallery (homepage only)
// The array is the truth, the page is a picture of it: this section's
// HTML container ships empty, and everything below builds the list
// and draws it. Nothing here is typed into index.html by hand.
// ---------------------------------------------------------------
const projectList = document.getElementById('project-list');

if (projectList) {

    // 1. THE DATA — one array of objects, each with title, description,
    // tags, url, image, and year. This is the single source of truth
    // for the whole section.
    const projects = [
        {
            title: 'Music Player',
            description: 'A YouTube-powered player with synced lyric timing and a curated song suggestion panel.',
            tags: ['JavaScript', 'CSS'],
            url: 'projects/music-player/index.html',
            image: 'images/music-player.jpg',
            alt: 'Music Player app showing a Now Playing panel with a YouTube link field and synced lyrics timer',
            year: 2026
        },
        {
            title: 'Surprise Page',
            description: 'A passcode-locked hidden page — enter the right code to see what\u2019s behind it.',
            tags: ['JavaScript', 'HTML'],
            url: 'projects/surprise/index.html',
            image: 'images/surprise.jpg',
            alt: 'A dark passcode entry screen with a numeric keypad',
            year: 2026
        },
        {
            title: 'Portfolio',
            description: 'This site — designed and built from scratch with HTML, CSS, and JavaScript.',
            tags: ['HTML', 'CSS'],
            url: '#top',
            image: 'images/portfolio.jpg',
            alt: 'Screenshot of this portfolio site\u2019s homepage',
            year: 2026
        },
        {
            title: 'Cybersecurity Notes',
            description: 'A running set of write-ups on the vulnerabilities and defenses I\u2019m studying this term.',
            tags: ['Cybersecurity', 'HTML'],
            url: '#top',
            image: 'images/portfolio.jpg',
            alt: 'Placeholder preview for a notes project',
            year: 2025
        }
    ];

    const searchInput = document.getElementById('gallerySearch');
    const tagButtons = document.getElementById('galleryTags');
    const countEl = document.getElementById('galleryCount');

    let activeTag = 'All';

    // 2. THE WORKER FUNCTION — takes the list plus the user's current
    // filters and returns a new, usually shorter, list. It never
    // touches the page: no querySelector, no textContent, nothing.
    function filterProjects(list, query, tag) {
        const cleanQuery = query.trim().toLowerCase();

        return list.filter(project => {
            const matchesTag = tag === 'All' || project.tags.includes(tag);
            const matchesQuery = cleanQuery === '' ||
                project.title.toLowerCase().includes(cleanQuery) ||
                project.description.toLowerCase().includes(cleanQuery);
            return matchesTag && matchesQuery;
        });
    }

    // 3. THE DRAW FUNCTION — the only place in this section that writes
    // to the page. Loops once, builds the markup as a string, then
    // writes it in a single assignment (never inside the loop).
    function renderProjects(list) {
        if (list.length === 0) {
            projectList.innerHTML = '<p class="gallery-empty">No projects match that search. Try a different word or tag.</p>';
        } else {
            let html = '';
            for (const project of list) {
                const tagsHtml = project.tags
                    .map(tag => `<span class="card-tag">${tag}</span>`)
                    .join('');

                html += `
                    <a class="card" href="${project.url}" target="_blank" rel="noopener noreferrer">
                        <img src="${project.image}" alt="${project.alt}">
                        <div class="card-body">
                            <h3>${project.title}</h3>
                            <p>${project.description}</p>
                            <div class="card-tags">${tagsHtml}</div>
                            <span class="card-link">Open project →</span>
                        </div>
                    </a>
                `;
            }
            projectList.innerHTML = html;
        }

        countEl.textContent = `Showing ${list.length} of ${projects.length} projects`;
    }

    function updateGallery() {
        const query = searchInput ? searchInput.value : '';
        const filtered = filterProjects(projects, query, activeTag);
        renderProjects(filtered);
    }

    // Build the tag filter buttons from the data itself, so a new tag
    // added to the array shows up here automatically.
    if (tagButtons) {
        const allTags = ['All', ...new Set(projects.flatMap(p => p.tags))];
        tagButtons.innerHTML = allTags
            .map(tag => `<button type="button" class="tag-btn${tag === 'All' ? ' is-active' : ''}" data-tag="${tag}">${tag}</button>`)
            .join('');

        tagButtons.addEventListener('click', (event) => {
            const button = event.target.closest('.tag-btn');
            if (!button) return;

            activeTag = button.dataset.tag;
            tagButtons.querySelectorAll('.tag-btn').forEach(btn => {
                btn.classList.toggle('is-active', btn === button);
            });
            updateGallery();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', updateGallery);
    }

    // 4. Draw once on load, before the user touches anything.
    updateGallery();
}
const DESKTOP_QUERY = '(min-width: 900px)';

function initPaneSwap() {
    const layout = document.querySelector('.layout');
    const openButton = document.querySelector('.gallery-open-btn');
    if (!layout) return;

    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

    openButton?.addEventListener('click', () => {
        if (isDesktop()) return;
        layout.classList.toggle('is-swapped');
    });
}

function initGalleryOpenLabel() {
    const layout = document.querySelector('.layout');
    const openButton = document.querySelector('.gallery-open-btn');
    if (!layout || !openButton) return;

    function sync() {
        const isOpen = layout.classList.contains('is-swapped');
        openButton.setAttribute(
            'aria-label',
            isOpen ? openButton.dataset.closeLabel : openButton.dataset.openLabel,
        );
    }

    new MutationObserver(sync).observe(layout, { attributes: true, attributeFilter: ['class'] });
}

function initSwipeNav() {
    const layout = document.querySelector('.layout');
    if (!layout) return;

    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
    const SWIPE_THRESHOLD = 35;
    // Elements involving their own horizontal dragging (native audio scrubbing,
    // the project modal) shouldn't be hijacked by the swipe-to-open/close gesture.
    // Plain taps on buttons/links are already safe: they never cross SWIPE_THRESHOLD.
    const IGNORE_SELECTOR = 'audio, .project-modal';

    let startX = null;
    let startY = null;

    document.addEventListener('touchstart', (event) => {
        if (isDesktop() || event.target.closest(IGNORE_SELECTOR)) {
            startX = null;
            return;
        }
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
        if (startX === null || isDesktop()) return;
        const deltaX = event.changedTouches[0].clientX - startX;
        const deltaY = event.changedTouches[0].clientY - startY;
        startX = null;

        if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

        if (deltaX < 0) {
            layout.classList.add('is-swapped');
        } else {
            layout.classList.remove('is-swapped');
        }
    }, { passive: true });
}

function initCategoryNav() {
    const layout = document.querySelector('.layout');
    const nav = document.querySelector('.category-nav');
    const gallery = document.querySelector('.gallery');
    if (!layout || !nav || !gallery) return;

    const buttons = [...nav.querySelectorAll('.category-nav__item')];
    const categories = [...gallery.querySelectorAll('.gallery__category')];
    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previewCard = null;
    let previewKey = null;

    gallery.addEventListener('mouseover', (event) => {
        if (!isDesktop()) return;
        const trigger = event.target.closest('.gallery__item-trigger');
        if (!trigger) return;
        const card = trigger.closest('.gallery__item');
        if (!card || card === previewCard) return;
        previewCard?.classList.remove('is-preview');
        previewCard = card;
        previewCard.classList.add('is-preview');
    });

    function setActive(key) {
        buttons.forEach((button) => {
            const active = button.dataset.category === key;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-current', active ? 'true' : 'false');
        });

        if (isDesktop() && key !== previewKey) {
            previewKey = key;
            previewCard?.classList.remove('is-preview');
            previewCard = null;
            const categoryEl = categories.find((c) => c.dataset.category === key);
            const cards = categoryEl ? [...categoryEl.querySelectorAll('.gallery__item')] : [];
            if (cards.length) {
                previewCard = cards[0];
                previewCard.classList.add('is-preview');
            }
        }
    }

    function activate(key, { updateHash = true } = {}) {
        if (!buttons.some((b) => b.dataset.category === key)) return;
        setActive(key);
        if (updateHash) history.replaceState(null, '', `#${key}`);

        if (key === 'all') {
            gallery.classList.add('gallery--all');
            if (!isDesktop()) layout.classList.add('is-swapped');
            return;
        }
        gallery.classList.remove('gallery--all');

        const target = categories.find((c) => c.dataset.category === key);
        if (!target) return;

        const scrollToTarget = () => target.scrollIntoView({
            behavior: reducedMotion() ? 'auto' : 'smooth',
            block: 'start',
        });

        if (isDesktop()) {
            scrollToTarget();
            return;
        }

        const wasCollapsed = !layout.classList.contains('is-swapped');
        layout.classList.add('is-swapped');
        if (wasCollapsed) {
            gallery.closest('.pane').addEventListener('transitionend', scrollToTarget, { once: true });
        } else {
            scrollToTarget();
        }
    }

    buttons.forEach((button) => {
        button.addEventListener('click', () => activate(button.dataset.category));
    });

    document.querySelectorAll('a[href="#all"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            activate('all');
        });
    });

    let observer;
    function observeActiveCategory() {
        observer?.disconnect();
        observer = new IntersectionObserver((entries) => {
            const mostVisible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (mostVisible) setActive(mostVisible.target.dataset.category);
        }, { root: gallery, threshold: 0.6 });
        categories.forEach((category) => observer.observe(category));
    }

    observeActiveCategory();
    window.matchMedia(DESKTOP_QUERY).addEventListener('change', (event) => {
        observeActiveCategory();
        if (!event.matches) {
            previewCard?.classList.remove('is-preview');
            previewCard = null;
            previewKey = null;
        }
    });

    const initialKey = location.hash.slice(1);
    if (buttons.some((b) => b.dataset.category === initialKey)) {
        activate(initialKey, { updateHash: false });
    } else if (categories[0]) {
        setActive(categories[0].dataset.category);
    }
}

function initAchievements() {
    const items = [...document.querySelectorAll('.achievements__item')];
    const star = document.querySelector('.achievements__star');
    if (items.length < 2) return;

    let index = 0;
    function next() {
        items[index].classList.remove('is-active');
        index = (index + 1) % items.length;
        items[index].classList.add('is-active');
    }

    let timer = setInterval(next, 5000);

    star?.addEventListener('click', () => {
        next();
        clearInterval(timer);
        timer = setInterval(next, 5000);
    });
}

function updateYearsSince() {
    const now = new Date();
    document.querySelectorAll('.years-since').forEach((el) => {
        const since = new Date(el.dataset.since);
        const years = now.getFullYear() - since.getFullYear();
        const hadAnniversary = now.getMonth() > since.getMonth()
            || (now.getMonth() === since.getMonth() && now.getDate() >= since.getDate());
        el.textContent = hadAnniversary ? years : years - 1;
    });
}

function initSongOverlay() {
    const audio = document.querySelector('.song-audio');
    const overlay = document.querySelector('.song-overlay');
    const essay = document.querySelector('.essay');
    const playButton = document.querySelector('.song-play-btn');
    if (!audio || !overlay) return;

    if (playButton) {
        playButton.addEventListener('click', () => {
            playButton.hidden = true;
            audio.setAttribute('controls', '');
            audio.play();
        });
    }

    let hideTimer = null;

    audio.addEventListener('play', () => {
        clearTimeout(hideTimer);
        audio.hidden = false;
        overlay.classList.add('is-active');
        if (essay && !window.matchMedia(DESKTOP_QUERY).matches) {
            essay.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            });
        }
    });
    function hideAudio() {
        overlay.classList.remove('is-active');
        audio.hidden = true;
        if (playButton) playButton.hidden = false;
    }
    audio.addEventListener('pause', () => {
        // Scrubbing the native seek bar briefly pauses then resumes playback;
        // wait a beat so that doesn't get mistaken for the user stopping the song.
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (audio.paused) hideAudio();
        }, 250);
    });
    audio.addEventListener('ended', hideAudio);
    overlay.addEventListener('click', () => audio.pause());
}

function initProjectModal() {
    const modal = document.querySelector('.project-modal');
    const closeButton = document.querySelector('.project-modal__close');
    const prevButton = document.querySelector('.project-modal__prev');
    const nextButton = document.querySelector('.project-modal__next');
    const titleEl = document.querySelector('.project-modal__title');
    const tagsEl = document.querySelector('.project-modal__tags');
    const descriptionEl = document.querySelector('.project-modal__description');
    const mediaEl = document.querySelector('.project-modal__media');
    const triggers = [...document.querySelectorAll('.gallery__item-trigger')];
    const layout = document.querySelector('.layout');
    if (!modal || !closeButton || !prevButton || !nextButton
        || !titleEl || !tagsEl || !descriptionEl || !mediaEl || !triggers.length) return;

    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
    const YOUTUBE_PATTERN = /youtube\.com|youtu\.be/;
    let images = [];
    let index = 0;
    let lastTrigger = null;

    function showMedia() {
        const src = images[index];
        const label = `${titleEl.textContent} ${index + 1}/${images.length}`;
        mediaEl.innerHTML = '';
        if (YOUTUBE_PATTERN.test(src)) {
            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.title = label;
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            mediaEl.appendChild(iframe);
        } else {
            const img = document.createElement('img');
            img.src = src;
            img.alt = label;
            mediaEl.appendChild(img);
        }
    }

    function openModal(trigger) {
        titleEl.textContent = trigger.dataset.title;
        descriptionEl.textContent = trigger.dataset.description;
        tagsEl.textContent = JSON.parse(trigger.dataset.tags).join(' • ');
        images = JSON.parse(trigger.dataset.images);
        index = 0;
        prevButton.hidden = images.length <= 1;
        nextButton.hidden = images.length <= 1;
        showMedia();

        lastTrigger = trigger;
        modal.classList.add('is-active');
        closeButton.focus();
    }

    function closeModal() {
        modal.classList.remove('is-active');
        mediaEl.innerHTML = '';
        lastTrigger?.focus();
    }

    triggers.forEach((trigger) => {
        trigger.addEventListener('click', () => {
            if (!isDesktop() && !layout?.classList.contains('is-swapped')) return;
            openModal(trigger);
        });
    });

    closeButton.addEventListener('click', closeModal);
    prevButton.addEventListener('click', () => {
        index = (index - 1 + images.length) % images.length;
        showMedia();
    });
    nextButton.addEventListener('click', () => {
        index = (index + 1) % images.length;
        showMedia();
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-active')) closeModal();
    });
}

initPaneSwap();
initGalleryOpenLabel();
initSwipeNav();
initCategoryNav();
updateYearsSince();
initSongOverlay();
initProjectModal();
initAchievements();

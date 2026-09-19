const DESKTOP_QUERY = '(min-width: 900px)';

function initPaneSwap() {
    const layout = document.querySelector('.layout');
    const gallery = document.querySelector('.pane--gallery');
    const openButton = document.querySelector('.gallery-open-btn');
    const avatarButton = document.querySelector('.avatar-btn');
    if (!layout) return;

    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

    gallery?.addEventListener('click', () => {
        if (isDesktop()) return;
        layout.classList.add('is-swapped');
    });

    openButton?.addEventListener('click', () => {
        if (isDesktop()) return;
        layout.classList.toggle('is-swapped');
    });

    avatarButton?.addEventListener('click', () => {
        if (isDesktop()) return;
        layout.classList.remove('is-swapped');
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
    const INTENT_THRESHOLD = 15;
    const SWIPE_THRESHOLD = 35;
    // Elements involving their own horizontal dragging (native audio scrubbing,
    // the project modal) shouldn't be hijacked by the swipe-to-open/close gesture.
    // Plain taps on buttons/links are already safe: they never cross SWIPE_THRESHOLD.
    const IGNORE_SELECTOR = 'audio, .project-modal';

    let startX = null;
    let startY = null;

    function clearPeek() {
        layout.classList.remove('is-peek-open', 'is-peek-close');
    }

    document.addEventListener('touchstart', (event) => {
        if (isDesktop() || event.target.closest(IGNORE_SELECTOR)) {
            startX = null;
            return;
        }
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (event) => {
        if (startX === null || isDesktop()) return;
        const deltaX = event.touches[0].clientX - startX;
        const deltaY = event.touches[0].clientY - startY;

        if (Math.abs(deltaX) < INTENT_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) {
            clearPeek();
            return;
        }

        const isOpen = layout.classList.contains('is-swapped');
        if (deltaX < 0 && !isOpen) {
            layout.classList.add('is-peek-open');
            layout.classList.remove('is-peek-close');
        } else if (deltaX > 0 && isOpen) {
            layout.classList.add('is-peek-close');
            layout.classList.remove('is-peek-open');
        } else {
            clearPeek();
        }
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
        clearPeek();
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

    document.addEventListener('touchcancel', () => {
        clearPeek();
        startX = null;
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

    const initialKey = location.hash.slice(1).split('?')[0];
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

    audio.addEventListener('play', () => {
        audio.hidden = false;
        overlay.classList.add('is-active');
        if (essay && !window.matchMedia(DESKTOP_QUERY).matches) {
            essay.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            });
        }
    });

    function closeOverlay() {
        overlay.classList.remove('is-active');
        audio.hidden = true;
        if (playButton) playButton.hidden = false;
        if (!audio.paused) audio.pause();
    }
    audio.addEventListener('pause', closeOverlay);
    overlay.addEventListener('click', closeOverlay);

    document.querySelectorAll('.song-overlay__actions a').forEach((link) => {
        link.addEventListener('click', closeOverlay);
    });
}

function initProjectModal() {
    const modal = document.querySelector('.project-modal');
    const closeButton = document.querySelector('.project-modal__close');
    const brandButton = document.querySelector('.project-modal__brand-btn');
    const titleEl = document.querySelector('.project-modal__title');
    const categoryEl = document.querySelector('.project-modal__category');
    const tagsEl = document.querySelector('.project-modal__tags');
    const descriptionEl = document.querySelector('.project-modal__description');
    const siteColEl = document.querySelector('.project-modal__col--site');
    const siteLinkEl = document.querySelector('.project-modal__site-link');
    const mediaEl = document.querySelector('.project-modal__media');
    const mediaPrevButton = document.querySelector('.project-modal__media-nav--prev');
    const mediaNextButton = document.querySelector('.project-modal__media-nav--next');
    const dotsEl = document.querySelector('.project-modal__dots');
    const prevProjectButton = document.querySelector('.project-modal__prev-project');
    const nextProjectButton = document.querySelector('.project-modal__next-project');
    const triggers = [...document.querySelectorAll('.gallery__item-trigger')];
    const layout = document.querySelector('.layout');
    if (!modal || !closeButton || !titleEl || !categoryEl || !tagsEl || !descriptionEl
        || !mediaEl || !mediaPrevButton || !mediaNextButton || !dotsEl
        || !prevProjectButton || !nextProjectButton || !triggers.length) return;

    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
    const YOUTUBE_PATTERN = /youtube\.com|youtu\.be/;
    const dotLabel = dotsEl.dataset.dotLabel || 'Image';
    const AUTO_ADVANCE_INTERVAL = 7000;
    let images = [];
    let index = 0;
    let triggerIndex = 0;
    let lastTrigger = null;
    let autoAdvanceTimer = null;

    function stopAutoAdvance() {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }

    function startAutoAdvance() {
        stopAutoAdvance();
        if (images.length <= 1) return;
        autoAdvanceTimer = setInterval(() => stepImage(1), AUTO_ADVANCE_INTERVAL);
    }

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
            img.draggable = false;
            mediaEl.appendChild(img);
        }
        [...dotsEl.children].forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    }

    function stepImage(delta) {
        if (images.length <= 1) return;
        index = (index + delta + images.length) % images.length;
        showMedia();
        startAutoAdvance();
    }

    function renderDots() {
        dotsEl.innerHTML = '';
        dotsEl.hidden = images.length <= 1;
        mediaPrevButton.hidden = images.length <= 1;
        mediaNextButton.hidden = images.length <= 1;
        images.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'project-modal__dot';
            dot.setAttribute('aria-label', `${dotLabel} ${i + 1}`);
            dot.addEventListener('click', () => {
                index = i;
                showMedia();
                startAutoAdvance();
            });
            dotsEl.appendChild(dot);
        });
    }

    function getProjectRef(trigger) {
        const categoryEl = trigger.closest('.gallery__category');
        if (!categoryEl) return null;
        const siblings = [...categoryEl.querySelectorAll('.gallery__item-trigger')];
        return { key: categoryEl.dataset.category, p: siblings.indexOf(trigger) + 1 };
    }

    function openModal(trigger, { updateHash = true } = {}) {
        triggerIndex = triggers.indexOf(trigger);
        titleEl.textContent = trigger.dataset.title;
        categoryEl.textContent = trigger.dataset.category;
        descriptionEl.textContent = trigger.dataset.description;
        tagsEl.textContent = JSON.parse(trigger.dataset.tags).join(' • ');
        if (siteColEl && siteLinkEl) {
            const siteUrl = trigger.dataset.siteUrl;
            siteColEl.hidden = !siteUrl;
            siteLinkEl.href = siteUrl || '';
        }
        images = JSON.parse(trigger.dataset.images);
        index = 0;
        renderDots();
        showMedia();
        startAutoAdvance();

        lastTrigger = trigger;
        modal.classList.add('is-active');
        closeButton.focus();

        if (updateHash) {
            const ref = getProjectRef(trigger);
            if (ref) history.replaceState(null, '', `#${ref.key}?p=${ref.p}`);
        }
    }

    function closeModal() {
        stopAutoAdvance();
        modal.classList.remove('is-active');
        mediaEl.innerHTML = '';
        lastTrigger?.focus();

        const ref = lastTrigger && getProjectRef(lastTrigger);
        if (ref) history.replaceState(null, '', `#${ref.key}`);
    }

    triggers.forEach((trigger) => {
        trigger.addEventListener('click', () => {
            if (!isDesktop() && !layout?.classList.contains('is-swapped')) return;
            openModal(trigger);
        });
    });

    closeButton.addEventListener('click', closeModal);
    brandButton?.addEventListener('click', closeModal);
    mediaPrevButton.addEventListener('click', () => stepImage(-1));
    mediaNextButton.addEventListener('click', () => stepImage(1));

    const SWIPE_THRESHOLD = 35;
    let swipeStartX = null;
    let swipeStartY = null;
    mediaEl.addEventListener('pointerdown', (event) => {
        swipeStartX = event.clientX;
        swipeStartY = event.clientY;
    });
    mediaEl.addEventListener('pointerup', (event) => {
        if (swipeStartX === null) return;
        const deltaX = event.clientX - swipeStartX;
        const deltaY = event.clientY - swipeStartY;
        swipeStartX = null;
        if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
        stepImage(deltaX < 0 ? 1 : -1);
    });
    mediaEl.addEventListener('pointercancel', () => {
        swipeStartX = null;
    });

    prevProjectButton.addEventListener('click', () => {
        triggerIndex = (triggerIndex - 1 + triggers.length) % triggers.length;
        openModal(triggers[triggerIndex]);
    });
    nextProjectButton.addEventListener('click', () => {
        triggerIndex = (triggerIndex + 1) % triggers.length;
        openModal(triggers[triggerIndex]);
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-active')) closeModal();
    });

    const [hashKey, hashQuery] = location.hash.slice(1).split('?');
    const sharedIndex = Number(new URLSearchParams(hashQuery || '').get('p'));
    if (hashKey && sharedIndex >= 1) {
        const sharedCategoryEl = document.querySelector(`.gallery__category[data-category="${CSS.escape(hashKey)}"]`);
        const sharedTrigger = sharedCategoryEl?.querySelectorAll('.gallery__item-trigger')[sharedIndex - 1];
        if (sharedTrigger) openModal(sharedTrigger, { updateHash: false });
    }
}

initPaneSwap();
initGalleryOpenLabel();
initSwipeNav();
initCategoryNav();
updateYearsSince();
initSongOverlay();
initProjectModal();
initAchievements();

const DESKTOP_QUERY = '(min-width: 900px)';

function initPaneSwap() {
    const layout = document.querySelector('.layout');
    const content = document.querySelector('.pane--content');
    const gallery = document.querySelector('.pane--gallery');
    if (!layout || !content || !gallery) return;

    const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

    gallery.addEventListener('click', () => {
        if (isDesktop()) return;
        if (!layout.classList.contains('is-swapped')) {
            layout.classList.add('is-swapped');
        }
    });

    content.addEventListener('click', () => {
        if (isDesktop()) return;
        if (layout.classList.contains('is-swapped')) {
            layout.classList.remove('is-swapped');
        }
    });
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

    function setActive(key) {
        buttons.forEach((button) => {
            const active = button.dataset.category === key;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-current', active ? 'true' : 'false');
        });
    }

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = categories.find((c) => c.dataset.category === button.dataset.category);
            if (!target) return;
            setActive(button.dataset.category);
            if (isDesktop()) return;

            const scrollToTarget = () => target.scrollIntoView({
                behavior: reducedMotion() ? 'auto' : 'smooth',
                block: 'start',
            });
            const wasCollapsed = !layout.classList.contains('is-swapped');
            layout.classList.add('is-swapped');
            if (wasCollapsed) {
                gallery.closest('.pane').addEventListener('transitionend', scrollToTarget, { once: true });
            } else {
                scrollToTarget();
            }
        });
    });

    let observer;
    function observeActiveCategory() {
        observer?.disconnect();
        if (isDesktop()) return;
        observer = new IntersectionObserver((entries) => {
            const mostVisible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (mostVisible) setActive(mostVisible.target.dataset.category);
        }, { root: gallery, threshold: 0.6 });
        categories.forEach((category) => observer.observe(category));
    }

    observeActiveCategory();
    window.matchMedia(DESKTOP_QUERY).addEventListener('change', observeActiveCategory);
    if (buttons[0]) setActive(buttons[0].dataset.category);
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

initPaneSwap();
initCategoryNav();
updateYearsSince();

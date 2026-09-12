import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(ROOT, 'build');
const LANGS = ['en', 'es'];

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readText = (p) => fs.readFileSync(p, 'utf8');
const tplPath = (...parts) => path.join(ROOT, 'src', 'templates', ...parts);

function get(obj, keyPath) {
    return keyPath.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

const YEARS_SINCE_TOKEN = '{{yearsSince}}';
const YEARS_SINCE_DATE = '2015-02-09';

function yearsSince(dateStr, now = new Date()) {
    const since = new Date(dateStr);
    const years = now.getFullYear() - since.getFullYear();
    const hadAnniversary = now.getMonth() > since.getMonth()
        || (now.getMonth() === since.getMonth() && now.getDate() >= since.getDate());
    return hadAnniversary ? years : years - 1;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function formatInline(escaped) {
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function render(template, data) {
    return template
        .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => get(data, key) ?? '')
        .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => escapeHtml(get(data, key) ?? ''));
}

function collectPaths(value, prefix = '') {
    if (Array.isArray(value)) {
        return value.flatMap((item, i) => collectPaths(item, `${prefix}[${i}]`));
    }
    if (value !== null && typeof value === 'object') {
        return Object.keys(value).flatMap((key) =>
            collectPaths(value[key], prefix ? `${prefix}.${key}` : key));
    }
    return [prefix];
}

function assertMatchingShape(content) {
    const [en, es] = LANGS.map((lang) => collectPaths(content[lang]));
    const enSet = new Set(en);
    const esSet = new Set(es);
    const missingInEs = en.filter((p) => !esSet.has(p));
    const missingInEn = es.filter((p) => !enSet.has(p));
    if (missingInEs.length || missingInEn.length) {
        console.error('Content mismatch between content/en.json and content/es.json:');
        missingInEs.forEach((p) => console.error(`  missing in es.json: ${p}`));
        missingInEn.forEach((p) => console.error(`  missing in en.json: ${p}`));
        process.exit(1);
    }
}

function outputPathFor(canonicalPath) {
    const trimmed = canonicalPath.replace(/^\/|\/$/g, '');
    return trimmed ? path.join(trimmed, 'index.html') : 'index.html';
}

function buildPage(content) {
    const partials = {
        projectCard: readText(tplPath('partials', 'project-card.html')),
    };

    const CARD_SIZES = ['l', 's', 's', 's', 'l', 's'];

    const categoryNavHtml = [
        `<li><button type="button" class="category-nav__item" data-category="all">${escapeHtml(content.projects.allLabel)}</button></li>`,
        ...content.projects.categories.map((cat) =>
            `<li><button type="button" class="category-nav__item" data-category="${escapeHtml(cat.key)}">${escapeHtml(cat.label)}</button></li>`
        ),
    ].join('\n');

    const galleryHtml = content.projects.categories.map((cat) => {
        const cardsHtml = cat.items.map((item, i) => {
            const tagsHtml = item.tags.map((t) => escapeHtml(t)).join(' • ');
            return render(partials.projectCard, {
                ...item,
                image: item.images[0],
                tagsHtml,
                tagsJson: escapeHtml(JSON.stringify(item.tags)),
                imagesJson: escapeHtml(JSON.stringify(item.images)),
                size: CARD_SIZES[i % CARD_SIZES.length],
            });
        }).join('\n');
        return `<div class="gallery__category" data-category="${escapeHtml(cat.key)}" aria-label="${escapeHtml(cat.label)}">${cardsHtml}</div>`;
    }).join('\n');

    const achievementsHtml = content.achievements.items.map((text, i) =>
        `<li class="achievements__item${i === 0 ? ' is-active' : ''}">${formatInline(escapeHtml(text))}</li>`
    ).join('\n');

    const aboutParagraphsHtml = content.about.paragraphs.map((p) => {
        let escaped = escapeHtml(p);
        if (escaped.includes(YEARS_SINCE_TOKEN)) {
            const span = `<span class="years-since" data-since="${YEARS_SINCE_DATE}">${yearsSince(YEARS_SINCE_DATE)}</span>`;
            escaped = escaped.replace(YEARS_SINCE_TOKEN, span);
        }
        return `<p>${formatInline(escaped)}</p>`;
    }).join('\n');

    const pageData = {
        ...content,
        galleryHtml,
        categoryNavHtml,
        aboutParagraphsHtml,
        achievementsHtml,
    };

    const bodyHtml = render(readText(tplPath('home.html')), pageData);
    return render(readText(tplPath('layout.html')), { ...pageData, bodyHtml });
}

function minify(code, loader) {
    return transformSync(code, { loader, minify: true }).code;
}

function buildStaticAssets() {
    const css = minify(readText(path.join(ROOT, 'css', 'main.css')), 'css');
    fs.mkdirSync(path.join(BUILD_DIR, 'css'), { recursive: true });
    fs.writeFileSync(path.join(BUILD_DIR, 'css', 'main.css'), css);

    const js = minify(readText(path.join(ROOT, 'js', 'main.js')), 'js');
    fs.mkdirSync(path.join(BUILD_DIR, 'js'), { recursive: true });
    fs.writeFileSync(path.join(BUILD_DIR, 'js', 'main.js'), js);

    fs.cpSync(path.join(ROOT, 'assets'), path.join(BUILD_DIR, 'assets'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'robots.txt'), path.join(BUILD_DIR, 'robots.txt'));
}

function main() {
    const content = Object.fromEntries(
        LANGS.map((lang) => [lang, readJSON(path.join(ROOT, 'content', `${lang}.json`))]));

    assertMatchingShape(content);

    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    fs.mkdirSync(BUILD_DIR, { recursive: true });

    for (const lang of LANGS) {
        const html = buildPage(content[lang]);
        const outPath = path.join(BUILD_DIR, outputPathFor(content[lang].meta.canonicalPath));
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, html, 'utf8');
        console.log(`built ${path.relative(ROOT, outPath)}`);
    }

    buildStaticAssets();
    console.log('copied css/js (minified), assets/, robots.txt into build/');
}

main();

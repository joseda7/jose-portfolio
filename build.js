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
        ...content.projects.categories.map((cat) => {
            const realSkills = (cat.skills ?? []).filter((s) => s !== '+').slice(0, 5);
            const skillsHtml = realSkills.length
                ? `${realSkills.map((s) => escapeHtml(s)).join(', ')}...`
                : '';
            return `<li><button type="button" class="category-nav__item" data-category="${escapeHtml(cat.key)}">${escapeHtml(cat.label)}</button><div class="category-nav__skills">${skillsHtml}</div></li>`;
        }),
    ].join('\n');

    const renderMusicSection = (cat) => {
        const { spotifyCard, videosCard } = cat;
        const videosHtml = videosCard.videos.map((v) => `<a class="music-card__video" href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(v.title)}">
                    <img src="${escapeHtml(v.thumbnail)}" alt="${escapeHtml(v.title)}" loading="lazy">
                    <span class="music-card__play" aria-hidden="true"><span class="music-card__play-icon"></span></span>
                </a>`).join('');
        return `<div class="gallery__category gallery__category--music" data-category="${escapeHtml(cat.key)}" aria-label="${escapeHtml(cat.label)}">
            <div class="music-card music-card--spotify">
                <iframe class="music-card__spotify-embed" src="${escapeHtml(spotifyCard.embedSrc)}" title="${escapeHtml(spotifyCard.title)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
                ${spotifyCard.caption ? `<p class="music-card__caption">${escapeHtml(spotifyCard.caption)}</p>` : ''}
            </div>
            <div class="music-card music-card--videos">
                ${videosCard.heading ? `<h3 class="music-card__heading">${escapeHtml(videosCard.heading)}</h3>` : ''}
                <div class="music-card__videos">${videosHtml}</div>
                ${videosCard.caption ? `<p class="music-card__caption">${escapeHtml(videosCard.caption)}</p>` : ''}
            </div>
        </div>`;
    };

    const galleryHtml = content.projects.categories.map((cat) => {
        if (cat.key === 'music') return renderMusicSection(cat);
        const cardsHtml = cat.items.map((item, i) => {
            const tagsHtml = item.tags.map((t) => escapeHtml(t)).join(' • ');
            const thumbnail = item.media.find((m) => !/^https?:\/\//.test(m)) ?? item.media[0];
            return render(partials.projectCard, {
                ...item,
                image: thumbnail,
                tagsHtml,
                tagsJson: escapeHtml(JSON.stringify(item.tags)),
                mediaJson: escapeHtml(JSON.stringify(item.media)),
                category: cat.label,
                size: CARD_SIZES[i % CARD_SIZES.length],
            });
        }).join('\n');
        return `<div class="gallery__category" data-category="${escapeHtml(cat.key)}" aria-label="${escapeHtml(cat.label)}">${cardsHtml}</div>`;
    }).join('\n');

    const aboutParagraphsHtml = content.about.paragraphs.map((p) =>
        `<p>${formatInline(escapeHtml(p))}</p>`
    ).join('\n');

    const pageData = {
        ...content,
        galleryHtml,
        categoryNavHtml,
        aboutParagraphsHtml,
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

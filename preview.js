import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Serves ./build under /jose-portfolio/, mirroring the GitHub Pages project-site
// URL structure so the <base href="/jose-portfolio/"> tag resolves the same way
// it does in production.

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(ROOT, 'build');
const PREFIX = '/jose-portfolio/';
const PORT = 8080;

const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.m4a': 'audio/mp4',
    '.txt': 'text/plain',
};

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);

    if (url === '/' || url === '') {
        res.writeHead(302, { Location: PREFIX });
        return res.end();
    }
    if (!url.startsWith(PREFIX)) {
        res.writeHead(404);
        return res.end(`Not found. Try ${PREFIX}`);
    }

    let rel = url.slice(PREFIX.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';

    const filePath = path.join(BUILD_DIR, rel);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`Preview running at http://localhost:${PORT}${PREFIX}`);
});

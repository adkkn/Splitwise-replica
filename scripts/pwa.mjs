// After `expo export -p web`: makes the web build installable on iPhone/Android home screens
// and adds a 404.html so GitHub Pages serves the app for every route.
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const manifest = {
  name: 'Evenly',
  short_name: 'Evenly',
  description: 'Split bills with friends',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  background_color: '#F4F6F8',
  theme_color: '#12A887',
  icons: [
    { src: `${base}/pwa-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/pwa-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${base}/pwa-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

const tags = `
    <link rel="manifest" href="${base}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Evenly" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="#12A887" />`;

html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />');
if (!html.includes('manifest.webmanifest')) html = html.replace('</head>', `${tags}\n  </head>`);
fs.writeFileSync(indexPath, html);
fs.copyFileSync(indexPath, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('PWA ready in', dist);

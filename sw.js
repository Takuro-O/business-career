// ビジキャリ 問題集 Service Worker
// - アプリ本体（HTML・アイコン）をキャッシュし、オフラインでも成績・履歴の閲覧ができるようにする
// - Gemini API など別オリジンへの通信には一切介入しない（問題生成は常にネットワーク経由）
// - index.html を更新したら CACHE_VERSION を上げる
const CACHE_VERSION = 'bizcareer-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIなど外部通信は対象外

  // ページ本体：ネットワーク優先（更新をすぐ反映）→ 失敗時はキャッシュ
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // その他（アイコン等）：キャッシュ優先、裏で更新
  event.respondWith(
    caches.match(req).then(cached => {
      const fetching = fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => cached);
      return cached || fetching;
    })
  );
});

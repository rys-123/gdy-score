// 缓存存储名称（更新版本号以强制刷新缓存）
const CACHE_NAME = 'gdy-scorekeeper-v3-cn';

// 需要缓存的资源列表
// 包含了 HTML 本身以及替换后的国内 CDN 资源
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png', // 如果没有这些图片，Service Worker 安装可能会报 404，建议准备占位图或在列表中移除
    './icon-512.png',
    // 外部库缓存 (BootCDN)
    'https://cdn.tailwindcss.com', // 注意：Tailwind Script 无法简单缓存离线运行，但在有网时会加速
    'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.bootcdn.net/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    // 缓存 FontAwesome 的 Webfonts (重要)
    'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2'
];

// 1. 安装阶段
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching assets');
            // addAll 如果有一个失败则全部失败，生产环境建议更稳健的写法
            // 这里为了演示简单直接添加
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('部分资源缓存失败 (如图片缺失可忽略):', err);
            });
        })
    );
    self.skipWaiting();
});

// 2. 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Cleaning old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// 3. 拦截请求
self.addEventListener('fetch', (event) => {
    // 仅处理 HTTP/HTTPS 请求
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(event.request).then((networkResponse) => {
                // 检查响应有效性
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // 允许跨域 CDN 资源通过
                    if (networkResponse.type !== 'cors' && networkResponse.type !== 'opaque') {
                        return networkResponse;
                    }
                }

                // 动态缓存新请求到的资源
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // 离线且无缓存时的回退逻辑 (可选)
                console.log('Fetch failed; returning offline page if available.');
            });
        })
    );
});
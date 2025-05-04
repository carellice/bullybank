// Non definiamo più il CACHE_NAME o urlsToCache

// Installazione del Service Worker - non fa nulla di particolare
self.addEventListener('install', event => {
    console.log('Service Worker installato, ma senza cache');
    self.skipWaiting(); // Attivazione immediata
});

// Attivazione del Service Worker - elimina tutte le cache esistenti
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    console.log('Eliminazione cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

// Gestione delle richieste di rete - sempre dalla rete, mai dalla cache
self.addEventListener('fetch', event => {
    // Passthrough diretto alla rete senza caching
    // Non facciamo nulla di speciale, lasciamo che il browser gestisca normalmente la richiesta
});
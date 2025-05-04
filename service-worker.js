const CACHE_NAME = 'bullybank-cache-v10'; // Incrementa la versione
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png'
];

// Installazione del Service Worker (manteniamo questa parte)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aperta');
                return cache.addAll(urlsToCache);
            })
    );
});

// Attivazione del Service Worker (manteniamo questa parte)
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Gestione delle richieste di rete - MODIFICATA per preferire sempre la rete
self.addEventListener('fetch', event => {
    event.respondWith(
        // Prima prova a prendere dalla rete
        fetch(event.request)
            .then(response => {
                // Se la risposta è valida, clonala per metterla in cache
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(error => {
                // Solo in caso di errore di rete, prova a usare la cache
                console.log('Errore di rete, tentativo di recupero dalla cache:', error);
                return caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }

                        // Se non c'è nulla in cache, mostra un errore
                        return new Response('Internet non disponibile. Non è possibile utilizzare l\'app offline.', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});
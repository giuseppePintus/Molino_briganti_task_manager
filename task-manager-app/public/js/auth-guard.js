/**
 * auth-guard.js - Verifica centralizzata della sessione utente.
 *
 * Da includere come PRIMO script in ogni pagina protetta (tranne index.html / login):
 *   <script src="js/auth-guard.js"></script>
 *
 * Comportamento:
 *  - Se il token mancante/non valido (verifica via /api/auth/me), reindirizza a /index.html.
 *  - Intercetta tutte le fetch verso /api/: in caso di 401/403 forza il logout.
 *  - Espone window.handleSessionExpired() per uso esplicito da altre pagine.
 */
(function () {
    'use strict';

    // Evita doppia installazione se incluso più volte.
    if (window.__authGuardInstalled) return;
    window.__authGuardInstalled = true;

    const API_BASE = `http://${window.location.hostname}:${window.location.port || 5000}/api`;

    function getStoredToken() {
        return localStorage.getItem('token')
            || localStorage.getItem('authToken')
            || sessionStorage.getItem('authToken');
    }

    function handleSessionExpired() {
        // Evita loop di redirect se siamo già sulla pagina di login.
        const here = (window.location.pathname || '').toLowerCase();
        if (here.endsWith('/index.html') || here === '/' || here === '') {
            return;
        }
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('authToken');
        } catch (_) { /* ignore */ }
        window.location.href = '/index.html';
    }
    window.handleSessionExpired = handleSessionExpired;

    // Wrap fetch per intercettare 401/403 sulle API.
    const originalFetch = window.fetch.bind(window);
    window.__originalFetch = originalFetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        try {
            const url = (args[0] && args[0].url) ? args[0].url : String(args[0] || '');
            if ((response.status === 401 || response.status === 403) && url.includes('/api/')) {
                handleSessionExpired();
            }
        } catch (_) { /* ignore */ }
        return response;
    };

    // Verifica iniziale del token al caricamento della pagina.
    async function verifyToken() {
        const token = getStoredToken();
        if (!token) {
            handleSessionExpired();
            return;
        }
        try {
            const res = await originalFetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                handleSessionExpired();
            }
            // Su altri errori (rete, 5xx) non sloggare: l'app continua a funzionare offline.
        } catch (_) {
            // Errore di rete: non forzare il logout (operatori in magazzino con rete instabile).
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verifyToken);
    } else {
        verifyToken();
    }
})();

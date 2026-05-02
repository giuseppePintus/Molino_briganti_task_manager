/**
 * Helper condiviso per renderizzare il badge dell'utente loggato
 * (immagine + nome) all'interno di un contenitore .user-info.
 *
 * Uso:
 *   renderUserInfoBadge('userInfo');                 // legge currentUser da localStorage
 *   renderUserInfoBadge('userInfo', currentUser);    // usa l'oggetto passato
 *   renderUserInfoBadge(document.getElementById(...));
 */
(function () {
    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildAvatarHtml(image, username) {
        const safeName = escapeHtml(username || '');
        if (image) {
            // URL assoluto, root-relative o data URI -> usa direttamente
            const isDirectUrl = image.startsWith('http') || image.startsWith('/') || image.startsWith('data:');
            // Path relativo tipo "uploads/xxx.png" caricato dal server -> prefissa con "/"
            const isRelativeUpload = /^uploads\//.test(image) || /\.(png|jpe?g|gif|webp|svg)$/i.test(image);
            if (isDirectUrl || isRelativeUpload) {
                const src = isDirectUrl ? image : '/' + image.replace(/^\/+/, '');
                const safeImg = escapeHtml(src);
                // Fallback al placeholder se l'immagine non si carica
                return `<img class="user-info-avatar" src="${safeImg}" alt="${safeName}" `
                     + `onerror="this.outerHTML='&lt;span class=\\'user-info-avatar user-info-avatar-fallback\\'&gt;👤&lt;/span&gt;'">`;
            }
            if (image.length <= 4) {
                // Probabile emoji salvata come avatar
                return `<span class="user-info-avatar user-info-avatar-emoji">${escapeHtml(image)}</span>`;
            }
        }
        return `<span class="user-info-avatar user-info-avatar-fallback">👤</span>`;
    }

    function renderUserInfoBadge(target, user) {
        const el = typeof target === 'string' ? document.getElementById(target) : target;
        if (!el) return;
        let u = user;
        if (!u) {
            try { u = JSON.parse(localStorage.getItem('currentUser') || '{}'); }
            catch (_) { u = {}; }
        }
        if (!u || !u.username) {
            el.textContent = '';
            return;
        }
        const avatar = buildAvatarHtml(u.image, u.username);
        el.classList.add('user-info-with-avatar');
        el.innerHTML = `${avatar}<span class="user-info-name">${escapeHtml(u.username)}</span>`;
        // Sposta il badge utente dentro .header-actions, prima del logout, così
        // su tutti i layout appare a destra accanto al pulsante "Logout".
        try { relocateToHeaderActions(el); } catch (_) {}
    }

    function relocateToHeaderActions(el) {
        if (!el || el.dataset.relocated === '1') return;
        // Trova l'header che contiene questo elemento
        const header = el.closest('.header');
        if (!header) return;
        const actions = header.querySelector(':scope > .header-actions');
        if (!actions) return;
        // Inserisci come primo figlio (avatar+nome a sinistra del Logout)
        actions.insertBefore(el, actions.firstChild);
        el.dataset.relocated = '1';
    }

    window.renderUserInfoBadge = renderUserInfoBadge;
})();

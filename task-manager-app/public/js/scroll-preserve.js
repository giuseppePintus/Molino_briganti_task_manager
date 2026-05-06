/*
 * scroll-preserve.js
 * -------------------
 * Helper condiviso che preserva la posizione di scroll della pagina quando
 * si apre/chiude un qualsiasi popup nel task-manager.
 *
 * Pattern di popup gestiti:
 *  - .modal.active                       (admin-dashboard, orders-planner, ...)
 *  - .overlay.active, [data-modal].active
 *  - .open su [id$="Overlay"], [id$="Modal"], .cargo-modal-overlay, .av-modal-overlay
 *  - .__cc_overlay (customConfirm di ui-confirm.js: inserito/rimosso dal DOM)
 *  - #batchModalOverlay, #tripAssignmentModal, #peerModal e altri overlay con
 *    style.display flex/block toggled inline
 *
 * Strategia:
 *  1. All'apertura del PRIMO popup (transizione 0 -> 1) salva window.scrollY.
 *  2. Alla chiusura dell'ULTIMO popup (transizione 1 -> 0) ripristina lo scroll
 *     piu' volte nel tempo (0/30/90/200/400/800/1400 ms) per coprire i
 *     re-render asincroni che partono subito dopo (renderCalendar, ricarica
 *     liste post-save/delete).
 *  3. Se l'utente fa wheel/touch/PageDown/PageUp/Home/End/Space/Frecce mentre
 *     il restore e' in coda, lo annulliamo per non combattere con lui.
 */
(function () {
    'use strict';

    if (window.__scrollPreserveInstalled) return;
    window.__scrollPreserveInstalled = true;

    // Selettore dei popup APERTI: se l'elemento matcha questo, e' "visibile".
    var OPEN_SELECTOR = [
        '.modal.active',
        '.overlay.active',
        '[data-modal].active',
        '.__cc_overlay',
        '[id$="Overlay"].open',
        '[id$="Modal"].open',
        '.cargo-modal-overlay.open',
        '.av-modal-overlay.open'
    ].join(', ');

    // Selettore dei nodi che sorvegliamo per cambi di classe (pre-filtro).
    var WATCH_SELECTOR = [
        '.modal', '.overlay', '[data-modal]',
        '[id$="Overlay"]', '[id$="Modal"]',
        '.cargo-modal-overlay', '.av-modal-overlay'
    ].join(', ');

    // ID overlay che usano style.display inline (no classe).
    var INLINE_DISPLAY_IDS = ['batchModalOverlay', 'tripAssignmentModal', 'peerModal'];

    var savedScrollY = null;
    var pendingCleanup = null;
    var lastOpenCount = 0;

    function isInlineDisplayOpen(el) {
        if (!el) return false;
        var d = el.style && el.style.display;
        return !!(d && d !== 'none');
    }

    function countOpenPopups() {
        var n = 0;
        try { n += document.querySelectorAll(OPEN_SELECTOR).length; } catch (_) {}
        for (var i = 0; i < INLINE_DISPLAY_IDS.length; i++) {
            var el = document.getElementById(INLINE_DISPLAY_IDS[i]);
            if (isInlineDisplayOpen(el)) n++;
        }
        return n;
    }

    function captureScroll() {
        if (pendingCleanup) { pendingCleanup(); pendingCleanup = null; }
        savedScrollY = window.scrollY || window.pageYOffset || 0;
    }

    function scheduleRestore() {
        if (savedScrollY === null) return;
        var target = savedScrollY;
        savedScrollY = null;
        if (target <= 0) return;

        var cancelled = false;
        var startedAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now() : Date.now();
        var MAX_DURATION_MS = 3000;      // tempo massimo di tentativi
        var rafId = null;
        var endTimer = null;

        function cancel() {
            cancelled = true;
            if (rafId != null) {
                try { cancelAnimationFrame(rafId); } catch (_) {}
                rafId = null;
            }
            if (endTimer) { clearTimeout(endTimer); endTimer = null; }
            window.removeEventListener('wheel', cancel, true);
            window.removeEventListener('touchstart', cancel, true);
            window.removeEventListener('keydown', onKeyDown, true);
            if (pendingCleanup === cancel) pendingCleanup = null;
        }
        function onKeyDown(e) {
            var k = e.key;
            if (k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End' ||
                k === 'ArrowDown' || k === 'ArrowUp' || k === ' ' || k === 'Spacebar') {
                cancel();
            }
        }

        window.addEventListener('wheel', cancel, { capture: true, passive: true });
        window.addEventListener('touchstart', cancel, { capture: true, passive: true });
        window.addEventListener('keydown', onKeyDown, true);

        function maxScrollY() {
            var doc = document.documentElement;
            var body = document.body;
            var sh = Math.max(
                doc ? doc.scrollHeight : 0,
                body ? body.scrollHeight : 0,
                doc ? doc.offsetHeight : 0,
                body ? body.offsetHeight : 0
            );
            return Math.max(0, sh - (window.innerHeight || 0));
        }

        function tick() {
            if (cancelled) return;
            var now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() : Date.now();
            var elapsed = now - startedAt;

            // Forza il ripristino ad ogni frame finche' la pagina e' alta abbastanza.
            // Questo copre re-render asincroni di renderCalendar/loadTasks che
            // partono dopo la chiusura del popup.
            var maxY = maxScrollY();
            if (maxY + 1 >= target) {
                var current = window.scrollY || window.pageYOffset || 0;
                if (Math.abs(current - target) > 1) {
                    window.scrollTo(0, target);
                }
            }
            // Se la pagina e' ancora piu' corta, aspettiamo: il browser troncherebbe
            // a maxY perdendo la posizione. Continuiamo a riprovare ai prossimi frame.

            if (elapsed >= MAX_DURATION_MS) {
                cancel();
                return;
            }
            rafId = requestAnimationFrame(tick);
        }

        // Hard cap di sicurezza in caso rAF non venga chiamato (tab in background).
        endTimer = setTimeout(cancel, MAX_DURATION_MS + 500);
        rafId = requestAnimationFrame(tick);
        pendingCleanup = cancel;
    }

    // Ricalcola lo stato e gestisce le transizioni 0->N e N->0.
    var recheckScheduled = false;
    function recheck() {
        recheckScheduled = false;
        var current = countOpenPopups();
        if (current > 0 && lastOpenCount === 0) {
            captureScroll();
        } else if (current === 0 && lastOpenCount > 0) {
            scheduleRestore();
        }
        lastOpenCount = current;
    }
    function scheduleRecheck() {
        if (recheckScheduled) return;
        recheckScheduled = true;
        // microtask: aggrega piu' mutations consecutive in un'unica verifica.
        Promise.resolve().then(recheck);
    }

    function startObserver() {
        // 1) Observer su attributi (class/style) per popup gia' presenti nel DOM.
        var attrObs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type !== 'attributes') continue;
                var el = m.target;
                if (!el || el.nodeType !== 1) continue;
                if (m.attributeName === 'class') {
                    if (typeof el.matches === 'function' && el.matches(WATCH_SELECTOR)) {
                        scheduleRecheck();
                    }
                } else if (m.attributeName === 'style') {
                    if (el.id && INLINE_DISPLAY_IDS.indexOf(el.id) >= 0) {
                        scheduleRecheck();
                    }
                }
            }
        });
        attrObs.observe(document.documentElement, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        // 2) Observer su aggiunta/rimozione nodi (per overlay creati al volo
        //    come __cc_overlay di customConfirm).
        var nodeObs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type !== 'childList') continue;
                if ((m.addedNodes && m.addedNodes.length) ||
                    (m.removedNodes && m.removedNodes.length)) {
                    scheduleRecheck();
                    return;
                }
            }
        });
        nodeObs.observe(document.body || document.documentElement, {
            subtree: true,
            childList: true
        });

        lastOpenCount = countOpenPopups();
    }

    // ------------------------------------------------------------------
    // Preservazione scroll per click su pulsanti SENZA popup
    // ------------------------------------------------------------------
    // Casi tipici: pulsanti "Accetta" / "Completa" / "Pausa" / "Riprendi"
    // che chiamano direttamente un fetch e poi rifanno il render della
    // pagina (renderCalendar / loadTasks). Senza popup, il blocco sopra
    // non scatta. Qui prendiamo uno snapshot dello scroll al click di un
    // pulsante e per ~2s rimettiamo la pagina alla stessa posizione, finche'
    // l'utente non interagisce manualmente.
    var clickRestoreCleanup = null;

    function startClickRestore(targetY) {
        if (targetY <= 0) return;
        if (clickRestoreCleanup) { clickRestoreCleanup(); clickRestoreCleanup = null; }

        var cancelled = false;
        var startedAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now() : Date.now();
        var MAX_DURATION_MS = 2000;
        var rafId = null;
        var endTimer = null;

        function cancel() {
            cancelled = true;
            if (rafId != null) {
                try { cancelAnimationFrame(rafId); } catch (_) {}
                rafId = null;
            }
            if (endTimer) { clearTimeout(endTimer); endTimer = null; }
            window.removeEventListener('wheel', cancel, true);
            window.removeEventListener('touchstart', cancel, true);
            window.removeEventListener('keydown', onKeyDown, true);
            if (clickRestoreCleanup === cancel) clickRestoreCleanup = null;
        }
        function onKeyDown(e) {
            var k = e.key;
            if (k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End' ||
                k === 'ArrowDown' || k === 'ArrowUp' || k === ' ' || k === 'Spacebar') {
                cancel();
            }
        }
        window.addEventListener('wheel', cancel, { capture: true, passive: true });
        window.addEventListener('touchstart', cancel, { capture: true, passive: true });
        window.addEventListener('keydown', onKeyDown, true);

        function maxScrollY() {
            var doc = document.documentElement;
            var body = document.body;
            var sh = Math.max(
                doc ? doc.scrollHeight : 0,
                body ? body.scrollHeight : 0,
                doc ? doc.offsetHeight : 0,
                body ? body.offsetHeight : 0
            );
            return Math.max(0, sh - (window.innerHeight || 0));
        }

        function tick() {
            if (cancelled) return;
            // Se nel frattempo si e' aperto un popup, lascia gestire al
            // meccanismo principale: smonta il watcher per non conflittare.
            if (countOpenPopups() > 0) { cancel(); return; }

            var now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() : Date.now();
            var elapsed = now - startedAt;

            var maxY = maxScrollY();
            if (maxY + 1 >= targetY) {
                var current = window.scrollY || window.pageYOffset || 0;
                if (Math.abs(current - targetY) > 1) {
                    window.scrollTo(0, targetY);
                }
            }

            if (elapsed >= MAX_DURATION_MS) { cancel(); return; }
            rafId = requestAnimationFrame(tick);
        }

        endTimer = setTimeout(cancel, MAX_DURATION_MS + 300);
        rafId = requestAnimationFrame(tick);
        clickRestoreCleanup = cancel;
    }

    function isActionableTarget(el) {
        if (!el || el.nodeType !== 1) return false;
        // Risali al primo elemento "azionabile" (button, [onclick], role=button, a).
        for (var node = el; node && node !== document.body; node = node.parentNode) {
            if (node.nodeType !== 1) continue;
            var tag = node.tagName;
            if (tag === 'BUTTON') return true;
            if (tag === 'A' && node.getAttribute('href')) return true;
            if (node.hasAttribute && node.hasAttribute('onclick')) return true;
            var role = node.getAttribute && node.getAttribute('role');
            if (role === 'button') return true;
            // Input bottoni (submit, button, reset).
            if (tag === 'INPUT') {
                var t = (node.type || '').toLowerCase();
                if (t === 'button' || t === 'submit' || t === 'reset') return true;
            }
        }
        return false;
    }

    function onDocumentClick(ev) {
        // Solo click "veri" del mouse / tap.
        if (ev.button !== undefined && ev.button !== 0) return;
        if (!isActionableTarget(ev.target)) return;
        var y = window.scrollY || window.pageYOffset || 0;
        if (y <= 0) return;
        // Avvia il watcher al prossimo tick: se l'azione apre un popup,
        // l'apertura sara' rilevata dal countOpenPopups e il watcher si
        // disattivera' da solo.
        setTimeout(function () { startClickRestore(y); }, 0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    } else {
        startObserver();
    }
    document.addEventListener('click', onDocumentClick, true);
})();

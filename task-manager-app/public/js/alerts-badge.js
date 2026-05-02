/**
 * alerts-badge.js
 *
 * Sostituisce l'icona del pulsante "Gestione Magazzino" (.btn-warehouse) con una
 * campanella colorata in base allo stato avvisi giacenza:
 *   - verde   = nessun avviso
 *   - arancio = ci sono avvisi (non critici)
 *   - rossa   = ci sono avvisi CRITICI
 * Le dimensioni del pulsante restano invariate (sostituiamo solo il glifo
 * mostrato dal CSS ::before tramite una mask SVG).
 *
 * Polling: ogni 15s + listener WebSocket `inventory_updated` se disponibile.
 */
(function () {
  if (window.__ALERTS_BADGE_INITED) return;
  window.__ALERTS_BADGE_INITED = true;

  const STYLE_ID = 'alerts-badge-style';
  const POLL_MS = 15000;

  // SVG bell come data URI per usarla come mask (colorabile via background-color)
  const BELL_SVG = "url(\"data:image/svg+xml;utf8,"
    + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>"
    + "<path fill='black' d='M12 2a6 6 0 0 0-6 6v3.586l-1.707 1.707"
    + "A1 1 0 0 0 5 15h14a1 1 0 0 0 .707-1.707L18 11.586V8a6 6 0 0 0-6-6z"
    + "m0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z'/></svg>\")";

  // SVG triangolo "warning" come mask, per il feature-card "Avvisi"
  const WARN_SVG = "url(\"data:image/svg+xml;utf8,"
    + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>"
    + "<path fill='black' d='M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8z"
    + "m-1 5h2v4h-2v-4zm0 5h2v2h-2v-2z'/></svg>\")";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      /* Quando il pulsante ha la classe .alerts-bell sostituiamo il glifo
         emoji originale con una campanella SVG colorabile via background-color. */
      .btn-warehouse.alerts-bell::before {
        content: '' !important;
        display: inline-block;
        width: 18px;
        height: 18px;
        vertical-align: middle;
        -webkit-mask: ${BELL_SVG} no-repeat center / contain;
                mask: ${BELL_SVG} no-repeat center / contain;
        background-color: #16a34a; /* verde di default (nessun avviso) */
        transition: background-color .25s ease;
      }
      .btn-warehouse.alerts-bell.alerts-state-warn::before     { background-color: #f59e0b; }
      .btn-warehouse.alerts-bell.alerts-state-critical::before { background-color: #ef4444; }

      /* Pulsazione discreta solo quando ci sono avvisi */
      .btn-warehouse.alerts-bell.alerts-state-warn {
        animation: warehouseAlertPulse 1.6s ease-in-out infinite;
      }
      .btn-warehouse.alerts-bell.alerts-state-critical {
        animation: warehouseAlertPulseCritical 1.2s ease-in-out infinite;
      }
      @keyframes warehouseAlertPulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.55); }
        50%     { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
      }
      @keyframes warehouseAlertPulseCritical {
        0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.65); }
        50%     { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
      }

      /* Feature card "Avvisi" dentro Panoramica Magazzino: ricolora l'icona ⚠️
         con un triangolo SVG mascherato, così possiamo usare background-color. */
      .alerts-feature-card .alerts-feature-icon {
        display: inline-block;
        width: 20px;
        height: 20px;
        font-size: 0;            /* nasconde l'emoji originale */
        line-height: 0;
        -webkit-mask: ${WARN_SVG} no-repeat center / contain;
                mask: ${WARN_SVG} no-repeat center / contain;
        background-color: #16a34a; /* verde di default */
        transition: background-color .25s ease;
      }
      .alerts-feature-card.alerts-state-warn     .alerts-feature-icon { background-color: #f59e0b; }
      .alerts-feature-card.alerts-state-critical .alerts-feature-icon { background-color: #ef4444; }
      .alerts-feature-card.alerts-state-warn,
      .alerts-feature-card.alerts-state-critical {
        outline: 2px solid transparent;
      }
      .alerts-feature-card.alerts-state-warn     { outline-color: rgba(245,158,11,0.45); }
      .alerts-feature-card.alerts-state-critical { outline-color: rgba(239,68,68,0.55); }
      /* Stesso effetto pulsante (alone box-shadow) usato sul btn "Gestione Magazzino" */
      .alerts-feature-card.alerts-state-warn {
        animation: warehouseAlertPulse 1.6s ease-in-out infinite;
      }
      .alerts-feature-card.alerts-state-critical {
        animation: warehouseAlertPulseCritical 1.2s ease-in-out infinite;
      }
    `;
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function getWarehouseButtons() {
    return document.querySelectorAll('.btn-warehouse');
  }

  function getAlertsCards() {
    return document.querySelectorAll('.alerts-feature-card');
  }

  function applyState(payload) {
    const count = (payload && payload.count) || 0;
    const total = (payload && payload.total) || 0;
    const hasCritical = !!(payload && Array.isArray(payload.alerts)
      && payload.alerts.some(a => a.level === 'CRITICAL'));
    const hasAlerts = (count > 0) || (total > 0);

    let state, title;
    if (hasCritical && count > 0) {
      state = 'critical';
      title = 'Gestione Magazzino — ' + count + ' avvisi attivi (CRITICI)';
    } else if (hasAlerts) {
      state = 'warn';
      title = (count > 0)
        ? ('Gestione Magazzino — ' + count + ' avvisi attivi')
        : ('Gestione Magazzino — ' + total + ' avvisi sospesi');
    } else {
      state = 'ok';
      title = 'Gestione Magazzino — nessun avviso';
    }

    getWarehouseButtons().forEach(function (btn) {
      btn.classList.add('alerts-bell');
      btn.classList.toggle('alerts-state-ok', state === 'ok');
      btn.classList.toggle('alerts-state-warn', state === 'warn');
      btn.classList.toggle('alerts-state-critical', state === 'critical');
      btn.title = title;
    });

    getAlertsCards().forEach(function (card) {
      card.classList.toggle('alerts-state-ok', state === 'ok');
      card.classList.toggle('alerts-state-warn', state === 'warn');
      card.classList.toggle('alerts-state-critical', state === 'critical');
      card.title = title;
    });
  }

  async function fetchAlerts() {
    try {
      const r = await fetch('/api/alerts', { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  }

  async function refresh() {
    if (!getWarehouseButtons().length && !getAlertsCards().length) return;
    const data = await fetchAlerts();
    if (data) applyState(data);
    else applyState({ count: 0, total: 0, alerts: [] });
  }

  function init() {
    injectStyle();
    // Stato iniziale verde finché non arriva la prima risposta
    applyState({ count: 0, total: 0, alerts: [] });
    refresh();
    setInterval(refresh, POLL_MS);
    // Hook WebSocket se presente
    try {
      if (window.io && !window.__ALERTS_BADGE_SOCK) {
        const sock = window.io({ transports: ['websocket', 'polling'] });
        window.__ALERTS_BADGE_SOCK = sock;
        sock.on('inventory_updated', function () { refresh(); });
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

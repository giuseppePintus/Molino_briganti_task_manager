/**
 * alerts-badge.js
 * Inietta automaticamente un bottone "campanella avvisi giacenza" nella sticky-top-bar
 * di tutte le pagine. Cliccandolo apre /alerts.html
 *
 * Polling: ogni 60s + listener WebSocket `inventory_updated` se disponibile.
 */
(function () {
  if (window.__ALERTS_BADGE_INITED) return;
  window.__ALERTS_BADGE_INITED = true;

  const STYLE_ID = 'alerts-badge-style';
  const BTN_ID = 'globalAlertsBadgeBtn';
  const POLL_MS = 15_000;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .alerts-badge-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 6px 10px;
        border-radius: 8px;
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        color: #fff;
        font-weight: 600;
        font-size: 14px;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(234,88,12,0.35);
        text-decoration: none;
        line-height: 1;
        transition: transform .15s ease, box-shadow .15s ease, opacity .2s ease;
      }
      .alerts-badge-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(234,88,12,0.5); }
      .alerts-badge-btn.is-zero { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); box-shadow: 0 2px 6px rgba(22,163,74,0.35); }
      .alerts-badge-btn.is-snoozed { background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); box-shadow: 0 2px 6px rgba(234,88,12,0.35); }
      .alerts-badge-btn.is-critical {
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        animation: alertsBadgePulse 1.6s ease-in-out infinite;
      }
      .alerts-badge-btn .ab-count {
        background: rgba(255,255,255,0.25);
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 12px;
        min-width: 20px;
        text-align: center;
      }
      .alerts-badge-btn.is-zero .ab-count { display: none; }
      @keyframes alertsBadgePulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
        50%     { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
      }
      /* Wrapper centrato nella top bar (se presente) */
      .alerts-badge-center {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        margin: 0 auto;
      }
    `;
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function buildButton() {
    if (document.getElementById(BTN_ID)) return document.getElementById(BTN_ID);
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.href = '/warehouse-management.html?section=avvisi';
    a.className = 'alerts-badge-btn is-zero';
    a.title = 'Avvisi di giacenza';
    a.innerHTML = '<span style="font-size:18px;">🔔</span><span class="ab-count">0</span>';
    return a;
  }

  function placeButton(btn) {
    // Non duplicare se già nel DOM
    if (btn.parentNode) return;
    // Preferenza 1: dentro il .header centrato (tra header-left e header-actions).
    // Preferenza 2: sticky-top-bar (legacy).
    // Preferenza 3: body.
    const header = document.querySelector('.sticky-top-bar .header')
                 || document.querySelector('.header');
    if (header) {
      let center = header.querySelector(':scope > .alerts-badge-center');
      if (!center) {
        center = document.createElement('div');
        center.className = 'alerts-badge-center';
        // Stili per centrare nell'header flex (header-left a sx, header-actions a dx)
        center.style.flex = '1 1 auto';
        center.style.display = 'flex';
        center.style.justifyContent = 'center';
        center.style.alignItems = 'center';
        const actions = header.querySelector(':scope > .header-actions');
        if (actions) header.insertBefore(center, actions);
        else header.appendChild(center);
      }
      center.appendChild(btn);
      return;
    }
    const top = document.querySelector('.sticky-top-bar') || document.body;
    let center = top.querySelector('.alerts-badge-center');
    if (!center) {
      center = document.createElement('div');
      center.className = 'alerts-badge-center';
      const firstActions = top.querySelector('.quick-actions') || top.firstElementChild;
      if (firstActions && firstActions.parentNode === top) {
        top.insertBefore(center, firstActions);
      } else {
        top.appendChild(center);
      }
    }
    center.appendChild(btn);
  }

  function updateButton(btn, payload) {
    const count = (payload && payload.count) || 0;
    const total = (payload && payload.total) || 0;
    const hasCritical = !!(payload && Array.isArray(payload.alerts) && payload.alerts.some(a => a.level === 'CRITICAL'));
    const snoozedOnly = count === 0 && total > 0;
    const display = count > 0 ? count : total;
    btn.querySelector('.ab-count').textContent = String(display);
    btn.classList.toggle('is-zero', count === 0 && total === 0);
    btn.classList.toggle('is-snoozed', snoozedOnly);
    btn.classList.toggle('is-critical', hasCritical && count > 0);
    // Mostra il numero anche per snoozed; nasconde solo quando tutto è 0
    const cnt = btn.querySelector('.ab-count');
    if (cnt) cnt.style.display = (count === 0 && total === 0) ? 'none' : '';
    if (count === 0 && total === 0) {
      btn.title = 'Nessun avviso di giacenza';
    } else if (snoozedOnly) {
      btn.title = `${total} avvisi sospesi (ordine in corso)`;
    } else {
      btn.title = `${count} avvisi attivi${hasCritical ? ' (di cui CRITICI)' : ''}`;
    }
  }

  async function fetchAlerts() {
    try {
      const r = await fetch('/api/alerts', { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  }

  async function refresh() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const data = await fetchAlerts();
    if (data) updateButton(btn, data);
  }

  function init() {
    injectStyle();
    const btn = buildButton();
    placeButton(btn);
    refresh();
    setInterval(refresh, POLL_MS);
    // Hook WebSocket se presente
    try {
      if (window.io && !window.__ALERTS_BADGE_SOCK) {
        const sock = window.io({ transports: ['websocket', 'polling'] });
        window.__ALERTS_BADGE_SOCK = sock;
        sock.on('inventory_updated', () => refresh());
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

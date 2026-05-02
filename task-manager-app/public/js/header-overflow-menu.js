/**
 * header-overflow-menu.js
 *
 * Su schermi stretti (<= MAX_W) nasconde i pulsanti dentro `.header-actions`
 * (Logout incluso) e mostra un pulsante `⋮` che apre un menù a tendina con
 * gli stessi pulsanti. I pulsanti vengono SPOSTATI nel menù (non clonati),
 * così conservano i loro handler onclick originali. Su schermi più larghi
 * vengono ricollocati nella loro posizione originale.
 *
 * L'avatar/nome utente (`.user-info`) resta sempre visibile nell'header.
 */
(function () {
  if (window.__HEADER_OVERFLOW_MENU_INITED) return;
  window.__HEADER_OVERFLOW_MENU_INITED = true;

  const STYLE_ID = 'header-overflow-menu-style';
  const TRIGGER_CLASS = 'header-overflow-trigger';
  const MENU_CLASS = 'header-overflow-menu';
  const MAX_W = 600; // px: sotto questa soglia attiviamo il menù

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .${TRIGGER_CLASS} {
        display: none;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: #2a2a2a;
        color: #e0e0e0;
        cursor: pointer;
        font-size: 22px;
        line-height: 1;
        flex-shrink: 0;
        transition: background-color .15s ease;
      }
      .${TRIGGER_CLASS}:hover { background: #3a3a3a; }
      .${TRIGGER_CLASS}[aria-expanded="true"] { background: #3a3a3a; }

      .${MENU_CLASS} {
        position: absolute;
        top: calc(100% + 6px);
        right: 8px;
        min-width: 200px;
        background: #1f1f1f;
        border: 1px solid #3a3a3a;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        padding: 8px;
        display: none;
        flex-direction: column;
        gap: 6px;
        z-index: 1000;
      }
      .${MENU_CLASS}.is-open { display: flex; }
      .${MENU_CLASS} > .btn,
      .${MENU_CLASS} > button,
      .${MENU_CLASS} > a,
      .${MENU_CLASS} > .dropdown-menu-admin > .btn,
      .${MENU_CLASS} > .dropdown-menu-admin > button,
      .${MENU_CLASS} > .dropdown-menu-admin > a {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        height: 42px !important;
        min-height: 42px !important;
        max-height: 42px !important;
        padding: 8px 14px !important;
        margin: 0 !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.2 !important;
        border-radius: 8px !important;
        border-width: 0 !important;
        justify-content: flex-start !important;
        text-align: left !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 10px !important;
        flex: 0 0 auto !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      /* Neutralizza ::before/::after decorativi che alterano l'altezza */
      .${MENU_CLASS} > .btn::before,
      .${MENU_CLASS} > .btn::after,
      .${MENU_CLASS} > .dropdown-menu-admin > .btn::before,
      .${MENU_CLASS} > .dropdown-menu-admin > .btn::after {
        content: none !important;
        display: none !important;
        background: none !important;
        width: 0 !important;
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      /* Uniforma il contenuto interno (span con icona/label) per evitare
         che regole come '.btn-danger span { font-size: 13px }' o
         '.quick-actions .btn span' rendano alcuni bottoni piu' grandi/piu' piccoli */
      .${MENU_CLASS} > .btn > *,
      .${MENU_CLASS} > .btn > span,
      .${MENU_CLASS} > .dropdown-menu-admin > .btn > *,
      .${MENU_CLASS} > .dropdown-menu-admin > .btn > span {
        font-size: 14px !important;
        line-height: 1.2 !important;
        font-weight: 600 !important;
        margin: 0 !important;
        padding: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        display: inline !important;
      }
      /* Wrapper come .dropdown-menu-admin: il bottone interno deve riempirlo */
      .${MENU_CLASS} > .dropdown-menu-admin {
        width: 100% !important;
        position: relative;
        display: block !important;
      }
      /* Sottomenu del dropdown admin: posizionalo coerente nel popup */
      .${MENU_CLASS} .admin-menu-dropdown {
        position: static !important;
        width: 100% !important;
        margin-top: 6px !important;
      }

      /* Quando il menù è attivo, nascondi i bottoni rimasti in .header-actions
         tranne user-info e il trigger stesso. */
      .header-actions.has-overflow > *:not(.user-info):not(.${TRIGGER_CLASS}):not(.${MENU_CLASS}) {
        display: none !important;
      }
      .header-actions.has-overflow .${TRIGGER_CLASS} { display: inline-flex; }

      /* Contenitore .quick-actions svuotato durante l'overflow.
         Usiamo selettore con piu' specificita' per battere le media query
         che forzano 'display: grid !important' su '.quick-actions'. */
      body .quick-actions.is-overflow-hidden,
      body .sticky-top-bar .quick-actions.is-overflow-hidden,
      .quick-actions.is-overflow-hidden {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        overflow: hidden !important;
      }

      /* L'header deve fare da contenitore per il menù assoluto */
      .header { position: relative; }

      /* Fallback CSS puro: anche se il JS non parte, sotto 600px nascondiamo
         il contenitore .quick-actions e mostriamo il trigger ⋮. */
      @media (max-width: 600px) {
        body .quick-actions,
        body .sticky-top-bar .quick-actions {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .header-actions .${TRIGGER_CLASS} { display: inline-flex !important; }
        /* Nascondi anche i bottoni residui dentro .header-actions (es. Logout)
           che il JS non avesse ancora spostato nel menù */
        .header-actions > .btn,
        .header-actions > button:not(.${TRIGGER_CLASS}):not(.${MENU_CLASS}) {
          display: none !important;
        }
      }
    `;
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function ensureTriggerAndMenu(actions) {
    let trigger = actions.querySelector(':scope > .' + TRIGGER_CLASS);
    let menu = actions.querySelector(':scope > .' + MENU_CLASS);
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = TRIGGER_CLASS;
      trigger.setAttribute('aria-label', 'Altre azioni');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.innerHTML = '\u22EE'; // ⋮
      actions.appendChild(trigger);
    }
    if (!menu) {
      menu = document.createElement('div');
      menu.className = MENU_CLASS;
      menu.setAttribute('role', 'menu');
      actions.appendChild(menu);
    }
    if (!trigger.dataset.bound) {
      trigger.addEventListener('click', function (ev) {
        ev.stopPropagation();
        const open = menu.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      trigger.dataset.bound = '1';
    }
    return { trigger, menu };
  }

  function getMovableButtons(actions) {
    // Tutti i figli diretti tranne user-info, trigger e menu
    return Array.from(actions.children).filter(function (el) {
      if (el.classList.contains('user-info')) return false;
      if (el.classList.contains(TRIGGER_CLASS)) return false;
      if (el.classList.contains(MENU_CLASS)) return false;
      return true;
    });
  }

  function getQuickActionsContainers() {
    return document.querySelectorAll('.quick-actions');
  }

  function getQuickActionsItems() {
    const items = [];
    getQuickActionsContainers().forEach(function (qa) {
      Array.from(qa.children).forEach(function (el) { items.push(el); });
    });
    return items;
  }

  function activateOverflow(actions) {
    const { trigger, menu } = ensureTriggerAndMenu(actions);
    // 1) Sposta i pulsanti di .header-actions (Logout, ecc.)
    const headerButtons = getMovableButtons(actions);
    headerButtons.forEach(function (btn, idx) {
      if (!btn.dataset.origIndex) btn.dataset.origIndex = String(idx);
      if (!btn.dataset.origSource) btn.dataset.origSource = 'header';
      menu.appendChild(btn);
    });
    // 2) Sposta i pulsanti delle .quick-actions (es. Gestione Magazzino, ecc.)
    getQuickActionsContainers().forEach(function (qa, qaIdx) {
      Array.from(qa.children).forEach(function (el, idx) {
        if (!el.dataset.origIndex) el.dataset.origIndex = String(idx);
        if (!el.dataset.origSource) el.dataset.origSource = 'quick';
        if (!el.dataset.origQaIdx) el.dataset.origQaIdx = String(qaIdx);
        menu.appendChild(el);
      });
      // Nascondi il contenitore vuoto: usiamo classe + inline style con
      // !important per battere qualsiasi media query CSS che imponga
      // `display: grid !important` su `.quick-actions`.
      qa.classList.add('is-overflow-hidden');
      qa.style.setProperty('display', 'none', 'important');
      qa.style.setProperty('visibility', 'hidden', 'important');
      qa.style.setProperty('height', '0', 'important');
      qa.style.setProperty('margin', '0', 'important');
      qa.style.setProperty('padding', '0', 'important');
    });
    actions.classList.add('has-overflow');
  }

  function deactivateOverflow(actions) {
    const menu = actions.querySelector(':scope > .' + MENU_CLASS);
    if (menu) {
      const trigger = actions.querySelector(':scope > .' + TRIGGER_CLASS);
      const items = Array.from(menu.children);
      // Separa per fonte
      const headerItems = items.filter(function (i) { return i.dataset.origSource !== 'quick'; });
      const quickItems  = items.filter(function (i) { return i.dataset.origSource === 'quick'; });

      headerItems.sort(function (a, b) {
        return (parseInt(a.dataset.origIndex || '0', 10))
             - (parseInt(b.dataset.origIndex || '0', 10));
      });
      headerItems.forEach(function (btn) {
        if (trigger) actions.insertBefore(btn, trigger);
        else actions.appendChild(btn);
      });

      const qaContainers = getQuickActionsContainers();
      // Raggruppa quickItems per origQaIdx
      const grouped = {};
      quickItems.forEach(function (el) {
        const k = el.dataset.origQaIdx || '0';
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(el);
      });
      Object.keys(grouped).forEach(function (k) {
        const idx = parseInt(k, 10);
        const qa = qaContainers[idx] || qaContainers[0];
        if (!qa) return;
        const list = grouped[k].sort(function (a, b) {
          return (parseInt(a.dataset.origIndex || '0', 10))
               - (parseInt(b.dataset.origIndex || '0', 10));
        });
        list.forEach(function (el) { qa.appendChild(el); });
      });
      menu.classList.remove('is-open');
    }
    // Mostra di nuovo i contenitori .quick-actions
    getQuickActionsContainers().forEach(function (qa) {
      qa.classList.remove('is-overflow-hidden');
      // Rimuovi gli stili inline applicati in activateOverflow
      qa.style.removeProperty('display');
      qa.style.removeProperty('visibility');
      qa.style.removeProperty('height');
      qa.style.removeProperty('margin');
      qa.style.removeProperty('padding');
    });
    if (actions.querySelector(':scope > .' + TRIGGER_CLASS)) {
      actions.querySelector(':scope > .' + TRIGGER_CLASS)
             .setAttribute('aria-expanded', 'false');
    }
    actions.classList.remove('has-overflow');
  }

  function syncAll() {
    const narrow = window.innerWidth <= MAX_W;
    document.querySelectorAll('.header > .header-actions').forEach(function (actions) {
      if (narrow) activateOverflow(actions);
      else deactivateOverflow(actions);
    });
  }

  function init() {
    injectStyle();
    syncAll();
    let resizeT;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(syncAll, 120);
    });
    // Chiudi il menù cliccando fuori
    document.addEventListener('click', function (ev) {
      document.querySelectorAll('.' + MENU_CLASS + '.is-open').forEach(function (m) {
        if (!m.parentNode.contains(ev.target)) {
          m.classList.remove('is-open');
          const t = m.parentNode.querySelector('.' + TRIGGER_CLASS);
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    });
    // Chiudi con Esc
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        document.querySelectorAll('.' + MENU_CLASS + '.is-open').forEach(function (m) {
          m.classList.remove('is-open');
          const t = m.parentNode.querySelector('.' + TRIGGER_CLASS);
          if (t) t.setAttribute('aria-expanded', 'false');
        });
      }
    });
    // Re-sync periodico leggero per pagine che aggiungono pulsanti dopo init
    setInterval(function () {
      if (window.innerWidth <= MAX_W) {
        document.querySelectorAll('.header > .header-actions').forEach(function (actions) {
          const stray = getMovableButtons(actions);
          const strayQuick = getQuickActionsItems();
          if (stray.length || strayQuick.length) activateOverflow(actions);
        });
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

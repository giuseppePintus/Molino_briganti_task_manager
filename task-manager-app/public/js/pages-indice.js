/**
 * pages-indice.js
 * Shared module for the "Indice Pagine" popup.
 * Dynamically fetches /api/pages so the list is always up-to-date.
 */

(function () {
  // Icon mapping for known filenames (key = filename without .html)
  const ICON_MAP = {
    'admin-dashboard':        { icon: '✅', label: 'Planner Task' },
    'orders-planner':         { icon: '📦', label: 'Planner Ordini' },
    'customers-management':   { icon: '👨‍💼', label: 'Gestione Clienti' },
    'warehouse-management':   { icon: '🏭', label: 'Gestione Magazzino' },
    'warehouse-management-lite': { icon: '📦', label: 'Magazzino Lite' },
    'trips-management':       { icon: '🚚', label: 'Gestione Viaggi' },
    'operator-dashboard':     { icon: '🖥️', label: 'Dashboard Operatore' },
    'operator-lite':          { icon: '📱', label: 'Operatore Lite' },
    'company-settings':       { icon: '🏢', label: 'Impostazioni Azienda' },
    'operators':              { icon: '👥', label: 'Gestione Operatori' },
    'backup-management':      { icon: '💾', label: 'Gestione Backup' },
    'index':                  { icon: '🏠', label: 'Home / Login' },
  };

  function getModalEl() {
    return document.getElementById('indice-pages-modal');
  }

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'indice-pages-modal';
    overlay.style.cssText = [
      'display:none',
      'position:fixed',
      'top:0','left:0','right:0','bottom:0',
      'background:rgba(0,0,0,0.65)',
      'z-index:99999',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    overlay.innerHTML = `
      <div id="indice-pages-box" style="
        background:#2d2d2d;
        border-radius:12px;
        padding:28px 28px 24px;
        max-width:740px;
        width:92%;
        max-height:88vh;
        overflow-y:auto;
        box-shadow:0 8px 40px rgba(0,0,0,0.6);
        position:relative;
      ">
        <button onclick="closeIndiceModal()" style="
          position:absolute;top:12px;right:14px;
          background:none;border:none;color:#aaa;
          font-size:22px;cursor:pointer;line-height:1;
        " title="Chiudi">✕</button>

        <h2 style="color:#38bdf8;margin-bottom:18px;font-size:1.3rem;">🗂️ Indice Pagine</h2>

        <div id="indice-pages-grid" style="
          display:grid;
          grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
          gap:10px;
        ">
          <div style="color:#888;font-size:13px;">Caricamento...</div>
        </div>
      </div>
    `;

    // Click outside closes modal
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeIndiceModal();
    });

    // Escape key closes modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeIndiceModal();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function renderPages(pages) {
    const grid = document.getElementById('indice-pages-grid');
    if (!grid) return;

    const currentFile = location.pathname.split('/').pop() || 'index.html';

    grid.innerHTML = pages.map(function (p) {
      const key = p.file.replace('.html', '');
      const mapped = ICON_MAP[key];
      const icon = mapped ? mapped.icon : '📄';
      // Use server title (already stripped of " - Molino Briganti"), fallback to label map
      const label = p.title || (mapped ? mapped.label : key);
      const isActive = p.file === currentFile;

      return `<a href="${p.file}" style="
        display:flex;align-items:center;gap:10px;
        background:${isActive ? '#1e3a5f' : '#1a1a1a'};
        border:1px solid ${isActive ? '#38bdf8' : '#444'};
        border-radius:8px;
        padding:11px 12px;
        color:#e0e0e0;
        text-decoration:none;
        transition:background 0.15s,border-color 0.15s;
        font-size:13px;
      "
      onmouseover="this.style.background='#2a3a4a';this.style.borderColor='#60a5fa'"
      onmouseout="this.style.background='${isActive ? '#1e3a5f' : '#1a1a1a'}';this.style.borderColor='${isActive ? '#38bdf8' : '#444'}'">
        <span style="font-size:1.35rem;flex-shrink:0">${icon}</span>
        <span>${label}</span>
      </a>`;
    }).join('');
  }

  window.openIndiceModal = function () {
    let modal = getModalEl();
    if (!modal) modal = buildModal();
    modal.style.display = 'flex';

    // Refresh pages list each time
    fetch('/api/pages')
      .then(function (r) { return r.json(); })
      .then(function (pages) { renderPages(pages); })
      .catch(function () {
        const grid = document.getElementById('indice-pages-grid');
        if (grid) grid.innerHTML = '<div style="color:#f87171">Errore caricamento pagine.</div>';
      });
  };

  window.closeIndiceModal = function () {
    const modal = getModalEl();
    if (modal) modal.style.display = 'none';
  };
})();

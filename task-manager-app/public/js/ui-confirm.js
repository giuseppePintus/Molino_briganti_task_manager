/**
 * Shared "pretty" confirm popup, used across the app.
 * Overrides any local window.customConfirm definitions.
 *
 * Usage:
 *   if (await customConfirm('Eliminare questo elemento?')) { ... }
 *
 * Optional second arg:
 *   await customConfirm(msg, { title, confirmText, cancelText, danger, icon })
 */
(function () {
    'use strict';

    // Inject CSS once
    if (!document.getElementById('__cc_styles')) {
        const style = document.createElement('style');
        style.id = '__cc_styles';
        style.textContent = `
            @keyframes __ccFadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes __ccSlideIn { from { transform: translateY(-10px) scale(.96); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
            .__cc_overlay {
                position: fixed; inset: 0;
                background: rgba(8, 10, 14, 0.72);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 100000;
                display: flex; align-items: center; justify-content: center;
                animation: __ccFadeIn .15s ease-out;
                padding: 16px;
            }
            .__cc_dialog {
                background: linear-gradient(180deg, #2b2f36 0%, #21252b 100%);
                border: 1px solid #3a3f47;
                border-radius: 14px;
                box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.3);
                max-width: 460px; width: 100%;
                padding: 26px 28px 22px;
                color: #e8e8ea;
                font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                animation: __ccSlideIn .18s ease-out;
            }
            .__cc_header {
                display: flex; align-items: flex-start; gap: 14px;
                margin-bottom: 14px;
            }
            .__cc_icon {
                width: 44px; height: 44px;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 22px;
                flex-shrink: 0;
            }
            .__cc_icon.danger { background: rgba(220, 38, 38, .15); color: #fca5a5; }
            .__cc_icon.warn   { background: rgba(245, 158, 11, .15); color: #fcd34d; }
            .__cc_icon.info   { background: rgba(59, 130, 246, .15); color: #93c5fd; }
            .__cc_title { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #fff; line-height: 1.3; }
            .__cc_msg { margin: 0; font-size: 14.5px; line-height: 1.55; color: #c8ccd2; word-break: break-word; }
            .__cc_actions {
                display: flex; gap: 10px;
                justify-content: flex-end;
                margin-top: 22px;
            }
            .__cc_btn {
                font-family: inherit;
                font-size: 14px; font-weight: 600;
                padding: 10px 22px;
                border-radius: 8px; border: none; cursor: pointer;
                transition: transform .08s ease, filter .12s ease, background .12s ease;
            }
            .__cc_btn:active { transform: translateY(1px); }
            .__cc_btn_cancel { background: #3a3f47; color: #e8e8ea; }
            .__cc_btn_cancel:hover { background: #454b54; }
            .__cc_btn_ok { background: #2563eb; color: #fff; }
            .__cc_btn_ok:hover { filter: brightness(1.1); }
            .__cc_btn_ok.danger { background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 2px 8px rgba(220,38,38,.4); }
            .__cc_btn_ok.danger:hover { filter: brightness(1.08); }
            .__cc_btn_ok.warn   { background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); }
        `;
        document.head.appendChild(style);
    }

    function detectVariant(msg, opts) {
        if (opts && opts.danger) return 'danger';
        const m = String(msg || '').toLowerCase();
        if (/elimina|rimuov|cancella|azzera|sovrascriv/.test(m)) return 'danger';
        if (/attenzion|warning|avvert|conferm/.test(m)) return 'warn';
        return 'info';
    }

    function customConfirm(message, options) {
        return new Promise(resolve => {
            const opts = options || {};
            const variant = detectVariant(message, opts);
            const icon = opts.icon || (variant === 'danger' ? '🗑️' : variant === 'warn' ? '⚠️' : '❓');
            const title = opts.title || (variant === 'danger' ? 'Conferma eliminazione' : 'Conferma');
            const confirmText = opts.confirmText || (variant === 'danger' ? 'Elimina' : 'Conferma');
            const cancelText = opts.cancelText || 'Annulla';

            const ov = document.createElement('div');
            ov.className = '__cc_overlay';
            ov.setAttribute('role', 'dialog');
            ov.setAttribute('aria-modal', 'true');

            const safeMsg = String(message == null ? '' : message)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');

            ov.innerHTML = `
                <div class="__cc_dialog">
                    <div class="__cc_header">
                        <div class="__cc_icon ${variant}">${icon}</div>
                        <div style="flex:1;min-width:0;">
                            <h3 class="__cc_title">${title}</h3>
                            <p class="__cc_msg">${safeMsg}</p>
                        </div>
                    </div>
                    <div class="__cc_actions">
                        <button type="button" class="__cc_btn __cc_btn_cancel">${cancelText}</button>
                        <button type="button" class="__cc_btn __cc_btn_ok ${variant}">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(ov);
            const okBtn = ov.querySelector('.__cc_btn_ok');
            const noBtn = ov.querySelector('.__cc_btn_cancel');

            const cleanup = (result) => {
                document.removeEventListener('keydown', kh, true);
                ov.style.animation = 'none';
                ov.style.opacity = '0';
                ov.style.transition = 'opacity .12s';
                setTimeout(() => { try { ov.remove(); } catch (_) {} }, 120);
                resolve(result);
            };
            const kh = (ev) => {
                if (ev.key === 'Escape') { ev.preventDefault(); cleanup(false); }
                else if (ev.key === 'Enter') { ev.preventDefault(); cleanup(true); }
            };

            okBtn.addEventListener('click', () => cleanup(true));
            noBtn.addEventListener('click', () => cleanup(false));
            ov.addEventListener('click', (ev) => { if (ev.target === ov) cleanup(false); });
            document.addEventListener('keydown', kh, true);

            // Focus the Cancel button by default for destructive actions (safer)
            setTimeout(() => { (variant === 'danger' ? noBtn : okBtn).focus(); }, 0);
        });
    }

    // Always override
    window.customConfirm = customConfirm;
})();

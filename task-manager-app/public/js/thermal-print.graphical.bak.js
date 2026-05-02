/**
 * Thermal Receipt Printer support
 * Target: 72mm / 576 dpi thermal printer (ESC/POS style via browser)
 * Generates a narrow, monospace, high-contrast HTML page optimized for
 * a 72mm receipt roll. Browser print dialog should be set to:
 *   - Page size: 72mm x auto (or "Receipt 72mm")
 *   - Margins: None
 *   - Background graphics: ON
 *
 * Public API (window-scoped):
 *   - printTripThermal(tripId)
 *   - printPickupOrderThermal(orderId)
 *
 * Required globals (already defined in admin-dashboard.html / orders-planner.html):
 *   trips, orders, allOperators, clienti
 *   getTripOrders(tripId), calculateTripTotals(tripId)
 *   getClientName(order), getOrderProductName(order)
 *   getOrderTotalQuantity(order), getOrderTotalColli(order)
 *   extractWeightPerCollo(productCode)
 */
(function () {
    'use strict';

    // 32 characters fits comfortably on 72mm at 12pt monospace
    const LINE_WIDTH = 38;

    // Read a top-level identifier from the page (works with `let`/`const`
    // declarations that don't attach to `window`). Returns undefined on failure.
    function getGlobal(name) {
        try {
            if (window[name] !== undefined) return window[name];
        } catch (_) {}
        try {
            // The Function constructor evaluates in global scope and can see
            // top-level let/const bindings of classic scripts.
            return new Function('try { return ' + name + '; } catch(_) { return undefined; }')();
        } catch (_) { return undefined; }
    }
    function getOrders() { const v = getGlobal('orders'); return Array.isArray(v) ? v : []; }
    function getTrips() { const v = getGlobal('trips'); return Array.isArray(v) ? v : []; }
    function getOps() { const v = getGlobal('allOperators'); return Array.isArray(v) ? v : []; }
    function findById(arr, id) {
        return arr.find(x => x && (x.id === id || String(x.id) === String(id)));
    }

    function repeat(ch, n) { return new Array(Math.max(0, n) + 1).join(ch); }
    function pad(s, n) { s = String(s); return s.length >= n ? s : s + repeat(' ', n - s.length); }
    function center(s) {
        s = String(s);
        if (s.length >= LINE_WIDTH) return s;
        const left = Math.floor((LINE_WIDTH - s.length) / 2);
        return repeat(' ', left) + s;
    }
    function hr(ch) { return repeat(ch || '-', LINE_WIDTH); }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    function fmtDate(d) {
        if (!(d instanceof Date)) d = new Date(d);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('it-IT');
    }
    function fmtTime(d) {
        if (!(d instanceof Date)) d = new Date(d);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    function getOperatorName(assignedOperatorId, fallbackObj) {
        if (assignedOperatorId) {
            const ops = getOps();
            const op = findById(ops, assignedOperatorId);
            if (op) return op.name || op.username || 'Op';
        }
        if (fallbackObj && (fallbackObj.name || fallbackObj.username)) {
            return fallbackObj.name || fallbackObj.username;
        }
        return 'Non assegnato';
    }
    function parseProducts(raw) {
        if (!raw) return [];
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { return []; }
        }
        return Array.isArray(raw) ? raw : [];
    }

    // CSS thermal-safe per Xprinter XP-N160II (carta 80mm)
    // IMPORTANTE: NON impostiamo @page size perche' il driver Xprinter ha
    // un formato carta proprio configurato (es. "80(72.1) x 3276mm" o simili).
    // Forzando una size diversa Chrome -> driver va in errore. Lasciamo che
    // sia il driver a gestire le dimensioni della carta.
    const THERMAL_CSS = `
        @page { margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
            width: 72mm;
            font-family: Arial, 'Arial Narrow', Helvetica, sans-serif;
            font-size: 9pt;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        /* ---- HEADER (bordo spesso, niente sfondo pieno) ---- */
        .rh { text-align:center; padding:2mm 2mm 1.5mm; border-bottom:1mm solid #000; }
        .rh-title { font-size:16pt; font-weight:900; letter-spacing:2px; line-height:1.1; }
        .rh-sub { font-size:9pt; margin-top:1mm; font-weight:700; letter-spacing:1px; }
        /* ---- INFO BLOCK ---- */
        .ri { padding:2mm 3mm; border-bottom:0.4mm solid #000; }
        .ri-row { display:flex; justify-content:space-between; font-size:9pt; line-height:1.5; }
        .ri-row b { min-width:18mm; font-weight:700; }
        /* ---- SECTION BAND (solo bordi) ---- */
        .rs { padding:1.5mm 3mm; font-size:10pt; font-weight:900; letter-spacing:1px; display:flex; justify-content:space-between; align-items:center; border-top:0.6mm solid #000; border-bottom:0.6mm solid #000; }
        /* ---- DELIVERY ITEM ---- */
        .ritem { border-bottom:0.4mm dashed #000; padding:2mm 3mm; }
        .ritem-hd { display:flex; align-items:flex-start; gap:2mm; margin-bottom:1.5mm; }
        /* badge cliente: piccolo riquadro inverted, ok perchè area limitata */
        .rnum { background:#000; color:#fff; min-width:7mm; height:7mm; display:flex; align-items:center; justify-content:center; font-size:11pt; font-weight:900; flex-shrink:0; border-radius:1mm; }
        .rclient { font-size:13pt; font-weight:900; flex:1; line-height:1.2; word-break:break-word; }
        .rtime { font-size:9pt; font-weight:700; border:0.3mm solid #000; padding:0.5mm 1.5mm; white-space:nowrap; align-self:flex-start; margin-top:0.5mm; }
        /* ---- PRODUCT BLOCK (bordo, niente sfondo pieno) ---- */
        .rprod { border:0.4mm solid #000; border-left:1.2mm solid #000; padding:1.5mm 2mm; margin:1mm 0; }
        .rprod-name { font-size:12pt; font-weight:900; line-height:1.2; word-break:break-word; }
        .rprod-qty { display:flex; justify-content:space-between; align-items:center; margin-top:1.5mm; }
        .rcolli { background:#000; color:#fff; padding:1mm 2.5mm; font-size:13pt; font-weight:900; white-space:nowrap; border-radius:1mm; }
        .rkg { font-size:11pt; font-weight:700; }
        /* ---- META (lotto / scaffale / scadenza) ---- */
        .rmeta { display:flex; gap:1.5mm; margin-top:1.5mm; flex-wrap:wrap; align-items:center; }
        .rbatch { font-size:8pt; border:0.3mm solid #000; padding:0.5mm 1.5mm; }
        .rpos   { font-size:11pt; font-weight:900; background:#000; color:#fff; padding:0.8mm 2.5mm; letter-spacing:0.5px; border-radius:1mm; }
        .rexp   { font-size:8pt; border:0.3mm solid #000; padding:0.5mm 1.5mm; font-weight:700; }
        /* ---- NOTES ---- */
        .rnotes { font-size:9pt; font-weight:700; margin-top:1.5mm; padding:1.5mm 2mm; border:0.5mm solid #000; }
        /* ---- TOTALS ---- */
        .rtot-section { padding:2mm 3mm; border-top:0.5mm solid #000; }
        .rtot-row { display:flex; justify-content:space-between; font-size:9pt; line-height:1.6; }
        .rtot-row b { flex:1; word-break:break-word; }
        /* totale finale: bordo spesso invece di sfondo pieno */
        .rtot-final { border:1mm solid #000; padding:2mm 3mm; display:flex; justify-content:space-between; align-items:center; margin:2mm 0; }
        .rtot-final .lbl { font-size:13pt; font-weight:900; }
        .rtot-final .val { font-size:14pt; font-weight:900; text-align:right; }
        /* ---- FOOTER ---- */
        .rfooter { text-align:center; padding:2mm 2mm 4mm; font-size:8pt; border-top:0.3mm dashed #000; }
        /* ---- SPACER ---- */
        .rsp { height:3mm; }
        /* ---- TOOLBAR (solo schermo) ---- */
        .toolbar { padding:8px; text-align:center; background:#f0f0f0; }
        .toolbar button { padding:8px 16px; font-size:13px; margin:3px; border:none; border-radius:4px; cursor:pointer; color:#fff; font-weight:bold; }
        .toolbar .btn-print { background:#111; }
        .toolbar .btn-close { background:#888; }
        @media print { .no-print { display:none !important; } body { width:80mm; } }
    `;

    function openReceipt(title, bodyHtml) {
        const html = '<!doctype html><html><head>' +
            '<meta charset="UTF-8">' +
            '<title>' + escapeHtml(title) + '</title>' +
            '<style>' + THERMAL_CSS + '</style>' +
            '</head><body>' +
            bodyHtml +
            '<div class="toolbar no-print">' +
            '<button class="btn-print" onclick="window.print()">\uD83D\uDDA8\uFE0F Stampa</button>' +
            '<button class="btn-close" onclick="window.close()">&#10060; Chiudi</button>' +
            '</div>' +
            '<script>window.addEventListener("load",function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},300);});<\/script>' +
            '</body></html>';
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const w    = window.open(url, '_blank', 'width=440,height=800');
        if (!w) {
            alert('Impossibile aprire la finestra di stampa. Disabilita il blocco popup.');
            URL.revokeObjectURL(url);
            return;
        }
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    }

    // Restituisce HTML grafico per un singolo prodotto
    function productBlock(p) {
        const name  = String(p.product || '').trim();
        const qtyKg = Number(p.quantity) || 0;
        const wpc   = (typeof window.extractWeightPerCollo === 'function')
            ? window.extractWeightPerCollo(name) : 1;
        const colli = wpc > 0 ? Math.round(qtyKg / wpc) : 0;
        const batch = p.batch || (p.batchData && p.batchData.batch) || '';
        const pos   = p.shelfPosition || (p.batchData && p.batchData.shelfPosition) || '';
        const exp   = p.expiry || (p.batchData && p.batchData.expiry) || '';
        let meta = '';
        if (batch || pos || exp) {
            meta = '<div class="rmeta">';
            if (batch) meta += '<span class="rbatch">L:' + escapeHtml(batch) + '</span>';
            if (pos)   meta += '<span class="rpos">' + escapeHtml(pos) + '</span>';
            if (exp)   meta += '<span class="rexp">Sc:' + escapeHtml(exp) + '</span>';
            meta += '</div>';
        }
        return '<div class="rprod">' +
            '<div class="rprod-name">' + escapeHtml(name) + '</div>' +
            '<div class="rprod-qty">' +
            '<span class="rcolli">' + escapeHtml(String(colli)) + ' colli</span>' +
            '<span class="rkg">' + escapeHtml(qtyKg.toFixed(1)) + ' kg</span>' +
            '</div>' + meta + '</div>';
    }

    function wrap(s, n) {
        const out = [];
        let cur = '';
        s.split(/\s+/).forEach(word => {
            if ((cur + ' ' + word).trim().length > n) {
                if (cur) out.push(cur);
                cur = word;
            } else {
                cur = (cur ? cur + ' ' : '') + word;
            }
        });
        if (cur) out.push(cur);
        return out.length ? out : [s.substring(0, n)];
    }

    // ============================================================
    // TRIP THERMAL RECEIPT
    // ============================================================
    function printTripThermal(tripId) {
        const trip = findById(getTrips(), tripId);
        if (!trip) { alert('Viaggio non trovato'); return; }

        const tripOrders = (typeof window.getTripOrders === 'function')
            ? window.getTripOrders(tripId)
            : getOrders().filter(o => String(o.tripId) === String(tripId));

        const totals = (typeof window.calculateTripTotals === 'function')
            ? window.calculateTripTotals(tripId) : {};

        const operatorName = getOperatorName(trip.assignedOperatorId, trip.assignedOperator);
        const dt = trip.dateTime ? new Date(trip.dateTime) : new Date();

        let html = '';

        // Header
        html += '<div class="rh">';
        html +=   '<div class="rh-title">VIAGGIO</div>';
        if (trip.name) html += '<div class="rh-sub">' + escapeHtml(trip.name) + '</div>';
        html += '</div>';

        // Info
        html += '<div class="ri">';
        html += '<div class="ri-row"><b>Data</b><span>' + escapeHtml(fmtDate(dt)) + '</span></div>';
        html += '<div class="ri-row"><b>Ora</b><span>' + escapeHtml(fmtTime(dt)) + '</span></div>';
        html += '<div class="ri-row"><b>Operatore</b><span>' + escapeHtml(operatorName) + '</span></div>';
        if (trip.vehicle) html += '<div class="ri-row"><b>Mezzo</b><span>' + escapeHtml(trip.vehicle) + '</span></div>';
        html += '</div>';

        // Deliveries
        html += '<div class="rs"><span>CONSEGNE</span><span>' + tripOrders.length + '</span></div>';

        tripOrders.forEach((o, idx) => {
            const cliente = (typeof window.getClientName === 'function')
                ? window.getClientName(o) : (o.client || o.clientName || '');
            const time = fmtTime(o.dateTime);

            html += '<div class="ritem">';
            html += '<div class="ritem-hd">';
            html += '<div class="rnum">' + (idx + 1) + '</div>';
            html += '<div class="rclient">' + escapeHtml(cliente) + '</div>';
            if (time) html += '<div class="rtime">' + escapeHtml(time) + '</div>';
            html += '</div>';

            const prods = parseProducts(o.products);
            if (prods.length) {
                prods.forEach(p => { html += productBlock(p); });
            } else {
                const name = (typeof window.getOrderProductName === 'function')
                    ? window.getOrderProductName(o) : (o.product || '');
                const qty  = (typeof window.getOrderTotalQuantity === 'function')
                    ? window.getOrderTotalQuantity(o) : (o.quantity || 0);
                if (name || qty) {
                    const wpc = (typeof window.extractWeightPerCollo === 'function') ? window.extractWeightPerCollo(name) : 1;
                    const c   = wpc > 0 ? Math.round(Number(qty) / wpc) : 0;
                    html += productBlock({ product: name, quantity: qty, batchData: null });
                }
            }
            if (o.notes) html += '<div class="rnotes">NOTE: ' + escapeHtml(o.notes) + '</div>';
            html += '</div>'; // ritem
        });

        // Totals
        html += '<div class="rs">TOTALI PRODOTTI</div>';
        let totalKg = 0, totalColli = 0;
        html += '<div class="rtot-section">';
        Object.entries(totals).forEach(([prod, qty]) => {
            const wpc = (typeof window.extractWeightPerCollo === 'function') ? window.extractWeightPerCollo(prod) : 1;
            const c   = wpc > 0 ? Math.round(qty / wpc) : 0;
            totalKg += qty; totalColli += c;
            html += '<div class="rtot-row"><b>' + escapeHtml(prod) + '</b>' +
                '<span>' + escapeHtml(c + ' colli &bull; ' + qty.toFixed(1) + ' kg') + '</span></div>';
        });
        html += '</div>';
        html += '<div class="rtot-final">';
        html +=   '<span class="lbl">TOTALE</span>';
        html +=   '<span class="val">' + escapeHtml(totalColli + ' colli') + '<br>' + escapeHtml(totalKg.toFixed(1) + ' kg') + '</span>';
        html += '</div>';

        html += '<div class="rfooter">Stampato: ' + escapeHtml(new Date().toLocaleString('it-IT')) + '</div>';
        html += '<div class="rsp"></div><div class="rsp"></div>';

        openReceipt('Viaggio ' + (trip.name || tripId), html);
    }

    // ============================================================
    // PICKUP ORDER THERMAL RECEIPT
    // ============================================================
    function printPickupOrderThermal(orderId) {
        const order = findById(getOrders(), orderId);
        if (!order) { alert('Ordine non trovato'); return; }

        const cliente = (typeof window.getClientName === 'function')
            ? window.getClientName(order) : (order.client || order.clientName || '');
        const dt = order.dateTime ? new Date(order.dateTime) : new Date();
        const operatorName = getOperatorName(order.assignedOperatorId, order.assignedOperator);

        let html = '';

        // Header
        html += '<div class="rh">';
        html +=   '<div class="rh-title">RITIRO</div>';
        html +=   '<div class="rh-sub">' + escapeHtml(cliente || '-') + '</div>';
        html += '</div>';

        // Info
        html += '<div class="ri">';
        html += '<div class="ri-row"><b>Data</b><span>' + escapeHtml(fmtDate(dt)) + '</span></div>';
        html += '<div class="ri-row"><b>Ora</b><span>' + escapeHtml(fmtTime(dt)) + '</span></div>';
        html += '<div class="ri-row"><b>Operatore</b><span>' + escapeHtml(operatorName) + '</span></div>';
        html += '<div class="ri-row"><b>Tipo</b><span>Ritiro Cliente</span></div>';
        html += '</div>';

        // Products
        html += '<div class="rs">PRODOTTI</div>';

        const prods = parseProducts(order.products);
        let totalKg = 0, totalColli = 0;
        if (prods.length) {
            prods.forEach(p => {
                const wpc   = (typeof window.extractWeightPerCollo === 'function') ? window.extractWeightPerCollo(p.product || '') : 1;
                const qtyKg = Number(p.quantity) || 0;
                const c     = wpc > 0 ? Math.round(qtyKg / wpc) : 0;
                totalKg += qtyKg; totalColli += c;
                html += productBlock(p);
            });
        } else {
            const name = (typeof window.getOrderProductName === 'function') ? window.getOrderProductName(order) : (order.product || '');
            const qty  = (typeof window.getOrderTotalQuantity === 'function') ? window.getOrderTotalQuantity(order) : (order.quantity || 0);
            const wpc  = (typeof window.extractWeightPerCollo === 'function') ? window.extractWeightPerCollo(name) : 1;
            const c    = wpc > 0 ? Math.round(Number(qty) / wpc) : 0;
            totalKg = Number(qty); totalColli = c;
            html += productBlock({ product: name, quantity: qty, batchData: null });
        }

        if (order.notes) {
            html += '<div style="padding:0 3mm"><div class="rnotes">NOTE: ' + escapeHtml(order.notes) + '</div></div>';
        }

        // Total
        html += '<div class="rtot-final" style="margin-top:2mm">';
        html +=   '<span class="lbl">TOTALE</span>';
        html +=   '<span class="val">' + escapeHtml(totalColli + ' colli') + '<br>' + escapeHtml(totalKg.toFixed(1) + ' kg') + '</span>';
        html += '</div>';

        html += '<div class="rfooter">Stampato: ' + escapeHtml(new Date().toLocaleString('it-IT')) + '</div>';
        html += '<div class="rsp"></div><div class="rsp"></div>';

        openReceipt('Ritiro ' + (cliente || orderId), html);
    }

    window.printTripThermal = printTripThermal;
    window.printPickupOrderThermal = printPickupOrderThermal;

    // ============================================================
    // INTERNAL ORDER (TASK "Ordine interno") — THERMAL & FULL PRINT
    // ============================================================

    function getToken() {
        try { return localStorage.getItem('token') || ''; } catch (_) { return ''; }
    }

    async function fetchTask(taskId) {
        try {
            const r = await fetch('/api/tasks', {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const list = await r.json();
            const arr = Array.isArray(list) ? list : (list.tasks || []);
            return arr.find(t => String(t.id) === String(taskId)) || null;
        } catch (e) {
            console.warn('[print internal order] fetch task', e);
            return null;
        }
    }

    async function markTaskPrinted(taskId) {
        try {
            const r = await fetch('/api/tasks/' + taskId + '/mark-printed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                }
            });
            const j = await r.json().catch(() => ({}));
            return { ok: r.ok, status: r.status, body: j };
        } catch (e) {
            return { ok: false, status: 0, body: { error: String(e) } };
        }
    }

    function isAdminUser() {
        try {
            const raw = localStorage.getItem('currentUser')
                || localStorage.getItem('user')
                || '{}';
            const u = JSON.parse(raw);
            if (!u) return false;
            const r = String(u.role || '').toLowerCase();
            return r === 'admin' || r === 'master';
        } catch (_) { return false; }
    }

    // Estrae i campi rilevanti dal title/description del task ordine interno.
    // Title format: "🛒 Ordine interno: <NAME> × <QTY> <UNIT>"
    function parseInternalOrder(task) {
        const title = task.title || '';
        const desc = task.description || '';
        const m = title.match(/Ordine interno:\s*(.+?)\s*[×x]\s*(\d+)\s*(\w+)?/i);
        const get = (label) => {
            const re = new RegExp('^\\s*' + label + ':\\s*(.+?)\\s*$', 'mi');
            const mm = desc.match(re);
            return mm ? mm[1].trim() : '';
        };
        const codeVal = get('Codice');
        // Peso per collo dal suffisso del codice articolo (es. F-0-5 = 5 kg)
        let weightPerCollo = 0;
        if (codeVal) {
            const wm = codeVal.match(/-(\d+(?:[\.,]\d+)?)$/);
            if (wm) weightPerCollo = parseFloat(wm[1].replace(',', '.')) || 0;
        }
        const qtyVal = m ? parseInt(m[2], 10) : (parseInt(get('Quantità da riordinare'), 10) || 0);
        const totalKg = weightPerCollo > 0 ? Math.round(qtyVal * weightPerCollo * 100) / 100 : 0;
        return {
            id: task.id,
            name: m ? m[1] : (get('Articolo') || title),
            qty: qtyVal,
            unit: 'colli',
            code: codeVal,
            category: get('Categoria'),
            weightPerCollo: weightPerCollo,
            totalKg: totalKg,
            minimum: get('Soglia avviso') || (get('Soglia avviso') ? '' : ''),
            soglie: (get('Soglia avviso') || get('Soglia critica')) ? (desc.match(/Soglia avviso[^\n]*/i) || [''])[0] : '',
            notes: get('Note'),
            scheduledAt: task.scheduledAt,
            priority: task.priority,
            assignedOperatorId: task.assignedOperatorId,
            printedAt: task.internalOrderPrintedAt || null
        };
    }

    async function printInternalOrderThermal(taskId) {
        const task = await fetchTask(taskId);
        if (!task) { alert('Task non trovato'); return; }
        const isAdmin = isAdminUser();
        const already = task.internalOrderPrintedAt;
        if (already) {
            const when = new Date(already).toLocaleString('it-IT');
            if (isAdmin) {
                const ok = confirm('⚠️ Questo ordine interno è già stato stampato il '
                    + when + '.\n\nVuoi ristamparlo comunque?');
                if (!ok) return;
            } else {
                alert('⚠️ Questo ordine interno è già stato stampato il '
                    + when
                    + '.\nGli operatori possono stamparlo una sola volta.');
                return;
            }
        }

        // Marca come stampato (admin: aggiorna comunque)
        const mark = await markTaskPrinted(taskId);
        if (!mark.ok && !isAdmin) {
            alert('Impossibile stampare: ' + (mark.body && mark.body.error || mark.status));
            return;
        }

        const o = parseInternalOrder(task);
        const out = [];
        out.push(center('=== ORDINE INTERNO ==='));
        out.push(center('Molino Briganti'));
        out.push('');
        out.push(hr('='));
        // Nome articolo (wrap)
        wrap(String(o.name), LINE_WIDTH).forEach(l => out.push(l));
        if (o.code) out.push('Cod: ' + o.code);
        if (o.category) out.push('Cat: ' + o.category);
        out.push(hr('-'));
        // Quantità grande
        out.push('');
        const qtyLine = 'QTA: ' + o.qty + ' ' + o.unit;
        out.push(center(qtyLine));
        out.push('');
        out.push(hr('-'));
        if (o.totalKg > 0) {
            out.push('Peso: ' + o.qty + ' x ' + o.weightPerCollo + ' kg = ' + o.totalKg + ' kg');
        }
        if (o.scheduledAt) {
            out.push('Per il: ' + fmtDate(o.scheduledAt) + ' ' + fmtTime(o.scheduledAt));
        }
        const opName = getOperatorName(o.assignedOperatorId);
        out.push('Op: ' + opName);
        if (o.priority) out.push('Priorità: ' + o.priority);
        if (o.notes) {
            out.push('');
            out.push('Note:');
            wrap(o.notes, LINE_WIDTH).forEach(l => out.push(l));
        }
        out.push('');
        out.push(hr('='));
        out.push(center('Stampato ' + new Date().toLocaleString('it-IT')));
        out.push('');
        out.push('');
        out.push('');

        openReceipt('Ordine interno ' + o.id, escapeHtml(out.join('\n')));
    }

    function printInternalOrderFull(taskId) {
        // Stampa A4 completa per gli admin (pi\u00f9 dettagliata)
        if (!isAdminUser()) {
            alert('Solo gli admin possono stampare il documento completo.');
            return;
        }
        fetchTask(taskId).then(task => {
            if (!task) { alert('Task non trovato'); return; }
            const o = parseInternalOrder(task);
            const opName = getOperatorName(o.assignedOperatorId);
            const w = window.open('', '_blank', 'width=900,height=1100');
            if (!w) { alert('Abilita i popup per stampare.'); return; }
            const html = `<!doctype html><html><head><meta charset="UTF-8">
                <title>Ordine interno #${task.id} - ${escapeHtml(o.name)}</title>
                <style>
                    @page { size: A4; margin: 18mm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; color:#111; margin:0; padding:24px; }
                    h1 { font-size: 22pt; margin: 0 0 4px; }
                    .sub { color:#555; margin-bottom: 18px; }
                    table { width:100%; border-collapse: collapse; margin-top: 12px; }
                    th, td { border:1px solid #ccc; padding: 8px 10px; text-align:left; vertical-align: top; }
                    th { background:#f3f4f6; font-weight:700; }
                    .qty { font-size: 32pt; font-weight: 900; color:#b91c1c; }
                    .footer { margin-top:24px; color:#666; font-size: 10pt; }
                    .toolbar { padding:12px; text-align:center; }
                    .toolbar button { padding:8px 14px; font-size:13px; margin:2px; border:none; border-radius:4px; cursor:pointer; color:#fff; }
                    .toolbar .btn-print { background:#111; }
                    .toolbar .btn-close { background:#888; }
                    @media print { .no-print { display:none !important; } body { padding:0; } }
                </style>
            </head><body>
                <h1>🛒 Ordine interno #${task.id}</h1>
                <div class="sub">Molino Briganti · Generato il ${new Date().toLocaleString('it-IT')}</div>
                <table>
                    <tr><th style="width:30%">Articolo</th><td><strong>${escapeHtml(o.name)}</strong></td></tr>
                    ${o.code ? `<tr><th>Codice</th><td>${escapeHtml(o.code)}</td></tr>` : ''}
                    ${o.category ? `<tr><th>Categoria</th><td>${escapeHtml(o.category)}</td></tr>` : ''}
                    <tr><th>Quantità da riordinare</th><td class="qty">${o.qty} ${escapeHtml(o.unit)}</td></tr>
                    ${o.totalKg > 0 ? `<tr><th>Peso totale</th><td><strong>${o.qty} × ${o.weightPerCollo} kg = ${o.totalKg} kg</strong></td></tr>` : ''}
                    ${o.scheduledAt ? `<tr><th>Data prevista</th><td>${fmtDate(o.scheduledAt)} ${fmtTime(o.scheduledAt)}</td></tr>` : ''}
                    <tr><th>Operatore</th><td>${escapeHtml(opName)}</td></tr>
                    ${o.priority ? `<tr><th>Priorità</th><td>${escapeHtml(o.priority)}</td></tr>` : ''}
                    ${o.notes ? `<tr><th>Note</th><td>${escapeHtml(o.notes)}</td></tr>` : ''}
                    ${task.internalOrderPrintedAt ? `<tr><th>Già stampato</th><td>${new Date(task.internalOrderPrintedAt).toLocaleString('it-IT')}</td></tr>` : ''}
                </table>
                <div class="footer">Firma operatore: ____________________________</div>
                <div class="toolbar no-print">
                    <button class="btn-print" onclick="window.print()">🖨️ Stampa</button>
                    <button class="btn-close" onclick="window.close()">❌ Chiudi</button>
                </div>
                <script>window.addEventListener('load', function(){ setTimeout(function(){ try{window.focus();window.print();}catch(e){} }, 300); });<\/script>
            </body></html>`;
            w.document.open();
            w.document.write(html);
            w.document.close();
            // Marca come stampato (admin pu\u00f2 ristampare ma aggiorniamo timestamp)
            markTaskPrinted(taskId);
        });
    }

    function isInternalOrderTask(task) {
        if (!task || !task.title) return false;
        return /ordine interno/i.test(task.title);
    }

    /**
     * Restituisce l'HTML dei bottoni di stampa per un task "Ordine interno".
     * - Admin: 🧾 Termica + 🖨️ Completa (sempre)
     * - Operatori: solo 🧾 Termica, disabilitato se gi\u00e0 stampato
     * Da chiamare nei renderer task: ${window.taskOrdineInternoButtons(task)}
     */
    function taskOrdineInternoButtons(task) {
        if (!isInternalOrderTask(task)) return '';
        const admin = isAdminUser();
        const printed = task.internalOrderPrintedAt;
        if (admin) {
            const note = printed
                ? `<span style="font-size:11px;color:#9ca3af;margin-left:4px;" title="Gi\u00e0 stampato il ${new Date(printed).toLocaleString('it-IT')}">\u2713 stampato</span>`
                : '';
            return `
                <button class="btn btn-secondary btn-small" onclick="printInternalOrderThermal(${task.id})" style="background:#475569;" title="Stampa scontrino su termica 72mm">\ud83e\uddfe Termica</button>
                <button class="btn btn-secondary btn-small" onclick="printInternalOrderFull(${task.id})" style="background:#8b5cf6;" title="Stampa documento completo A4">\ud83d\udda8\ufe0f Completa</button>
                ${note}
            `;
        }
        // Operatore
        if (printed) {
            return `<button class="btn btn-secondary btn-small" disabled style="background:#374151;color:#9ca3af;cursor:not-allowed;" title="Gi\u00e0 stampato il ${new Date(printed).toLocaleString('it-IT')}">\ud83e\uddfe Stampato</button>`;
        }
        return `<button class="btn btn-secondary btn-small" onclick="printInternalOrderThermal(${task.id})" style="background:#475569;" title="Stampa scontrino (una sola volta)">\ud83e\uddfe Termica</button>`;
    }

    /**
     * Normalizza il titolo "Ordine interno": forza unità "colli" e aggiunge il
     * peso totale calcolato (es. da nome "FARINA 0 da 5kg" → 5 kg/collo).
     * Da chiamare nei renderer: ${formatInternalOrderTitle(task.title)}
     */
    function formatInternalOrderTitle(title) {
        if (!title || typeof title !== 'string') return title || '';
        const m = title.match(/^(.*?Ordine interno:\s*)(.+?)\s*[×x]\s*(\d+)\s*(kg|colli)?\s*$/i);
        if (!m) return title;
        const prefix = m[1];
        const name = m[2].trim();
        const qty = parseInt(m[3], 10);
        if (!qty) return title;
        // Peso/collo dal nome ("da Xkg" / "da X kg")
        let w = 0;
        const wm = name.match(/da\s*(\d+(?:[\.,]\d+)?)\s*kg/i);
        if (wm) w = parseFloat(wm[1].replace(',', '.')) || 0;
        const totalKg = w > 0 ? Math.round(qty * w * 100) / 100 : 0;
        const totalPart = totalKg > 0 ? ` (${totalKg} kg)` : '';
        return `${prefix}${name} × ${qty} colli${totalPart}`;
    }

    window.printInternalOrderThermal = printInternalOrderThermal;
    window.printInternalOrderFull = printInternalOrderFull;
    window.isInternalOrderTask = isInternalOrderTask;
    window.taskOrdineInternoButtons = taskOrdineInternoButtons;
    window.formatInternalOrderTitle = formatInternalOrderTitle;

    // ============================================================
    // COMPLETA ORDINE INTERNO — modal con quantità/lotto/scadenza/posizione
    // ============================================================
    const COMPLETE_MODAL_ID = '__completeInternalOrderModal';
    let _completeOnSuccess = null;
    let _completeTaskId = null;

    function ensureCompleteModal() {
        let m = document.getElementById(COMPLETE_MODAL_ID);
        if (m) return m;
        m = document.createElement('div');
        m.id = COMPLETE_MODAL_ID;
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:none;align-items:center;justify-content:center;padding:16px;';
        m.innerHTML = `
            <div style="background:#1f2937;color:#e5e7eb;border-radius:10px;max-width:520px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.5);max-height:92vh;overflow:auto;">
                <h2 style="margin:0 0 4px;font-size:18px;color:#10b981;">✅ Completa Ordine Interno</h2>
                <div id="__cioSub" style="font-size:13px;color:#9ca3af;margin-bottom:14px;">Registra il carico merce sullo scaffale</div>

                <label style="display:block;font-size:12px;color:#9ca3af;margin-top:8px;">📦 Quantità preparata (colli) *</label>
                <input id="__cioQty" type="number" min="1" step="1" inputmode="numeric"
                    style="width:100%;padding:10px;background:#111827;color:#fff;border:1px solid #374151;border-radius:6px;font-size:16px;" />

                <label style="display:block;font-size:12px;color:#9ca3af;margin-top:10px;">📍 Posizione scaffale *</label>
                <input id="__cioPos" type="text" list="__cioPosList" placeholder="es. A1-2"
                    style="width:100%;padding:10px;background:#111827;color:#fff;border:1px solid #374151;border-radius:6px;font-size:16px;text-transform:uppercase;" />
                <datalist id="__cioPosList"></datalist>

                <div style="display:flex;gap:10px;margin-top:10px;">
                    <div style="flex:1;">
                        <label style="display:block;font-size:12px;color:#9ca3af;">🏷️ Lotto</label>
                        <input id="__cioBatch" type="text"
                            style="width:100%;padding:10px;background:#111827;color:#fff;border:1px solid #374151;border-radius:6px;" />
                    </div>
                    <div style="flex:1;">
                        <label style="display:block;font-size:12px;color:#9ca3af;">📅 Scadenza</label>
                        <input id="__cioExp" type="text" placeholder="GG/MM/AAAA"
                            style="width:100%;padding:10px;background:#111827;color:#fff;border:1px solid #374151;border-radius:6px;" />
                    </div>
                </div>

                <label style="display:block;font-size:12px;color:#9ca3af;margin-top:10px;">📝 Note (opzionale)</label>
                <textarea id="__cioNotes" rows="2"
                    style="width:100%;padding:10px;background:#111827;color:#fff;border:1px solid #374151;border-radius:6px;resize:vertical;"></textarea>

                <div id="__cioErr" style="display:none;background:#7f1d1d;color:#fecaca;padding:8px 12px;border-radius:6px;margin-top:10px;font-size:13px;"></div>

                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
                    <button id="__cioCancel" type="button"
                        style="padding:10px 18px;background:#374151;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Annulla</button>
                    <button id="__cioSubmit" type="button"
                        style="padding:10px 18px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">✓ Completa &amp; Carica</button>
                </div>
            </div>
        `;
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m) closeCompleteModal(); });
        m.querySelector('#__cioCancel').addEventListener('click', closeCompleteModal);
        m.querySelector('#__cioSubmit').addEventListener('click', submitCompleteInternalOrder);
        return m;
    }

    async function loadShelfPositionsList() {
        try {
            const tk = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
            const apiBase = window.API_URL || '/api';
            const r = await fetch(`${apiBase}/inventory/shelf-positions`, {
                headers: { 'Authorization': `Bearer ${tk}` }
            });
            if (!r.ok) return;
            const j = await r.json();
            const positions = Array.isArray(j) ? j : (j.data || j.positions || []);
            const dl = document.getElementById('__cioPosList');
            if (!dl) return;
            dl.innerHTML = positions
                .map(p => `<option value="${escapeHtml(p.code || p)}"></option>`)
                .join('');
        } catch (_) { /* ignore */ }
    }

    function closeCompleteModal() {
        const m = document.getElementById(COMPLETE_MODAL_ID);
        if (m) m.style.display = 'none';
        _completeOnSuccess = null;
        _completeTaskId = null;
    }

    function openCompleteInternalOrderModal(task, onSuccess) {
        const m = ensureCompleteModal();
        _completeOnSuccess = typeof onSuccess === 'function' ? onSuccess : null;
        _completeTaskId = task.id;

        // Pre-popola quantità dal titolo: "× N colli"
        const titleMatch = (task.title || '').match(/[×x]\s*(\d+)\s*colli/i);
        const suggestedQty = titleMatch ? titleMatch[1] : '';
        const desc = task.description || '';
        const codeMatch = desc.match(/Codice:\s*(\S+)/i);
        const nameMatch = desc.match(/Articolo:\s*(.+)/i);

        document.getElementById('__cioSub').innerHTML =
            `${nameMatch ? escapeHtml(nameMatch[1].trim()) : ''}` +
            (codeMatch ? ` <span style="color:#60a5fa;">[${escapeHtml(codeMatch[1])}]</span>` : '');
        document.getElementById('__cioQty').value = suggestedQty;
        document.getElementById('__cioPos').value = '';
        document.getElementById('__cioBatch').value = '';
        document.getElementById('__cioExp').value = '';
        document.getElementById('__cioNotes').value = '';
        document.getElementById('__cioErr').style.display = 'none';

        m.style.display = 'flex';
        loadShelfPositionsList();
        setTimeout(() => { try { document.getElementById('__cioQty').focus(); } catch(_){} }, 50);
    }

    async function submitCompleteInternalOrder() {
        const err = document.getElementById('__cioErr');
        err.style.display = 'none';
        const qty = parseInt(document.getElementById('__cioQty').value, 10);
        const pos = (document.getElementById('__cioPos').value || '').trim().toUpperCase();
        const batch = (document.getElementById('__cioBatch').value || '').trim();
        const expiry = (document.getElementById('__cioExp').value || '').trim();
        const notes = (document.getElementById('__cioNotes').value || '').trim();
        if (!qty || qty <= 0) { err.textContent = 'Quantità non valida'; err.style.display = 'block'; return; }
        if (!pos) { err.textContent = 'Posizione scaffale obbligatoria'; err.style.display = 'block'; return; }

        const btn = document.getElementById('__cioSubmit');
        btn.disabled = true;
        const oldLabel = btn.textContent;
        btn.textContent = '⏳ Caricamento…';
        try {
            const tk = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
            const apiBase = window.API_URL || '/api';
            const r = await fetch(`${apiBase}/tasks/${_completeTaskId}/complete-internal-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tk}` },
                body: JSON.stringify({
                    quantity: qty,
                    positionCode: pos,
                    batch: batch || undefined,
                    expiry: expiry || undefined,
                    notes: notes || undefined
                })
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || j.message || `HTTP ${r.status}`);
            const cb = _completeOnSuccess;
            closeCompleteModal();
            try { (typeof window.showAlert === 'function')
                ? window.showAlert(`✅ Caricati ${qty} colli in ${pos}`, 'success')
                : alert(`✅ Caricati ${qty} colli in ${pos}`); } catch(_){}
            if (cb) try { cb(j); } catch(_){}
        } catch (e) {
            err.textContent = '❌ ' + (e.message || e);
            err.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = oldLabel;
        }
    }

    window.openCompleteInternalOrderModal = openCompleteInternalOrderModal;

    // ============================================================
    // INTERCETTORE: dirotta i Completa task standard sul modal carico merce
    // se il task è un "Ordine interno". Si ri-installa periodicamente perché
    // alcune pagine definiscono completeTask / handleTaskStatusChange dopo.
    // ============================================================
    function installCompleteInterceptor() {
        try {
            const orig1 = window.completeTask;
            if (typeof orig1 === 'function' && !orig1.__cioWrapped) {
                const wrapped = async function (taskId) {
                    try {
                        const t = await fetchTask(taskId);
                        if (t && isInternalOrderTask(t) && !t.completed) {
                            openCompleteInternalOrderModal(t, () => {
                                // Ricarica l'intera pagina per riflettere lo stato aggiornato
                                setTimeout(() => { try { window.location.reload(); } catch(_) {} }, 400);
                            });
                            return;
                        }
                    } catch (_) {}
                    return orig1.apply(this, arguments);
                };
                wrapped.__cioWrapped = true;
                window.completeTask = wrapped;
            }
            const orig2 = window.handleTaskStatusChange;
            if (typeof orig2 === 'function' && !orig2.__cioWrapped) {
                const wrapped = async function (taskId, action) {
                    if (action === 'complete') {
                        try {
                            const t = await fetchTask(taskId);
                            if (t && isInternalOrderTask(t) && !t.completed) {
                                openCompleteInternalOrderModal(t, () => {
                                    // Ricarica l'intera pagina per riflettere lo stato aggiornato
                                    setTimeout(() => { try { window.location.reload(); } catch(_) {} }, 400);
                                });
                                return;
                            }
                        } catch (_) {}
                    }
                    return orig2.apply(this, arguments);
                };
                wrapped.__cioWrapped = true;
                window.handleTaskStatusChange = wrapped;
            }
        } catch (_) { /* ignore */ }
    }

    if (typeof window !== 'undefined') {
        setTimeout(installCompleteInterceptor, 200);
        setInterval(installCompleteInterceptor, 1500);
    }
})();

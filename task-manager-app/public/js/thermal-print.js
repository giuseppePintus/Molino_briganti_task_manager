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
    const LINE_WIDTH = 32;

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

    async function sendOrderAudit(orderId, action, details) {
        try {
            const apiBase = window.API_URL || '/api';
            const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
            if (!token) return;

            await fetch(`${apiBase}/orders/${orderId}/audit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token,
                },
                body: JSON.stringify({ action, details: details || {} }),
            });
        } catch (error) {
            console.warn('⚠️ [ORDER_AUDIT] audit termica fallito:', error);
        }
    }
    function parseProducts(raw) {
        if (!raw) return [];
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { return []; }
        }
        return Array.isArray(raw) ? raw : [];
    }

    // CSS per stampante termica 72mm (Xprinter XP-N160II)
    // PRINCIPI: full-width, margini laterali = 0, niente backgrounds pieni,
    // bordi sottili (max 0.6mm), wrap automatico testi lunghi.
    const THERMAL_CSS = `
        @page { size: 72mm auto; margin: 0; }
        * { box-sizing: border-box; }
        html, body {
            margin: 0; padding: 0;
            width: 70mm;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.25;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        /* === HEADER === */
        .rcpt-logo {
            display: block;
            max-width: 42mm;
            max-height: 17.5mm;
            width: auto;
            height: auto;
            margin: 1.5mm auto 0.5mm auto;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        }
        .rcpt-business {
            font-size: 11pt;
            font-weight: 800;
            text-align: center;
            padding: 0 1mm 1mm 1mm;
            margin: 0;
            line-height: 1.15;
            letter-spacing: 0.5px;
        }
        .rcpt-title {
            font-size: 24pt;
            font-weight: 900;
            text-align: center;
            letter-spacing: 3px;
            padding: 1.5mm 0 1mm 0;
            margin: 0;
            border-top: 0.6mm solid #000;
            border-bottom: 0.6mm solid #000;
        }
        .rcpt-sub {
            font-size: 14pt;
            font-weight: 800;
            text-align: center;
            padding: 1.5mm 1mm;
            margin: 0;
            line-height: 1.15;
            border-bottom: 0.3mm solid #000;
            overflow-wrap: anywhere;
        }
        .rcpt-info {
            font-size: 10pt;
            padding: 1.5mm 1mm;
            margin: 0;
            border-bottom: 0.6mm solid #000;
        }
        .rcpt-info-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            line-height: 1.4;
            gap: 2mm;
        }
        .rcpt-info-row .lbl {
            font-weight: 800;
            letter-spacing: 0.5px;
            white-space: nowrap;
            text-transform: uppercase;
            font-size: 9pt;
        }
        .rcpt-info-row .val {
            font-weight: 700;
            text-align: right;
            overflow-wrap: anywhere;
            flex: 1;
        }

        /* === SEZIONE (es. CONSEGNE / PRODOTTI) === */
        .rcpt-section {
            font-size: 11pt;
            font-weight: 900;
            text-align: center;
            letter-spacing: 2px;
            padding: 1mm 1mm;
            margin: 0;
            border-bottom: 0.3mm solid #000;
            text-transform: uppercase;
        }

        /* === DELIVERY (singola consegna in viaggio) === */
        .rcpt-delivery {
            padding: 1.5mm 1mm 1.5mm 1mm;
            border-bottom: 0.6mm solid #000;
        }
        .rcpt-delivery:last-child { border-bottom: 0.6mm solid #000; }
        .rcpt-delivery-head {
            display: flex;
            align-items: baseline;
            gap: 2mm;
            margin-bottom: 1mm;
        }
        .rcpt-num {
            font-size: 14pt;
            font-weight: 900;
            border: 0.4mm solid #000;
            padding: 0 1.2mm;
            line-height: 1.1;
            min-width: 7mm;
            text-align: center;
        }
        .rcpt-cli {
            font-size: 12pt;
            font-weight: 800;
            flex: 1;
            overflow-wrap: anywhere;
            line-height: 1.15;
        }
        .rcpt-time {
            font-size: 10pt;
            font-weight: 700;
            white-space: nowrap;
        }

        /* === PRODOTTO === */
        .rcpt-prod {
            padding: 1mm 1mm;
            border-top: 0.3mm dashed #000;
        }
        .rcpt-prod:first-child { border-top: none; }
        /* riga 1: solo nome prodotto */
        .rcpt-prod-name {
            display: block;
            font-size: 13pt;
            font-weight: 900;
            line-height: 1.2;
            overflow-wrap: anywhere;
            margin-bottom: 0.5mm;
        }
        /* riga 2: scaffale + colli + peso */
        .rcpt-prod-row2 {
            display: flex;
            align-items: center;
            gap: 1.5mm;
            margin-bottom: 0.8mm;
        }
        .rcpt-prod-shelf {
            font-size: 14pt;
            font-weight: 900;
            letter-spacing: 1px;
            white-space: nowrap;
            background: #000;
            color: #fff;
            padding: 0.5mm 2mm;
            border-radius: 0.5mm;
            line-height: 1.35;
        }
        .rcpt-prod-colli {
            font-size: 14pt;
            font-weight: 900;
            white-space: nowrap;
            border: 0.5mm solid #000;
            padding: 0.5mm 1.5mm;
            border-radius: 0.5mm;
            line-height: 1.35;
        }
        .rcpt-prod-kg {
            margin-left: auto;
            font-size: 11pt;
            font-weight: 800;
            white-space: nowrap;
        }
        /* riga 3: lotto + scadenza */
        .rcpt-prod-row3 {
            display: flex;
            gap: 1.5mm;
            flex-wrap: wrap;
            align-items: center;
            font-size: 10pt;
            font-weight: 700;
        }
        .rcpt-prod-row3 .r3-item {
            white-space: nowrap;
            border: 0.3mm solid #000;
            padding: 0 1mm;
            border-radius: 0.5mm;
        }

        /* === NOTE === */
        .rcpt-notes {
            padding: 1mm 1mm;
            border-top: 0.3mm dashed #000;
            font-size: 10pt;
            font-weight: 700;
            overflow-wrap: anywhere;
            line-height: 1.3;
        }
        .rcpt-notes .lbl {
            font-weight: 900;
            letter-spacing: 1px;
            font-size: 9pt;
            text-transform: uppercase;
            display: block;
            margin-bottom: 0.5mm;
        }

        /* === TOTALI === */
        .rcpt-totals-list {
            padding: 0;
            margin: 0;
        }
        .rcpt-total-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 0.8mm 1mm;
            border-top: 0.3mm dashed #000;
            font-size: 10pt;
            font-weight: 700;
            gap: 2mm;
        }
        .rcpt-total-row .name {
            flex: 1;
            overflow-wrap: anywhere;
            line-height: 1.2;
        }
        .rcpt-total-row .qty {
            white-space: nowrap;
            font-weight: 800;
        }
        .rcpt-total {
            margin: 0;
            padding: 2mm 1mm;
            border-top: 0.6mm solid #000;
            border-bottom: 0.6mm solid #000;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 2mm;
        }
        .rcpt-total .lbl {
            font-size: 16pt;
            font-weight: 900;
            letter-spacing: 2px;
        }
        .rcpt-total .val {
            font-size: 14pt;
            font-weight: 900;
            text-align: right;
        }

        /* === FOOTER === */
        .rcpt-footer {
            font-size: 8pt;
            text-align: center;
            padding: 1.5mm 1mm 8mm 1mm;
            margin: 0;
        }

        /* === TOOLBAR (solo schermo) === */
        .toolbar { padding: 8px; text-align: center; }
        .toolbar button {
            padding: 8px 14px; font-size: 13px; margin: 2px;
            border: none; border-radius: 4px; cursor: pointer; color: #fff;
        }
        .toolbar .btn-print { background: #111; }
        .toolbar .btn-close { background: #888; }
        @media print { .no-print { display: none !important; } }
    `;

    function openReceipt(title, contentHtml) {
        const w = window.open('', '_blank', 'width=380,height=720');
        if (!w) {
            alert('Impossibile aprire la finestra di stampa. Disabilita il blocco popup.');
            return;
        }
        const html = `<!doctype html><html><head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>${THERMAL_CSS}</style>
        </head><body>
            ${contentHtml}
            <div class="toolbar no-print">
                <button class="btn-print" onclick="window.print()">Stampa</button>
                <button class="btn-close" onclick="window.close()">Chiudi</button>
            </div>
            <script>
                function convertImgTo1Bit(img, threshold) {
                    return new Promise(function (resolve) {
                        try {
                            var sw = img.naturalWidth || img.width;
                            var sh = img.naturalHeight || img.height;
                            if (!sw || !sh) return resolve();
                            // Target ~304 px di larghezza (riferimento Xprinter)
                            var targetW = 304;
                            var scale = targetW / sw;
                            if (scale > 4) scale = 4;
                            if (scale < 1) scale = 1;
                            var w = Math.round(sw * scale);
                            var h = Math.round(sh * scale);
                            var canvas = document.createElement('canvas');
                            canvas.width = w; canvas.height = h;
                            var ctx = canvas.getContext('2d');
                            ctx.fillStyle = '#fff';
                            ctx.fillRect(0, 0, w, h);
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.drawImage(img, 0, 0, w, h);
                            var imageData;
                            try { imageData = ctx.getImageData(0, 0, w, h); }
                            catch (e) { return resolve(); }
                            var d = imageData.data;
                            var thr = threshold || 150;
                            for (var i = 0; i < d.length; i += 4) {
                                var a = d[i + 3] / 255;
                                var r = d[i] * a + 255 * (1 - a);
                                var g = d[i + 1] * a + 255 * (1 - a);
                                var b = d[i + 2] * a + 255 * (1 - a);
                                var gray = 0.299 * r + 0.587 * g + 0.114 * b;
                                var v = gray < thr ? 0 : 255;
                                d[i] = d[i + 1] = d[i + 2] = v;
                                d[i + 3] = 255;
                            }
                            ctx.putImageData(imageData, 0, 0);
                            img.onload = function () { resolve(); };
                            img.onerror = function () { resolve(); };
                            img.src = canvas.toDataURL('image/png');
                        } catch (e) { resolve(); }
                    });
                }
                window.addEventListener('load', function () {
                    var printed = false;
                    function doPrint() {
                        if (printed) return; printed = true;
                        try { window.focus(); window.print(); } catch (e) {}
                    }
                    var imgs = Array.prototype.slice.call(document.images || []);
                    if (!imgs.length) { setTimeout(doPrint, 250); return; }
                    Promise.all(imgs.map(function (img) {
                        return new Promise(function (res) {
                            if (img.complete && img.naturalWidth) return res();
                            img.addEventListener('load', function () { res(); });
                            img.addEventListener('error', function () { res(); });
                        });
                    })).then(function () {
                        return Promise.all(imgs.map(function (img) {
                            if (!img.classList.contains('rcpt-logo')) return null;
                            // Logo termico dedicato gia' pre-elaborato dall'utente:
                            // niente conversione, stampa l'immagine cosi' com'e'
                            if (img.getAttribute('data-thermal') === '1') return null;
                            return convertImgTo1Bit(img, 150);
                        }));
                    }).then(function () {
                        setTimeout(doPrint, 200);
                    });
                    setTimeout(doPrint, 4000);
                });
            <\/script>
        </body></html>`;
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    // Format a product line: name truncated, then "C kg KG"
    function productLines(prods) {
        const lines = [];
        prods.forEach(p => {
            const name = String(p.product || '').trim();
            const qtyKg = Number(p.quantity) || 0;
            const wpc = (typeof window.extractWeightPerCollo === 'function')
                ? window.extractWeightPerCollo(name)
                : 1;
            const colli = wpc > 0 ? Math.round(qtyKg / wpc) : 0;
            // Wrap product name to multiple lines if longer than width
            const namePart = name.length > LINE_WIDTH ? wrap(name, LINE_WIDTH) : [name];
            namePart.forEach(l => lines.push(l));
            const right = `${colli} colli  ${qtyKg.toFixed(1)} kg`;
            lines.push(' '.repeat(Math.max(0, LINE_WIDTH - right.length)) + right);
            const batch = p.batch || (p.batchData && p.batchData.batch) || '';
            const pos = p.shelfPosition || (p.batchData && p.batchData.shelfPosition) || '';
            const exp = p.expiry || (p.batchData && p.batchData.expiry) || '';
            const meta = [];
            if (batch) meta.push('L:' + batch);
            if (pos) meta.push('P:' + pos);
            if (exp) meta.push('S:' + exp);
            if (meta.length) lines.push(meta.join(' '));
            lines.push('');
        });
        if (lines.length && lines[lines.length - 1] === '') lines.pop();
        return lines;
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
    // HELPERS HTML (grafica strutturata)
    // ============================================================
    function getCompanySettings() {
        try {
            const raw = localStorage.getItem('companySettings');
            if (raw) return JSON.parse(raw) || {};
        } catch (_) {}
        return {};
    }

    function brandHeaderHtml() {
        const s = getCompanySettings();
        const businessName = s.businessName || '';
        // Priorità: logo termico dedicato (già ottimizzato dall'utente)
        // -> logo aziendale (verrà convertito 1-bit a runtime)
        // -> default insegna
        const thermalLogoUrl = (s.logoThermalUrl || '').trim();
        const isThermalDedicated = thermalLogoUrl.length > 0;
        const logoUrl = isThermalDedicated ? thermalLogoUrl : (s.logoUrl || 'images/logo INSEGNA.png');
        // Path assoluto per la finestra di stampa (origin del documento padre)
        let absLogo = logoUrl;
        if (!/^(https?:|data:|\/\/)/i.test(absLogo)) {
            absLogo = (absLogo.startsWith('/') ? '' : '/') + absLogo;
            absLogo = window.location.origin + absLogo;
        }
        let html = '';
        // Cache-busting leggero per logo aggiornato
        // NON aggiungere query string ai data URL (data:image/... non supporta ?param)
        let cacheSuffix = '';
        if (!/^data:/i.test(absLogo)) {
            const sep = absLogo.includes('?') ? '&' : '?';
            cacheSuffix = sep + 't=' + Date.now();
        }
        // data-thermal="1" -> salta conversione 1-bit lato finestra di stampa
        const thermalAttr = isThermalDedicated ? ' data-thermal="1"' : '';
        html += '<img class="rcpt-logo"' + thermalAttr + ' src="' + escapeHtml(absLogo + cacheSuffix) + '" alt="" onerror="this.style.display=\'none\'">';
        // businessName non mostrato: solo logo
        return html;
    }

    function infoBoxHtml(rows) {
        // rows: [['Data','01/05/2026'], ...]
        const inner = rows
            .filter(r => r && r[1] != null && r[1] !== '')
            .map(r => '<div class="rcpt-info-row"><span class="lbl">' +
                escapeHtml(r[0]) + '</span><span class="val">' +
                escapeHtml(r[1]) + '</span></div>')
            .join('');
        return '<div class="rcpt-info">' + inner + '</div>';
    }

    function productHtml(p) {
        const name = String(p.product || '').trim() || '-';
        const qtyKg = Number(p.quantity) || 0;
        const wpc = (typeof window.extractWeightPerCollo === 'function')
            ? window.extractWeightPerCollo(name) : 1;
        const colli = wpc > 0 ? Math.round(qtyKg / wpc) : 0;
        const batch = p.batch || (p.batchData && p.batchData.batch) || '';
        const pos = p.shelfPosition || (p.batchData && p.batchData.shelfPosition) || '';
        const exp = p.expiry || (p.batchData && p.batchData.expiry) || '';
        // Riga 1: solo nome prodotto (evidenziato)
        const row1 = '<span class="rcpt-prod-name">' + escapeHtml(name) + '</span>';
        // Riga 2: scaffale | colli | peso
        const row2 = '<div class="rcpt-prod-row2">' +
            (pos ? '<span class="rcpt-prod-shelf">' + escapeHtml(pos) + '</span>' : '') +
            '<span class="rcpt-prod-colli">' + colli + '\u00A0Colli</span>' +
            '<span class="rcpt-prod-kg">' + qtyKg.toFixed(1) + '\u00A0kg</span>' +
        '</div>';
        // Riga 3: L. lotto | Sc. scadenza
        const r3items = [];
        if (batch) r3items.push('<span class="r3-item">L.\u00A0' + escapeHtml(batch) + '</span>');
        if (exp)   r3items.push('<span class="r3-item">Sc.\u00A0' + escapeHtml(exp) + '</span>');
        const row3 = r3items.length ? '<div class="rcpt-prod-row3">' + r3items.join('') + '</div>' : '';
        return '<div class="rcpt-prod">' + row1 + row2 + row3 + '</div>';
    }

    function totalsListHtml(totalsObj) {
        // totalsObj: { 'Prodotto X': qtyKg, ... }
        let html = '<div class="rcpt-totals-list">';
        Object.entries(totalsObj).forEach(([prod, qty]) => {
            const wpc = (typeof window.extractWeightPerCollo === 'function')
                ? window.extractWeightPerCollo(prod) : 1;
            const c = wpc > 0 ? Math.round(qty / wpc) : 0;
            html += '<div class="rcpt-total-row">' +
                '<span class="name">' + escapeHtml(prod) + '</span>' +
                '<span class="qty">' + c + ' c &nbsp; ' + qty.toFixed(1) + ' kg</span>' +
            '</div>';
        });
        html += '</div>';
        return html;
    }

    function totalBoxHtml(totalColli, totalKg) {
        return '<div class="rcpt-total">' +
            '<span class="lbl">TOTALE</span>' +
            '<span class="val">' + totalColli + ' colli<br>' + totalKg.toFixed(1) + ' kg</span>' +
        '</div>';
    }

    function footerHtml() {
        return '<div class="rcpt-footer">Stampato ' +
            escapeHtml(new Date().toLocaleString('it-IT')) + '</div>';
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
            ? window.calculateTripTotals(tripId)
            : {};

        const operatorName = getOperatorName(trip.assignedOperatorId, trip.assignedOperator);
        const dt = new Date(trip.dateTime || trip.date || Date.now());

        let html = '';
        html += brandHeaderHtml();
        html += '<div class="rcpt-title">VIAGGIO</div>';
        if (trip.name) html += '<div class="rcpt-sub">' + escapeHtml(trip.name) + '</div>';
        html += infoBoxHtml([
            ['Data', fmtDate(dt)],
            ['Ora', fmtTime(dt)],
            ['Operatore', operatorName],
            ['Mezzo', trip.vehicleName || trip.vehicle || '']
        ]);

        // Sezione consegne
        html += '<div class="rcpt-section">CONSEGNE (' + tripOrders.length + ')</div>';
        tripOrders.forEach((o, idx) => {
            const cliente = (typeof window.getClientName === 'function')
                ? window.getClientName(o)
                : (o.client || o.clientName || '');
            const time = fmtTime(o.dateTime);
            html += '<div class="rcpt-delivery">';
            html += '<div class="rcpt-delivery-head">' +
                '<span class="rcpt-num">' + (idx + 1) + '</span>' +
                '<span class="rcpt-cli">' + escapeHtml(cliente || '-') + '</span>' +
                (time ? '<span class="rcpt-time">' + escapeHtml(time) + '</span>' : '') +
            '</div>';

            const prods = parseProducts(o.products);
            if (prods.length) {
                prods.forEach(p => { html += productHtml(p); });
            } else {
                const name = (typeof window.getOrderProductName === 'function')
                    ? window.getOrderProductName(o) : (o.product || '');
                const qty = (typeof window.getOrderTotalQuantity === 'function')
                    ? window.getOrderTotalQuantity(o) : (o.quantity || 0);
                html += productHtml({ product: name, quantity: qty });
            }

            if (o.notes) {
                html += '<div class="rcpt-notes"><span class="lbl">Note</span>' +
                    escapeHtml(o.notes) + '</div>';
            }
            html += '</div>';
        });

        // Totali per prodotto
        let totalKg = 0, totalColli = 0;
        Object.entries(totals).forEach(([prod, qty]) => {
            const wpc = (typeof window.extractWeightPerCollo === 'function')
                ? window.extractWeightPerCollo(prod) : 1;
            const c = wpc > 0 ? Math.round(qty / wpc) : 0;
            totalKg += qty;
            totalColli += c;
        });

        html += '<div class="rcpt-section">TOTALI PRODOTTI</div>';
        html += totalsListHtml(totals);
        html += totalBoxHtml(totalColli, totalKg);
        html += footerHtml();

        openReceipt('Viaggio ' + (trip.name || tripId), html);
    }

    // ============================================================
    // PICKUP ORDER THERMAL RECEIPT
    // ============================================================
    function printPickupOrderThermal(orderId) {
        const order = findById(getOrders(), orderId);
        if (!order) { alert('Ordine non trovato'); return; }

        sendOrderAudit(orderId, 'print-thermal', {
            clientName: (typeof window.getClientName === 'function') ? window.getClientName(order) : (order.client || order.clientName || ''),
            customerId: order.customerId ?? null,
            tripId: order.tripId ?? null,
            status: order.status || null,
            products: order.products || [],
        });

        const cliente = (typeof window.getClientName === 'function')
            ? window.getClientName(order)
            : (order.client || order.clientName || '');
        const dt = order.dateTime ? new Date(order.dateTime) : new Date();
        const operatorName = getOperatorName(order.assignedOperatorId, order.assignedOperator);

        let html = '';
        html += brandHeaderHtml();
        html += '<div class="rcpt-title">RITIRO</div>';
        html += '<div class="rcpt-sub">' + escapeHtml(cliente || '-') + '</div>';
        html += infoBoxHtml([
            ['Data', fmtDate(dt)],
            ['Ora', fmtTime(dt)],
            ['Operatore', operatorName],
            ['Tipo', 'Ritiro Cliente']
        ]);

        html += '<div class="rcpt-section">PRODOTTI</div>';

        const prods = parseProducts(order.products);
        let totalKg = 0, totalColli = 0;
        if (prods.length) {
            prods.forEach(p => {
                const wpc = (typeof window.extractWeightPerCollo === 'function')
                    ? window.extractWeightPerCollo(p.product || '') : 1;
                const qtyKg = Number(p.quantity) || 0;
                const c = wpc > 0 ? Math.round(qtyKg / wpc) : 0;
                totalKg += qtyKg;
                totalColli += c;
                html += productHtml(p);
            });
        } else {
            const name = (typeof window.getOrderProductName === 'function')
                ? window.getOrderProductName(order) : (order.product || '');
            const qty = (typeof window.getOrderTotalQuantity === 'function')
                ? window.getOrderTotalQuantity(order) : (order.quantity || 0);
            const wpc = (typeof window.extractWeightPerCollo === 'function')
                ? window.extractWeightPerCollo(name) : 1;
            const c = wpc > 0 ? Math.round(qty / wpc) : 0;
            totalKg = qty; totalColli = c;
            html += productHtml({ product: name, quantity: qty });
        }

        if (order.notes) {
            html += '<div class="rcpt-notes"><span class="lbl">Note</span>' +
                escapeHtml(order.notes) + '</div>';
        }

        html += totalBoxHtml(totalColli, totalKg);
        html += footerHtml();

        openReceipt('Ritiro ' + (cliente || orderId), html);
    }

    window.printTripThermal = printTripThermal;
    window.printPickupOrderThermal = printPickupOrderThermal;

    // API generica per costruire scontrini da altre pagine (es. instant-orders)
    window.thermalPrintAPI = {
        openReceipt: openReceipt,
        brandHeaderHtml: brandHeaderHtml,
        infoBoxHtml: infoBoxHtml,
        productHtml: productHtml,
        totalBoxHtml: totalBoxHtml,
        footerHtml: footerHtml,
        escapeHtml: escapeHtml,
    };

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
        const opName = getOperatorName(o.assignedOperatorId);
        let html = '';
        html += brandHeaderHtml();
        html += '<div class="rcpt-title">ORDINE INT.</div>';
        html += '<div class="rcpt-sub">' + escapeHtml(o.name) + '</div>';
        const infoRows = [];
        if (o.code) infoRows.push(['Codice', o.code]);
        if (o.category) infoRows.push(['Categoria', o.category]);
        if (o.scheduledAt) infoRows.push(['Data', fmtDate(new Date(o.scheduledAt)) + ' ' + fmtTime(new Date(o.scheduledAt))]);
        infoRows.push(['Operatore', opName]);
        if (o.priority) infoRows.push(['Priorità', o.priority]);
        html += infoBoxHtml(infoRows);
        html += '<div class="rcpt-section">QUANTITÀ DA RIORDINARE</div>';
        html += '<div class="rcpt-total">';
        html += '<span class="lbl">' + o.qty + ' colli</span>';
        if (o.totalKg > 0) {
            html += '<span class="val">' + o.qty + '&nbsp;×&nbsp;' + o.weightPerCollo + '&nbsp;kg<br><strong>' + o.totalKg + '&nbsp;kg</strong></span>';
        }
        html += '</div>';
        if (o.notes) {
            html += '<div class="rcpt-notes"><span class="lbl">Note</span>' + escapeHtml(o.notes) + '</div>';
        }
        html += footerHtml();
        openReceipt('Ordine interno ' + o.id, html);
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
            const scheduledStr = o.scheduledAt
                ? new Date(o.scheduledAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : '';
            const html = `<!doctype html><html><head><meta charset="UTF-8">
                <title>Ordine interno #${task.id} - ${escapeHtml(o.name)}</title>
                <style>
                    @page { size: A4; margin: 18mm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    .header { border-bottom: 3px solid #f97316; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { margin: 0; color: #f97316; font-size: 24px; }
                    .header p { margin: 5px 0; color: #666; }
                    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                    .detail-box { padding: 10px; background: #f5f5f5; border-radius: 4px; }
                    .detail-label { font-weight: bold; color: #f97316; font-size: 12px; text-transform: uppercase; }
                    .detail-value { font-size: 16px; margin-top: 5px; }
                    .qty-box { margin: 20px 0; padding: 20px; background: #fff9f0; border: 2px solid #f97316; border-radius: 6px; text-align: center; }
                    .qty-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
                    .qty-value { font-size: 48px; font-weight: 900; color: #f97316; margin: 8px 0; }
                    .qty-kg { font-size: 18px; font-weight: 700; color: #555; }
                    .notes-section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #f97316; border-radius: 4px; }
                    .notes-section h2 { color: #f97316; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; }
                    .signature { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 12px; color: #666; }
                    .toolbar { padding: 12px; text-align: center; }
                    .toolbar button { padding: 10px 20px; font-size: 14px; margin: 2px; border: none; border-radius: 4px; cursor: pointer; color: #fff; }
                    .btn-print { background: #f97316; }
                    .btn-close { background: #999; }
                    @media print { .no-print { display: none !important; } body { margin: 0; } }
                </style>
            </head><body>
                <div class="header">
                    <h1>🛒 Ordine Interno #${task.id}</h1>
                    <p>Stampa Ordine Interno • ${new Date().toLocaleString('it-IT')}</p>
                </div>
                <div class="details">
                    <div class="detail-box">
                        <div class="detail-label">📦 ARTICOLO</div>
                        <div class="detail-value"><strong>${escapeHtml(o.name)}</strong></div>
                    </div>
                    ${o.code ? `<div class="detail-box"><div class="detail-label">🏷️ CODICE</div><div class="detail-value">${escapeHtml(o.code)}</div></div>` : ''}
                    ${o.category ? `<div class="detail-box"><div class="detail-label">📂 CATEGORIA</div><div class="detail-value">${escapeHtml(o.category)}</div></div>` : ''}
                    <div class="detail-box">
                        <div class="detail-label">👤 OPERATORE</div>
                        <div class="detail-value">${escapeHtml(opName)}</div>
                    </div>
                    ${o.priority ? `<div class="detail-box"><div class="detail-label">⚡ PRIORITÀ</div><div class="detail-value">${escapeHtml(o.priority)}</div></div>` : ''}
                    ${o.scheduledAt ? `<div class="detail-box"><div class="detail-label">📅 DATA PREVISTA</div><div class="detail-value">${scheduledStr}</div></div>` : ''}
                </div>
                <div class="qty-box">
                    <div class="qty-label">Quantità da riordinare</div>
                    <div class="qty-value">${o.qty} colli</div>
                    ${o.totalKg > 0 ? `<div class="qty-kg">${o.qty} × ${o.weightPerCollo} kg = <strong>${o.totalKg} kg</strong></div>` : ''}
                </div>
                ${o.notes ? `<div class="notes-section"><h2>📝 Note</h2><p>${escapeHtml(o.notes)}</p></div>` : ''}
                ${task.internalOrderPrintedAt ? `<p style="color:#888;font-size:12px;">⚠️ Già stampato il ${new Date(task.internalOrderPrintedAt).toLocaleString('it-IT')}</p>` : ''}
                <div class="signature">Firma operatore: ____________________________</div>
                <div class="no-print toolbar">
                    <p style="color:#999;font-size:12px;margin-bottom:8px;">Generato il ${new Date().toLocaleString('it-IT')}</p>
                    <button class="btn-print" onclick="window.print()">🖨️ Stampa A4</button>
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
                <button class="btn btn-secondary btn-small" onclick="printInternalOrderThermal(${task.id})" style="background:#475569;" title="Stampa scontrino su termica 80mm">\ud83e\uddfe Stampa 80mm</button>
                <button class="btn btn-secondary btn-small" onclick="printInternalOrderFull(${task.id})" style="background:#8b5cf6;" title="Stampa documento completo A4">\ud83d\udda8\ufe0f Stampa A4</button>
                ${note}
            `;
        }
        // Operatore
        if (printed) {
            return `<button class="btn btn-secondary btn-small" disabled style="background:#374151;color:#9ca3af;cursor:not-allowed;" title="Gi\u00e0 stampato il ${new Date(printed).toLocaleString('it-IT')}">\ud83e\uddfe Stampato</button>`;
        }
        return `<button class="btn btn-secondary btn-small" onclick="printInternalOrderThermal(${task.id})" style="background:#475569;" title="Stampa scontrino (una sola volta)">\ud83e\uddfe Stampa 80mm</button>`;
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

    // ============================================================
    // GENERIC TASK — STAMPA TERMICA 80mm
    // Per task "ritiro -": usa il formato identico a printPickupOrderThermal.
    // Per altri task: formato generico compito.
    // ============================================================
    async function printTaskThermal(taskId) {
        const task = await fetchTask(taskId);
        if (!task) { alert('Task non trovato'); return; }
        const isAdmin = isAdminUser();
        const already = task.internalOrderPrintedAt;
        if (already) {
            const when = new Date(already).toLocaleString('it-IT');
            if (isAdmin) {
                const ok = confirm('\u26a0\ufe0f Questo compito \u00e8 gi\u00e0 stato stampato il '
                    + when + '.\n\nVuoi ristamparlo comunque?');
                if (!ok) return;
            } else {
                alert('\u26a0\ufe0f Questo compito \u00e8 gi\u00e0 stato stampato il '
                    + when
                    + '.\nGli operatori possono stamparlo una sola volta.');
                return;
            }
        }

        const mark = await markTaskPrinted(taskId);
        if (!mark.ok && !isAdmin) {
            alert('Impossibile stampare: ' + (mark.body && mark.body.error || mark.status));
            return;
        }

        const titleRaw = String(task.title || '').trim();
        const isRitiro = titleRaw.toLowerCase().startsWith('ritiro -');

        if (isRitiro) {
            // === Formato identico a printPickupOrderThermal ===
            const cliente = titleRaw.slice('ritiro - '.length).toUpperCase();
            const desc = task.description || '';

            if (task.orderId) {
                sendOrderAudit(task.orderId, 'print-thermal-task', {
                    title: task.title || null,
                    scheduledAt: task.scheduledAt || null,
                    assignedOperatorId: task.assignedOperatorId || null,
                    description: task.description || null,
                });
            }

            // Estrae "Prodotti: F-00-25 (250 kg), ..." dalla descrizione
            const prodMatch = desc.match(/Prodotti:\s*([^\n]+)/i);
            const prodStr = prodMatch ? prodMatch[1].trim() : '';
            const notesMatch = desc.match(/Note:\s*([^\n]*)/i);
            const notes = notesMatch ? notesMatch[1].trim() : '';

            // Parsa ogni "CODE (QTY kg)" o "CODE (QTY)"
            const prodItems = [];
            const prodRegex = /([A-Z0-9\-\/]+)\s*\((\d+(?:[.,]\d+)?)\s*(?:kg)?\)/gi;
            let m;
            while ((m = prodRegex.exec(prodStr)) !== null) {
                prodItems.push({ product: m[1].toUpperCase(), quantity: parseFloat(m[2].replace(',', '.')) });
            }
            if (!prodItems.length && prodStr) {
                prodItems.push({ product: prodStr, quantity: 0 });
            }

            const dt = task.scheduledAt ? new Date(task.scheduledAt) : new Date();
            const opName = getOperatorName(
                task.assignedOperator ? task.assignedOperator.id : null,
                task.assignedOperator || null
            );

            let html = '';
            html += brandHeaderHtml();
            html += '<div class="rcpt-title">RITIRO</div>';
            html += '<div class="rcpt-sub">' + escapeHtml(cliente) + '</div>';
            html += infoBoxHtml([
                ['Data', fmtDate(dt)],
                ['Ora', fmtTime(dt)],
                ['Operatore', opName],
                ['Tipo', 'Ritiro Cliente']
            ]);
            html += '<div class="rcpt-section">PRODOTTI</div>';
            let totalKg = 0, totalColli = 0;
            prodItems.forEach(function (p) {
                const wpc = (typeof window.extractWeightPerCollo === 'function')
                    ? window.extractWeightPerCollo(p.product) : 1;
                const c = wpc > 0 ? Math.round(p.quantity / wpc) : 0;
                totalKg += p.quantity;
                totalColli += c;
                html += productHtml(p);
            });
            if (notes) {
                html += '<div class="rcpt-notes"><span class="lbl">Note</span>' + escapeHtml(notes) + '</div>';
            }
            html += totalBoxHtml(totalColli, totalKg);
            html += footerHtml();
            openReceipt('Ritiro ' + cliente, html);

        } else {
            // === Formato generico per altri task ===
            const opName = getOperatorName(
                task.assignedOperator ? task.assignedOperator.id : null,
                task.assignedOperator || null
            );
            const infoRows = [];
            if (task.scheduledAt) infoRows.push(['Data', fmtDate(new Date(task.scheduledAt)) + ' ' + fmtTime(new Date(task.scheduledAt))]);
            infoRows.push(['Operatore', opName]);
            if (task.priority) infoRows.push(['Priorit\u00e0', task.priority]);
            if (task.estimatedMinutes) infoRows.push(['Durata', task.estimatedMinutes + ' min']);

            let html = '';
            html += brandHeaderHtml();
            html += '<div class="rcpt-title">COMPITO</div>';
            html += '<div class="rcpt-sub">' + escapeHtml(titleRaw) + '</div>';
            html += infoBoxHtml(infoRows);
            if (task.description) {
                html += '<div class="rcpt-notes"><span class="lbl">Note</span>' + escapeHtml(task.description) + '</div>';
            }
            html += footerHtml();
            openReceipt('Compito ' + task.id, html);
        }
    }

    window.printInternalOrderThermal = printInternalOrderThermal;
    window.printInternalOrderFull = printInternalOrderFull;
    window.printTaskThermal = printTaskThermal;
    window.isInternalOrderTask = isInternalOrderTask;
    window.taskOrdineInternoButtons = taskOrdineInternoButtons;
    window.formatInternalOrderTitle = formatInternalOrderTitle;

    // ============================================================
    // COMPLETA ORDINE INTERNO — modal con quantità/lotto/scadenza/posizione
    // ============================================================
    const COMPLETE_MODAL_ID = '__completeInternalOrderModal';
    let _completeOnSuccess = null;
    let _completeTaskId = null;
    let _shelfPositions = [];
    let _shelfEntriesByPosition = {};

    function ensureFocusedFieldVisible(targetEl) {
        if (!targetEl) return;
        const modal = document.getElementById(COMPLETE_MODAL_ID);
        if (!modal || modal.style.display === 'none') return;

        try {
            if (targetEl.scrollIntoView) {
                try {
                    targetEl.scrollIntoView({ block: 'center', inline: 'nearest' });
                } catch (_) {
                    targetEl.scrollIntoView(true);
                }
            }
        } catch (_) { /* ignore */ }

        // Alcune WebView mostrano la tastiera con ritardo: riprova dopo breve delay.
        setTimeout(function() {
            try {
                if (targetEl && targetEl.scrollIntoView) {
                    try {
                        targetEl.scrollIntoView({ block: 'center', inline: 'nearest' });
                    } catch (_) {
                        targetEl.scrollIntoView(true);
                    }
                }
            } catch (_) { /* ignore */ }
        }, 260);
    }

    function ensureCompleteModal() {
        let m = document.getElementById(COMPLETE_MODAL_ID);
        if (m) return m;
        m = document.createElement('div');
        m.id = COMPLETE_MODAL_ID;
        // Fullscreen: evita sezioni nascoste su schermi piccoli (Jelly Bean compreso).
        m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.82);z-index:99999;display:none;padding:0;overflow:hidden;';
        m.innerHTML = `
            <div id="__cioBody" style="background:#111827;color:#e5e7eb;border-radius:0;width:100%;height:100%;padding:16px 14px 20px;box-sizing:border-box;overflow:auto;-webkit-overflow-scrolling:touch;">
                <h2 style="margin:0 0 6px;font-size:26px;line-height:1.2;color:#10b981;">✅ Completa Ordine Interno</h2>
                <div id="__cioSub" style="font-size:22px;line-height:1.25;color:#f3f4f6;font-weight:700;margin-bottom:6px;"></div>
                <div style="font-size:17px;line-height:1.3;color:#cbd5e1;margin-bottom:12px;">Inserisci i dati del carico merce da mettere in scaffale</div>

                <table style="width:100%;border-collapse:separate;border-spacing:8px 8px;table-layout:fixed;">
                    <tr>
                        <td style="width:33.33%;vertical-align:top;">
                            <label style="display:block;font-size:18px;color:#cbd5e1;font-weight:700;">📦 Colli *</label>
                            <input id="__cioQty" type="number" min="1" step="1" inputmode="numeric"
                                style="width:100%;height:60px;padding:10px 12px;background:#0b1220;color:#fff;border:2px solid #334155;border-radius:8px;font-size:28px;line-height:1.1;box-sizing:border-box;" />
                        </td>
                        <td style="vertical-align:top;">
                            <label style="display:block;font-size:18px;color:#cbd5e1;font-weight:700;">🏷️ Lotto</label>
                            <input id="__cioBatch" type="text"
                                style="width:100%;height:60px;padding:10px 12px;background:#0b1220;color:#fff;border:2px solid #334155;border-radius:8px;font-size:24px;line-height:1.1;box-sizing:border-box;" />
                        </td>
                        <td style="vertical-align:top;">
                            <label style="display:block;font-size:18px;color:#cbd5e1;font-weight:700;">📅 Scadenza</label>
                            <input id="__cioExp" type="text" placeholder="GG/MM/AAAA"
                                style="width:100%;height:60px;padding:10px 12px;background:#0b1220;color:#fff;border:2px solid #334155;border-radius:8px;font-size:24px;line-height:1.1;box-sizing:border-box;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align:top;">
                            <label style="display:block;font-size:18px;color:#cbd5e1;font-weight:700;">📌 Posizione *</label>
                            <input id="__cioPos" type="text" readonly placeholder="Tocca per scegliere"
                                style="width:72%;min-width:140px;max-width:210px;height:60px;padding:10px 12px;background:#0b1220;color:#fff;border:2px solid #334155;border-radius:8px;font-size:24px;line-height:1.1;box-sizing:border-box;cursor:pointer;" />
                        </td>
                        <td colspan="2" style="vertical-align:top;">
                            <label style="display:block;font-size:18px;color:#cbd5e1;font-weight:700;">📝 Note aggiuntive</label>
                            <input id="__cioNotes" type="text"
                                style="width:100%;height:60px;padding:10px 12px;background:#0b1220;color:#fff;border:2px solid #334155;border-radius:8px;font-size:24px;line-height:1.2;box-sizing:border-box;" />
                        </td>
                    </tr>
                </table>

                <div id="__cioPosPicker" style="display:none;margin-top:8px;background:#0b1220;border:2px solid #334155;border-radius:10px;padding:10px;">
                    <div style="font-size:17px;color:#93c5fd;font-weight:700;margin-bottom:8px;">1) Seleziona settore</div>
                    <div id="__cioSectorBtns" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;"></div>
                    <div id="__cioSectorDesc" style="display:none;font-size:16px;color:#cbd5e1;font-weight:600;margin:2px 0 12px;"></div>
                    <div style="font-size:17px;color:#93c5fd;font-weight:700;margin-bottom:8px;">2) Seleziona posizione</div>
                    <div id="__cioPosBtns" style="display:flex;align-items:flex-end;gap:28px;overflow-x:auto;padding:6px 6px 4px 2px;"></div>
                </div>

                <div id="__cioErr" style="display:none;background:#7f1d1d;color:#fecaca;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:16px;line-height:1.2;"></div>

                <div style="display:flex;gap:10px;justify-content:space-between;margin-top:14px;">
                    <button id="__cioCancel" type="button"
                        style="padding:14px 16px;min-width:42%;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:19px;">Annulla</button>
                    <button id="__cioSubmit" type="button"
                        style="padding:14px 16px;min-width:56%;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:19px;">✓ Completa &amp; Carica</button>
                </div>
            </div>
        `;
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m) closeCompleteModal(); });
        m.querySelector('#__cioCancel').addEventListener('click', closeCompleteModal);
        m.querySelector('#__cioSubmit').addEventListener('click', submitCompleteInternalOrder);
        m.querySelector('#__cioPos').addEventListener('click', function() { openPositionPicker(); });

        // Mantieni visibile il campo attivo quando compare la tastiera.
        m.addEventListener('focusin', function(ev) {
            const t = ev && ev.target;
            if (!t || !t.tagName) return;
            const tag = String(t.tagName).toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                ensureFocusedFieldVisible(t);
            }
        });

        if (window.visualViewport && !m.getAttribute('data-vv-bound')) {
            const onVvResize = function() {
                if (m.style.display === 'none') return;
                const active = document.activeElement;
                if (active) ensureFocusedFieldVisible(active);
            };
            window.visualViewport.addEventListener('resize', onVvResize);
            m.setAttribute('data-vv-bound', '1');
        }
        return m;
    }

    async function loadShelfPositionsList() {
        try {
            const tk = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
            const apiBase = window.API_URL || '/api';
            const results = await Promise.all([
                fetch(`${apiBase}/inventory/shelf-positions`, {
                    headers: { 'Authorization': `Bearer ${tk}` }
                }),
                fetch(`${apiBase}/inventory/shelf-entries`, {
                    headers: { 'Authorization': `Bearer ${tk}` }
                }).catch(function() { return null; })
            ]);

            const posResp = results[0];
            const entriesResp = results[1];
            if (!posResp || !posResp.ok) return;

            const j = await posResp.json();
            const positions = Array.isArray(j) ? j : (j.data || j.positions || []);
            _shelfPositions = positions.map(function(p) {
                if (p && typeof p === 'object') {
                    return {
                        code: String(p.code || '').toUpperCase(),
                        description: p.description ? String(p.description) : ''
                    };
                }
                return { code: String(p || '').toUpperCase(), description: '' };
            }).filter(function(p) { return p.code; });

            _shelfEntriesByPosition = {};
            if (entriesResp && entriesResp.ok) {
                const entriesJson = await entriesResp.json().catch(function() { return []; });
                const entries = Array.isArray(entriesJson) ? entriesJson : (entriesJson.data || entriesJson.entries || []);
                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i] || {};
                    const code = String(entry.positionCode || '').toUpperCase();
                    if (!code) continue;
                    const qty = parseFloat(entry.quantity) || 0;
                    _shelfEntriesByPosition[code] = (_shelfEntriesByPosition[code] || 0) + qty;
                }
            }

            renderPositionPicker('');
        } catch (_) { /* ignore */ }
    }

    function getSectorFromCode(code) {
        const m = String(code || '').toUpperCase().match(/^([A-Z])/);
        return m ? m[1] : '#';
    }

    function parseShelfPositionCode(code) {
        const normalized = String(code || '').toUpperCase().trim();
        const match = normalized.match(/^([A-Z]+)(\d+)\.(\d+)$/);
        if (match) {
            return {
                code: normalized,
                sector: match[1],
                column: parseInt(match[2], 10),
                level: parseInt(match[3], 10)
            };
        }

        const fallback = normalized.match(/^([A-Z]+)(\d+)/);
        return {
            code: normalized,
            sector: fallback ? fallback[1] : getSectorFromCode(normalized),
            column: fallback ? parseInt(fallback[2], 10) : 0,
            level: 0
        };
    }

    function renderPositionPicker(activeSector) {
        const sectorBox = document.getElementById('__cioSectorBtns');
        const sectorDescBox = document.getElementById('__cioSectorDesc');
        const posBox = document.getElementById('__cioPosBtns');
        if (!sectorBox || !posBox) return;

        const sectorsMap = {};
        _shelfPositions.forEach(function(position) { sectorsMap[getSectorFromCode(position.code)] = true; });
        const sectors = Object.keys(sectorsMap).sort();
        const selectedSector = (activeSector || sectors[0] || '').toUpperCase();

        const sectorDescription = _shelfPositions
            .filter(function(position) { return getSectorFromCode(position.code) === selectedSector && position.description; })
            .map(function(position) { return position.description; })[0] || '';

        sectorBox.innerHTML = sectors.map(function(s) {
            const active = s === selectedSector;
            const bg = active ? '#16a34a' : '#334155';
            const desc = _shelfPositions
                .filter(function(position) { return getSectorFromCode(position.code) === s && position.description; })
                .map(function(position) { return position.description; })[0] || '';
            return '<button type="button" data-sector="' + escapeHtml(s) + '" style="min-height:56px;padding:8px 14px;border:none;border-radius:8px;background:' + bg + ';color:#fff;font-size:24px;font-weight:700;min-width:72px;">'
                + '<div>' + escapeHtml(s) + '</div>'
                + (desc ? '<div style="font-size:12px;line-height:1.2;font-weight:600;color:#dbeafe;margin-top:2px;white-space:normal;">' + escapeHtml(desc) + '</div>' : '')
                + '</button>';
        }).join('');

        if (sectorDescBox) {
            if (sectorDescription) {
                sectorDescBox.style.display = 'block';
                sectorDescBox.textContent = 'Settore ' + selectedSector + ': ' + sectorDescription;
            } else {
                sectorDescBox.style.display = 'none';
                sectorDescBox.textContent = '';
            }
        }

        const filtered = _shelfPositions.filter(function(position) {
            return getSectorFromCode(position.code) === selectedSector;
        }).map(function(position) {
            const parsed = parseShelfPositionCode(position.code);
            parsed.description = position.description || '';
            parsed.quantity = _shelfEntriesByPosition[parsed.code] || 0;
            return parsed;
        }).sort(function(a, b) {
            if (a.column !== b.column) return a.column - b.column;
            return b.level - a.level;
        });

        const columnsMap = {};
        filtered.forEach(function(item) {
            const key = String(item.column);
            if (!columnsMap[key]) columnsMap[key] = [];
            columnsMap[key].push(item);
        });

        const columnKeys = Object.keys(columnsMap).sort(function(a, b) {
            return parseInt(a, 10) - parseInt(b, 10);
        });

        posBox.innerHTML = columnKeys.map(function(columnKey) {
            const items = columnsMap[columnKey].sort(function(a, b) { return b.level - a.level; });
            const buttonsHtml = items.map(function(item) {
                const hasStock = item.quantity > 0;
                const bg = hasStock ? '#b45309' : '#1d4ed8';
                const border = hasStock ? '#f59e0b' : '#60a5fa';
                return '<button type="button" data-pos="' + escapeHtml(item.code) + '" title="' + escapeHtml(item.description || item.code) + '" style="display:block;width:100%;height:62px;padding:8px 10px;border:2px solid ' + border + ';border-radius:8px;background:' + bg + ';color:#fff;font-size:24px;font-weight:700;">'
                    + '<div style="line-height:1;">' + escapeHtml(item.code) + '</div>'
                    + (hasStock ? '<div style="font-size:12px;line-height:1.1;color:#fef3c7;margin-top:4px;">Giac. ' + escapeHtml(String(item.quantity)) + '</div>' : '')
                    + '</button>';
            }).join('');
            return '<div style="display:flex;flex-direction:column;justify-content:flex-end;gap:12px;min-width:102px;">' + buttonsHtml + '</div>';
        }).join('');

        const sectorBtns = sectorBox.querySelectorAll('button[data-sector]');
        for (let i = 0; i < sectorBtns.length; i++) {
            sectorBtns[i].addEventListener('click', function() {
                renderPositionPicker(this.getAttribute('data-sector') || '');
            });
        }

        const posBtns = posBox.querySelectorAll('button[data-pos]');
        for (let i = 0; i < posBtns.length; i++) {
            posBtns[i].addEventListener('click', function() {
                const val = (this.getAttribute('data-pos') || '').toUpperCase();
                const posInput = document.getElementById('__cioPos');
                if (posInput) posInput.value = val;
                closePositionPicker();
            });
        }
    }

    function openPositionPicker() {
        const p = document.getElementById('__cioPosPicker');
        if (!p) return;
        p.style.display = 'block';
        renderPositionPicker('');
    }

    function closePositionPicker() {
        const p = document.getElementById('__cioPosPicker');
        if (p) p.style.display = 'none';
    }

    function closeCompleteModal() {
        const m = document.getElementById(COMPLETE_MODAL_ID);
        if (m) m.style.display = 'none';
        _completeOnSuccess = null;
        _completeTaskId = null;
    }

    function pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function getIsoWeekNumber(date) {
        // ISO week: Monday=1, week 1 is the week with Jan 4th.
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const day = d.getUTCDay() || 7; // Sunday -> 7
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function getSuggestedBatchCode() {
        const now = new Date();
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Monday=1 ... Sunday=7
        const week = getIsoWeekNumber(now);
        const yy = pad2(now.getFullYear() % 100);
        return '' + dayOfWeek + pad2(week) + yy;
    }

    function getSuggestedExpiry() {
        const now = new Date();
        // "5 mesi dal mese corrente" con mese corrente incluso -> offset di 4 mesi.
        const target = new Date(now.getFullYear(), now.getMonth() + 4, 1);
        const mm = pad2(target.getMonth() + 1);
        const yy = pad2(target.getFullYear() % 100);
        return '28/' + mm + '/' + yy;
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

        // Testo descrittivo: usa "Articolo:" dalla descrizione, altrimenti usa il titolo del task
        var articleName = nameMatch ? escapeHtml(nameMatch[1].trim()) : escapeHtml((task.title || '').replace(/^.*Ordine interno:\s*/i, ''));
        var codePart = codeMatch ? ' <span style="color:#60a5fa;">[' + escapeHtml(codeMatch[1]) + ']</span>' : '';
        document.getElementById('__cioSub').innerHTML = articleName + codePart;
        document.getElementById('__cioQty').value = suggestedQty;
        document.getElementById('__cioPos').value = '';
        document.getElementById('__cioBatch').value = getSuggestedBatchCode();
        document.getElementById('__cioExp').value = getSuggestedExpiry();
        document.getElementById('__cioNotes').value = '';
        document.getElementById('__cioErr').style.display = 'none';

        m.style.display = 'block';
        loadShelfPositionsList();
        closePositionPicker();
        // Non fare auto-focus su dispositivi touch: l'operatore deve prima leggere il form
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

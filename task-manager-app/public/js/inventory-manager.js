const API_BASE = 'http://localhost:5000/api';
let currentEditingArticle = null;

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    setupTabNavigation();
    loadDashboard();
    loadAllArticles();
    loadAlerts();
});

// Setup navigazione tab
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Rimuovi active da tutti
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Aggiungi active ai selezionati
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');

            // Ricarica dati per il tab
            if (tabName === 'dashboard') loadDashboard();
            if (tabName === 'inventory') loadAllArticles();
            if (tabName === 'alerts') loadAlerts();
        });
    });
}

// Ottieni token JWT
function getToken() {
    return localStorage.getItem('token');
}

// Funzioni Dashboard
async function loadDashboard() {
    try {
        const token = getToken();
        
        // Carica articoli
        const articlesRes = await fetch(`${API_BASE}/inventory/articles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const articles = await articlesRes.json();

        // Calcola statistiche
        let totalArticles = articles.length;
        let totalItems = 0;
        let criticalCount = 0;

        articles.forEach(article => {
            if (article.inventory) {
                totalItems += article.inventory.currentStock;
                if (article.inventory.currentStock < article.inventory.minimumStock) {
                    criticalCount++;
                }
            }
        });

        // Carica avvisi
        const alertsRes = await fetch(`${API_BASE}/inventory/alerts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const alerts = await alertsRes.json();

        // Aggiorna UI
        document.getElementById('totalArticles').textContent = totalArticles;
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('alertsCount').textContent = alerts.length;
        document.getElementById('criticalItems').textContent = criticalCount;

        // Mostra avvisi
        let alertsHTML = '';
        if (alerts.length === 0) {
            alertsHTML = '<div class="alert alert-success">✓ Nessun allarme attivo</div>';
        } else {
            alertsHTML = alerts.map(alert => `
                <div class="alert alert-warning">
                    <strong>${alert.article.name}</strong><br>
                    Stock attuale: ${alert.currentStock} ${alert.article.unit} | Minimo: ${alert.minimumStock} ${alert.article.unit}
                    <button class="btn-secondary" onclick="resolveAlert(${alert.id})" style="margin-left: auto;">Risolvi</button>
                </div>
            `).join('');
        }

        document.getElementById('alertsList').innerHTML = alertsHTML;

    } catch (error) {
        console.error('Errore caricamento dashboard:', error);
        document.getElementById('alertsList').innerHTML = `<div class="alert alert-danger">Errore: ${error.message}</div>`;
    }
}

// Carica tutti gli articoli
async function loadAllArticles() {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/articles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const articles = await res.json();

        let html = '';
        if (articles.length === 0) {
            html = '<div class="empty-state"><p>Nessun articolo trovato. Importa dati dalla tab "Importa Dati"</p></div>';
        } else {
            html += '<table class="table"><thead><tr>' +
                '<th>Codice</th>' +
                '<th>Nome</th>' +
                '<th>Categoria</th>' +
                '<th>Quantità</th>' +
                '<th>Minimo</th>' +
                '<th>Scaffale</th>' +
                '<th>Stato</th>' +
                '<th>Azioni</th>' +
                '</tr></thead><tbody>';

            articles.forEach(article => {
                const inv = article.inventory;
                const status = inv && inv.currentStock < inv.minimumStock ? 'ALLARME' : 'OK';
                const statusClass = inv && inv.currentStock < inv.minimumStock ? 'stock-critical' : 'stock-ok';

                html += `
                    <tr>
                        <td><strong>${article.code}</strong></td>
                        <td>${article.name}</td>
                        <td>${article.category || '-'}</td>
                        <td>${inv?.currentStock || 0}</td>
                        <td>${inv?.minimumStock || 0}</td>
                        <td>${inv?.shelfPosition || '-'}</td>
                        <td><span class="stock-badge ${statusClass}">${status}</span></td>
                        <td>
                            <button class="btn-secondary" onclick="editArticle(${article.id})">Modifica</button>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
        }

        document.getElementById('articlesList').innerHTML = html;

    } catch (error) {
        console.error('Errore caricamento articoli:', error);
        document.getElementById('articlesList').innerHTML = `<div class="alert alert-danger">Errore: ${error.message}</div>`;
    }
}

// Ricerca articoli
async function searchArticles() {
    try {
        const search = document.getElementById('searchInput').value;
        const token = getToken();
        
        const res = await fetch(`${API_BASE}/inventory/articles?search=${encodeURIComponent(search)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const articles = await res.json();

        let html = '<table class="table"><thead><tr>' +
            '<th>Codice</th>' +
            '<th>Nome</th>' +
            '<th>Categoria</th>' +
            '<th>Quantità</th>' +
            '<th>Minimo</th>' +
            '<th>Scaffale</th>' +
            '<th>Stato</th>' +
            '<th>Azioni</th>' +
            '</tr></thead><tbody>';

        articles.forEach(article => {
            const inv = article.inventory;
            const status = inv && inv.currentStock < inv.minimumStock ? 'ALLARME' : 'OK';
            const statusClass = inv && inv.currentStock < inv.minimumStock ? 'stock-critical' : 'stock-ok';

            html += `
                <tr>
                    <td><strong>${article.code}</strong></td>
                    <td>${article.name}</td>
                    <td>${article.category || '-'}</td>
                    <td>${inv?.currentStock || 0}</td>
                    <td>${inv?.minimumStock || 0}</td>
                    <td>${inv?.shelfPosition || '-'}</td>
                    <td><span class="stock-badge ${statusClass}">${status}</span></td>
                    <td>
                        <button class="btn-secondary" onclick="editArticle(${article.id})">Modifica</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        document.getElementById('articlesList').innerHTML = html;

    } catch (error) {
        console.error('Errore ricerca:', error);
        document.getElementById('articlesList').innerHTML = `<div class="alert alert-danger">Errore: ${error.message}</div>`;
    }
}

// Carica avvisi dettagliati
async function loadAlerts() {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/alerts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const alerts = await res.json();

        let html = '';
        if (alerts.length === 0) {
            html = '<div class="alert alert-success">✓ Nessun allarme attivo. Magazzino in buone condizioni!</div>';
        } else {
            html = alerts.map(alert => `
                <div class="alert alert-danger">
                    <strong>🚨 ${alert.article.name}</strong><br>
                    Codice: ${alert.article.code}<br>
                    Stock attuale: <strong>${alert.currentStock}</strong> ${alert.article.unit}<br>
                    Soglia minima: <strong>${alert.minimumStock}</strong> ${alert.article.unit}<br>
                    Allarme dal: ${new Date(alert.createdAt).toLocaleString('it-IT')}<br>
                    <button class="btn-success" onclick="resolveAlert(${alert.id})" style="margin-top: 10px;">✓ Risolvi Allarme</button>
                </div>
            `).join('');
        }

        document.getElementById('alertsDetailList').innerHTML = html;

    } catch (error) {
        console.error('Errore caricamento avvisi:', error);
        document.getElementById('alertsDetailList').innerHTML = `<div class="alert alert-danger">Errore: ${error.message}</div>`;
    }
}

// Risolvi allarme
async function resolveAlert(alertId) {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/alerts/${alertId}/resolve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error('Errore nella risoluzione allarme');

        showMessage('Allarme risolto!', 'success');
        loadDashboard();
        loadAlerts();

    } catch (error) {
        console.error('Errore risoluzione allarme:', error);
        showMessage(`Errore: ${error.message}`, 'danger');
    }
}

// Modifica articolo
async function editArticle(articleId) {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/articles/${articleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const article = await res.json();

        currentEditingArticle = article;

        document.getElementById('editCode').value = article.code;
        document.getElementById('editName').value = article.name;
        document.getElementById('editCurrentStock').value = article.inventory?.currentStock || 0;
        document.getElementById('editMinimumStock').value = article.inventory?.minimumStock || 0;
        document.getElementById('editShelfPosition').value = article.inventory?.shelfPosition || '';
        document.getElementById('editNotes').value = article.inventory?.notes || '';

        document.getElementById('editModal').classList.add('show');

    } catch (error) {
        console.error('Errore caricamento articolo:', error);
        showMessage(`Errore: ${error.message}`, 'danger');
    }
}

// Salva modifiche articolo
async function saveArticleChanges() {
    try {
        const token = getToken();
        const articleId = currentEditingArticle.id;

        // Aggiorna quantità
        if (document.getElementById('editCurrentStock').value != currentEditingArticle.inventory?.currentStock) {
            await fetch(`${API_BASE}/inventory/stock/update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    articleId: articleId,
                    newQuantity: parseInt(document.getElementById('editCurrentStock').value),
                    reason: 'AGGIUSTAMENTO MANUALE'
                })
            });
        }

        // Aggiorna minimo
        if (document.getElementById('editMinimumStock').value != currentEditingArticle.inventory?.minimumStock) {
            await fetch(`${API_BASE}/inventory/stock/set-minimum`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    articleId: articleId,
                    minimumStock: parseInt(document.getElementById('editMinimumStock').value)
                })
            });
        }

        // Aggiorna posizione scaffale
        if (document.getElementById('editShelfPosition').value) {
            await fetch(`${API_BASE}/inventory/shelf-position`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    articleId: articleId,
                    shelfPosition: document.getElementById('editShelfPosition').value
                })
            });
        }

        closeEditModal();
        showMessage('Articolo aggiornato con successo!', 'success');
        loadAllArticles();
        loadDashboard();

    } catch (error) {
        console.error('Errore salvataggio:', error);
        showMessage(`Errore: ${error.message}`, 'danger');
    }
}

// Chiudi modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    currentEditingArticle = null;
}

// Importa articoli
async function importArticles() {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/import/articles`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        showMessage(`Importati ${result.imported} articoli con successo!`, 'success');
        loadAllArticles();
        loadDashboard();

    } catch (error) {
        console.error('Errore importazione:', error);
        showMessage(`Errore: ${error.message}`, 'danger');
    }
}

// Importa posizioni scaffali
async function importShelfPositions() {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/import/shelf-positions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        showMessage(`Caricate ${result.positions} posizioni scaffali!`, 'success');

    } catch (error) {
        console.error('Errore importazione posizioni:', error);
        showMessage(`Errore: ${error.message}`, 'danger');
    }
}

// Esporta inventory
async function exportInventory() {
    try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/inventory/export/csv`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Errore export');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showMessage('Inventory esportato con successo!', 'success');

    } catch (error) {
        console.error('Errore export:', error);
        showMessage(`Errore: ${error.message}`, 'danger');
    }
}

// Mostra messaggi
function showMessage(message, type = 'info') {
    const messagesDiv = document.getElementById('importMessages') || document.body;
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    if (!document.getElementById('importMessages')) {
        const container = document.querySelector('#import');
        const div = document.createElement('div');
        div.id = 'importMessages';
        container.appendChild(div);
        div.appendChild(alertDiv);
    } else {
        messagesDiv.appendChild(alertDiv);
    }

    setTimeout(() => alertDiv.remove(), 5000);
}

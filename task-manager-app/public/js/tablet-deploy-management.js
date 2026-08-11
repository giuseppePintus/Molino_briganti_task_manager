(function () {
    'use strict';

    var API_URL = 'http://' + window.location.hostname + ':' + (window.location.port || 5000) + '/api';
    var STORAGE_KEY = 'tabletDeployRegistry';
    var TABLET_REGISTRY_ENDPOINT = API_URL + '/settings/tablet-registry';
    var TABLET_RUNTIME_STATUS_ENDPOINT = API_URL + '/settings/tablet-registry/runtime-status';
    var TABLET_DEVICE_ACTION_ENDPOINT = API_URL + '/settings/tablet-registry/device-action';
    var token = localStorage.getItem('token');
    var currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    var editingId = null;
    var runtimeByTabletId = {};
    var pendingActionByTabletId = {};

    function showAlert(message, type) {
        var alert = document.getElementById('alert');
        if (!alert) return;
        alert.textContent = message;
        alert.className = 'alert ' + (type || 'success');
        alert.style.display = 'block';
        setTimeout(function () { alert.style.display = 'none'; }, 3000);
    }

    function showSyncError(message) {
        var tbody = document.getElementById('tabletsTbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="9">Non è stato possibile sincronizzare il registro tablet con il server. ' +
            escapeHtml(message || 'Riprova tra poco.') + '</td></tr>';
    }

    function getSelectedEnvironment() {
        var envEl = document.getElementById('targetEnvironment');
        if (!envEl) return 'shadow';
        return envEl.value === 'prod' ? 'prod' : 'shadow';
    }

    function getDefaultRegistry() {
        return {
            tablets: []
        };
    }

    function loadRegistry() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return getDefaultRegistry();
            var parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.tablets)) return getDefaultRegistry();
            return parsed;
        } catch (e) {
            return getDefaultRegistry();
        }
    }

    function isValidRegistry(registry) {
        return !!registry && Array.isArray(registry.tablets);
    }

    function loadRegistryFromServer() {
        return fetch(TABLET_REGISTRY_ENDPOINT, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) {
                    throw new Error((result.data && result.data.message) || 'Errore caricamento registro');
                }

                var serverRegistry = result.data;
                if (!isValidRegistry(serverRegistry)) {
                    serverRegistry = getDefaultRegistry();
                }

                saveRegistry(serverRegistry);
                return serverRegistry;
            });
    }

    function persistRegistry(registry) {
        return fetch(TABLET_REGISTRY_ENDPOINT, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(registry)
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) {
                    throw new Error((result.data && result.data.message) || 'Errore salvataggio registro');
                }
                saveRegistry(registry);
                return result.data;
            });
    }

    function saveRegistry(registry) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    }

    function getFormValue(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function resetForm() {
        editingId = null;
        document.getElementById('tabletName').value = '';
        document.getElementById('tabletMac').value = '';
        document.getElementById('tabletShadowIp').value = '';
        document.getElementById('tabletProdIp').value = '';
        document.getElementById('tabletNote').value = '';
        document.getElementById('tabletEnabled').checked = true;
        document.getElementById('saveTabletBtn').textContent = 'Aggiungi Tablet';
    }

    function upsertTablet() {
        var name = getFormValue('tabletName');
        var mac = getFormValue('tabletMac');
        var shadowIp = getFormValue('tabletShadowIp');
        var prodIp = getFormValue('tabletProdIp');
        var note = getFormValue('tabletNote');
        var enabled = document.getElementById('tabletEnabled').checked;

        if (!name) {
            showAlert('Inserisci almeno il nome tablet', 'error');
            return;
        }

        var registry = loadRegistry();

        if (!editingId) {
            editingId = 'tb-' + Date.now();
            registry.tablets.push({
                id: editingId,
                name: name,
                mac: mac,
                shadowIp: shadowIp,
                prodIp: prodIp,
                note: note,
                enabled: enabled
            });
            showAlert('Tablet aggiunto', 'success');
        } else {
            for (var i = 0; i < registry.tablets.length; i++) {
                if (registry.tablets[i].id === editingId) {
                    registry.tablets[i].name = name;
                    registry.tablets[i].mac = mac;
                    registry.tablets[i].shadowIp = shadowIp;
                    registry.tablets[i].prodIp = prodIp;
                    registry.tablets[i].note = note;
                    registry.tablets[i].enabled = enabled;
                    break;
                }
            }
            showAlert('Tablet aggiornato', 'success');
        }

        persistRegistry(registry)
            .then(function () {
                resetForm();
                renderTablets();
                renderSuggestedCommands();
            })
            .catch(function (err) {
                showAlert('Non è stato possibile sincronizzare: ' + err.message, 'error');
                showSyncError(err.message);
            });
    }

    function editTablet(id) {
        var registry = loadRegistry();
        var tablet = registry.tablets.find(function (t) { return t.id === id; });
        if (!tablet) return;

        editingId = tablet.id;
        document.getElementById('tabletName').value = tablet.name || '';
        document.getElementById('tabletMac').value = tablet.mac || '';
        document.getElementById('tabletShadowIp').value = tablet.shadowIp || '';
        document.getElementById('tabletProdIp').value = tablet.prodIp || '';
        document.getElementById('tabletNote').value = tablet.note || '';
        document.getElementById('tabletEnabled').checked = tablet.enabled !== false;
        document.getElementById('saveTabletBtn').textContent = 'Salva Modifiche';
    }

    function deleteTablet(id) {
        if (!confirm('Eliminare questo tablet dal registro?')) return;

        var registry = loadRegistry();
        registry.tablets = registry.tablets.filter(function (t) { return t.id !== id; });
        persistRegistry(registry)
            .then(function () {
                showAlert('Tablet rimosso', 'warning');
                if (editingId === id) resetForm();
                renderTablets();
                renderSuggestedCommands();
            })
            .catch(function (err) {
                showAlert('Non è stato possibile sincronizzare: ' + err.message, 'error');
                showSyncError(err.message);
            });
    }

    function renderTablets() {
        var tbody = document.getElementById('tabletsTbody');
        var registry = loadRegistry();
        var tablets = registry.tablets || [];

        if (tablets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9">Nessun tablet registrato nel registro server.</td></tr>';
            return;
        }

        tbody.innerHTML = tablets.map(function (t) {
            var runtime = runtimeByTabletId[t.id] || null;
            var enabledBadge = '<span class="badge badge-loading">verifica in corso</span>';

            if (t.enabled === false) {
                enabledBadge = '<span class="badge badge-disabled">disabilitato</span>';
            } else if (runtime) {
                if (runtime.reachable && runtime.configurable) {
                    var installText = runtime.installed ? 'app presente' : 'app assente';
                    enabledBadge = '<span class="badge badge-enabled">attivo reale</span> <span class="small-note">' + escapeHtml(installText) + '</span>';
                } else if (runtime.state === 'adb-missing') {
                    enabledBadge = '<span class="badge badge-warning">ADB non disponibile</span>';
                } else {
                    enabledBadge = '<span class="badge badge-offline">non raggiungibile</span>';
                }
            }

            var shadow = t.shadowIp ? '<code>' + escapeHtml(t.shadowIp) + '</code>' : '-';
            var prod = t.prodIp ? '<code>' + escapeHtml(t.prodIp) + '</code>' : '-';
            var pendingAction = pendingActionByTabletId[t.id] === true;
            var deployButtons = '<div class="row-actions">' +
                '<button class="btn btn-primary btn-small" ' +
                (pendingAction || t.enabled === false ? 'disabled' : '') +
                ' onclick="TabletDeployPage.installTablet(\'' + t.id + '\')">Installa</button>' +
                '<button class="btn btn-danger btn-small" ' +
                (pendingAction || t.enabled === false ? 'disabled' : '') +
                ' onclick="TabletDeployPage.uninstallTablet(\'' + t.id + '\')">Disinstalla</button>' +
                '</div>';

            var runtimeMessage = runtime && runtime.message
                ? '<div class="small-note">' + escapeHtml(runtime.message) + '</div>'
                : '';

            return '<tr>' +
                '<td>' + escapeHtml(t.name || '') + '</td>' +
                '<td>' + escapeHtml(t.mac || '-') + '</td>' +
                '<td>' + shadow + '</td>' +
                '<td>' + prod + '</td>' +
                '<td>' + enabledBadge + runtimeMessage + '</td>' +
                '<td>' + escapeHtml(t.note || '-') + '</td>' +
                '<td>' + deployButtons + '</td>' +
                '<td><button class="btn btn-secondary btn-small" onclick="TabletDeployPage.editTablet(\'' + t.id + '\')">✏️ Modifica</button></td>' +
                '<td><button class="btn btn-danger btn-small" onclick="TabletDeployPage.deleteTablet(\'' + t.id + '\')">🗑️ Rimuovi</button></td>' +
                '</tr>';
        }).join('');
    }

    function getSelectedApkFilename() {
        var select = document.getElementById('apkDeployFileSelect');
        if (!select || !select.value) return '';
        return select.value;
    }

    function refreshRuntimeStatuses() {
        return fetch(TABLET_RUNTIME_STATUS_ENDPOINT + '?environment=' + encodeURIComponent(getSelectedEnvironment()), {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) {
                    throw new Error((result.data && result.data.message) || 'Errore verifica stato tablet');
                }

                runtimeByTabletId = {};
                var statuses = result.data && Array.isArray(result.data.statuses) ? result.data.statuses : [];
                statuses.forEach(function (status) {
                    runtimeByTabletId[status.tabletId] = status;
                });

                renderTablets();
            });
    }

    function runDeviceAction(tabletId, action) {
        var actionLabel = action === 'install' ? 'installazione' : 'disinstallazione';
        if (action === 'install') {
            var selectedApk = getSelectedApkFilename();
            if (!selectedApk) {
                showAlert('Nessun APK disponibile: carica prima un file APK.', 'error');
                return Promise.resolve();
            }
        }

        pendingActionByTabletId[tabletId] = true;
        renderTablets();

        return fetch(TABLET_DEVICE_ACTION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                tabletId: tabletId,
                action: action,
                environment: getSelectedEnvironment(),
                apkFilename: action === 'install' ? getSelectedApkFilename() : undefined
            })
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) {
                    throw new Error((result.data && result.data.message) || ('Errore ' + actionLabel));
                }

                showAlert('Operazione completata: ' + actionLabel, 'success');
                return refreshRuntimeStatuses();
            })
            .catch(function (err) {
                showAlert('Non è stato possibile completare la ' + actionLabel + ': ' + err.message, 'error');
            })
            .finally(function () {
                delete pendingActionByTabletId[tabletId];
                renderTablets();
            });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function exportRegistry() {
        var data = JSON.stringify(loadRegistry(), null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'tablet-registry.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importRegistry(input) {
        var file = input.files && input.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (event) {
            try {
                var json = JSON.parse(event.target.result);
                if (!json || !Array.isArray(json.tablets)) {
                    throw new Error('Formato non valido');
                }
                persistRegistry(json)
                    .then(function () {
                        showAlert('Registro importato', 'success');
                        renderTablets();
                        renderSuggestedCommands();
                    })
                    .catch(function (err) {
                        showAlert('Non è stato possibile sincronizzare: ' + err.message, 'error');
                        showSyncError(err.message);
                    });
            } catch (e) {
                showAlert('Errore import JSON: ' + e.message, 'error');
            } finally {
                input.value = '';
            }
        };
        reader.readAsText(file);
    }

    function copyCommands() {
        var box = document.getElementById('commandsBox');
        if (!box || !box.value) return;
        navigator.clipboard.writeText(box.value)
            .then(function () { showAlert('Comandi copiati', 'success'); })
            .catch(function () { showAlert('Copia non riuscita', 'error'); });
    }

    function renderSuggestedCommands() {
        var env = document.getElementById('targetEnvironment').value;
        var apkPath = getFormValue('apkPathInput') || '.\\android-inventory-app\\operatorlite\\build\\outputs\\apk\\debug\\OperatorLite-v1.0.0-debug.apk';
        var registry = loadRegistry();
        var ips = (registry.tablets || [])
            .filter(function (t) { return t.enabled !== false; })
            .map(function (t) {
                return env === 'prod' ? (t.prodIp || '') : (t.shadowIp || '');
            })
            .filter(function (ip) { return !!ip; });

        var ipsArg = ips.length > 0 ? ips.join(',') : '192.168.1.101,192.168.1.102';

        var lines = [
            '# 1) Una tantum su tablet collegato via USB',
            '.\\deploy-operatorlite-wifi.ps1 -PrepareUsb',
            '',
            '# 2) Deploy in ' + env,
            '.\\deploy-operatorlite-wifi.ps1 -Environment ' + env + ' -ApkPath "' + apkPath + '" -TabletIps ' + ipsArg,
            '',
            '# 3) Solo connessione test',
            '.\\deploy-operatorlite-wifi.ps1 -Environment ' + env + ' -ConnectOnly -TabletIps ' + ipsArg
        ];

        document.getElementById('commandsBox').value = lines.join('\n');
    }

    function uploadApk() {
        var input = document.getElementById('apkUploadFile');
        var file = input.files && input.files[0];

        if (!file) {
            showAlert('Seleziona un APK', 'error');
            return;
        }

        var formData = new FormData();
        formData.append('apk', file);

        fetch(API_URL + '/upload/apk', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error(result.data.message || 'Upload fallito');
                }
                showAlert('APK caricato: ' + result.data.filename, 'success');
                document.getElementById('apkServerUrl').value = '/' + result.data.url;
                renderApkList();
            })
            .catch(function (err) {
                showAlert('Errore upload APK: ' + err.message, 'error');
            });
    }

    function renderApkList() {
        fetch(API_URL + '/upload/apks', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error(result.data.message || 'Errore lista APK');
                }

                var list = document.getElementById('apkList');
                var select = document.getElementById('apkDeployFileSelect');
                var apks = result.data.apks || [];

                if (apks.length === 0) {
                    list.innerHTML = '<li>Nessun APK caricato</li>';
                    if (select) {
                        select.innerHTML = '<option value="">Nessun APK disponibile</option>';
                    }
                    return;
                }

                list.innerHTML = apks.map(function (apk) {
                    var url = '/' + apk.url;
                    return '<li>' +
                        '<a href="' + escapeHtml(url) + '" download="' + escapeHtml(apk.filename) + '">' + escapeHtml(apk.filename) + '</a>' +
                        ' <span class="small-note">(' + Math.round((apk.size || 0) / 1024) + ' KB)</span>' +
                        '</li>';
                }).join('');

                if (select) {
                    select.innerHTML = apks.map(function (apk) {
                        return '<option value="' + escapeHtml(apk.filename) + '">' + escapeHtml(apk.filename) + '</option>';
                    }).join('');
                }
            })
            .catch(function (err) {
                showAlert('Errore caricamento elenco APK: ' + err.message, 'error');
            });
    }

    function initPage() {
        if (!token || currentUser.role !== 'master') {
            window.location.href = 'index.html';
            return;
        }

        if (typeof renderUserInfoBadge === 'function') {
            renderUserInfoBadge('userInfo', currentUser);
        }

        if (window.SettingsUtils && window.SettingsUtils.loadAndApplyBranding) {
            window.SettingsUtils.loadAndApplyBranding();
        }

        var saveBtn = document.getElementById('saveTabletBtn');
        saveBtn.addEventListener('click', upsertTablet);

        document.getElementById('clearTabletBtn').addEventListener('click', resetForm);
        document.getElementById('exportRegistryBtn').addEventListener('click', exportRegistry);
        document.getElementById('importRegistryInput').addEventListener('change', function () { importRegistry(this); });
        document.getElementById('copyCommandsBtn').addEventListener('click', copyCommands);
        document.getElementById('targetEnvironment').addEventListener('change', renderSuggestedCommands);
        document.getElementById('targetEnvironment').addEventListener('change', function () {
            refreshRuntimeStatuses().catch(function (err) {
                showAlert('Errore verifica stato reale: ' + err.message, 'error');
            });
        });
        document.getElementById('apkPathInput').addEventListener('input', renderSuggestedCommands);
        document.getElementById('uploadApkBtn').addEventListener('click', uploadApk);
        document.getElementById('refreshRuntimeBtn').addEventListener('click', function () {
            refreshRuntimeStatuses()
                .then(function () {
                    showAlert('Stato tablet aggiornato', 'success');
                })
                .catch(function (err) {
                    showAlert('Errore verifica stato reale: ' + err.message, 'error');
                });
        });

        loadRegistryFromServer()
            .then(function () {
                renderTablets();
                renderSuggestedCommands();
                return refreshRuntimeStatuses();
            })
            .catch(function (err) {
                showAlert('Non è stato possibile sincronizzare il registro: ' + err.message, 'error');
                showSyncError(err.message);
            });

        renderApkList();
        resetForm();
    }

    window.TabletDeployPage = {
        editTablet: editTablet,
        deleteTablet: deleteTablet,
        installTablet: function (tabletId) { return runDeviceAction(tabletId, 'install'); },
        uninstallTablet: function (tabletId) { return runDeviceAction(tabletId, 'uninstall'); }
    };

    window.addEventListener('load', initPage);
})();

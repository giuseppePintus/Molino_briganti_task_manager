---
applyTo: "task-manager-app/public/**,task-manager-app/client/**"
description: "Frontend del task manager: HTML/JS vanilla in public/ e TS in client/."
---

# Frontend `task-manager-app/`

## Pagine principali (`public/`)
- `index.html` — landing/login
- `admin-dashboard.html`, `operator-dashboard.html`, `operator-lite.html`
- `warehouse-management.html` (3000+ righe), `warehouse-management-lite.html`
- `orders-planner.html`, `customers-management.html`, `trips-management.html`
- `operators.html`, `company-settings.html`
- `backup-management.html` (controllata da `update-backup-page.ps1`)

## Convenzioni
- **No framework** (no React/Vue/Angular). HTML + JS vanilla + fetch API.
- CSS condivisi in `public/css/` (`common.css`, `warehouse-management-custom.css`, ecc.). Aggiungi nuovi stili lì, non inline, salvo casi puntuali.
- JS condiviso in `public/js/`. Nuovi moduli: file separato + import via `<script>`, niente bundler.
- Comunicazione realtime: Socket.IO già istanziato globalmente — riusa il client esistente, non aprire nuove connessioni.
- Le chiamate API vanno verso le route di `server/src/routes/` documentate in `/memories/repo/warehouse-system-overview.md`.

## UX
- Le pagine devono funzionare anche **offline** (operatori in magazzino con rete instabile): usa `localStorage` per cache locale e sincronizza quando torna la rete.
- Operazioni distruttive (delete articolo, scarico stock): chiedi conferma con `confirm()` o modal.
- Stampe (es. inventario): rispettare i filtri/sort già esposti nella UI corrente.

## Client TypeScript (`client/`)
- TS strict (vedi `client/tsconfig.json`). Compila prima di considerare done.
- Mantieni i tipi delle API allineati con le response del server.

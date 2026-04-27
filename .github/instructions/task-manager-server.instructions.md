---
applyTo: "task-manager-app/server/**"
description: "Backend Node/TypeScript/Express/Prisma del task manager."
---

# Backend `task-manager-app/server/`

## Stack
- Node.js + TypeScript (vedi `task-manager-app/tsconfig.json`).
- Express per le route REST, Socket.IO per il realtime.
- Prisma client verso MariaDB (`utf8mb4`).
- Auth JWT.

## Convenzioni
- Layer separati: `routes/` → `controllers/` → `services/`. Le route NON contengono business logic.
- I controller fanno solo marshalling request/response e validazione di base; la logica vive nei service.
- Usa `async/await`, mai callback. Errori propagati con `next(err)` a un middleware centrale.
- Tipizzazione esplicita per i payload pubblici (request body, response). No `any` impliciti.
- Per query Prisma complesse, definisci tipi derivati con `Prisma.<Model>GetPayload<...>`.
- Eventi Socket.IO: nome in `dominio:azione` (es. `inventory:updated`, `orders:created`).

## Pattern già in uso (rispettarli)
- Modulo magazzino: `routes/inventory.ts` → `controllers/inventoryController.ts` → `services/inventoryService.ts`.
- Master CSV su NAS: `/share/Container/data/molino/master-Inventory.csv` (chiave unica `Posizione+Codice+Lotto`).
- Reservation system: `reserve` → `release` o `consume`. Mai modificare `currentStock` senza creare uno `StockMovement`.

## Sicurezza
- Valida sempre input da client (lunghezza, tipo, range).
- Niente SQL raw senza necessità: usa Prisma. Se serve raw, parametrizza (`$queryRaw`).
- Non loggare token, password, header `Authorization`.

## Test rapidi
- Dopo modifiche significative: `npm run build` da `task-manager-app/` e verifica che il server parta.

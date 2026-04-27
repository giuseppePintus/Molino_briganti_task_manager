---
applyTo: "android-inventory-app/**"
description: "App Android Kotlin/Compose per la gestione magazzino."
---

# Android Inventory App

## Stack
- **Kotlin** + **Jetpack Compose**
- **Hilt** per la DI
- **Retrofit** per le chiamate HTTP
- **ML Kit** per lo scanner barcode
- Build system: **Gradle KTS** (`build.gradle.kts`, `settings.gradle.kts`)

## Identità
- Package: `com.molinobriganti.inventory`
- Server: `http://NAS71F89C:5000`, base API `/api/inventory/`
- Auth: JWT, credenziali di servizio `master` / `masterpass`
- DB lato server: SQLite/MariaDB su `/share/Container/data/molino/`

## Funzionalità presenti
1. Lista articoli + ricerca
2. Scanner barcode (ML Kit)
3. Wizard "carico merce": **shelf → product → details → confirm**
4. Stock alerts
5. Settings (endpoint server, credenziali)

## Convenzioni
- UI completamente in **Compose**, niente XML layout per nuove schermate.
- ViewModel per ogni screen, stato esposto come `StateFlow`.
- Retrofit interface unica per dominio (es. `InventoryApi`), DTO in package `data.remote.dto`.
- Nessuna chiamata di rete dalla UI: solo via repository + ViewModel.
- Stringhe utente in `res/values/strings.xml` (italiano) + opzionale `values-en/`.
- **Mai committare** `local.properties` o keystore.

## Build
- `./gradlew assembleDebug` da `android-inventory-app/`.
- Se cambi dipendenze in `app/build.gradle.kts`, esegui sync Gradle prima di considerare done.

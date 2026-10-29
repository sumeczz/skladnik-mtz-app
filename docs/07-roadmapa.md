# 07 – Roadmapa (milníky)

Milníky se dokončují postupně podle akceptačních kritérií a Definition of Done v `AGENTS.md`.

| # | Milník | Výsledek |
|---|---|---|
| M0 | Základ webu | Vite, HTML/CSS/JS, PWA shell, IndexedDB schema v1, testy, dokumentace. |
| M1 | Čtečka | Implementace hotova v kódu; automatické testy procházejí. Terénní ověření kamery a GS separátoru čeká na fyzickém telefonu (`docs/field-tests.md`). |
| M2 | Palety | Skeny v IndexedDB, dělení po N, transakce, uzavírání, undo, duplicity, obnova po restartu. |
| M3 | GS1-128 štítek | GS1 parser, SSCC, render kódu a round-trip testy proti vektorům. |
| M4 | Export a historie | CSV/JSON/PDF, sdílení, hledání a detail palet. |
| M5 | Nastavení a leštění | Preference, přístupnost, výkon, dlouhé běhy a test na reálných štítcích. |
| M6 | Vydání | Produkční statický build, HTTPS deployment, instalace PWA a uživatelský návod. |
| F2 | Průmyslový skener | DataWedge / Bluetooth HID, správné zachování GS separátoru. |
| F2 | Tisk štítků | ZPL a kompatibilní Bluetooth tiskárny. |

## Pořadí

M0 → M1 → M2 → M3 → M4 → M5 → M6. GS1 jádro lze rozvíjet souběžně, ale musí mít testy ještě před integrací do UI.

## Uživatelská kontrola

Po každém milníku uživatel spustí uvedené testy, vyzkouší změnu na telefonu a popíše závady. Skenování se považuje za ověřené až po zkoušce skutečných štítků. Po M0 je nutné zvlášť ověřit instalaci PWA a načtení shellu bez sítě.
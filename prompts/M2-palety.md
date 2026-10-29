# M2 – Palety

Cíl: skeny se ukládají do palet; po N kusech se paleta automaticky uzavře a otevře se nová; vše přežije pád aplikace.

Přečti: docs/02-uzivatelske-scenare.md (US-03, US-06), docs/04-datovy-model.md, docs/03-architektura.md (tok skenu).
Použij skills: `pallet-sessions`, `local-storage-drift`, `testing-quality`.

Úkoly:
1. Repozitáře a `PalletService.registerScan()` v jedné transakci (viz skill `pallet-sessions`). Testy FIRST: hranice N, bez limitu, 100 skenů, atomicita, obnova po „pádu".
2. Pravidla duplicit (všechny kombinace policy × scope) vč. „Přidat přesto".
3. Vrátit poslední sken (undo) včetně znovuotevření uzavřené palety se zachováním SSCC čísla (zatím jen rezervace čísla z čítače; kód se kreslí v M3).
4. Napoj `ScanPipeline` (M1) na `PalletService`; UI čte stav z DB streamů (`watch`).
5. Banner „Paleta 0007 uzavřena (3/3)", počítadlo, tlačítko „Uzavřít paletu" (ruční uzavření).
6. Seznam palet (jednoduchý) a detail palety se seznamem kódů, mazání s potvrzením.
7. Nastavení: kapacita palety, pravidla duplicit, kooldown.

Akceptace: US-03 a US-06 (základ) splněny; integrační test „naskenuj 7 kódů při N=3 → 2 uzavřené + 1 otevřená (1/3)"; ruční test s násilným ukončením aplikace.

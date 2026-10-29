# 06 – UX a UI pravidla

## Principy

1. **Nulový dotek při skenování.** Po startu skenování nesmí být nutné nic mačkat, dokud se nezmění typ nebo nekončí práce.
2. **Zpětná vazba bez pohledu na displej.** Skladník kouká na zboží, ne na telefon: zvuk + vibrace nesou význam, displej ho jen potvrzuje.
3. **Barva nikdy sama.** Stav vždy ikona + text + barva (rukavice, špatné světlo, barvoslepost).
4. **Velké cíle.** Hlavní akce ≥ 56 dp, počítadlo a poslední kód velké a čitelné z 50 cm.
5. **Chyby jsou srozumitelné a nezastavují práci.** Banner, ne dialog. Dialog jen u destruktivní akce.

## Obrazovky

```
Domů
 ├─ [ Skenovat ]  ← největší tlačítko
 ├─ Palety (seznam, hledání)
 └─ Nastavení

Skenovat – krok 1: výběr typu             Skenovat – krok 2: běží
┌──────────────────────────┐              ┌──────────────────────────┐
│ Jaký kód budeš skenovat? │              │ [GS1-128 ▾]   🔦   ⏸     │  záhlaví: typ, svítilna, pauza
│ ┌────────┐ ┌────────┐    │              │ ┌──────────────────────┐ │
│ │Code 128│ │GS1-128 │    │              │ │      KAMERA          │ │
│ └────────┘ └────────┘    │              │ │   ┌──────────────┐   │ │  zaměřovací okno
│ ┌────────┐ ┌────────┐    │              │ │   └──────────────┘   │ │
│ │  QR    │ │EAN-13  │ …  │              │ └──────────────────────┘ │
│                          │              │  Paleta 0007      2 / 3  │  velké počítadlo
│ [      SPUSTIT       ]   │              │  ✔ 8590123456789  12:04  │  poslední sken
└──────────────────────────┘              │  [Vrátit] [Ručně] [Uzavřít]│
                                          └──────────────────────────┘

Detail palety
┌──────────────────────────┐
│ Paleta 0007   ● uzavřená │
│ 3 kódy · 29. 10. 2026 12:05
│ ┌──────────────────────┐ │
│ │ ▌▌▌▍▌▌▍▌▌▍▌▌▌▍▌▌▍▌▌  │ │  GS1-128 (SSCC)
│ │ (00)106141412345678908│ │
│ └──────────────────────┘ │
│ Typ štítku: [GS1-128 ▾]  │
│ Kódy: 1) … 2) … 3) …     │
│ [Export ▾]  [Tisk / PDF] │
└──────────────────────────┘
```

## Zpětná vazba (signály)

| Událost | Zvuk | Vibrace | Displej |
|---|---|---|---|
| Sken přijat | krátký vysoký tón | 1 × krátká (40 ms) | zelený záblesk rámečku + ✔ v řádku posledního skenu |
| Paleta uzavřena | dvojtón vzestupný | 2 × krátká | banner „Paleta 0007 uzavřena (3/3)" 2 s |
| Duplicita | nízký dvojitý tón | 2 × střední | oranžový banner + akce „Přidat přesto" 4 s |
| Odmítnuto (neplatné) | dlouhý nízký tón | 1 × dlouhá (300 ms) | červený banner s důvodem |
| Typ neodpovídá | žádný | žádná | žádná (ignoruje se) |

Zvuk i vibrace lze v nastavení vypnout nezávisle (sklad bývá hlučný, ale někdy se pracuje potichu).

## Texty (klíče ARB → čeština)

| Klíč | Text |
|---|---|
| `scanChooseType` | Jaký kód budeš skenovat? |
| `scanStart` | Spustit skenování |
| `scanPaused` | Skenování pozastaveno |
| `scanAccepted` | Načteno |
| `scanDuplicate` | Duplicitní kód |
| `scanAddAnyway` | Přidat přesto |
| `scanInvalidChecksum` | Neplatná kontrolní číslice |
| `scanInvalidGs1` | Kód není platný GS1-128 |
| `scanUndo` | Vrátit |
| `scanManualEntry` | Zadat ručně |
| `palletClosed` | Paleta {number} uzavřena ({count}/{capacity}) |
| `palletCloseNow` | Uzavřít paletu |
| `palletNumberMissingPrefix` | Nastav GS1 prefix, jinak nelze vytvořit SSCC. |
| `cameraPermissionDenied` | Aplikace potřebuje kameru. Povol ji v nastavení telefonu. |
| `exportCsv` / `exportJson` / `exportPdfLabel` | CSV / JSON / PDF štítek |
| `confirmDeletePallet` | Smazat paletu {number} a všech {count} kódů? Nelze vrátit. |

Pravidla textu: krátce, činně, bez odborných zkratek navíc; oslovení neutrální (imperativ „Povol…"); žádné vykřičníky.

## Vzhled

- Výchozí téma **vysoký kontrast** (tmavý text na bílé, nebo světlý na tmavé podle systému); testuj ve skladu i na slunci.
- Stavové barvy: zelená = přijato, oranžová = varování, červená = chyba, modrá = informace. Vždy s ikonou.
- Orientace: výchozí portrait; landscape povol, pokud se rozložení neláme.
- Obrazovka se při skenování nesmí zhasínat (wakelock) a po opuštění se vrací do normálu.

## Přístupnost

Podpora velikosti písma systému (rozložení nesmí zlomit při 130 %), popisky `Semantics` u ikon, dostatečný kontrast (≥ 4,5:1),
zpětná vazba nezávislá na jednom kanálu.

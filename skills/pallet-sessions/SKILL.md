---
name: pallet-sessions
description: Doménová logika palet pro skladovou čtečku – ukládání naskenovaných kódů do otevřené palety, automatické dělení po N kódech (nová paleta po každých 3 kódech), ruční uzavření, bez limitu, přidělení SSCC při uzavření, pravidla duplicit, vrácení posledního skenu (undo) a obnova po pádu aplikace. Použij vždy, když uživatel mluví o paletě, dávce, "souboru ke kterému kódy patří", "každé 3 kódy", dělení, seskupování skenů, duplicitách nebo ztracených skenech, i když nepoužije slovo paleta.
---

# pallet-sessions

Jádro hodnoty aplikace: skladník skenuje bez přestání a kódy se samy seskupují do palet. Chyby tady znamenají dohledávání zboží.
Doménová vrstva je čistý Dart; databáze je za rozhraními repozitářů (`local-storage-drift`).

## Model (zkráceně; detail v `docs/04-datovy-model.md`)

Paleta: `open | closed`, `capacity` (N nebo null), `sscc` (přidělí se při prvním uzavření a **nikdy se nemění**), `number`.
Sken: `pallet_id`, `seq` (1..N), `value`, `code_type`, `scanned_at`.

## Hlavní algoritmus `registerScan`

Celé v **jedné DB transakci**; volání jsou **serializována** (jedna fronta), aby se dvě události neprolnuly:

```
registerScan(scan, {forceDuplicate = false}):
  tx:
    settings  = settings.read()
    pallet    = pallets.findOpen()                # nejvýše jedna
    if pallet == null: pallet = pallets.createOpen(capacity: settings.capacity)   # líné založení
    if not forceDuplicate and duplicates.exists(scan.value, settings.duplicateScope, pallet):
        return Duplicate(existingPalletId)        # nic se nezapisuje
    seq = scans.countIn(pallet) + 1
    scans.insert(pallet, seq, scan)
    if pallet.capacity != null and seq >= pallet.capacity:
        sscc = ssccAllocator.allocateIfEnabled(pallet)   # čítač++ ve stejné transakci
        pallets.close(pallet, sscc)
        return AcceptedAndClosed(pallet, sscc)
    return Accepted(pallet, seq)
```

### Proč líné zakládání nové palety

Nová paleta se nezakládá hned po uzavření, ale až při dalším skenu. Důvody: (1) nevznikají prázdné palety, když skladník skončí;
(2) „poslední sken v systému" je vždy v otevřené nebo právě uzavřené paletě, takže `undo` je jednoznačné. Pro uživatele je chování stejné:
UI ukáže „Paleta 0008 · 0/3" (číslo = nejvyšší + 1) a první další sken ji založí.

## Pravidla (a proč)

1. **Žádný sken mimo transakci.** Důvod: pád aplikace nesmí zanechat sken bez palety nebo paletu bez SSCC.
2. **Unikátní index `(pallet_id, seq)`** je záchranná síť proti souběhu; logika ale má souběhu předcházet frontou.
3. **SSCC se přidělí jednou, při prvním uzavření, a zůstane navždy.** Důvod: štítek mohl být už vytištěn; číslo se nikdy nevrací do zásoby, ani při `undo`. Mezery v číslování jsou v pořádku, duplicity ne.
4. **Prefix chybí → uzavři paletu bez SSCC** (`sscc = null`) a po nastavení prefixu doplň čísla zpětně v pořadí uzavření (`assignMissingSscc`). Skenování se kvůli tomu nikdy nezastaví.
5. **Změna kapacity** v nastavení platí pro nově zakládané palety. Otevřená paleta si drží svou kapacitu (nabídni akci „Použít i na aktuální"). Důvod: překvapivé uzavření hotové palety je nejhorší možné chování.
6. **Ruční uzavření** je povoleno jen u palety s ≥ 1 kódem. Prázdná paleta se nikdy neuzavírá.
7. **Duplicity** řeší nastavení (viz tabulka). Výchozí: `warnAndSkip` + `allStored`.
8. **Typ kódu u každého skenu**, ne u palety – skladník smí uprostřed palety změnit typ.

### Duplicity

| Policy | Chování |
|---|---|
| `allow` | přidá vždy |
| `warnAndSkip` (výchozí) | nepřidá, vrátí `Duplicate`; UI nabídne „Přidat přesto" (4 s) → `registerScan(forceDuplicate: true)` |
| `silentSkip` | nepřidá, bez banneru (jen krátký signál) |

Scope: `pallet` (jen otevřená/aktuální paleta) | `allStored` (všechny uložené skeny). Porovnávej **normalizovanou hodnotu** (bez `]C1`, bílých znaků na okrajích);
u GS1 porovnávej element string, ne lidsky čitelný zápis.

### Undo (Vrátit)

Povoleno pro **poslední sken v systému**:
- smaž řádek skenu; `seq` ostatních se nemění;
- pokud byla paleta uzavřená, znovu ji otevři (`status = open`, `closed_at = null`), **SSCC ponech**;
- při opětovném uzavření se použije stejné SSCC (žádný nový čítač).
Undo staršího skenu není v MVP (smazání skenu z detailu palety je samostatná akce s potvrzením a dopadem na `seq`: přečísluj v transakci).

## Obnova po pádu

Start aplikace nic „neobnovuje" ručně: UI čte `findOpen()` jako stream z DB. Když DB obsahuje otevřenou paletu se 2 skeny ze 3, uživatel ji uvidí a pokračuje.
Test: vlož 2 skeny, zahoď instanci služby i DB spojení, otevři znovu → stav stejný.

## Výsledky pro UI

```dart
sealed class ScanOutcome {}
class Accepted extends ScanOutcome { final Pallet pallet; final int seq; }
class AcceptedAndClosed extends ScanOutcome { final Pallet pallet; final String? sscc; }
class Duplicate extends ScanOutcome { final int existingPalletId; }
class Rejected extends ScanOutcome { final RejectReason reason; }   // přichází z validace před transakcí
```

UI na výsledek reaguje signály podle tabulky v `docs/06-ux-a-ui-pravidla.md`; **nikdy** dialogem.

## Testy, které musí existovat

- N = 1, 3, 50 a „bez limitu"; hrana přesně N; N+1. skenu patří do nové palety.
- 100 skenů v řadě při N = 3 → 33 uzavřených + 1 otevřená s 1 kódem; `seq` v každé 1..3.
- Atomicita: výjimka po vložení skenu, před uzavřením → žádný sken ani změna palety.
- SSCC: unikátní přes 10 000 uzavření; čítač přežije restart; `undo` + znovuuzavření = stejné SSCC.
- Duplicity: matice `policy × scope × forceDuplicate`.
- Souběh: dvě události téhož kódu těsně po sobě → jedna přijata, druhá `Duplicate`.
- Změna kapacity za běhu.

## Kontrolní seznam

- [ ] Všechno zapisující jde přes `registerScan` / `closeManually` / `undoLast`.
- [ ] Žádná logika dělení v UI ani v repozitáři.
- [ ] Všechny stavy mají test; žádné `print`.
- [ ] Ruční test: násilně ukonči aplikaci uprostřed palety a vrať se.

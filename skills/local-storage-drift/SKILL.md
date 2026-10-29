---
name: local-storage-drift
description: Lokální databáze SQLite přes drift ve Flutteru pro offline skladovou aplikaci – tabulky, transakce, streamy (watch), migrace a testy migrací, in-memory testovací DB, čítač SSCC, nastavení a spolehlivé ukládání bez ztráty dat při pádu. Použij vždy, když se mění schéma, přidává tabulka nebo sloupec, píše repozitář, řeší transakce, "ukládání skenů", zálohu, export databáze, nebo když se objeví chyby build_runner/drift, i když uživatel řekne jen "ať se to ukládá do telefonu".
---

# local-storage-drift

Databáze je zdroj pravdy; UI z ní jen čte (streamy). Cíl: **žádný sken se neztratí** a změny schématu nikdy nezničí data.
API drift se mění – nejdřív ověř dokumentaci verze z `pubspec.lock` (drift.simonbinder.eu) a až pak piš kód.

## Postup při zavádění

1. Tabulky podle `docs/04-datovy-model.md` (`pallets`, `scans`, `counters`, `settings`) jako drift `Table` třídy.
2. `AppDatabase` s `schemaVersion = 1`, `MigrationStrategy` (`onCreate`, `onUpgrade`).
3. Připojení přes `drift_flutter` (soubor v adresáři aplikace); pro testy `NativeDatabase.memory()`.
4. Repozitáře jsou **rozhraní v doméně** a implementace v `data/`. Doména neimportuje drift.
5. `dart run build_runner build --delete-conflicting-outputs`.

## Pravidla (a proč)

1. **Každý zápis skenu je v transakci** (`db.transaction(() async { ... })`). Důvod: pád uprostřed nesmí zanechat nekonzistenci (viz `pallet-sessions`).
2. **Trvanlivost zápisu:** po `commit` musí sken přežít vybití telefonu. Ověř nastavení `PRAGMA synchronous` / `journal_mode` pro zvolenou konfiguraci; pro tuto aplikaci
   (desítky zápisů za minutu) je cena nejbezpečnějšího nastavení zanedbatelná. Zvaž `PRAGMA synchronous = FULL` v `setup` callbacku DB a rozhodnutí zapiš do ADR.
3. **UI čte přes `watch()` streamy**, ne přes jednorázové `get()` + ruční refresh. Důvod: po pádu a návratu je stav konzistentní bez extra kódu.
4. **Čítač SSCC je řádek v tabulce `counters`** zvýšený v téže transakci jako přidělení. Nikdy v paměti, nikdy v `shared_preferences`.
5. **Čas v UTC** (epoch ms nebo ISO), do místního času se převádí jen při zobrazení.
6. **Invarianty ve schématu, kde to jde:** `UNIQUE(pallet_id, seq)`, `UNIQUE(sscc)`, cizí klíč se `ON DELETE CASCADE`; pravidlo „jedna otevřená paleta" hlídej částečným unikátním indexem nebo v transakci.
7. **Migrace nikdy nemažou data bez náhrady.** Změna schématu = `schemaVersion + 1` + migrace + test.
8. **Žádná síť, žádné cloudové databáze** v MVP.

## Migrace a jejich testy

- Po každé změně schématu vygeneruj snímek (`dart run drift_dev schema dump …`) a ulož ho do `drift_schemas/`.
- Test migrace z každé předchozí verze na aktuální (drift `SchemaVerifier`): vlož data ve staré verzi, migruj, ověř data a strukturu.
- Před vydáním spusť migraci na **kopii reálné DB** z telefonu.

## Dotazy, které budeš potřebovat

| Potřeba | Dotaz |
|---|---|
| otevřená paleta | `pallets` where `status = 'open'` limit 1 (`watchSingleOrNull`) |
| počet skenů v paletě | `count(*)` where `pallet_id = ?` |
| duplicita | `exists` where `value = ?` (+ `pallet_id = ?` pro scope `pallet`) |
| seznam palet s počty | join/agregace `scans` na `pallets`, řazení `created_at DESC` |
| hledání kódu | `scans.value LIKE ?` → distinct `pallet_id` |
| další SSCC serial | `counters` where `name = 'sscc_serial'`, `update value = value + 1` (v transakci) |

Pro velké seznamy používej stránkování (`limit/offset`) nebo `StreamBuilder` nad omezeným dotazem.

## Záloha a export

Ruční záloha = export do JSON (`docs/04-datovy-model.md`) přes `labels-and-export`; případně kopie souboru DB přes sdílení.
Obnova ze zálohy je samostatná funkce s potvrzením a testem (nepřepisuj data bez potvrzení).

## Testy

- Repozitáře proti `NativeDatabase.memory()`.
- Test transakce: výjimka v půlce → nic se nezapsalo.
- Test „restartu": zavři DB, otevři znovu na stejném souboru (dočasný soubor) → data jsou tam.
- Test výkonu: vlož 10 000 skenů, `exists` a seznam palet < 50 ms.

## Kontrolní seznam

- [ ] Schéma odpovídá `docs/04-datovy-model.md` (jinak uprav dokument i ADR).
- [ ] `schemaVersion` zvýšena a migrace má test.
- [ ] Doména neimportuje drift; generované soubory (`*.g.dart`) nejsou ručně upravované.
- [ ] Žádná logika dělení palet v repozitáři.

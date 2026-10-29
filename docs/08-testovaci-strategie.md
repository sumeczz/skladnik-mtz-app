# 08 – Testovací strategie

## Pyramida

| Úroveň | Co | Nástroj | Kde |
|---|---|---|---|
| Jednotkové (většina) | GS1 (kontrolní číslice, SSCC, parser), validátory typů, pravidla duplicit, dělení palet | `flutter test` / `dart test` | `test/core/`, `test/features/*/domain/` |
| Repozitáře (DB) | transakce, invarianty, migrace | drift in-memory DB | `test/features/*/data/` |
| Widget | obrazovky s `FakeScanSource`, banner, počítadlo | `flutter_test` | `test/features/*/presentation/` |
| Integrační | celý tok: výběr typu → N skenů → uzavření → štítek | `integration_test` | `integration_test/` |
| Golden | vzhled štítku / PDF (stabilní rozměry) | golden testy | `test/goldens/` |
| **Terén** | reálné štítky, reálný telefon, reálné světlo | ruční checklist níže | – |

## Povinné testy (bez nich milník není hotový)

- **GS1 vektory**: každý záznam z `docs/test-vectors/gs1_vectors.json` (zkopíruj do `test/fixtures/`). Změna logiky bez změny vektorů je podezřelá.
- **Dělení palet**: N=1, N=3, N=max, bez limitu; dělení přesně na hranici; 100 skenů v řadě → správný počet palet a pořadí; souběh dvou událostí téhož kódu.
- **Atomicita**: simulovaná chyba uprostřed transakce uzavření → stav se vrátí (žádná paleta bez SSCC, žádný sken bez palety).
- **SSCC**: unikátnost přes 10 000 uzavření; čítač přežije restart; nikdy se nevrací při undo.
- **Duplicity**: všechny kombinace `DuplicatePolicy × DuplicateScope`, včetně „Přidat přesto".
- **Obnova po pádu**: DB s otevřenou paletou → start aplikace → stav stejný.
- **Round-trip štítku**: `parse(render(sscc)) == sscc` (generování → dekódování obrazu, pokud to nástroje dovolí; jinak ruční test v terénu).

## FakeScanSource

Pro všechny testy skenování používej `FakeScanSource implements ScanSource` s řízeným streamem (`emit(RawScan)`),
ne kameru. Díky tomu jde napsat „naskenuj 7 kódů" v 5 řádcích a test běží v milisekundách.

## Terénní checklist (před každým vydáním)

Pro každý podporovaný typ kódu vyzkoušej alespoň tyto situace a zapiš výsledek do `docs/field-tests.md` (zakládá se při prvním testu):

| Situace | Výsledek (OK / pomalé / selhalo) |
|---|---|
| Čistý štítek, 20 cm, dobré světlo | |
| Štítek v rukavici ve 40 cm | |
| Zmačkaný / poškrábaný štítek | |
| Lesklý štítek (odlesk) | |
| Slabé světlo + svítilna | |
| Kód na displeji (jiný telefon / monitor) | |
| Malý kód (< 20 mm široký) | |
| Dlouhý Code 128 (> 20 znaků) | |
| GS1-128 se dvěma proměnlivými poli (kontrola GS separátoru, riziko R-01) | |
| 30 kódů za sebou bez doteku (kontinuální režim) | |
| Držení kamery 3 s na jednom kódu (musí se uložit jen jednou) | |
| Násilné ukončení aplikace po 2. skenu z 3 | |
| Zámek obrazovky a návrat | |
| Přerušení telefonním hovorem | |

Měř čas „kód v záběru → vibrace" stopkami alespoň 10× a zapiš medián.

## Kvalita kódu

`flutter analyze` bez varování, `dart format --set-exit-if-changed .`, žádný `print` v produkčním kódu (použij logger), pokrytí
doménových složek ≥ 85 % (měř `flutter test --coverage`, ale pokrytí není cíl samo o sobě).

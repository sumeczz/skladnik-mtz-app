---
name: testing-quality
description: Testování a kontrola kvality Flutter aplikace pro skladové skenování – jednotkové, databázové, widget a integrační testy, FakeScanSource místo kamery, testovací vektory GS1, golden testy štítku, terénní testy na reálných štítcích, měření rychlosti čtení a kontrolní seznam před vydáním. Použij vždy, když se píše test, opravuje chyba, ověřuje "jestli to opravdu funguje", hlásí se nefunkční skenování, nebo před dokončením milníku, i když uživatel řekne jen "zkontroluj to" či "otestuj".
---

# testing-quality

Dvě vrstvy jistoty: **automatické testy** (rychlé, opakovatelné, bez zařízení) a **terénní testy** (reálné štítky, reálný telefon). Žádná z nich druhou nenahradí.
Plná strategie a checklist: `docs/08-testovaci-strategie.md`.

## Pravidla (a proč)

1. **Testy logiky píšeš před implementací** u GS1 a dělení palet. Důvod: chyby tady znamenají špatně označené palety a hledání zboží.
2. **Žádná kamera v testech.** Používej `FakeScanSource` (`emit(RawScan)`). Důvod: rychlost a opakovatelnost.
3. **Vektory jsou smlouva:** `test/fixtures/gs1_vectors.json` se nemění ručně; změna jde přes `tools/gs1_reference.py`.
4. **Chyba nejdřív jako test.** Hlášení „nenačetlo to kód X" → nejdřív test/vektor pro X, pak oprava.
5. **Ověřeno ≠ předpoklad.** V odpovědi uživateli odděl, co bylo spuštěno (a s jakým výsledkem), a co je jen úsudek z kódu.
6. **Rychlost měř, neodhaduj.** Čas „kód v záběru → vibrace" měř stopkami (≥ 10 pokusů, medián) a zapisuj.

## FakeScanSource (základ)

```dart
class FakeScanSource implements ScanSource {
  final _c = StreamController<RawScan>.broadcast();
  @override Stream<RawScan> get scans => _c.stream;
  void emit(String value, {DetectedFormat format = DetectedFormat.code128, DateTime? at}) =>
      _c.add(RawScan(value: value, format: format, at: at ?? DateTime.now().toUtc()));
  @override Future<void> start(CodeType type) async {}
  @override Future<void> stop() async {}
  @override Future<void> setTorch(bool on) async {}
}
```

Hodiny (`Clock`) injektuj, ať jde kooldown testovat bez `sleep`.

## Co a kde testovat

| Oblast | Test |
|---|---|
| GS1 | všechny vektory + fuzz (náhodné řetězce nikdy nevyhodí neočekávanou výjimku) |
| Pipeline | formát neodpovídá typu → ignorováno; kooldown; validace EAN; GS1 reject |
| Palety | hranice N, 100 skenů, atomicita, SSCC unikátnost, undo, obnova po „pádu" |
| Duplicity | matice `policy × scope`, „Přidat přesto" |
| DB | transakce, migrace (SchemaVerifier), restart na souboru |
| Widgety | počítadlo, banner, výběr typu (Spustit neaktivní bez volby) |
| Integrační | výběr typu → 7 skenů při N=3 → 2 uzavřené + 1 otevřená |
| Export | CSV bajty (BOM, `;`, diakritika, injection), JSON round-trip |
| Golden | rozměry PDF štítku, přítomnost prvků |

## Terénní testy

Vyplňuj tabulku z `docs/08-testovaci-strategie.md` do `docs/field-tests.md` (datum, telefon, verze aplikace, výsledek, poznámky, foto štítku).
Povinné před každým vydáním: R-01 (GS separátor u GS1-128 se dvěma proměnlivými poli), round-trip vlastního štítku, 30 kódů za sebou, násilné ukončení uprostřed palety.

Při selhání čtení **vždy** zjisti: typ kódu a jeho kvalitu (foto), vzdálenost, světlo, zda byla zapnutá svítilna, zda byl zvolen správný typ,
zda štítek načte jiná aplikace/skener. Teprve pak hledej chybu v kódu.

## Příkazy

```bash
dart format --set-exit-if-changed .
flutter analyze
flutter test --coverage
flutter test integration_test         # na zařízení / emulátoru
python tools/gs1_reference.py --selftest
```

## Kontrolní seznam před dokončením milníku

- [ ] Nové chování má test; chyba, kterou jsme opravili, má regresní test.
- [ ] `analyze`, `format`, `test` zelené.
- [ ] Terénní testy relevantní pro milník zapsány (nebo výslovně „neprovedeno").
- [ ] Rizika v `docs/09-rizika-a-otevrene-otazky.md` aktualizována podle zjištění.
- [ ] `CHANGELOG.md` obsahuje změnu a známá omezení.

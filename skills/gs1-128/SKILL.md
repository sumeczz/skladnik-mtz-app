---
name: gs1-128
description: Práce s GS1-128, SSCC a Application Identifiers – parsování načtených kódů (AI, GS separátor, ]C1), validace (kontrolní číslice mod 10, datumy, délky, znaková sada), sestavení SSCC (extension digit, GS1 Company Prefix, serial reference) a generování/vykreslení GS1-128 kódu palety. Použij vždy, když se objeví GS1, GS-128, GS128, SSCC, EAN-128, AI/Application Identifier, kontrolní číslice, "kód palety", "štítek palety", nebo když se rozhoduje, zda je načtený Code 128 vlastně GS1-128, i když uživatel píše jen "gs128".
---

# gs1-128

Jediná implementace GS1 logiky v projektu: `lib/core/gs1/` (čistý Dart, bez Flutteru).
Zdroj pravdy pro chování: `tools/gs1_reference.py` a `docs/test-vectors/gs1_vectors.json`.
Teorie, tabulka AI a upozornění ⚠: `docs/05-gs1-128-reference.md` – přečti ji před implementací.

## Postup (TDD)

1. Zkopíruj `docs/test-vectors/gs1_vectors.json` do `test/fixtures/` a napiš test, který **projde všechny kategorie** (`check_digit`, `sscc_build`, `sscc_build_errors`, `parse_valid`, `parse_invalid`). Teprve pak implementuj.
2. Implementuj v tomto pořadí: `checkDigit` → `buildSscc` → tabulka AI → `parse` → `toElementString`/`toHumanReadable`.
3. Spusť `python tools/gs1_reference.py --selftest`, abys měl jistotu, že reference je v pořádku; při změně logiky vždy změň nejdřív referenci a vektory, pak Dart.

## API (návrh)

```dart
class Gs1Element { final String ai; final String value; }
class Gs1ParseResult { final List<Gs1Element> elements; final bool ambiguous; }
class Gs1Failure implements Exception { final Gs1ErrorCode code; final String detail; }
enum Gs1ErrorCode { unknownAi, badLength, badCheckDigit, badDate, nonNumeric,
                    badCharset, tooLong, emptyValue, duplicateAi, empty,
                    badExtension, badPrefix, serialOverflow }

abstract final class Gs1 {
  static String checkDigit(String payload);                       // mod 10
  static String buildSscc({required int extension, required String companyPrefix, required int serial});
  static Gs1ParseResult parse(String input);                      // element string (s GS) NEBO "(01)…(10)…"
  static String toElementString(List<Gs1Element> e);              // pro kódování (GS za proměnlivými poli, ne za posledním)
  static String toHumanReadable(List<Gs1Element> e);              // "(00)…"
}
```

Kódy chyb se **musí shodovat** s `expected_error` ve vektorech (`BAD_CHECK_DIGIT` ↔ `badCheckDigit` atd.).

## Pravidla (a proč)

1. **Parser nejdřív normalizuje:** odřízne `]C1`, rozpozná lidsky čitelný zápis podle úvodní `(`. Důvod: různé skenery a knihovny vrací různou podobu téhož kódu.
2. **AI jsou prefix-free**, proto stačí brát nejkratší shodu (2 → 3 → 4 číslice). Neimplementuj heuristiky navíc.
3. **Proměnlivé pole končí na GS nebo na konci vstupu.** Pokud proměnlivé pole **není poslední** a ve vstupu **chybí GS**, parser nastaví `ambiguous = true` (nelze poznat, kde pole končí). Důvod: riziko R-01; raději varovat než potichu slít pole.
4. **SSCC nikdy nesestavuj ručním skládáním řetězců v UI.** Jen `Gs1.buildSscc`. Důvod: jediná kontrolní číslice a validace délky prefixu.
5. **Kontrolní číslici ověřuj** u AI 00, 01, 02, 410 vždy, i když štítek „vypadá dobře". Nevalidní kontrolní číslice znamená špatný sken nebo vadný štítek.
6. **Neznámý AI není výjimka v aplikaci**, ale výsledek validace; rozhodnutí o přijetí řídí nastavení.
7. Typ **GS1-128 ve skenování = formát Code 128 + úspěšný `parse`**. Samotný formát Code 128 žádný GS1 neprokazuje.

## SSCC a prefix firmy

- Bez GS1 Company Prefix nevyrábět SSCC (viz `docs/05-gs1-128-reference.md` §4): nabídnout interní režim A (`(91)PAL0000007` jako GS1-128) nebo B (Code 128 `PAL-0000007`).
- Validace prefixu: 6–12 číslic; délka serial reference = `16 − len(prefix)`; serial se dopočítává z DB čítače (`pallet-sessions`).
- Extension digit 0–9, výchozí 0, konfigurovatelný.

## Generování a kreslení

- Vstup pro kreslení = `toElementString`/lidsky čitelný zápis podle požadavku knihovny `barcode` (`Barcode.gs1128()`).
  **Neodhaduj formát:** otevři dokumentaci verze z `pubspec.lock`, napiš test, který kód vykreslí, a ověř **naskenováním** výsledku.
- Pod kód vždy lidsky čitelný text `(00)…`.
- Quiet zone ≥ 10 modulů; kód neořezávej ani nezmenšuj pod čitelnost (viz `labels-and-export`).

## Kontrolní seznam před hotovo

- [ ] Všechny vektory zelené (včetně `parse_invalid` se správnými kódy chyb).
- [ ] `generate(parse(x)) == x` pro platné vektory (round-trip element stringu).
- [ ] V `lib/core/gs1/` žádný import Flutteru.
- [ ] Parser nikdy nevyhodí neočekávanou výjimku (fuzz: náhodné řetězce → buď výsledek, nebo `Gs1Failure`).
- [ ] Reálný štítek z terénu naskenován a rozparsován; výsledek zapsán v `docs/field-tests.md`.
- [ ] SSCC vykreslené v aplikaci čte jiný skener stejně.

## Časté chyby

- Zahrnutí závorek do dat kódu (patří jen do lidsky čitelného textu).
- Zapomenutý GS mezi proměnlivými poli při kódování.
- Délka serial reference pevně 9 (platí jen pro prefix 7 číslic).
- Kopírování GS1 logiky do více míst (UI, export) místo volání `Gs1`.

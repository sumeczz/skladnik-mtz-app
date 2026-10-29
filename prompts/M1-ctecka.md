# M1 – Čtečka kódů

Cíl: výběr typu kódu, kontinuální skenování kamerou, zpětná vazba, ruční zadání, validace podle typu. Ukládání do palet zatím NE (to je M2) – skeny se dočasně ukládají do jednoduchého seznamu v paměti pouze pro ladění.

Přečti: docs/02-uzivatelske-scenare.md (US-01, US-02), docs/06-ux-a-ui-pravidla.md, docs/05-gs1-128-reference.md (§5), docs/09-rizika-a-otevrene-otazky.md (R-01, R-02).
Použij skills: `barcode-scanning`, `warehouse-ux-cs`, `gs1-128` (parser a validace), `testing-quality`.

Úkoly:
1. Nejdřív GS1 jádro (čistý Dart, TDD): kontrolní číslice, parser, validace – projdi VŠECHNY vektory z gs1_vectors.json.
2. Rozhraní `ScanSource`, `RawScan`, `CodeType` a `MobileScannerSource` (adaptér); `FakeScanSource` pro testy.
3. `ScanPipeline` kroky 1–5 z docs/03-architektura.md jako čisté funkce + testy (kooldown, filtr formátu, validace EAN, GS1).
4. Obrazovka výběru typu (US-01) a obrazovka skenování (US-02): svítilna, pauza, počítadlo, poslední sken, Vrátit, Ručně.
5. `FeedbackService`: zvuk + vibrace podle tabulky v docs/06-ux-a-ui-pravidla.md (zvuky jako malé assety nebo systémové; ošetři vypnutí).
6. Správa životního cyklu kamery (zámek obrazovky, přepnutí aplikace), oprávnění ke kameře včetně odepřeného stavu.
7. Napiš mi do `docs/field-tests.md` tabulku z docs/08 a řekni, co mám na telefonu vyzkoušet a nafotit.

Akceptace: scénáře US-01 a US-02 splněny; testy zelené; terénní test na ≥ 3 reálných štítcích zapsán (vyplním já).
Zvlášť mi napiš, jak otestovat riziko R-01 (GS separátor) na mém telefonu.

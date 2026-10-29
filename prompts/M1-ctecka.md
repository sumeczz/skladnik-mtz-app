# M1 – Čtečka kódů (web/PWA)

Cíl: výběr typu kódu, kontinuální skenování kamerou, zpětná vazba, ruční zadání a validace podle typu. Ukládání do palet zatím NE (to je M2) – přijaté skeny jsou v M1 pouze v paměti aktivní stránky a po obnovení stránky zmizí.

Přečti: docs/02-uzivatelske-scenare.md (US-01, US-02), docs/06-ux-a-ui-pravidla.md, docs/05-gs1-128-reference.md (§5), docs/09-rizika-a-otevrene-otazky.md (R-01, R-02).
Použij skills: barcode-scanning, warehouse-ux-cs, gs1-128, testing-quality.

## Úkoly
1. GS1 jádro (čistý JavaScript, TDD): kontrolní číslice, parser a validace; projdi všechny vektory z docs/test-vectors/gs1_vectors.json.
2. Rozhraní ScanSource, RawScan, CodeType a CameraScanSource adaptér; FakeScanSource pro testy.
3. ScanPipeline jako čistá funkce/služba: filtr formátu, cooldown, EAN kontrolní číslice, GS1 validace a ochrana před nejednoznačným GS1 bez oddělovače.
4. Obrazovka výběru typu (US-01) a skenování (US-02): svítilna, pauza, počítadlo, poslední sken, Vrátit a Ručně.
5. FeedbackService nebo ekvivalent: zvuk + vibrace, nezávislé vypnutí.
6. Životní cyklus kamery, odepřené oprávnění a rozlišení nepodporovaného prohlížeče.
7. Vytvoř docs/field-tests.md s checklistem a vysvětlením ověření R-01.
8. Automatické testy, build, audit a aktualizace README/CHANGELOG.

## Akceptace
- Typ kódu je povinný před spuštěním.
- Nesouhlasící formát je tiše ignorován.
- 3 s držení stejného kódu vede k jedinému přijatému skenu; jiný kód projde okamžitě.
- Ruční zadání prochází stejnou pipeline.
- EAN-8/EAN-13 kontrolují délku i kontrolní číslici.
- GS1 vektory procházejí; nejednoznačný GS1 bez oddělovače GS je odmítnut.
- npm test, npm run build a npm audit --omit=optional projdou.
- Terénní test na reálných štítcích musí být poctivě označen jako neprovedený, dokud jej uživatel neudělá.

## Test R-01 na telefonu
Na štítku GS1-128 se dvěma proměnlivými poli (např. AI 10 a AI 21) načti kód a ověř, zda mezi hodnotami zůstane ASCII 29 / U+001D. Pokud chybí, aplikace musí kód odmítnout jako nejednoznačný. Unit testy s uměle vloženým GS neprokazují, že skutečná kamera separátor zachová.

# M3 – GS1-128 štítek palety

Cíl: stránka palety zobrazí vykreslený GS1-128 kód (SSCC) s lidsky čitelným textem; nastavení GS1 prefixu; round-trip test.

Přečti: docs/05-gs1-128-reference.md celé, docs/02-uzivatelske-scenare.md (US-04), docs/test-vectors/gs1_vectors.json.
Použij skills: `gs1-128`, `labels-and-export`, `testing-quality`.

Úkoly:
1. `SsccGenerator` (extension, prefix, serial z čítače v DB) – testy ze sscc_build a sscc_build_errors.
2. Nastavení: GS1 Company Prefix (validace 6–12 číslic), extension digit; bez prefixu zablokuj SSCC a nabídni interní režim A/B (§4 reference).
3. Přidělení SSCC při uzavření palety (transakčně, bez opakování; mezery jsou OK).
4. Widget `PalletLabelCode`: vykreslení GS1-128 přes `barcode_widget`. NEJDŘÍV ověř v dokumentaci přesný vstupní formát pro GS1-128 a napiš test; pak implementuj.
5. Stránka palety: kód, lidsky čitelný text, přepínač typu štítku (GS1-128 / Code 128 / QR).
6. Round-trip: aplikace umí naskenovat vlastní vygenerovaný štítek na druhém telefonu nebo z monitoru (typ GS1-128) a výsledek je stejné SSCC. Napiš mi postup zkoušky.

Akceptace: US-04 splněno; všechny GS1 vektory zelené; ruční round-trip zapsán v docs/field-tests.md.

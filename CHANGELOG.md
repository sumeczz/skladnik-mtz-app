# Changelog

Formát: Keep a Changelog; verze aplikace se zatím drží na 0.1.0.

## [Nepublikováno] – M1

### Přidáno
- Výběr osmi typů čárových a 2D kódů před spuštěním čtečky.
- Adaptér kontinuální webové kamery přes ZXing Browser, omezení formátů, svítilna (pokud ji zařízení podporuje), pauza/obnovení a obsluha životního cyklu.
- Ruční zadání se stejnou validací, počítadlo a seznam skenů v paměti relace, vrácení posledního skenu.
- Zvuková a vibrační zpětná vazba s nezávislým vypnutím.
- Validace EAN-8/EAN-13, GS1 AI parser, kontrolní číslice a ochrana před nejednoznačným GS1 bez oddělovače.
- Testy všech GS1 referenčních vektorů a základních pravidel pipeline.
- Dokumentace terénních testů v docs/field-tests.md.

### Omezení / neověřeno
- Skeny se zatím ukládají pouze v paměti stránky; perzistence a dělení palet jsou M2.
- Kamera, torch a skutečné zachování GS (ASCII 29) nebyly ověřeny na fyzickém telefonu.
- Decoder může GS separátor v reálném GS1-128 ztratit; takový vstup nesmí být považován za jednoznačný.

# M4 – Export a historie

Cíl: CSV/JSON/PDF štítek, sdílení, seznam a hledání palet.

Přečti: docs/02-uzivatelske-scenare.md (US-05, US-06), docs/04-datovy-model.md (Export JSON), docs/06-ux-a-ui-pravidla.md.
Použij skills: `labels-and-export`, `warehouse-ux-cs`, `testing-quality`.

Úkoly:
1. `ExportWriter` pro CSV (středník, UTF-8 BOM, CRLF), JSON (kontrakt schema=1), s testy na znaky `ěščřžýáíé`, uvozovky, středníky a řídicí znak GS v datech.
2. PDF štítek 100×150 mm (golden test rozměrů) s kódem, názvem palety, počtem kódů, datem; náhled a tisk přes systémový dialog.
3. Sdílení přes systémové menu; export více palet najednou.
4. Seznam palet: filtr otevřené/uzavřené, hledání podle hodnoty kódu, řazení.
5. Zaznamenávej `label_exported_at` při prvním exportu/tisku štítku.

Akceptace: US-05 a US-06 splněny; CSV otevřu v českém Excelu bez rozbité diakritiky.

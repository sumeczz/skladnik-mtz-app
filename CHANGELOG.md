# Changelog

Formát: Keep a Changelog; verze aplikace se zatím drží na 0.1.0.

## [Nepublikováno] — kompletní registr GS1 AI

### Změněno
- Ručně udržovaný seznam AI byl nahrazen registrem odvozeným z aktuálního veřejného JSON-LD GS1: 541 identifikátorů, včetně jejich formátů, délek, komponent a validace.
- GS1 parser rozděluje pevná a proměnlivá pole podle definice každého AI a GS oddělovače. Nejednoznačné řetězce bez povinného GS odmítá.
- Úspěšně načtený GS1 kód se zobrazuje a ukládá jako `(AI)hodnota(AI)hodnota`; surový obsah zůstává dostupný jako `rawValue`.
- Doplněny testy pro novější AI a počet definic registru.

### Zdroj a hranice podpory
- Registr: GS1 AI JSON-LD, poslední změna v metadatech zdroje 2026-01-26; viz `docs/gs1-application-identifiers.jsonld`.
- GS1 AI není totéž co SAP IDoc, EANCOM nebo zákaznická Z-pole. Tyto integrace vyžadují konkrétní SAP rozhraní a mapování.


## [Nepublikováno] — audit projektu a diagnostika GS1-128

### Opraveno
- Chyba neznámého GS1 AI nyní zobrazí načtená data a poradí přepnout na Code 128, pokud jde o běžný interní kód.
- GS1 parser ořízne bílé znaky před rozpoznáním prefixu symbologie `]C1`.
- Přidány regresní testy pro AI 02 (GTIN obsahu), AI 11 (datum výroby) a AI 37 (počet kusů) a pro běžný Code 128 omylem načtený v režimu GS1-128.
- Přidán skill `project-audit-repair` pro opakovatelný audit a opravy projektu.

### Známá omezení
- Úplná podpora všech GS1 Application Identifiers ani fyzické ověření FNC1/GS na telefonu tímto není potvrzeno.
- Produkční build hlásí velký JavaScript chunk; build ale proběhl úspěšně.


## [Nepublikováno] – M2

### Přidáno
- Trvalé ukládání skenů a palet do IndexedDB, obnova historie a otevřené palety po obnovení aplikace.
- Automatické vytvoření palety, nastavitelná kapacita (výchozí 40 kódů), automatické uzavření při naplnění a vytvoření další palety.
- Ruční uzavření palety, vrácení posledního uloženého skenu a ochrana proti opakovanému kódu na stejné paletě.
- Historie palet, počty skenů a trvalé preference zvuku a vibrací.
- Kamera nyní vizuálně nepoužívá zaměřovací rámeček; dekódování probíhá nad celým obrazem náhledu. Mobilní náhled je vyšší pro pohodlnější skenování.
- Pět testů pro perzistenci palet, duplicity, automatické dělení, undo a ruční uzavření.

### Ověření / omezení
- Automatické testy a produkční build procházejí.
- Fyzický test na telefonu zatím není proveden. Chování kamery, různé orientace štítků a GS separátor je nutné ověřit v terénu.
- Data zůstávají v lokálním IndexedDB bez synchronizace; smazání dat prohlížeče je může odstranit.

## [Nepublikováno] – M1

### Přidáno
- Výběr osmi typů čárových a 2D kódů před spuštěním čtečky.
- Adaptér kontinuální webové kamery přes ZXing Browser, omezení formátů, svítilna (pokud ji zařízení podporuje), pauza/obnovení a obsluha životního cyklu.
- Ruční zadání se stejnou validací, počítadlo a seznam skenů, vrácení posledního skenu.
- Zvuková a vibrační zpětná vazba s nezávislým vypnutím.
- Validace EAN-8/EAN-13, GS1 AI parser, kontrolní číslice a ochrana před nejednoznačným GS1 bez oddělovače.
- Testy GS1 referenčních vektorů a základních pravidel pipeline.

### Omezení / neověřeno
- Kamera, torch a skutečné zachování GS (ASCII 29) nebyly ověřeny na fyzickém telefonu.
- Decoder může GS separátor v reálném GS1-128 ztratit; takový vstup nesmí být považován za jednoznačný.

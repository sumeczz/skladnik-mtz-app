---
name: barcode-scanning
description: Webové skenování čárových a 2D kódů pro Skladník MTZ PWA; výběr typu před skenem, kontinuální režim, cooldown, svítilna, ruční zadání, životní cyklus kamery a oprávnění.
---

# barcode-scanning

Cíl: skenovat kód za kódem bez opakovaného dotyku displeje, pouze zvolený typ, bez zdvojených skenů.

## Technologie
- Webová kamera přes getUserMedia a adaptér CameraScanSource.
- Dekódování přes @zxing/browser; konkrétní formáty nastav pomocí ZXing DecodeHintType.POSSIBLE_FORMATS.
- Doménová validace v src/core/scanning/pipeline.js; kamera nesmí sama rozhodovat o duplicitách ani validitě GS1.
- Testy používají FakeScanSource a Vitest, nikdy skutečnou kameru.
- Kamera i PWA vyžadují HTTPS nebo localhost. Přístup přes file:// nefunguje.

## Povinná pravidla
1. Typ kódu je nutné vybrat před spuštěním. Bez výběru je tlačítko vypnuté.
2. Decoder omezuje povolené formáty podle vybraného typu. GS1-128 používá Code 128 + validaci GS1 obsahu.
3. Po přijetí skenu žádný dialog ani navigace. Potvrzení je krátký zvuk, vibrace a banner.
4. Skeny se v M1 drží pouze v paměti relace. Okamžité trvalé uložení a dělení palet patří do M2.
5. ScanSource abstrahuje kameru a případný budoucí HID skener.
6. Cooldown 800 ms je per hodnota; jiný kód projde okamžitě.
7. Nesouhlasící formát je tiše ignorován; neplatný EAN/GS1 je odmítnut s důvodem.
8. Nejednoznačný GS1-128 bez GS (ASCII 29) se nesmí tiše interpretovat jako platná sekvence AI.
9. Při opuštění stránky, přepnutí aplikace či skrytí karty uvolni kameru. Po návratu může uživatel obnovit stejný vybraný typ.
10. Odepřené oprávnění, chybějící kamera, obsazená kamera a nezabezpečený origin musí dát srozumitelnou chybu, nikoli pád.

## Formáty
- Code 128 / GS1-128 → CODE_128.
- QR → QR_CODE.
- EAN-13 → EAN_13; EAN-8 → EAN_8.
- Code 39 → CODE_39.
- Data Matrix → DATA_MATRIX.
- ITF → ITF.

## GS1-128 a riziko R-01
Decoder může vrátit jen CODE_128; to samo o sobě neznamená GS1. Při GS1 volbě parsuj ]C1 (je-li přítomno), AI a GS separator U+001D. Pokud proměnlivé pole zřejmě následuje další AI bez oddělovače, odmítni vstup jako nejednoznačný. ZXing getRawBytes() jsou surové bajty symbolu, nikoli automaticky čitelný text; nepřeváděj je na text bez protokolu. Skutečné zachování GS ověř na fyzickém štítku a telefonu.

## Testy
- Všechny check_digit, parse_valid a parse_invalid vektory.
- EAN-8/EAN-13 kontrolní číslice.
- Formát mimo výběr se ignoruje.
- Stejný kód v cooldownu je ignorován; jiná hodnota projde.
- Kamera se testuje ručně na telefonu; jednotkové testy používají FakeScanSource.
- Povinný terénní test: 30 kódů v řadě, držení stejného kódu 3 s, pauza/obnovení, zamítnutí kamery a GS separator.

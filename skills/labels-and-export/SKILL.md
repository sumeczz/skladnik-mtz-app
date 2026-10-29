---
name: labels-and-export
description: Vykreslení čárového kódu a štítku palety (GS1-128, Code 128, QR), PDF štítek 100x150 mm, tisk a sdílení, export CSV (český Excel, středník, UTF-8 BOM), JSON a zálohy databáze. Použij vždy, když uživatel chce "vygenerovat kód", "vytisknout štítek", "poslat soubor", "exportovat do Excelu", "uložit paletu jako soubor", "sdílet", nebo když se řeší velikost, kvalita a čitelnost vytištěného kódu, i když neřekne PDF ani CSV.
---

# labels-and-export

Dva výstupy: **štítek** (kód + lidsky čitelný text, pro tisk) a **data** (CSV/JSON pro další zpracování).
GS1 logika patří do `skills/gs1-128`; tady je jen zobrazení, soubory a sdílení.

## Štítek palety

Obsah: název palety („Paleta 0007"), počet kódů, datum a čas uzavření, **čárový kód**, lidsky čitelný text kódu.
Typ kódu štítku je u palety (`label_type`): `gs1_128` (výchozí) | `code128` | `qr`.

### Vykreslení na obrazovce

`barcode_widget` s `Barcode.gs1128()` / `Barcode.code128()` / `Barcode.qrCode()`. Zobraz jen tehdy, když data prošla `Gs1.parse` (u GS1) – jinak chybový stav, ne rozbitý kód.
Zadej explicitní `width`/`height` a bílé pozadí; barevné motivy do kódu nezasahují (černá na bílé i v tmavém režimu aplikace – kód ve vlastním bílém rámečku).

### PDF štítek

Balíček `pdf` (widgety `pw.*`; kód přes `pw.BarcodeWidget`), formát 100 × 150 mm:

```dart
// Náčrt – ověř API ve verzi z pubspec.lock.
final mm = PdfPageFormat.mm;
final format = PdfPageFormat(100 * mm, 150 * mm, marginAll: 5 * mm);
```

Pravidla:
1. Kód v původní velikosti, nikdy nezmenšovat „aby se vešel"; místo toho změň rozložení.
2. Quiet zone ≥ 10 modulů vlevo i vpravo; kód neumisťuj těsně k okraji (tiskárny ořezávají).
3. Lidsky čitelný text pod kódem velikostí ≥ 8 pt, v zápisu `(00)…`.
4. Rozměry kódu orientačně (⚠ ověř v GS1 General Specifications): X-dimenze zhruba 0,495–1,016 mm, výška ≥ 32 mm. Test: vytiskni, naskenuj dvěma různými skenery.
5. Golden test rozměrů stránky a přítomnosti prvků (ne pixel-perfect obsahu kódu).

Tisk: `printing` (systémový dialog / náhled). Tisk na Bluetooth tiskárnu (ZPL) je fáze 2.

## CSV (pro český Excel)

- Oddělovač **středník**, kódování **UTF-8 s BOM** (`EF BB BF`), konce řádků **CRLF**. Důvod: český Excel jinak rozbije diakritiku a čárku bere jako desetinnou.
- Sloupce: `paleta;sscc;poradi;hodnota;typ;cas_skenu;ai_rozpis`
- Hodnota s řídicím znakem GS: v CSV viditelný zápis `<GS>`; `ai_rozpis` obsahuje lidsky čitelný zápis `(01)…(10)…`.
- Uvozovkování podle RFC 4180: pole obsahující `;`, `"` nebo nový řádek se obalí `"…"`, uvnitř se `"` zdvojí.
- Ochrana proti „CSV injection": hodnota začínající `=`, `+`, `-`, `@` se v buňce předřadí apostrofem `'` (kódy ze štítků mohou být nepřátelské), a to jen v CSV, ne v JSON.
- Čas v místním čase se zónou (`2026-10-29 12:05:11+01:00`) nebo UTC ISO; zvol jedno a zdokumentuj.
- Názvy souborů: `paleta-0007_20261029-1205.csv` (bez mezer a diakritiky).

## JSON

Kontrakt `schema: 1` z `docs/04-datovy-model.md`. Řídicí znaky escapuj (`\u001d`). Při změně kontraktu zvyš `schema` a zachovej čtení starých souborů.

## Sdílení

`share_plus` (systémové sdílení souborů): ⚠ API se mezi verzemi měnilo – ověř aktuální volání. Soubory zapisuj do dočasného adresáře (`path_provider`),
po sdílení je nech systému (neukládej do veřejných složek bez vědomí uživatele). Multi-export (více palet) = jeden soubor se sloupcem `paleta`.

## Testy

- CSV: text s `ěščřžýáíé`, středníkem, uvozovkou, novým řádkem, `=SUM(1)` a znakem GS → očekávaný bajtový výstup včetně BOM.
- JSON: round-trip (zapsat → načíst → totéž).
- PDF: rozměr stránky = 100 × 150 mm, přítomnost kódu a textu; soubor se otevře.
- Ruční: otevři CSV v českém Excelu; naskenuj vytištěný štítek.

## Kontrolní seznam

- [ ] Štítek je černobílý, bez stínů; lidsky čitelný text pod kódem.
- [ ] Vytištěný štítek načtený dvěma skenery dává stejnou hodnotu.
- [ ] CSV se v Excelu otevře správně na první dobrou.
- [ ] `label_exported_at` se nastaví při prvním exportu/tisku štítku.
- [ ] Žádná data neopouštějí zařízení bez akce uživatele.

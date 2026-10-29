# 05 – GS1-128 a SSCC: referenční příručka pro projekt

> Tato příručka shrnuje, co agent potřebuje k implementaci. Autoritativní zdroj je **GS1 General Specifications**
> (gs1.org) a poradenství **GS1 Czech Republic**. Hodnoty označené ⚠ ověř v aktuální verzi specifikace,
> než je zabuduješ do produktu. Reference vektory: `docs/test-vectors/gs1_vectors.json`
> (generuje `tools/gs1_reference.py`, ověřeno na veřejně známých příkladech EAN/GTIN).

## 1. Co je GS1-128

GS1-128 je Code 128, který na začátku obsahuje speciální znak **FNC1** a nese data ve struktuře
**Application Identifier (AI) + hodnota**. Příklad lidsky čitelného zápisu: `(01)09501101530003(17)261231(10)LOT-7`.

- Závorky jsou jen v lidsky čitelném textu pod kódem. **Do čárového kódu se nekódují.**
- **Pole s pevnou délkou** (např. AI 00, 01, 11, 17) následuje další AI hned.
- **Pole s proměnlivou délkou** (např. AI 10, 21) se, pokud nejsou poslední, ukončují oddělovačem **FNC1**.
  Ve čteném textu se FNC1 projeví jako řídicí znak **GS (ASCII 29, `0x1D`)**.
- Skenery mohou na začátek přidat **symbology identifier** `]C1` (znamená GS1-128). Parser ho musí umět odříznout.

## 2. AI podporované v MVP

| AI | Význam | Formát | Pozn. |
|---|---|---|---|
| 00 | SSCC – identifikace logistické jednotky (paleta) | 18 číslic, pevná | kontrolní číslice |
| 01 | GTIN obchodní jednotky | 14 číslic, pevná | kontrolní číslice |
| 02 | GTIN obsahu logistické jednotky | 14 číslic, pevná | kontrolní číslice |
| 10 | Číslo šarže | až 20 znaků (alfanum.) | proměnlivá |
| 11 | Datum výroby | YYMMDD | pevná |
| 13 | Datum balení | YYMMDD | pevná |
| 15 | Minimální trvanlivost | YYMMDD | pevná |
| 17 | Datum expirace | YYMMDD | pevná |
| 20 | Varianta produktu | 2 číslice | pevná |
| 21 | Sériové číslo | až 20 znaků | proměnlivá |
| 30 | Počet kusů (variabilní míra) | až 8 číslic | proměnlivá |
| 37 | Počet jednotek v logistické jednotce | až 8 číslic | proměnlivá |
| 240 | Dodatečná identifikace produktu | až 30 znaků | proměnlivá |
| 241 | Číslo dílu u zákazníka | až 30 znaků | proměnlivá |
| 3100–3105 | Čistá hmotnost v kg (poslední číslice = pozice desetinné čárky) | 6 číslic | pevná |
| 400 | Číslo objednávky zákazníka | až 30 znaků | proměnlivá |
| 401 | Číslo zásilky | až 30 znaků | proměnlivá |
| 410 | GLN místa dodání | 13 číslic, pevná | kontrolní číslice |
| 420 | PSČ příjemce (bez země) | až 20 znaků | proměnlivá |
| 421 | PSČ příjemce s kódem země (3 číslice země) | až 12 znaků | proměnlivá |
| 90 | Informace dohodnuté mezi partnery | až 30 znaků | proměnlivá |
| 91–99 | Interní informace firmy | až 90 znaků | proměnlivá |

Neznámý AI není chyba aplikace, ale chyba **validace** (`UNKNOWN_AI`). Chování řídí nastavení: přísně odmítnout / přijmout jako surový Code 128.
Tabulku rozšiřuj podle skutečných štítků, se kterými se ve skladu potkáš (nejdřív přidej vektor, pak AI).

Datumy: `DD = 00` znamená „poslední den v měsíci" (ne chyba). ⚠ Úplnou tabulku AI a pravidla (včetně AI ve 4 číslicích) viz GS1 General Specifications.

Znaková sada hodnot (GS1 „sada 82"): číslice, písmena bez diakritiky a vybrané znaky `! " % & ' ( ) * + , - . / : ; < = > ? _` a mezera.
Znaky jako `^`, `~`, `č`, `ř` nejsou povoleny.

## 3. Kontrolní číslice (mod 10)

1. Vezmi číslice bez kontrolní číslice.
2. Zprava doleva je násob střídavě 3, 1, 3, 1… (poslední číslice payloadu má váhu 3).
3. Součet → `(10 − součet mod 10) mod 10` = kontrolní číslice.

Příklad: payload `400638133393` → kontrolní číslice `1` (EAN-13 `4006381333931`).

## 4. SSCC – jak se skládá

18 číslic: `[extension 1][GS1 Company Prefix + serial reference = 16 číslic][kontrolní číslice 1]`

- **Extension digit** (0–9): volí firma, typicky pro rozlišení typu obalu; v MVP konfigurovatelné, výchozí `0`.
- **GS1 Company Prefix**: přiděluje GS1 Czech Republic, délka bývá 7–10 číslic (⚠ obecně 6–12). Délka prefixu určuje délku serial reference: `16 − délka prefixu`.
- **Serial reference**: pořadové číslo palety doplněné zleva nulami. Musí být unikátní po celou dobu, po kterou se SSCC používá (⚠ GS1 doporučuje nepoužít stejné číslo po dobu minimálně 12 měsíců; rozhodne firma).
- Příklad (z referenčního skriptu): extension `1`, prefix `0614141`, serial `234567890` → `106141412345678908`.
  Prefix `0614141` je **vzorový z dokumentace**; `8591234` použitý ve vektorech je **fiktivní**. Neprodukuj štítky s prefixem, který nepatří tvé firmě.

### Co když firma nemá GS1 Company Prefix

SSCC bez přiděleného prefixu může kolidovat s cizími čísly, pokud kód opustí firmu. Do té doby:

1. **Interní režim A (doporučený):** generuj GS1-128 s interními AI, např. `(91)PAL0000007` nebo `(90)…`. Takový štítek je platný GS1-128, ale **není SSCC** a nesmí opustit firmu jako logistický štítek.
2. **Interní režim B:** prostý Code 128 s hodnotou `PAL-0000007`.
3. Zjisti u vedení / logistiky, zda firma prefix má. Teprve pak zapni SSCC.

Aplikace musí v nastavení zřetelně rozlišit „SSCC (potřebuje GS1 prefix)" a „interní kód".

## 5. Čtení a rozlišení GS1-128 od Code 128

Skenovací knihovny obvykle hlásí formát jen jako `code128`. **GS1-128 se pozná z obsahu**:

1. Hodnota začíná `]C1` (pokud skener/knihovna identifikátor vrací), nebo
2. hodnota se rozparsuje jako sekvence platných AI (kromě těch, co uživatel povolil jako neznámé).

Důsledek: typ „GS1-128" při skenování = čtení formátu Code 128 + `Gs1Codec.parse` musí uspět. Typ „Code 128" přijme cokoliv, co je Code 128.

⚠ **Riziko R-01:** není zaručeno, že knihovna vrátí znak GS (`0x1D`) mezi proměnlivými poli. Pokud jej zahodí, jsou kódy
se dvěma proměnlivými poli nejednoznačné. Doporučená obrana: otestuj knihovnu na reálných štítcích; parser vrací `ambiguous = true`,
pokud proměnlivé pole není poslední a chybí GS; případně pro takové štítky nabídni skenování průmyslovým skenerem (`skills/hardware-scanner/`).
Kód SSCC (jediný AI 00, pevná délka) tímto rizikem **netrpí**.

## 6. Generování (kreslení) kódu

- Balíček `barcode` (Dart) umí GS1-128 (`Barcode.gs1128()`), widget `barcode_widget` ho zobrazí, `pdf` ho umí vložit do PDF.
  ⚠ **Přesný formát vstupních dat** (zda se AI píší v závorkách, jak se zadává FNC1) ověř v dokumentaci verze, kterou použiješ,
  a potvrď golden testem a hlavně **naskenováním vygenerovaného kódu** (round-trip) reálnou čtečkou.
- Vždy zobraz lidsky čitelný text pod kódem: `(00)106141412345678908`.
- Quiet zone ≥ 10 modulů na obou stranách (⚠ GS1: 10X). Nepřitlačuj kód k okraji štítku.
- Orientační rozměry logistického štítku (⚠ ověř v GS1 General Specifications): X-dimenze zhruba 0,495–1,016 mm, výška kódu typicky ≥ 32 mm. Štítek 100×150 mm je běžná velikost pro termotisk.
- Kód musí být čitelný při tisku i na displeji: černá na bílé, bez stínů a barevných gradientů.

## 7. Testování

- Jednotkové testy: celý `gs1_vectors.json` (kontrolní číslice, SSCC, parsování platných i neplatných vstupů).
- Round-trip: `generate(parse(x)) == x` pro všechny platné vektory.
- Reálná zkouška: vytiskni 5 štítků, naskenuj je telefonem v aplikaci a druhým nezávislým skenerem/aplikací; hodnoty musí být stejné.


## 8. Aktuální registr AI a rozdělení polí

Zdroj oficiálních definic: `docs/gs1-application-identifiers.jsonld`, stažený z `https://ref.gs1.org/ai/GS1_Application_Identifiers.jsonld` (údaj `dc:lastModified`: 2026-01-26; licence a upozornění jsou součástí původního souboru). Z něj je vytvořen běhový registr `src/core/scanning/gs1-ai-registry.json` s 541 definicemi AI. Registry nese formát, regulární výraz, komponenty, délky, kontrolní číslice a metadata.

Parser už nepoužívá ručně sestavený krátký seznam. Při čtení element stringu vybírá nejdelší platný prefix AI (4, 3 nebo 2 číslice), pro pole s pevnou délkou přečte přesný počet znaků a pro pole s proměnlivou délkou čte do GS (ASCII 29) nebo do konce dat. Pokud po proměnlivém poli nelze bezpečně určit hranici dalšího AI bez GS, odmítne řetězec jako nejednoznačný, místo aby tiše slil hodnoty.

Po úspěšném skenu se hodnota ukládá a zobrazuje v čitelném tvaru `(AI)hodnota(AI)hodnota...`; původní dekódovaný řetězec zůstává v `rawValue` a normalizovaný element string v `gs1.elementString`. Závorky jsou zobrazovací formát, nejsou doslovně vloženy do čárového kódu.

**SAP poznámka:** tento registr pokrývá aktuální veřejný registr GS1 AI. Neznamená automaticky podporu každého SAP IDoc/EANCOM/GS1 XML mapování, interních Z polí ani konkrétního SAP customizingu. Ty závisejí na konkrétním procesu a verzi SAP; standardní GS1 parser nemůže hádat proprietární pole.

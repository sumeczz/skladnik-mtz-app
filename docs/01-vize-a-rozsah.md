# 01 – Vize a rozsah

## Vize

Skladník MTZ naskenuje kódy zboží, aniž by se musel dotýkat displeje po každém kódu. Aplikace sama
rozdělí kódy na palety, každou paletu označí jednoznačným GS1-128 kódem (SSCC) a nabídne štítek nebo export.

## Uživatel

Skladník v materiálně-technickém zásobování. Pracuje často v rukavicích, jednou rukou, v proměnlivém světle,
na hlučném místě, pod časovým tlakem. Chyba (zdvojený nebo ztracený sken) znamená dohledávání na paletě.

## Cíle MVP (v pořadí důležitosti)

1. Spolehlivé kontinuální skenování vybraného typu kódu kamerou telefonu.
2. Nic se neztratí: okamžité ukládání, přežije pád a vybití baterie.
3. Automatické dělení na palety po N kódech bez přerušení skenování.
4. Stránka palety s kódy a vygenerovaným GS1-128 (SSCC) kódem.
5. Export a sdílení (CSV, JSON, PDF štítek).

## Mimo rozsah MVP

Přihlášení a účty, synchronizace s ERP/WMS, cloud, více uživatelů, správa zásob, tisk přes Bluetooth tiskárnu
(ZPL), integrace průmyslových skenerů (fáze 2), iOS vydání, hlasové ovládání.

## Měřitelná kritéria úspěchu

| Metrika | Cíl |
|---|---|
| Čas od zamíření kamery na čitelný kód po uložení | ≤ 1 s na běžném telefonu |
| Ztracené skeny po násilném ukončení aplikace | 0 |
| Zdvojené skeny při držení kamery na kódu | 0 (kooldown + pravidla duplicit) |
| Počet doteků na jeden kód při kontinuálním skenování | 0 |
| Spuštění aplikace → první sken | ≤ 3 doteky (typ kódu, start) |

## Výchozí předpoklady (uživatel je může změnit)

Zadání nechává otevřené body. Dokud uživatel neřekne jinak, platí tyto výchozí hodnoty:

| # | Otevřená otázka | Výchozí předpoklad |
|---|---|---|
| 1 | Na čem aplikace poběží? | Android telefon s kamerou. Průmyslový skener je fáze 2. |
| 2 | Má firma GS1 Company Prefix (od GS1 Czech Republic)? | Neznámo. Prefix je v nastavení; bez něj je generátor SSCC zablokovaný a nabídne se interní režim (viz `docs/05-gs1-128-reference.md`). |
| 3 | Co má GS1-128 kód palety obsahovat? | SSCC (AI 00). Alternativy: interní GS1-128 s AI 10/21/90, nebo prostý Code 128. |
| 4 | Kapacita palety | N = 3 (konfigurovatelné 1–999, nebo „bez limitu / uzavírat ručně"). |
| 5 | Duplicity | Stejný kód se podruhé nepřidá; aplikace upozorní a nabídne „přidat přesto". Rozsah kontroly: všechny uložené skeny. |
| 6 | Export | CSV (středník, UTF-8 s BOM pro český Excel), JSON, PDF štítek 100×150 mm, sdílení přes systémové menu. |
| 7 | Pojmenování palet | „Paleta 0001, 0002 …" (průběžné číslo zařízení) + volitelná poznámka. |
| 8 | Který typ je výchozí při otevření výběru? | Naposledy použitý je předvybraný, ale skenování startuje až po explicitním potvrzení. |

Až uživatel odpoví, aktualizuj tuto tabulku a případně ADR.

# Terénní testy M1 – čtečka

Stav k 2026-10-29: automatické testy lze provádět v Node.js. Terénní testy na fyzickém telefonu **neprovedeny**; vyplní uživatel po otevření aplikace přes HTTPS nebo localhost na telefonu.

| Datum | Telefon / OS | Typ / štítek | Výsledek | Medián odezvy | Poznámka / foto |
|---|---|---|---|---|---|
| — | — | EAN-13 | Neprovedeno | — | — |
| — | — | Code 128 | Neprovedeno | — | — |
| — | — | QR | Neprovedeno | — | — |
| — | — | GS1-128 se dvěma proměnlivými poli | Neprovedeno | — | Ověřit GS (ASCII 29), riziko R-01 |
| — | — | 30 kódů bez doteku | Neprovedeno | — | Ověřit kontinuální režim |
| — | — | Zámek obrazovky / návrat | Neprovedeno | — | Ověřit uvolnění a obnovu kamery |

## Test R-01 – GS separátor

1. Na štítku GS1-128 použij data se dvěma proměnlivými poli, například AI 10 (šarže) a AI 21 (sériové číslo).
2. Zvol v aplikaci **GS1-128** a načti kód.
3. Zkopíruj hodnotu do textového editoru nebo prohlédni testovací výpis: mezi poli musí být znak GS s kódem U+001D (ASCII 29), ne pouhá mezera.
4. Pokud chybí, aplikace má nejednoznačný obsah odmítnout. Nepoužívej takový výsledek pro skladovou evidenci; zkus průmyslový skener/HID.
5. Výsledek zapiš výše. Tento test nelze nahradit unit testem s uměle vloženým GS.

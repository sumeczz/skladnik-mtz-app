---
name: gs1-128
description: Práce s GS1-128, SSCC a Application Identifiers – parsování načtených kódů (AI, GS separátor, ]C1), validace (kontrolní číslice mod 10, datumy, délky, znaková sada), sestavení SSCC (extension digit, GS1 Company Prefix, serial reference) a generování/vykreslení GS1-128 kódu palety. Použij vždy, když se objeví GS1, GS-128, GS128, SSCC, EAN-128, AI/Application Identifier, kontrolní číslice, "kód palety", "štítek palety", nebo když se rozhoduje, zda je načtený Code 128 vlastně GS1-128, i když uživatel píše jen "gs128".
---

# gs1-128

Jediná implementace GS1 parsování je v `src/core/scanning/pipeline.js`; kamera a UI ji pouze volají. Projekt je JavaScript/Vite PWA, nikoli Flutter/Dart.

## Postup při změně
1. Přečti `AGENTS.md`, `docs/05-gs1-128-reference.md`, `docs/test-vectors/gs1_vectors.json` a `docs/field-tests.md`.
2. Přidej regresní test do `tests/scanning.test.js` před změnou parseru.
3. Spusť `npm test`, `npm run build`, `python tools/gs1_reference.py --selftest` a `npm audit --omit=optional`.
4. Ověř na konkrétním štítku surový dekódovaný obsah; nezaměňuj běžný Code 128 za GS1-128 jen proto, že oba používají CODE_128 symbologii.

## Závazná pravidla
- GS1-128 je Code 128 s FNC1 na začátku; následné dekódování má identifikovat GS1 data. Symbology identifier `]C1` se může objevit v dekódovaném textu.
- Proměnlivá pole (například AI 10, 21, 37) jsou oddělená GS (`U+001D`, ASCII 29), pokud za nimi následuje další pole. Na konci řetězce oddělovač potřeba není.
- Závorkový zápis `(02)...(11)...(37)...` je lidsky čitelná reprezentace, nikoliv doslovný obsah zakódovaný do symbolu.
- AI 02 je GTIN obsahu (14 číslic), AI 11 datum výroby (YYMMDD) a AI 37 počet kusů (proměnná délka do 8 číslic). Kontrolní číslice GTIN musí sedět.
- Neznámé AI nesmí být potichu přijato. Chybová zpráva má zobrazit surový načtený obsah a poradit ověřit, zda uživatel nezvolil GS1-128 pro běžný Code 128.
- Nesmí se tvrdit úplná podpora všech AI bez úplné ověřené tabulky a testů.
- Fyzický sken, zachování FNC1/GS a round-trip vytištěného štítku se považují za ověřené pouze po skutečné zkoušce na zařízení.

## Kontrolní seznam
- [ ] Referenční vektory GS1 procházejí.
- [ ] AI 02, 11 a 37 z paletního štítku jsou pokryté regresním testem.
- [ ] Proměnná pole bez GS mezi poli jsou odmítnuta jako nejednoznačná.
- [ ] Běžný Code 128 v režimu GS1-128 zobrazí dekódovaný obsah a vysvětlení, ne obecnou slepou chybu.
- [ ] `npm test`, `npm run build` a GS1 selftest proběhly.
- [ ] Terénní test je zaznamenán v `docs/field-tests.md`, nebo výslovně označen jako neprovedený.

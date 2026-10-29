# Původní zadání (od uživatele, beze změny)

> Chci vytvořit mobilní aplikaci pro moji práci (Skladník MTZ). Začneme například čtečkou čárových kódů –
> s možností neustálého skenování (Code-128, QR, GS-128 … a uživatel si před skenováním musí vybrat
> konkrétní typ kódu) a s možností ukládání naskenovaných kódů (s možností automaticky rozdělit
> naskenované kódy například po 3 kódech – uživatel neustále skenuje a každé 3 kódy vytvoří nový soubor
> (jakoby paletu), ke které ty kódy patří. Ta stránka s kódy by mohla umět generovat automaticky GS-128
> kód (popř. jiný).

Požadavek na přípravu projektu: navrhnout všechny skills pro takový projekt (případně napsat vlastní
na míru), `AGENTS.md` a další soubory pro agenta (např. ChatGPT) a vše zabalit do zipu.

## Jak jsme zadání vyložili

| Formulace v zadání | Výklad v projektu |
|---|---|
| „neustálé skenování" | Kontinuální režim: kamera běží, po každém úspěšném skenu se nic nezavírá. |
| „uživatel si před skenováním musí vybrat konkrétní typ kódu" | Povinný krok před spuštěním kamery; kamera hledá jen zvolený typ. |
| „ukládání naskenovaných kódů" | Lokální databáze v telefonu, okamžité ukládání každého skenu. |
| „každé 3 kódy vytvoří nový soubor (paletu)" | Paleta = skupina kódů s kapacitou N (konfigurovatelné, výchozí 3). Po N-tém skenu se paleta uzavře a otevře se nová. „Soubor" = záznam palety v DB, exportovatelný do CSV/JSON/PDF. |
| „GS-128" | GS1-128 (dříve UCC/EAN-128): Code 128 s datovou strukturou GS1 (Application Identifiers). |
| „generovat automaticky GS-128 kód" | Na stránce palety se zobrazí kód GS1-128; výchozí obsah je SSCC (AI 00) identifikující paletu. |

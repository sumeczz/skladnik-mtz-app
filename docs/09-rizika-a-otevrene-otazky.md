# 09 – Rizika a otevřené otázky

| ID | Riziko | Dopad | Pravděpodobnost | Opatření |
|---|---|---|---|---|
| R-01 | ZXing nebo prohlížeč nevrátí separátor GS (0x1D) mezi proměnlivými poli GS1-128 | Dvě proměnlivá pole se slijí; chybná data | Střední (⚠ ověřit na reálné knihovně a zařízení) | Test na reálných štítcích v M1; parser odmítne rozpoznatelně nejednoznačný vstup; pro SSCC (pevná délka) bez rizika; fáze 2: průmyslový skener |
| R-02 | Knihovna nerozliší Code 128 a GS1-128 | Špatné roztřídění typu | Vysoká (obvyklé) | Typ „GS1-128" = Code 128 + úspěšný `Gs1Codec.parse`; zdokumentováno |
| R-03 | Firma nemá GS1 Company Prefix | SSCC nelze legitimně vydávat | Neznámá | Interní režim A/B (`docs/05-gs1-128-reference.md` §4); nepovolit „SSCC" bez prefixu |
| R-04 | Kolize SSCC při použití více telefonů | Dvě palety se stejným číslem | Nízká (dnes 1 zařízení) | Čítač v DB; při více zařízeních rozdělit rozsahy serial reference per zařízení (ADR před nasazením) |
| R-05 | Ztráta dat při pádu / vybití | Ztracené skeny | Střední | Okamžitá transakce při každém skenu; test obnovy; nic nedržet jen v paměti |
| R-06 | Slabý výkon kamery na starém telefonu | Pomalé čtení, frustrace | Střední | Měřit; nastavit rozlišení a `detectionTimeoutMs`; svítilna; scan window; průmyslový skener |
| R-07 | Velikost JavaScript dekodéru a výkon na starších telefonech | Pomalé nebo neúspěšné dekódování na starším zařízení | Nízká–střední | Měřit velikost bundle a rychlost na cílovém telefonu; dekodér běží v prohlížeči bez Google Play Services |
| R-08 | Nesprávné rozměry nebo kvalita štítku → nečitelné u partnera | Reklamace, zdržení | Střední | Terénní test s nezávislým skenerem; tisk v 300 dpi+; dodržet quiet zone; ověřit podle GS1 |
| R-09 | Změna API balíčků (@zxing/browser, @zxing/library, Vite) | Rozbité sestavení | Střední | Zamykat verze v package-lock.json; upgrady jako samostatné úkoly s testy |
| R-10 | Uživatel (ne-vývojář) si neporadí s ladicími chybami | Zastavení projektu | Střední | Agent dává konkrétní příkazy, vysvětluje chyby česky, pracuje v malých krocích |
| R-11 | Datová ochrana (kódy mohou obsahovat obchodní informace) | Únik | Nízká | Offline; export jen na pokyn uživatele; nedávat do cloudu bez rozhodnutí |

## Otevřené otázky pro uživatele

1. Jaký telefon / OS máš ve skladu (Android verze, model)? Máš nebo plánuješ průmyslový skener?
2. Má firma GS1 Company Prefix? Jaké štítky dnes na paletách používáte (SSCC, vlastní)?
3. Jaké kódy reálně skenuješ nejčastěji (zboží, paletové štítky, lokace regálů)? Pošli fotku 3–5 reálných štítků (bez citlivých dat).
4. Kam mají naskenovaná data putovat dál (papír, e-mail, Excel, ERP)?
5. Smí být do telefonu nainstalována aplikace mimo Google Play (APK)? Spravuje telefony firma?
6. Chceš tisknout štítky z telefonu? Jakou tiskárnu máte?

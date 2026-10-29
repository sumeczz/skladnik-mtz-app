---
name: warehouse-ux-cs
description: UX a UI pravidla pro aplikace používané ve skladu – ovládání jednou rukou a v rukavicích, velké dotykové cíle, zpětná vazba zvukem a vibrací, vysoký kontrast, nepřerušované skenování, srozumitelné české texty a lokalizace (ARB), přístupnost. Použij vždy, když se navrhují nebo upravují obrazovky, tlačítka, banner, texty chyb, zvuky, vibrace, barvy nebo když uživatel píše, že je něco "malé", "nepřehledné", "zdržuje" nebo "musím to mačkat", i když neřekne UX.
---

# warehouse-ux-cs

Uživatel je skladník: rukavice, jedna ruka, špatné světlo, hluk, spěch. Dobré UX tady znamená **méně doteků a jistota bez pohledu na displej**.
Podrobné obrazovky, tabulku signálů a texty najdeš v `docs/06-ux-a-ui-pravidla.md` – tento skill je pracovní postup a kontrola.

## Principy (a proč)

1. **Nula doteků na jeden kód.** Každý dotek navíc se násobí stovkami skenů denně.
2. **Feedback, který nevyžaduje pohled na displej:** zvuk + vibrace nesou význam (přijato / duplicita / chyba / paleta uzavřena). Displej jen potvrzuje.
3. **Barva nikdy sama.** Vždy ikona + text + barva (rukavice, odlesky, barvoslepost).
4. **Cíle ≥ 56 dp** u hlavních akcí; mezi tlačítky dost místa, aby se netrefila sousední akce rukavicí.
5. **Žádné modální dialogy v toku skenování.** Dialog jen u destruktivní akce (smazání). Chyby jsou banner s akcí.
6. **Nejdůležitější informace velké:** počítadlo palety (např. 2/3) a poslední kód čitelné z ~50 cm.
7. **Stav je vždy vidět:** který typ kódu, zda kamera běží, číslo a stav palety.

## Při návrhu obrazovky projdi

- [ ] Co je hlavní akce a je největší?
- [ ] Dá se obrazovka obsloužit jedním palcem (dolní polovina displeje)?
- [ ] Co se stane při chybě a je to srozumitelné bez čtení dlouhého textu?
- [ ] Funguje při písmu systému 130 % bez zalomení a přetečení?
- [ ] Funguje na slunci i v šeru (kontrast ≥ 4,5:1, vysoký kontrast jako výchozí)?
- [ ] Zachová stav při otočení a návratu z pozadí?

## Texty (čeština)

- Krátké, činné, bez zkratek navíc. Imperativ místo „Prosím…": „Povol kameru v nastavení."
- Chybová hláška řekne **co se stalo a co s tím**: „Neplatná kontrolní číslice. Zkus kód naskenovat znovu."
- Čísla formátuj podle místního nastavení (`intl`), data `d. M. yyyy H:mm`.
- Žádný text natvrdo v kódu: ARB klíče (`app_cs.arb`, volitelně `app_en.arb`). Pojmenování klíčů: `<oblast><Význam>` (`scanDuplicate`, `palletClosed`).
- Množné číslo přes ICU: `{count, plural, one{{count} kód} few{{count} kódy} other{{count} kódů}}` (čeština má tvary 1 / 2–4 / 5+).
- Nepoužívej vykřičníky ani humor v chybových stavech.

Ukázka ARB:

```json
{
  "palletClosed": "Paleta {number} uzavřena ({count}/{capacity})",
  "@palletClosed": { "placeholders": { "number": {"type": "String"}, "count": {"type": "int"}, "capacity": {"type": "int"} } },
  "codesCount": "{count, plural, one{{count} kód} few{{count} kódy} other{{count} kódů}}",
  "@codesCount": { "placeholders": { "count": {"type": "int"} } }
}
```

## Zvuk a vibrace

- Zvuky jako krátké assety (< 300 ms), přehrávané s nízkou latencí (`audioplayers`, režim nízké latence; ověř API verze). Vibrace přes `HapticFeedback` (jednoduché) nebo balíček `vibration` (vlastní vzory) – podle tabulky v `docs/06-ux-a-ui-pravidla.md`.
- Zvuk a vibrace lze vypnout nezávisle. Ztlumený telefon nesmí způsobit, že chyba zůstane bez signálu – displej ji pořád ukáže.
- Latence signálu od přijetí skenu ≤ 100 ms; signál se nepřehrává pro ignorované detekce (kooldown, nesprávný formát).

## Téma

- Výchozí vysoký kontrast; stavové barvy: zelená přijato, oranžová varování, červená chyba, modrá informace.
- Čárový kód se vždy kreslí černou na bílé (i v tmavém režimu).
- Obrazovka při skenování nezhasíná (`wakelock_plus`), po opuštění se vrací do normálu.

## Přístupnost

`Semantics` u ikon a stavů (čtečka obrazovky), dostatečné kontrasty, podpora zvětšení písma, žádná informace jen barvou nebo jen zvukem.

## Časté chyby

- Malá tlačítka vedle sebe v dolní liště.
- „Úspěšně načteno" jako dialog s tlačítkem OK.
- Červená/zelená bez ikony.
- České texty v kódu místo ARB; ruční skloňování místo ICU plural.

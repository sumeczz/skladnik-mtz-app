# 08 – Testovací strategie

## Pyramida testů

| Úroveň | Co | Nástroj | Kde |
|---|---|---|---|
| Jednotkové | GS1, kontrolní číslice, parser, validátory, cooldown | Vitest | tests/ |
| Repozitáře | IndexedDB transakce, schéma a migrace | Vitest + fake-indexeddb | tests/storage.test.js |
| Pipeline | výběr formátu, EAN, GS1, ruční vstup, FakeScanSource | Vitest | tests/scanning.test.js |
| Integrační | výběr typu → sken → feedback → seznam | prohlížeč / budoucí automatizace | manuální + budoucí testy |
| Terén | skutečné štítky, telefon, světlo, kamera | checklist | docs/field-tests.md |

## Automatické testy M1

- Všechny položky check_digit, parse_valid a parse_invalid v docs/test-vectors/gs1_vectors.json.
- EAN-13/EAN-8: délka a kontrolní číslice.
- Formát mimo výběr se tiše ignoruje.
- Cooldown 800 ms je per hodnota; jiné hodnoty projdou bez čekání.
- GS separator U+001D se zachová v parseru; rozpoznatelně nejednoznačné GS1 bez separatoru je odmítnuto.
- FakeScanSource emituje pouze při spuštění a podporuje pauzu/obnovení.

## Povinné terénní testy

Vyplň docs/field-tests.md. Testy níže jsou dosud neprovedené, dokud je někdo neověří na fyzickém telefonu:

| Situace | Co ověřit |
|---|---|
| Čistý štítek, 20 cm, dobré světlo | správná hodnota |
| Rukavice / 40 cm / slabé světlo | použitelnost |
| Poškrábaný nebo lesklý štítek | spolehlivost |
| Kód na jiném displeji | detekce |
| GS1-128 se dvěma proměnlivými poli | zachování GS (ASCII 29 / U+001D) |
| 30 kódů za sebou bez doteku | kontinuální režim |
| Držení stejného kódu 3 sekundy | jen jeden přijatý sken |
| Pauza, skrytí karty, návrat z hovoru | kamera se uvolní a obnoví |
| Odepřené oprávnění kamery | srozumitelná chyba, žádný pád |
| Svítilna | funguje na podporovaném telefonu |

Měř čas „kód v záběru → potvrzovací signál“ alespoň 10× a zapiš medián. Automatické testy nedokazují rychlost kamery ani zachování GS.

## Příkazy

```powershell
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
```

Před každým milníkem musí automatické testy a build projít. Před vydáním je povinný terénní test a kontrola dat po násilném ukončení aplikace.

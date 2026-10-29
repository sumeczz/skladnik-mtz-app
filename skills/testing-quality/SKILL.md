---
name: testing-quality
description: Testování webové PWA Skladník MTZ: Vitest, fake-indexeddb, FakeScanSource, GS1 vektory, integrační a terénní testy reálných štítků.
---

# testing-quality

Dvě vrstvy jistoty: automatické testy (rychlé a opakovatelné) a terénní testy (reálné štítky a telefon). Jedna nenahrazuje druhou.

## Pravidla
1. Piš testy pro GS1 a pravidla palet před implementací.
2. Pro skenování používej FakeScanSource, nikdy skutečnou kameru v automatických testech.
3. Referenční vektory docs/test-vectors/gs1_vectors.json jsou smlouva; neupravuj je ručně.
4. Ověřeno není totéž co předpokládáno. Vždy uveď, co bylo skutečně spuštěno.
5. Rychlost měř, neodhaduj; „kód v záběru → vibrace“ změř alespoň 10×.

## Co testovat
| Oblast | Test |
|---|---|
| GS1 | všechny vektory, kontrolní číslice, platná/neplatná data a zachování GS |
| Pipeline | špatný formát, cooldown, EAN, neplatný/nejednoznačný GS1 |
| Kamera | terénní test; oprávnění, torch, pause/resume a skrytí karty |
| Palety (M2) | hranice N, atomicita, SSCC unikátnost, undo a obnova |
| Export (M4) | CSV/JSON/PDF a bezpečné kódování dat |

## Příkazy
```powershell
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
```

## Terénní testy
Vyplňuj docs/field-tests.md. Před vydáním ověř R-01 (GS separátor u GS1-128 se dvěma proměnlivými poli), round-trip, 30 kódů bez doteku a obnovu po přerušení. Pokud fyzický telefon není dostupný, výslovně napiš „neprovedeno“.

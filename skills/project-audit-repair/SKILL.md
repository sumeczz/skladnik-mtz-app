---
name: project-audit-repair
description: Komplexní kontrola, úklid a opravy celého projektu Skladník MTZ před změnou, po chybě nebo před nasazením. Spouštěj při žádosti o audit, vyčištění, opravu celého projektu, stabilizaci či release.
---

# Project audit and repair

## Cíl
Zlepšovat existující offline-first JavaScript/Vite PWA bez přepisování architektury a bez přidávání zbytečných závislostí. Zachovat skladová data, zavedené workflow a české UI. Každé tvrzení o opravě musí odpovídat ověřenému výsledku.

## Postup
1. Přečti `AGENTS.md`, `docs/07-roadmapa.md`, `CHANGELOG.md` a relevantní skill. Zkontroluj `git status`, poslední commity a lokální změny; nikdy je nepřepisuj ani neodstraňuj.
2. Proveď výchozí měření: `npm test`, `npm run build`, `npm audit --omit=optional`, `python tools/gs1_reference.py --selftest`, `git diff --check`. Výsledky a chyby odděl od sebe.
3. Projdi strukturu, závislosti a konfiguraci (`package.json`, Vite, PWA/service worker, IndexedDB/migrace, skenovací pipeline, GS1 parser, palety, exporty, UI, přístupnost, dokumentaci). Hledej zastaralé instrukce, nepoužívaný kód, nekonzistentní definice a nejasné chyby uživateli.
4. Zvol konkrétní nejmenší opravy s největším dopadem. Neprováděj hromadné formátování, přepis architektury ani upgrade balíčků bez důkazu, že je potřebný. Před změnou datové logiky napiš regresní test.
5. U čárových kódů rozlišuj symbologii od obsahu: Code 128 samo o sobě neznamená GS1-128. GS1-128 vyžaduje platná GS1 pole, zachování FNC1/GS (ASCII 29) mezi proměnnými poli a správnou kontrolu délky, kontrolních číslic a dat. Nikdy automaticky nepřeklasifikuj neznámý obsah na platné GS1.
6. Ověř konkrétní reálné/přiložené příklady jako testy. Při chybě uveď dekódovaný obsah a srozumitelnou cestu k nápravě; neoznačuj validní data za chybná bez reprodukce.
7. Po změně spusť znovu všechny výchozí kontroly. Zkontroluj diff, nechtěné změny souborů, build artefakty a stav Git. Aktualizuj dokumentaci/CHANGELOG, pokud se mění chování.
8. Před nasazením zkontroluj diff, commituj Conventional Commits, pushuj jen po kontrole a ověř CI/Pages deployment. Push není totéž co nasazení.
9. Terénní kamerové testy, offline chování a fyzické štítky označ jako neprovedené, dokud nejsou skutečně vyzkoušené na zařízení.

## Příkazy
```powershell
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
git diff --check
git status --short --branch
```

## Definition of done
- Každá oprava má regresní test nebo zdůvodnění, proč test není možný.
- Všechny dostupné kontroly jsou spuštěné; selhání a varování jsou výslovně uvedeny.
- Žádná neověřená tvrzení o kamerách, offline režimu nebo produkčním nasazení.
- Zachované uživatelské změny a lokální skladová data; diff je úzký a kontrolovatelný.
- Dokumentace odpovídá aktuálnímu JavaScript/Vite projektu, ne starému Flutter/Dart návrhu.

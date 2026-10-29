# M0 – Základ webové aplikace

Cíl: vytvořit spustitelnou mobilní webovou aplikaci ve standardním HTML/CSS/JS. M0 neimplementuje vlastní čtečku ani kompletní workflow palet; přichystá kvalitní shell, PWA a bezpečný základ úložiště.

Přečti `AGENTS.md`, `docs/03-architektura.md`, `docs/04-datovy-model.md`, `docs/decisions/ADR-0001-technologie.md` a `skills/project-bootstrap/SKILL.md`.

## Úkoly
1. Zkontroluj Node.js/npm a připrav npm projekt s Vite, Vitest a fake-indexeddb. Použij aktuální kompatibilní verze a zkontroluj npm audit.
2. Vytvoř responsivní českou domovskou stránku s hlavní akcí Skenovat, přehledem, navigací a jasnými placeholdery pro funkce M1/M2.
3. Zaveď IndexedDB `skladnik-mtz`, verze schématu 1, se store `pallets`, `scans`, `counters` a `settings`. Přidej unikátní index UUID a pořadí skenu v paletě.
4. Implementuj pomocnou vrstvu pro otevření DB, načtení a zápis nastavení a přečtení základního přehledu. Nesmí odesílat data mimo zařízení.
5. Vytvoř manifest a service worker pro offline cache statického shellu; zaregistruj service worker jen v produkčním buildu. Připrav SVG ikonu.
6. Přidej testy úložiště: otevření schématu, existence store, zápis/čtení nastavení a souhrn palet.
7. Zkopíruj nebo referencuj `docs/test-vectors/gs1_vectors.json`; samotná GS1 implementace patří do pozdější samostatné vrstvy a testů.
8. Aktualizuj ADR-0001, architekturu, roadmapu, pokyny agenta, README a CHANGELOG. Odstraň staré příkazy Flutter/Dart z aktivních instrukcí.
9. Spusť `npm test`, `npm run build`, `npm audit --omit=optional` a `python tools/gs1_reference.py --selftest`.

## Akceptace
- `npm test` prochází.
- `npm run build` vytvoří výstup ve `dist/`.
- Audit ve scope `--omit=optional` nehlásí známé zranitelnosti.
- IndexedDB má všechny čtyři store a základní testy.
- Responzivní domovská stránka má české texty a velké dotykové cíle.
- PWA manifest i service worker jsou přítomné. Offline provoz a instalace je třeba výslovně ověřit přes prohlížeč; build sám tento test nenahrazuje.
- Zápis skladových dat mimo zařízení nikde neprobíhá.

## Výstup
Na konci stručně popiš, co změnilo, příkazy k lokálnímu spuštění a co je zatím neověřeno na reálném telefonu.
# Changelog

Formát: Keep a Changelog; verze aplikace se zatím drží na 0.1.0.

## [Nepublikováno] – M0

### Přidáno
- Základní mobilní webový shell v HTML/CSS/JavaScriptu s responzivní domovskou obrazovkou.
- Vite, Vitest a fake-indexeddb.
- IndexedDB verze 1 se store `pallets`, `scans`, `counters`, `settings`.
- Zápis/čtení nastavení a základní přehled počtu palet.
- PWA manifest, SVG ikona a service worker pro aplikační shell.
- Automatické testy pro DB schéma, nastavení a přehled.

### Změněno
- Technologie projektu převedena z Flutter/Dart na HTML/CSS/JavaScript PWA dle požadavku.
- ADR-0001, AGENTS.md, architektura, datový model, roadmapa, M0 prompt, bootstrap skill a README aktualizovány.

### Zatím nehotovo / neověřeno
- Tlačítko Skenovat je placeholder; reálná kamera a dekódování kódů jsou M1.
- Instalace a skutečný offline režim PWA nebyly ověřeny na fyzickém telefonu.
- Historie palet, atomické dělení, GS1 parser, generování SSCC a export jsou pozdější milníky.
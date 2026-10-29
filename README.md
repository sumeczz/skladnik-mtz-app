# Skladník MTZ – mobilní webová aplikace

Offline-first PWA pro skladníka: kontinuální skenování čárových kódů, trvalé ukládání do palet, automatické dělení podle limitu, kontrola duplicit a GS1-128/SSCC workflow. Technologie: HTML, CSS, JavaScript ES modules, Vite, IndexedDB a Vitest.

## Spuštění
Vyžaduje Node.js a npm.

```powershell
npm install
npm run dev
```

Vite vypíše lokální adresu, typicky http://localhost:5173. Pro telefon ve stejné síti lze použít `npm run dev -- --host 0.0.0.0`; kamera na jiném zařízení vyžaduje HTTPS origin.

## Kontroly
```powershell
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
```

## Stav milníků
- M0: responzivní shell, IndexedDB schema v1, manifest, service worker.
- M1: osm typů kódů, ZXing kamera, ruční zadání, EAN/GS1 validace a cooldown. Kamera a skutečné GS separátory čekají na terénní ověření.
- M2: skeny a palety se ukládají do IndexedDB; automatické uzavření při naplnění, nastavitelná kapacita (výchozí 40), ruční uzavření, vrácení posledního skenu, kontrola duplicit v aktivní paletě, historie a obnova po restartu. Preference zvuku a vibrací jsou trvalé.
- Zaměřování: není vykreslen výřez/reticle; dekodér pracuje s celým obrazem kamery. Náhled je na mobilu vysoký přibližně 58 % výšky obrazovky.

## Omezení
- Data zůstávají pouze v tomto prohlížeči/zařízení; není k dispozici cloud ani synchronizace.
- Kamera, torch a zachování GS (ASCII 29) musí být ověřeny na fyzickém telefonu; checklist je v `docs/field-tests.md`.
- Kamera a service worker vyžadují HTTPS nebo localhost.
- Kapacita se nastavuje v sekci Palety; změna limitu se uplatní při dalším skenu. Data z prohlížeče se mohou ztratit při vymazání úložiště/aplikačních dat.

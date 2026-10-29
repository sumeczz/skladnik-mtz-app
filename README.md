# Skladník MTZ – mobilní webová aplikace

Offline-first PWA pro skladníka: kontinuální skenování čárových kódů, automatické dělení skenů na palety a generování GS1-128/SSCC štítků. Technologie: HTML, CSS, JavaScript ES modules, Vite, IndexedDB a Vitest.

## Spuštění
Vyžaduje Node.js a npm.

```powershell
npm install
npm run dev
```

Vite vypíše lokální adresu, typicky http://localhost:5173. Pro telefon ve stejné síti lze použít npm run dev -- --host 0.0.0.0; kamera na jiném zařízení vyžaduje HTTPS origin.

## Kontroly
```powershell
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
```

## Stav milníků
- M0: responzivní shell, IndexedDB schema v1, manifest, service worker.
- M1: výběr osmi typů kódů, ZXing kamera, ruční zadání, EAN/GS1 validace, cooldown a dočasný seznam skenů.
- M2: ukládání skenů do IndexedDB, palety a atomické dělení po N.

## Omezení
- V M1 jsou skeny jen v paměti aktivní stránky; obnovením stránky se smažou.
- Kameru a skutečné GS separátory je nutné ověřit na fyzickém telefonu; checklist je v docs/field-tests.md.
- Kamera a service worker vyžadují HTTPS nebo localhost.
- Data zůstávají v zařízení; žádný backend ani automatická synchronizace.

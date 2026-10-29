# Skladník MTZ – mobilní webová aplikace

Offline-first PWA pro skladníka: kontinuální skenování čárových kódů, automatické dělení skenů na palety a generování GS1-128/SSCC štítků. Zdrojový základ tvoří HTML, CSS a JavaScript; nativní Flutter projekt se nepoužívá.

## Spuštění

Vyžaduje Node.js a npm.

```powershell
npm install
npm run dev
```

V terminálu Vite vypíše lokální adresu, typicky `http://localhost:5173`. Pro otevření na jiném zařízení ve stejné síti lze použít `npm run dev -- --host 0.0.0.0`. Kamera a service worker mimo localhost vyžadují HTTPS.

## Kontroly

```powershell
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
```

## Stav

M0 tvoří responzivní domovskou obrazovku, lokální IndexedDB verze 1, základní PWA manifest/service worker a automatické testy storage. Tlačítko skenování zatím neaktivuje kameru; skutečné skenování je plánováno do M1. Offline mód a instalace PWA se musí ověřit v mobilním prohlížeči.

## Důležité

- Data zůstávají v prohlížeči zařízení; neexistuje backend ani automatická synchronizace.
- IndexedDB data mohou být odstraněna vymazáním dat prohlížeče; export/záloha přijde v pozdějším milníku.
- Žádné reálné SSCC štítky neopouštějí testovací prostředí bez přiděleného GS1 Company Prefix.
- Projektové instrukce a rozhodnutí jsou v `AGENTS.md`, `docs/` a `prompts/`.
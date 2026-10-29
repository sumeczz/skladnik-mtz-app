# AGENTS.md – Skladník MTZ (mobilní webová aplikace)

Tento soubor je hlavní vstup pro AI agenta. Přečti jej celý před každou změnou. Uživatel je skladník MTZ, ne profesionální vývojář: vysvětluj stručně, česky, a uváděj konkrétní příkazy.

## 1. Co stavíme
Offline-first mobilní webovou aplikaci (PWA) pro skladníka:
1. Čtečka čárových kódů s kontinuálním skenováním (Code 128, GS1-128, QR, EAN, Code 39, DataMatrix, ITF…). Typ kódu si uživatel vybere před skenováním; webová čtečka musí omezit povolené formáty.
2. Každých N kódů (výchozí 3, konfigurovatelné) se automaticky uzavře aktuální paleta a otevře nová, bez přerušení skenování.
3. Detail palety s kódy a GS1-128/SSCC štítkem, exportem CSV/JSON/PDF a sdílením.
4. Instalovatelnost na mobilu přes PWA; lokální data i základní shell fungují offline.

## 2. Závazná technologie
- UI: sémantické HTML5, CSS3, moderní JavaScript ES modules.
- Dev server a build: Vite; testy: Vitest; IndexedDB testy: fake-indexeddb.
- Lokální databáze: IndexedDB, s explicitní verzí schématu a migracemi.
- Offline aplikace: Web App Manifest + service worker.
- Bez backendu, účtu, analytiky nebo automatického odesílání dat v MVP.
- Žádný Flutter/Dart, Android APK, Riverpod, drift ani ARB. Staré instrukce se považují za překonané rozhodnutím ADR-0001.
- Produkční nasazení musí používat HTTPS (kromě localhost), aby byly dostupné kamera a service worker.

## 3. Jazyk a konvence
- Dokumentace, texty UI a odpovědi uživateli: česky.
- Názvy proměnných, funkcí, souborů, testů a komentáře v kódu: anglicky.
- Texty UI centralizuj v src/i18n/cs.js; výchozí jazyk čeština, nevytvářej při M0 zbytečný lokalizační framework.
- Commity: Conventional Commits (feat(scan): ..., fix(pallet): ..., test(storage): ...).
- Styl kódu konzistentně používej ES modules, dvouprostorové odsazení, jednoduché uvozovky a středníky.
- Nepřidávej závislost bez zdůvodnění. Verze ověřuj pomocí npm registru a npm audit; neodhaduj je z paměti.

## 4. Struktura projektu
```text
index.html
src/
  main.js
  styles.css
  i18n/cs.js
  core/
    gs1/
    scanning/
    pallets/
  storage/
    db.js
  features/
    scan/
    pallets/
    labels/
    export/
    settings/
public/
  manifest.webmanifest
  sw.js
  icons/
tests/
  storage.test.js
docs/
skills/
prompts/
tools/gs1_reference.py
```
Doménová logika GS1 a dělení palet musí být čistý JavaScript bez DOM vazeb. Kamera se abstrahuje přes rozhraní, aby později šel použít průmyslový/Bluetooth HID skener.

## 5. Nepodkročitelná doménová pravidla
1. Bez zvoleného typu kódu nelze spustit skenování.
2. Sken nikdy neblokuje další sken modálním dialogem ani navigací; potvrzení je krátké a nenápadné.
3. Každý přijatý sken se okamžitě uloží do IndexedDB v transakci. Při selhání úložiště nesmí aplikace potichu pokračovat.
4. Přidání N-tého skenu, uzavření palety, přidělení SSCC a otevření nové palety musí být jediná atomická IndexedDB transakce.
5. SSCC se nikdy neopakuje; čítač se aktualizuje ve stejné transakci. Neplatná/nezadaná firma prefixem nesmí produkovat štítky pro reálné použití.
6. GS1 logika musí mít jedinou implementaci v src/core/gs1/ a ověřuje se vůči docs/test-vectors/gs1_vectors.json. Nevytvářej kopie parseru v UI.
7. GS1-128 se nesmí zaměnit s libovolným Code 128: ověř GS1 strukturu a zachovej oddělovač GS (ASCII 29).
8. Offline-first: bez backendu, účtu, analytiky i síťového odesílání osobních/skladových dat.
9. Služba skenování musí rozlišit chybu oprávnění kamery, nepodporovanou platformu a prázdný výsledek.

## 6. Postup práce agenta
1. Přečti docs/07-roadmapa.md; pracuj vždy na jednom milníku.
2. Přečti související skill v skills/.
3. Dělej malé ověřitelné kroky; po změně spusť npm test, npm run build a npm audit --omit=optional.
4. Ke každé nové logice přidej test. GS1 a dělení palet nejdříve testuj (TDD).
5. Dokumentaci a CHANGELOG.md aktualizuj spolu s kódem.
6. Nikdy netvrď, že aplikace běží na telefonu, pokud to nebylo přímo ověřeno. Jasně odděluj automatické testy od testů na zařízení.

## 7. Příkazy
```powershell
npm install
npm run dev -- --host 0.0.0.0
npm test
npm run build
npm audit --omit=optional
python tools/gs1_reference.py --selftest
```
Pro kameru a service worker musíš aplikaci otevírat přes localhost nebo zabezpečený HTTPS origin, ne přímo jako file://.

## 8. Definition of done
- [ ] Akceptační kritéria milníku splněna a zdokumentována.
- [ ] npm test, npm run build a audit závislostí bez známých zranitelností v zahrnutém rozsahu.
- [ ] UI česky, ovladatelné dotykem a klávesnicí, kontrast alespoň 4,5:1 a cíle důležitých akcí minimálně 44×44 CSS px.
- [ ] Lokální skladová data neopouštějí zařízení bez výslovného souhlasu.
- [ ] Migrations IndexedDB a odpovídající testy jsou přidány, pokud se mění schéma.
- [ ] Offline režim otestován v prohlížeči; kamerové skenování je výslovně označeno jako neověřené, pokud nebylo testováno na reálném telefonu.
- [ ] Dokumentace a CHANGELOG.md aktualizovány.

## 9. Zakázáno
- Zapisovat hesla, klíče, tajemství nebo firemní GS1 prefix do repozitáře.
- Odesílat skeny mimo zařízení bez výslovného zadání.
- Používat zastaralé Flutter instrukce jako zdroj dalších kroků.
- Mazat nebo přepisovat uživatelská data při upgrade IndexedDB.
- Tvrdit, že neověřená funkčnost je hotová.
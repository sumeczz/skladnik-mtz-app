# 03 – Architektura mobilní webové aplikace

## Vrstvy

```text
presentation: HTML templates / DOM events / CSS
        ↓
features: scan / pallets / labels / export / settings
        ↓
domain: pure JavaScript (GS1, ScanPipeline, PalletService, validators)
        ↓
data: IndexedDB repositories + versioned schema migrations
        ↓
platform: Camera API + barcode decoder, feedback, Web Share / downloads
```

Pravidlo závislostí: doménová logika nezná DOM ani konkrétní kamerovou knihovnu. Funkce GS1, validátory a pravidla palet musí být čistý JavaScript s automatickými testy.

## Adresářová struktura

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
  storage/db.js
  features/
    scan/
    pallets/
    labels/
    export/
    settings/
public/
  manifest.webmanifest
  sw.js
  icons/icon.svg
tests/
  storage.test.js
docs/test-vectors/gs1_vectors.json
tools/gs1_reference.py
```

## Platformní rozhraní

- `ScanSource`: start(type), stop(), události úspěšných skenů; kamera i pozdější HID skener implementují stejné rozhraní.
- `PalletRepository`: metody nad IndexedDB; každá zapisující operace určuje transakční hranici.
- `FeedbackService`: zvuk a vibrace jsou volitelné, s detekcí nepodporovaných API.
- Export používá Blob + stažení a Web Share API jen při dostupnosti; bez odesílání na server.

## Datový tok skenu (pro M1/M2)

```text
ScanSource -> format filter -> cooldown -> normalize -> domain validation
  -> duplicate policy -> one IndexedDB readwrite transaction
  -> ScanOutcome -> unobtrusive UI + optional feedback
```

Paleta: v jedné transakci uložit N-tý sken, uzavřít paletu, rezervovat unikátní SSCC a připravit následující paletu. Pokud jedna část selže, transakce se abortuje jako celek.

## IndexedDB

DB: `skladnik-mtz`, aktuální schéma v M0: verze 1.

- `pallets`: keyPath `id`, autoIncrement; unikátní indexy `uuid`, `number`; indexy `status`, `createdAt`.
- `scans`: keyPath `id`, autoIncrement; indexy `palletId`, unikátní složený `palletSeq=[palletId, seq]`, `value`, `scannedAt`.
- `counters`: klíč `name` a hodnota `value`.
- `settings`: klíč `key` a hodnota `value`.

Každá změna schématu musí zvýšit verzi DB a zachovat existující data. IndexedDB je lokální úložiště prohlížeče, nikoli náhrada zálohy; později přidej explicitní export.

## PWA, offline a soukromí

- Web App Manifest určuje název, ikonu, start URL a režim standalone.
- Service worker cachuje pouze aplikační shell a statické assety. Do cache nevkládej soukromá skladová data.
- Kamera i service worker vyžadují secure context (HTTPS; výjimkou je localhost).
- MVP neobsahuje server, login, analytiku ani automatickou synchronizaci.
- Offline dostupnost se ověřuje vypnutím sítě v reálném prohlížeči; úspěšný build sám o sobě offline provoz nedokazuje.

## Rizika pro ověření v M1

- Browser decoder může vracet GS1-128 jen jako Code 128. Zachovej GS (ASCII 29) a vždy validuj GS1 strukturu.
- Podpora formátů, fotoaparátu, zvuku, vibrací a screen wake lock závisí na prohlížeči.
- Data browser storage mohou uživatel nebo OS vymazat; vysvětli potřebu exportu.
- Nikdy neprezentuj nepodporovanou kameru jako prázdný nebo neplatný kód bez zřetelné chyby.
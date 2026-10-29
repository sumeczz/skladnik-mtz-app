# 04 – Datový model

## IndexedDB

Lokální databáze `skladnik-mtz`, schéma verze 1. Čas ukládej v UTC jako ISO-8601 nebo epoch ms, zobrazuj místní čas (Europe/Prague). ID jsou lokální autoinkrementy; UUID jsou textové a unikátní pro budoucí explicitní export/synchronizaci.

### `pallets`

| Pole | Typ | Poznámka |
|---|---|---|
| id | number PK | autoIncrement |
| uuid | string unique | UUID pro export |
| number | number unique | název „Paleta 0007“ |
| status | string | `open` nebo `closed` |
| capacity | number/null | N při založení; null = bez limitu |
| sscc | string/null unique | přiděleno při uzavření; nikdy se neopakuje ani nevrací |
| labelType | string | `gs1_128` / `code128` / `qr` |
| note | string/null | poznámka |
| createdAt | number | UTC epoch ms |
| closedAt | number/null | UTC epoch ms |
| labelExportedAt | number/null | první export/tisk |

Invariant: nejvýše jedna paleta má `status = open`; ověřuj a vynucuj to v transakční vrstvě.

### `scans`

| Pole | Typ | Poznámka |
|---|---|---|
| id | number PK | autoIncrement |
| palletId | number FK | ID palety; ručně kaskádně spravovat mazání, IndexedDB nemá SQL FK |
| seq | number | pořadí 1..N; složený index `(palletId, seq)` unique |
| value | string | přesný výsledek skeneru včetně ASCII 29 |
| displayValue | string | lidsky čitelný zápis |
| codeType | string | uživatelem zvolený typ |
| detectedFormat | string | formát nahlášený decoderem |
| aiJson | string/null | parsovaná GS1 AI pole |
| source | string | `camera` / `manual` / `hardware` |
| scannedAt | number | UTC epoch ms |

### `counters`

Klíč `name` a hodnota `value`; například `sscc_serial`. Čítač se zvyšuje ve stejné transakci jako přidělení SSCC. Duplicity SSCC nesmí vzniknout ani po přerušení aplikace.

### `settings`

Klíč `key` a hodnota serializovatelná strukturovaná data `value`. Sem patří kapacita, GS1 prefix, extension digit a pravidla duplicit. Do úložiště neukládej tajemství.

## Výčty

```js
const CodeType = ['code128', 'gs1128', 'qr', 'ean13', 'ean8', 'code39', 'dataMatrix', 'itf'];
const PalletStatus = ['open', 'closed'];
const DuplicatePolicy = ['allow', 'warnAndSkip', 'silentSkip'];
const DuplicateScope = ['pallet', 'allStored'];
const ScanSourceKind = ['camera', 'manual', 'hardware'];
```

## Pravidla schématu a migrací

- Každá změna schématu zvýší `DB_VERSION` a implementuje `onupgradeneeded` bez ztráty dat.
- IndexedDB indexy a store se zakládají pouze pokud chybí.
- Přidej automatické testy pro každou migraci z předchozí verze.
- Před release otestuj upgrade na kopii/exportu reálných dat.

## JSON export – stabilní kontrakt

```json
{
  "schema": 1,
  "exported_at": "2026-10-29T07:15:00Z",
  "pallets": [{
    "number": 7, "uuid": "…", "status": "closed", "capacity": 3,
    "sscc": "106141412345678908", "closed_at": "2026-10-29T07:10:12Z",
    "scans": [{"seq": 1, "value": "…", "code_type": "gs1128", "scanned_at": "…", "ai": [{"ai": "01", "value": "…"}]}]
  }]
}
```

Řídicí znak GS se v JSON escapuje jako `\\u001d`; v CSV se zobrazí jako `<GS>` a použije se i samostatná čitelná hodnota.
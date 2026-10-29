---
name: barcode-scanning
description: Skenování čárových a 2D kódů kamerou ve Flutteru pro skladovou aplikaci – povinný výběr typu kódu před skenem (Code 128, GS1-128, QR, EAN, Code 39, DataMatrix, ITF), kontinuální režim bez doteku, kooldown a deduplikace, svítilna, ruční zadání, životní cyklus kamery a oprávnění. Použij pokaždé, když se řeší obrazovka skenování, čtení kódů, mobile_scanner, "neustálé skenování", "vyber typ kódu", zdvojené nebo ztracené skeny nebo pomalé čtení, i když uživatel nezmíní konkrétní knihovnu.
---

# barcode-scanning

Cíl: skenovat kód za kódem bez doteku displeje, jen zvolený typ kódu, bez zdvojených a bez ztracených skenů.

## Pravidla (a proč)

1. **Typ kódu je povinný vstup před startem.** Důvod: ve skladu je v záběru často více štítků; omezení formátu je nejlevnější ochrana proti načtení špatného kódu a zrychluje detekci. Tlačítko Spustit je neaktivní bez volby; poslední použitý typ je jen předvybraný.
2. **Kamera se konfiguruje jen na formáty zvoleného typu** (mapování níže). Neshodný formát se tiše ignoruje.
3. **Po úspěšném skenu žádný dialog, žádná navigace.** Důvod: každý dotek zdržuje a skladník má často jednu ruku obsazenou. Zpětná vazba je zvuk + vibrace + nenápadný banner.
4. **Ukládej hned, v pipeline, ne ve widgetu.** Widget jen předá `RawScan` do `ScanPipeline`. Důvod: widget se při otočení nebo návratu znovu staví a sken by se mohl ztratit nebo zdvojit.
5. **Doména nezná kameru.** Používej rozhraní `ScanSource` (viz `docs/03-architektura.md`); `mobile_scanner` je jen jedna implementace. Důvod: průmyslový skener (fáze 2) a testy s `FakeScanSource`.
6. **Knihovně nevěř, že odfiltruje duplicity tak, jak je potřebuješ.** Vlastní kooldown a pravidla duplicit patří do pipeline (`pallet-sessions`).

## Mapování typů na formáty

Mapování žije v adaptéru (`MobileScannerSource`), ne v doméně:

```dart
// Náčrt – ověř názvy hodnot BarcodeFormat ve verzi z pubspec.lock.
List<BarcodeFormat> formatsFor(CodeType t) => switch (t) {
  CodeType.code128 || CodeType.gs1128 => [BarcodeFormat.code128],
  CodeType.qr        => [BarcodeFormat.qrCode],
  CodeType.ean13     => [BarcodeFormat.ean13],
  CodeType.ean8      => [BarcodeFormat.ean8],
  CodeType.code39    => [BarcodeFormat.code39],
  CodeType.dataMatrix=> [BarcodeFormat.dataMatrix],
  CodeType.itf       => [BarcodeFormat.itf], // ověř, zda knihovna rozlišuje ITF-14/ITF-16
};
```

`gs1128` čte formát Code 128 a **validuje obsah** (`skills/gs1-128`). Knihovna GS1-128 jako samostatný formát typicky neuvádí.

## Konfigurace kontroleru (náčrt)

```dart
final controller = MobileScannerController(
  autoStart: false,                     // start řídíme sami po volbě typu
  formats: formatsFor(type),
  detectionSpeed: DetectionSpeed.noDuplicates, // ověř sémantiku; doménovou deduplikaci stejně děláš sám
  detectionTimeoutMs: 250,              // vyladit měřením (M5)
  facing: CameraFacing.back,
  torchEnabled: false,
);
```

Užitečné vlastnosti, které knihovna nabízí (ověř ve verzi projektu): `scanWindow` (čti jen střed záběru – důležité,
když je v záběru víc štítků), svítilna, zoom, `rawBytes` (může zachovat řídicí znaky, např. GS u GS1-128), `returnImage` (nepotřebujeme, vypnout).

## Životní cyklus kamery (kritické)

Použij `WidgetsBindingObserver` jako v dokumentaci balíčku:
- `resumed` → znovu se přihlas k `controller.barcodes` a `start()`;
- `inactive`/`paused` → zruš odběr a `stop()`;
- při odchodu z obrazovky `dispose()` kontroleru a uvolni wakelock.

Důvod: kamera nesmí zůstat obsazená ani žrát baterii. Po návratu se skenování obnoví **ve stejném typu**, bez nového výběru.

## Oprávnění

Odepřené oprávnění nesmí shodit aplikaci: ukaž vysvětlení (`cameraPermissionDenied`) a tlačítko do systémového nastavení.
Stav „trvale odepřeno" řeš odkazem do nastavení, ne dalším vyskakovacím dialogem.

## Kooldown a duplicity v kameře

Při držení kamery na štítku přicházejí desítky detekcí za sekundu. Pipeline proto:
1. zahodí stejnou hodnotu do `cooldownMs` (výchozí 800 ms) od posledního přijetí **bez signálu**;
2. pak aplikuje pravidla duplicit z nastavení (signál + banner).
Kooldown se měří od času přijetí, ne od času detekce, a je per hodnota (jiný kód hned po předchozím projde okamžitě).

## Validace podle typu

| Typ | Validace |
|---|---|
| EAN-13 / EAN-8 | délka + kontrolní číslice (stejný algoritmus jako `gs1-128` §3) |
| GS1-128 | `Gs1Codec.parse` musí uspět; při `UNKNOWN_AI` podle nastavení odmítnout/přijmout |
| Code 128, Code 39, QR, DataMatrix, ITF | bez validace obsahu; jen neprázdná hodnota |
| ITF-14 | 14 číslic + kontrolní číslice (pokud rozlišuješ) |

Odmítnutý kód = chybový signál + banner s důvodem; nikdy se neuloží.

## Ruční zadání

Vždy dostupné z obrazovky skenování. Prochází **stejnou pipeline** (`source = manual`) včetně validace, duplicit a dělení palet.
Důvod: poškozený štítek je ve skladu běžný a práce se nesmí zastavit.

## Kontrolní seznam před hotovo

- [ ] Bez zvoleného typu nejde spustit skenování.
- [ ] Při zvoleném QR se Code 128 ignoruje a naopak.
- [ ] 3 s držení na jednom kódu = jeden sken.
- [ ] 30 kódů za sebou bez doteku.
- [ ] Zámek obrazovky / přepnutí aplikace / hovor → kamera se uvolní a obnoví.
- [ ] Odepřené oprávnění: žádný pád.
- [ ] Ruční zadání prochází pipeline.
- [ ] Měření „kód v záběru → vibrace" zapsáno (`docs/08-testovaci-strategie.md`).
- [ ] Test R-01: štítek GS1-128 se dvěma proměnlivými poli – obsahuje čtená hodnota/`rawBytes` znak 0x1D? Zapsáno do `docs/field-tests.md`.

## Časté chyby

- Ukládání přímo v `onDetect` callbacku widgetu (zdvojení při rebuildu).
- Spoléhání na `DetectionSpeed` místo vlastní deduplikace.
- Kamera dál běží v pozadí (zapomenutý `stop()`/`dispose()`).
- Použití `rawValue` pro GS1-128, když `rawBytes` zachovává separátory lépe – porovnej obojí na reálném štítku.

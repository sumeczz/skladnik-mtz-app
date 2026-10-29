---
name: android-release
description: Sestavení, podepsání a distribuce Android aplikace (APK/AAB) pro interní použití ve firmě – keystore a key.properties, verze, ikona, oprávnění, release build, instalace na telefony ve skladu mimo Google Play, interní testování, zálohování klíče a uživatelská příručka. Použij vždy, když uživatel chce "nahrát to do telefonů", "udělat instalační soubor", "apk", "release", "podepsat", "nainstalovat kolegům", "dát to do Google Play", nebo řeší, proč se aplikace nedá nainstalovat, i když neřekne slovo release.
---

# android-release

Cíl: spolehlivě dostat aplikaci na telefony ve skladu a umět ji později aktualizovat **přes stejný podpis**.
Tajemství (keystore, hesla) nikdy do repozitáře.

## 1. Příprava

- Název aplikace (`android:label`), ikona (např. `flutter_launcher_icons`), verze v `pubspec.yaml` (`1.0.0+1`; za `+` je `versionCode`, který musí s každým vydáním růst).
- Oprávnění: ověř v `AndroidManifest.xml` (release), že je jen kamera (+ případně Bluetooth ve fázi 2). Nepřidávej `INTERNET`, pokud ho nepotřebuješ.
- `applicationId` (balíčkový identifikátor) je po vydání neměnný – ověř, že je správný.

## 2. Podpisový klíč (jednorázově)

```bash
keytool -genkey -v -keystore ~/skladnik-upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

- Hesla si ulož do správce hesel. **Ztráta klíče = nelze aktualizovat nainstalované aplikace** (musely by se odinstalovat a data by se ztratila).
- Udělej **dvě zálohy** keystore mimo počítač (např. šifrovaný disk a firemní trezor).
- `android/key.properties` (v `.gitignore`):

```properties
storePassword=…
keyPassword=…
keyAlias=upload
storeFile=/cesta/k/skladnik-upload-keystore.jks
```

- V `android/app/build.gradle(.kts)` načti `key.properties` a nastav `signingConfigs.release` + `buildTypes.release.signingConfig`.
  ⚠ Syntaxe se liší podle verze šablony Flutteru (Groovy vs. Kotlin DSL) – řiď se aktuální oficiální dokumentací „Build and release an Android app".

## 3. Sestavení

```bash
flutter clean && flutter pub get
flutter analyze && flutter test
flutter build apk --release            # instalační soubor pro přímou instalaci
flutter build appbundle --release      # pro Google Play
```

Výstup: `build/app/outputs/flutter-apk/app-release.apk`, resp. `build/app/outputs/bundle/release/app-release.aab`.
Pokud je potřeba menší soubor pro jednotlivé architektury: `--split-per-abi` (a zvol správnou variantu pro telefony ve skladu).

## 4. Instalace do telefonů

| Cesta | Postup | Poznámka |
|---|---|---|
| Kabel (adb) | `adb install -r app-release.apk` | rychlé pro několik telefonů |
| Sdílení souboru | APK pošli (e-mail/disk), na telefonu povol instalaci z neznámých zdrojů pro konkrétní aplikaci | firemní pravidla mohou zakazovat |
| Správa zařízení (MDM) | distribuce přes firemní MDM | pokud ho firma má |
| Google Play – interní testování | nahraj AAB, přidej testery | vyžaduje účet vývojáře; ověř aktuální podmínky |

Aktualizace: stejný podpis, vyšší `versionCode`. Data zůstávají. Před aktualizací, která mění DB, otestuj migraci na kopii reálné DB.

## 5. Po instalaci ověř (na čistém telefonu)

- [ ] Instalace i spuštění bez chyby, kamera si vyžádá oprávnění.
- [ ] Skenování v každém podporovaném typu, uložení palety, štítek, export.
- [ ] Aktualizace přes vyšší verzi zachová data.
- [ ] Velikost a rychlost startu přijatelné na nejstarším telefonu ve skladu.

## 6. Dokumentace pro uživatele

`docs/uzivatelska-prirucka.md`: instalace, první spuštění, výběr typu kódu, skenování, uzavření palety, štítek, export, co dělat při chybě,
jak zálohovat. 1–2 stránky, česky, s popisem obrazovek nebo snímky.

## Kontrolní seznam před předáním kolegům

- [ ] Keystore a hesla zálohována, mimo repozitář.
- [ ] Verze a `versionCode` zapsány v `CHANGELOG.md`.
- [ ] Manifest bez zbytečných oprávnění.
- [ ] Příručka hotová; kontakt na uživatele, který problémy řeší.
- [ ] Pravidla firmy pro instalaci aplikací mimo Play ověřena.

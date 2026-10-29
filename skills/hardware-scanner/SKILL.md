---
name: hardware-scanner
description: Napojení průmyslových a Bluetooth čteček čárových kódů (Zebra DataWedge, Honeywell, Bluetooth HID/SPP) do Flutter aplikace přes rozhraní ScanSource – zachování GS separátoru u GS1-128, režim klávesnice vs. Android intent, problém s českým rozložením klávesnice, konfigurace prefixu/sufixu. Použij, když uživatel zmíní skener, "pistoli", Zebra, Honeywell, DataWedge, Bluetooth čtečku, "ruční skener", nebo když kamera na telefonu nestačí rychlostí či spolehlivostí, i když zatím neví, jaký skener má. Fáze 2 projektu – nepoužívat před dokončením M6, pokud to uživatel výslovně nezadá.
---

# hardware-scanner

Fáze 2. Kamera telefonu stačí na začátek; průmyslový skener je rychlejší, čte i špatné štítky a **spolehlivěji vrací separátor GS u GS1-128** (riziko R-01).
Díky rozhraní `ScanSource` se doména (pipeline, palety) nemění; přidává se jen nová implementace.

## Nejdřív zjisti (jedna otázka)

Jaký skener nebo telefon s vestavěným skenerem uživatel má (výrobce, model, Android verze) a jak se připojuje (vestavěný / Bluetooth / USB).
Bez toho nic nepředpokládej – postup se liší.

## Varianty napojení

| Varianta | Jak to funguje | Kdy |
|---|---|---|
| **Zebra DataWedge – Intent** | DataWedge odesílá výsledek skenu jako Android broadcast intent; aplikace ho přijme přes platform channel (`EventChannel`) | zařízení Zebra; **doporučeno**: spolehlivá data, včetně GS |
| **Honeywell / jiné SDK** | výrobcovo SDK nebo intent API | zařízení Honeywell apod. |
| **Keyboard wedge (HID)** | skener „píše" jako klávesnice do fokusovaného `TextField`; konec skenu = Enter | Bluetooth skenery v HID módu; nejjednodušší, nejnáchylnější na chyby |
| **Bluetooth SPP** | sériová linka; potřeba plugin/nativní kód | skenery v SPP módu |

Pro každou variantu vznikne třída `XxxScanSource implements ScanSource`. Konkrétní balíčky pro DataWedge/Bluetooth se mění – **ověř aktuální stav na pub.dev**
a posuď údržbu balíčku; alternativa je malý vlastní platform channel.

## Rizika, na která se zeptat a otestovat

1. **GS (0x1D) v keyboard wedge režimu.** Mnoho skenerů pošle GS jako kombinaci kláves (např. Ctrl+]) nebo ho vypustí. Nastav skener (prefix/sufix, „GS1 formatting") nebo použij intent. Test: naskenuj štítek se dvěma proměnlivými poli a porovnej bajty.
2. **České rozložení klávesnice.** V HID režimu skener emuluje stisky kláves a telefon je převádí podle aktivního rozložení; na české klávesnici může číselná řada vydávat znaky s diakritikou místo číslic a prohodí se Y/Z. Řešení: nastavit na skeneru správné rozložení/režim, nebo přepnout na intent/SPP. Vždy testuj na čísla, písmena i speciální znaky (`-`, `/`).
3. **Symbology identifier.** Skener může přidat prefix (`]C1`, `]C0`, `]Q1` …). Parser z `gs1-128` ho umí odříznout; ostatní typy nepoužívají → nastav, zda se prefix posílá.
4. **Kontinuální skenování.** Tlačítko skeneru je spoušť; aplikace nepotřebuje „Spustit" kamery, ale typ kódu se přesto vybírá (filtr v pipeline podle symbologie, pokud ji skener hlásí).
5. **Oprávnění Bluetooth** (Android 12+ nové oprávnění) a párování – řeš v UI s jasným stavem připojení.

## Postup implementace

1. Napiš `HardwareScanSource` s příznakem `source = hardware` a mapováním symbologie → `DetectedFormat`.
2. Přidej výběr zdroje do nastavení (Kamera / Čtečka) a uchovej volbu.
3. Přidej testy pomocí `FakeScanSource` a kontrakt testy ScanSource (stejné scénáře pro všechny implementace).
4. Terénní test: 50 štítků za sebou, GS1-128 se dvěma proměnlivými poli, malé a poškozené štítky; porovnej s kamerou.
5. Zapiš do `docs/09-rizika-a-otevrene-otazky.md`, zda se R-01 potvrdilo/vyřešilo.

## Kontrolní seznam

- [ ] Doména a pipeline beze změny; nová je jen implementace `ScanSource`.
- [ ] GS u GS1-128 ověřen na reálném štítku.
- [ ] České rozložení klávesnice a speciální znaky otestovány.
- [ ] Stav připojení (připojeno/odpojeno) je v UI vidět.

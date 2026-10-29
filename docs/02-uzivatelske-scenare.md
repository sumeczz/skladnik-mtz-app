# 02 – Uživatelské scénáře a akceptační kritéria

Formát: **Dáno** (výchozí stav) → **Když** (akce) → **Pak** (ověřitelný výsledek). Každé kritérium má být
ověřitelné testem nebo krátkým ručním postupem na telefonu.

## US-01 Výběr typu kódu před skenováním

Jako skladník chci před skenováním zvolit typ kódu, aby kamera nehledala nic jiného a nečetla cizí kódy.

- Dáno: otevřu obrazovku Skenovat. Pak: vidím mřížku typů (Code 128, GS1-128, QR, EAN-13, EAN-8, Code 39, DataMatrix, ITF) a tlačítko Spustit je neaktivní, dokud nic nevyberu. Naposledy použitý typ je předvybraný.
- Když zvolím typ a stisknu Spustit, pak se kamera spustí a hledá jen formáty zvoleného typu.
- Když je zvolen QR a namířím na Code 128, pak se nic nestane (kód se ignoruje bez chyby).
- Když chci typ změnit, pak stisknu chip typu v záhlaví → kamera se zastaví → znovu vyberu → Spustit. Otevřená paleta zůstává.

## US-02 Kontinuální skenování

Jako skladník chci skenovat kód za kódem bez doteku displeje.

- Když načtu platný kód, pak se uloží do aktuální otevřené palety, zazní krátký tón, telefon krátce zavibruje, počítadlo se zvýší a kamera dál běží.
- Když držím kód před kamerou déle než kooldown (výchozí 800 ms), pak se uloží **jen jednou**.
- Když načtu kód, který už je uložený, pak zazní jiný signál (dvojitá vibrace), zobrazí se banner „Duplicitní kód" s akcí „Přidat přesto" (4 s) a kód se nepřidá.
- Když kód neprojde validací typu (např. EAN-13 se špatnou kontrolní číslicí, GS1-128 bez platných AI), pak zazní chybový signál a banner řekne proč; kód se neuloží.
- Když stisknu Vrátit u posledního skenu, pak se poslední sken odstraní a počítadlo klesne.
- Když zamknu telefon nebo přepnu aplikaci, pak se kamera uvolní; po návratu se skenování obnoví ve stejném typu.
- Když není oprávnění ke kameře, pak vidím vysvětlení a tlačítko do nastavení; žádný pád.
- Když kód nejde přečíst, pak mám dostupné **ruční zadání** (se stejnou validací jako skenování).

## US-03 Automatické dělení na palety

Jako skladník chci, aby se po N kódech sama založila nová paleta.

- Dáno: kapacita palety N = 3. Když naskenuji 3 kódy, pak se paleta uzavře, dostane SSCC a automaticky se otevře nová prázdná; 4. kód patří do nové palety.
- Pak: skenování se nepřeruší; zobrazí se nenápadný banner „Paleta 0007 uzavřena (3/3)" a počítadlo ukáže 0/3.
- Když je kapacita nastavena na „bez limitu", pak se palety uzavírají jen ručně tlačítkem „Uzavřít paletu".
- Když změním kapacitu v nastavení, pak platí pro nově otevřené palety; aktuální otevřená paleta si zachová kapacitu (volitelně akce „Použít i na aktuální").
- Když aplikaci násilně ukončím uprostřed palety, pak se po spuštění paleta obnoví se všemi uloženými kódy a pokračuje.
- Když z uzavřené palety poslední sken vrátím (Vrátit), pak se paleta znovu otevře a **zachová si své SSCC** (číslo se nikdy nevrací do zásoby).

## US-04 Stránka palety a GS1-128 kód

Jako skladník chci u palety vidět její kódy a štítek s čárovým kódem.

- Když otevřu uzavřenou paletu, pak vidím: název, stav, čas, seznam kódů (typ, hodnota, čas) a **vykreslený GS1-128 kód SSCC** s lidsky čitelným textem pod ním.
- Když není nastaven GS1 Company Prefix, pak místo kódu vidím výzvu k nastavení (s tlačítkem do nastavení) a volbu interního režimu.
- Když vygenerovaný kód naskenuji v aplikaci typem GS1-128, pak se přečte jako stejné SSCC (test round-trip).
- Když chci jiný typ kódu palety (Code 128 / QR), pak ho přepnu na stránce palety; volba se uloží u palety.
- Na otevřené paletě vidím kódy a tlačítko „Uzavřít paletu"; kód SSCC se zobrazí až po uzavření.

## US-05 Export a sdílení

- Když stisknu Export u palety nebo ve výběru více palet, pak mohu zvolit CSV, JSON nebo PDF štítek a sdílet přes systémové menu (e-mail, Disk, Bluetooth…).
- CSV se otevře v českém Excelu bez rozbitých znaků a sloupců (středník, UTF-8 s BOM).
- PDF štítek má rozměr 100×150 mm, obsahuje název palety, počet kódů, datum a GS1-128 kód s lidsky čitelným textem.

## US-06 Historie a hledání

- Seznam palet je řazen od nejnovější, ukazuje stav, počet kódů, čas; lze filtrovat otevřené/uzavřené.
- Hledání podle hodnoty kódu najde paletu, ve které kód je.
- Smazání palety vyžaduje potvrzení a je to jediná destruktivní akce (včetně smazání všech starších než X dní v nastavení).

## US-07 Nastavení

Kapacita palety, pravidla duplicit (povolit / upozornit a přeskočit / mlčky přeskočit), rozsah duplicit, kooldown mezi
skeny, zvuk a vibrace, GS1 Company Prefix a extension digit SSCC, aktuální SSCC čítač (jen zobrazit, změna se
potvrzuje), výchozí typ kódu palety, jazyk.

## Nefunkční požadavky

- Offline; žádná síťová oprávnění kromě těch, která si vyžádají knihovny (ověř manifest).
- Spuštění do obrazovky Skenovat ≤ 2 s na běžném telefonu.
- Použitelné v rukavicích: dotykové cíle ≥ 56 dp u hlavních akcí, kontrast ≥ 4,5:1.
- Skenování nesmí pálit baterii zbytečně: kamera se zastaví při odchodu z obrazovky a po nečinnosti (nastavitelné, výchozí 2 min s upozorněním).

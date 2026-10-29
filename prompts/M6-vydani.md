# M6 – Vydání

Cíl: podepsaná sestavení a bezpečná distribuce do skladu.

Přečti: skills/android-release/SKILL.md.

Úkoly:
1. Vygeneruj upload keystore (návod pro mě krok za krokem; keystore NIKDY do repozitáře), nastav `key.properties` a `.gitignore`.
2. Nastav název aplikace, ikonu, verzi (`1.0.0+1`), oprávnění (jen kamera; ověř manifest).
3. Sestav release APK (a AAB, pokud budu používat Google Play interní testování) a otestuj instalaci na čistém telefonu.
4. Napiš `docs/uzivatelska-prirucka.md` (1–2 stránky, česky, s obrázky nebo popisem obrazovek).
5. Zálohování dat: přidej export celé databáze do JSON jako ruční zálohu a popiš obnovu.
6. Shrň do CHANGELOG.md a navrhni plán na fázi 2 (průmyslový skener, Bluetooth tiskárna).

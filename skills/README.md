# Skills projektu Skladník MTZ

Skill = složka s `SKILL.md` (frontmatter `name` + `description`, pak postup). Agent si ho otevře, když úkol odpovídá popisu.
Popisy jsou záměrně „pushy", aby se skill použil i tehdy, když to uživatel nepojmenuje (např. řekne „aby se sama dělila paleta" a ne „pallet sessions").

## Přehled

| Skill | Použij, když… | Milník |
|---|---|---|
| `project-bootstrap` | zakládáš projekt, přidáváš závislosti, měníš strukturu | M0 |
| `barcode-scanning` | děláš obrazovku skenování, výběr typu kódu, kontinuální režim, kameru | M1 |
| `gs1-128` | řešíš GS1-128, SSCC, AI, kontrolní číslice, parsování čteného kódu | M1, M3 |
| `pallet-sessions` | ukládáš skeny, dělíš po N, uzavíráš paletu, duplicity, vrácení | M2 |
| `local-storage-drift` | děláš databázi, transakce, migrace, streamy | M0, M2 |
| `labels-and-export` | kreslíš kód/štítek, PDF, tisk, CSV, JSON, sdílení | M3, M4 |
| `warehouse-ux-cs` | navrhuješ obrazovky, texty, zvuk/vibrace, ovládání v rukavicích | M1–M5 |
| `testing-quality` | píšeš testy, FakeScanSource, terénní checklist | všechny |
| `hardware-scanner` | připojuješ Zebra/Honeywell/Bluetooth čtečku | fáze 2 |
| `android-release` | podepisuješ a sestavuješ APK/AAB, distribuuješ do skladu | M6 |

## Proč vlastní skills

Při přípravě balíčku jsem prošel dostupné obecné skills (práce s dokumenty, prezentacemi, tabulkami, PDF, frontend design,
UX copy, přístupnost). Žádný nepokrývá mobilní skenování, GS1/SSCC ani skladový workflow, proto jsou tyto skills napsané na míru.
Obecné doplňky, které se hodí (pokud je tvůj nástroj nabízí): kontrola přístupnosti (WCAG), psaní UX textů, tvorba uživatelské příručky.

## Jak skills používat

- **Claude Code:** zkopíruj složky do `.claude/skills/`.
- **ChatGPT / Codex a jiní agenti:** nahraj složku `skills/` do projektu, nebo vlož obsah relevantního `SKILL.md` do konverzace.
  `AGENTS.md` obsahuje tabulku „úkol → skill", takže agent ví, který otevřít.
- **Úpravy:** skills jsou živé dokumenty. Když agent opakovaně dělá stejnou chybu, přidej do příslušného skillu pravidlo
  s vysvětlením **proč** (agenti se řídí pravidly lépe, když znají důvod).

## Konvence

- Každý skill: frontmatter → kdy použít → postup → pravidla s důvody → kód/ukázky → kontrolní seznam.
- Ukázky kódu jsou **náčrty**. API balíčků vždy ověř v dokumentaci verze z `pubspec.lock`.

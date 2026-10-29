# 10 – Jak s balíčkem pracovat (ChatGPT, Codex, Claude Code, Cursor)

Hlavní myšlenka: agent potřebuje **kontext** (`AGENTS.md`, `docs/`, `skills/`) a **malý úkol najednou** (`prompts/`).
Rozhraní nástrojů se mění; níže je princip, ne přesné názvy tlačítek.

## Varianta A – ChatGPT v prohlížeči/aplikaci (nejjednodušší start)

ChatGPT v chatu **nespouští Flutter na tvém počítači**. Kód ti napíše, ty ho zkopíruješ, spustíš a výsledek (chyby) vrátíš.

1. Vytvoř nový **Projekt** (nebo vlastní GPT / vlastní instrukce) a vlož do instrukcí obsah `prompts/00-master-prompt.md`.
2. Nahraj do projektu soubory: `AGENTS.md`, složku `docs/` a složku `skills/` (při limitu souborů aspoň `AGENTS.md`, `docs/00-puvodni-zadani.md` až `docs/03-architektura.md`, `docs/05-gs1-128-reference.md`, `docs/07-roadmapa.md` a skills podle aktuálního milníku).
3. Do nové konverzace vlož prompt aktuálního milníku z `prompts/` (začni `M0-zaklad.md`).
4. Kód ukládej do složky projektu na svém počítači (agent vždy píše cestu k souboru). Spusť příkazy, které agent uvede.
5. Když něco spadne, **vlož celý text chyby** a napiš, co jsi dělal. Agent má chybu opravit, ne přepisovat celý projekt.
6. Po každém milníku: ulož do gitu (`git add . && git commit -m "…"`), aby šlo vrátit zpět.

## Varianta B – Codex / agent, který pracuje přímo v repozitáři

1. Rozbal zip, ve složce `git init`, první commit.
2. Otevři složku v agentovi. Nástroje typu Codex čtou `AGENTS.md` z kořene automaticky (⚠ ověř v dokumentaci svého nástroje).
3. Zadej prompt milníku. Agent může sám spouštět `flutter analyze` a `flutter test`; ty zkoušíš na telefonu.

## Varianta C – Claude Code / Cursor / jiný

`CLAUDE.md` odkazuje na `AGENTS.md`. Složky v `skills/` jsou ve formátu `SKILL.md`; pro Claude Code je zkopíruj do `.claude/skills/`.
Cursor a podobné nástroje: vlož obsah `AGENTS.md` do jejich pravidel projektu.

## Pracovní smyčka (platí pro všechny)

```
prompt milníku → agent navrhne plán (krátce) → změny po malých krocích → testy zelené
→ ty zkusíš na telefonu → zpětná vazba (chyba / fotka / popis) → opravy → commit → další milník
```

## Tipy, jak z agenta dostat to nejlepší

- **Jeden milník = jedna konverzace.** Dlouhé konverzace se rozjíždějí; nový milník začni čistě promptem a odkazy na soubory.
- Žádej **testy ke každé logice** a **vysvětlení česky**, co máš na telefonu vyzkoušet.
- Když agent tvrdí „funguje", zeptej se: „Co z toho jsi skutečně spustil a co je jen předpoklad?"
- U balíčků a API: „Ověř to v aktuální dokumentaci, nehádej."
- Foť reálné štítky a posílej je: nejrychlejší cesta, jak odhalit problém s typem kódu nebo kvalitou tisku.
- Nic z firmy (skutečné kódy, GS1 prefix) nevkládej do veřejných nástrojů, pokud to firemní pravidla zakazují.

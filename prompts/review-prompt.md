# Prompt pro revizi kódu

Proveď kritickou revizi změn z poslední práce. Neopravuj nic, dokud nedostanu seznam nálezů.

Kontroluj v tomto pořadí:
1. Porušení doménových pravidel v AGENTS.md (bod 5): typ kódu před skenem, neblokující sken, okamžité ukládání, atomické uzavření palety, unikátní SSCC, jediná GS1 implementace, offline.
2. Chybějící nebo slabé testy (zejména GS1 vektory, hranice N, atomicita, duplicity, obnova po pádu).
3. Souběh a stavy: dvě rychlé události téhož kódu, změna typu uprostřed palety, životní cyklus kamery, odepřené oprávnění.
4. Natvrdo napsané české texty, chybějící lokalizace, nepřístupné cíle (< 56 dp), barva jako jediný signál.
5. Závislosti: zbytečné nebo neověřené verze/API.
6. Dokumentace a CHANGELOG.

Výstup: tabulka `Závažnost (kritická/vysoká/střední/nízká) | Soubor:řádek | Problém | Navržená oprava`,
pak 3 věci, které bys opravil jako první. Označ, co jsi skutečně spustil a co je jen úsudek z čtení kódu.

# ADR-0001 – Volba technologie

- Stav: **přijato**
- Datum: 2026-10-29

## Kontext

Aplikaci bude vyvíjet jeden člověk s pomocí AI agenta. Primární zařízení je mobilní telefon se současným prohlížečem. Potřebujeme kontinuální skenování, lokální databázi, GS1-128/SSCC štítky a spolehlivý provoz offline.

## Rozhodnutí

| Oblast | Volba | Důvod |
|---|---|---|
| UI | **HTML5 + CSS3 + JavaScript ES modules** | Žádná instalace nativního runtime, nízké nároky na údržbu a přímá podpora mobilních prohlížečů. |
| Vývojový server/build | Vite | Rychlý lokální vývoj a statický produkční build. |
| PWA | Web App Manifest + service worker | Instalace na domovskou obrazovku a cache aplikačního shellu. |
| Lokální databáze | IndexedDB | Asynchronní ukládání strukturovaných dat a transakcí v prohlížeči. |
| Testy | Vitest + fake-indexeddb | Opakovatelné automatické testy aplikační logiky a lokálního úložiště. |
| Kamerové skenování (M1) | Vybere se knihovna po ověření aktuální podpory formátů, GS separátoru a mobilních prohlížečů. | Kamera je důležitá část provozu; kompatibilitu nelze předpokládat bez testu na reálném zařízení. |
| GS1 logika | Čistý JavaScript bez vazby na UI | Jediné místo pro parsování, kontrolní číslice a generování SSCC; testy proti sdíleným vektorům. |

## Zvažované alternativy

- Flutter/Dart: zamítnuto pro tento projekt na základě požadavku uživatele na mobilní webovou aplikaci HTML/CSS/JS.
- React/SPA framework: pro M0 zbytečný; nejprve použijeme jednoduchý JavaScript a přidáme framework jen při doložené potřebě.
- Backend/synchronizace: mimo MVP; žádné skladové údaje nesmí odcházet z telefonu.

## Důsledky a rizika

- Produkční PWA a přístup ke kameře vyžadují HTTPS; localhost je vývojová výjimka.
- Podpora kamery, GS1-128, GS oddělovače, vibrací, zvuku a udržení displeje se liší mezi prohlížeči. Tyto požadavky se ověří na skutečném telefonu, nikoli pouze v unit testech.
- Browser storage není totožné s nativní databází: uživatel nebo OS mohou data prohlížeče vymazat. Později je třeba nabídnout explicitní export/zálohu.
- Service worker cache je pouze pro app shell; nikdy neukládá odpovědi obsahující soukromé skladové údaje z backendu.
- IndexedDB schéma je verzované a každá migrace musí uchovat již existující data.
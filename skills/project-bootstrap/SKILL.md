---
name: project-bootstrap
description: Bootstrap and maintain the Skladník MTZ mobile web/PWA project with Vite, HTML, CSS, JavaScript, IndexedDB and tests.
---

# project-bootstrap

Goal: keep a small, verifiable web project that can run on a phone and install as a PWA.

## Environment

```powershell
node --version
npm --version
npm install
```

Use Node.js LTS/current supported by the current Vite release. Check current package compatibility in the npm registry rather than guessing versions.

## Project setup

- Vite is the development server and build tool.
- HTML5, CSS and native JavaScript ES modules are the application stack.
- Vitest is the test runner; `fake-indexeddb` provides deterministic IndexedDB tests.
- Avoid adding a UI framework in M0 without a clear need.

## Commands

```powershell
npm run dev
npm test
npm run build
npm audit --omit=optional
```

Use HTTPS for real camera and service-worker testing; localhost is accepted by browsers as a secure development context. `file://` is not a valid run mode.

## Code organization

Keep pure domain functions under `src/core/`; store access in `src/storage/`; UI integration in `src/features/` and `src/main.js`. Keep UI copy in `src/i18n/cs.js` as the project grows.

## PWA

- Configure `public/manifest.webmanifest` with Czech app name and icons.
- Service worker caches only versioned shell assets and updates cache names when required.
- Always test first install, refresh, update and offline navigation in a real mobile browser.
- Never put private scan results into generic caches.

## Definition of done

`npm test`, `npm run build` and `npm audit --omit=optional` are clean; README and CHANGELOG describe the implementation; real-device-only checks are labelled honestly.
import './styles.css';
import { openDatabase, getDashboardSummary, getSetting, saveSetting } from './storage/db.js';

const byId = (id) => document.getElementById(id);
const statusElement = byId('connection-status');
const storageState = byId('storage-state');
let databaseReady = false;

function announce(message) {
  const target = byId('home-message');
  if (target) target.textContent = message;
}

function setStorageStatus(ready, detail = '') {
  databaseReady = ready;
  statusElement.classList.toggle('is-error', !ready);
  statusElement.classList.toggle('is-ready', ready);
  statusElement.innerHTML = ready
    ? '<span class="status-dot" aria-hidden="true"></span><span>Úložiště připraveno</span>'
    : '<span class="status-dot" aria-hidden="true"></span><span>Úložiště nedostupné</span>';
  storageState.textContent = ready ? 'Připraveno' : 'Nedostupné';
  storageState.classList.toggle('setup-state-pending', !ready);
  if (detail) announce(detail);
}

async function refreshDashboard() {
  if (!databaseReady) return;
  try {
    const summary = await getDashboardSummary();
    byId('pallet-count').textContent = String(summary.palletCount);
    byId('open-pallet').textContent = summary.openPalletNumber === null
      ? 'Žádná'
      : String(summary.openPalletNumber).padStart(4, '0');
  } catch (error) {
    console.error('Unable to read dashboard summary', error);
    announce('Lokální přehled se nepodařilo načíst. Data nebyla odeslána mimo zařízení.');
  }
}

function openPlaceholder(title, detail) {
  announce(`${title}: ${detail}`);
}

byId('start-scan').addEventListener('click', () => openPlaceholder('Skenování', 'čtečka s výběrem typu kódu bude doplněna v milníku M1.'));
byId('open-settings').addEventListener('click', () => openPlaceholder('Nastavení', 'základní preference a jejich správa budou doplněny v navazujícím kroku.'));
byId('nav-home').addEventListener('click', () => announce('Jsi na domovské obrazovce.'));
byId('nav-pallets').addEventListener('click', () => openPlaceholder('Palety', 'seznam a detail palet budou doplněny v milníku M2.'));
byId('nav-settings').addEventListener('click', () => openPlaceholder('Nastavení', 'nastavení aplikace bude rozšířeno v navazujícím kroku.'));

async function boot() {
  try {
    await openDatabase();
    setStorageStatus(true);
    await refreshDashboard();
    const installedAt = await getSetting('firstRunAt');
    if (!installedAt) await saveSetting('firstRunAt', new Date().toISOString());
  } catch (error) {
    console.error('Application bootstrap failed', error);
    setStorageStatus(false, 'Prohlížeč zablokoval lokální úložiště. Zkus aplikaci otevřít v běžném prohlížeči.');
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try { await navigator.serviceWorker.register('/sw.js'); }
    catch (error) { console.error('Service worker registration failed', error); }
  }
}

boot();
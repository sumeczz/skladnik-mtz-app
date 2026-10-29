import './styles.css';
import { openDatabase, getDashboardSummary, getSetting, saveSetting } from './storage/db.js';
import { CameraScanSource } from './core/scanning/camera.js';
import { CODE_TYPES, createScanPipeline } from './core/scanning/pipeline.js';
import { addScanToPallet, closeActivePallet, listPallets, undoLastScan } from './core/scanning/pallet-store.js';

const byId = (id) => document.getElementById(id);
const statusElement = byId('connection-status');
const storageState = byId('storage-state');
let databaseReady = false;
let selectedType = null;
let cameraSource = null;
let pipeline = null;
let scans = [];
let soundEnabled = true;
let vibrationEnabled = true;
let paused = false;
let torchEnabled = false;
let pallets = [];
let activePallet = null;
let palletCapacity = 40;
let savingScan = false;
let selectedPalletDetailId = null;
let reticleVisible = false;

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
  if (storageState) {
    storageState.textContent = ready ? 'Připraveno' : 'Nedostupné';
    storageState.classList.toggle('setup-state-pending', !ready);
  }
  if (detail) announce(detail);
}

function showScreen(screen) {
  const screens = {
    home: byId('home-screen'),
    types: byId('type-screen'),
    camera: byId('camera-screen'),
    pallets: byId('pallets-screen'),
    settings: byId('settings-screen'),
  };
  for (const [key, element] of Object.entries(screens)) element.hidden = key !== screen;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('nav-item-active'));
  const activeNav = screen === 'settings' ? byId('nav-settings') : screen === 'pallets' ? byId('nav-pallets') : screen === 'camera' || screen === 'types' ? null : byId('nav-home');
  if (activeNav) activeNav.classList.add('nav-item-active');
  if (screen !== 'camera' && cameraSource) void stopCamera();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showTypePicker() {
  byId('type-error').hidden = true;
  showScreen('types');
}

function selectType(type) {
  selectedType = type;
  document.querySelectorAll('[data-code-type]').forEach((button) => {
    const active = button.dataset.codeType === type;
    button.classList.toggle('type-option-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  byId('begin-camera').disabled = !selectedType;
  byId('type-error').hidden = true;
}

function setCameraStatus(state, detail = '') {
  const titles = {
    requesting: 'Žádám o přístup ke kameře',
    running: 'Kamera je připravena',
    paused: 'Skenování pozastaveno',
    stopped: 'Kamera vypnutá',
    error: 'Kameru nelze spustit',
  };
  byId('camera-status-title').textContent = titles[state] ?? 'Kamera se připravuje';
  byId('camera-status-detail').textContent = detail || ({
    requesting: 'Povol přístup ke kameře, pokud se prohlížeč zeptá.',
    running: 'Celý obraz kamery je aktivní skenovací plocha. Kód nemusí být v rámečku.',
    paused: 'Stiskni Pokračovat, až budeš připraven.',
    stopped: 'Spusť kameru, až budeš připraven.',
    error: 'Zkontroluj oprávnění a zabezpečené připojení.',
  }[state] ?? '');
  byId('camera-placeholder').classList.toggle('camera-placeholder-hidden', state === 'running');
  byId('camera-video').classList.toggle('camera-video-active', state === 'running');
  byId('pause-camera').textContent = state === 'paused' || state === 'stopped' || state === 'error' ? '▶ Pokračovat' : 'Ⅱ Pozastavit';
}

function playAcceptedFeedback() {
  if (soundEnabled) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 1150;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
        oscillator.addEventListener('ended', () => void context.close(), { once: true });
      }
    } catch (error) {
      console.debug('Audio feedback unavailable', error);
    }
  }
  if (vibrationEnabled && 'vibrate' in navigator) navigator.vibrate(40);
}

function playRejectedFeedback() {
  if (vibrationEnabled && 'vibrate' in navigator) navigator.vibrate([150, 70, 150]);
}

function renderScans() {
  byId('session-scan-count').textContent = String(activePallet?.scanCount ?? 0);
  byId('last-scan-value').textContent = scans.length ? scans[0].value : 'Zatím nic';
  byId('last-scan-time').textContent = scans.length ? new Date(scans[0].at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  byId('undo-scan').disabled = scans.length === 0;
  const list = byId('recent-scan-list');
  list.replaceChildren();
  if (!scans.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-list';
    empty.textContent = 'Zatím nebyl načten žádný kód.';
    list.append(empty);
    return;
  }
  for (const scan of scans.slice(0, 12)) {
    const item = document.createElement('li');
    item.className = 'recent-scan-item';
    const icon = document.createElement('span');
    icon.className = 'recent-scan-check';
    icon.textContent = '✓';
    const body = document.createElement('div');
    body.className = 'recent-scan-body';
    const value = document.createElement('strong');
    value.textContent = scan.value;
    const meta = document.createElement('small');
    meta.textContent = `${CODE_TYPES[scan.type]?.label ?? scan.type} · ${new Date(scan.at).toLocaleTimeString('cs-CZ')}`;
    body.append(value, meta);
    item.append(icon, body);
    list.append(item);
  }
}

async function refreshPalletState() {
  pallets = await listPallets();
  activePallet = pallets.find((pallet) => pallet.status === 'open') ?? null;
  scans = pallets.flatMap((pallet) => pallet.scans).sort((a, b) => b.scannedAt - a.scannedAt).map((scan) => ({ ...scan, at: scan.scannedAt, status: 'accepted' }));
  renderScans();
  const summary = await getDashboardSummary();
  byId('pallet-count').textContent = String(summary.palletCount);
  byId('open-pallet').textContent = activePallet ? `Paleta ${activePallet.number}` : 'Bez otevřené';
  byId('session-scan-count').textContent = String(activePallet?.scanCount ?? 0);
  byId('active-pallet-label').textContent = activePallet ? `Paleta ${activePallet.number} · ${activePallet.scanCount}/${activePallet.capacity ?? palletCapacity}` : 'Nová paleta při dalším skenu';
  renderPalletList();
}

function renderPalletList() {
  const list = byId('pallet-list');
  if (!list) return;
  list.replaceChildren();
  if (!pallets.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-list';
    empty.textContent = 'Zatím nejsou vytvořené žádné palety. První vznikne při načtení kódu.';
    list.append(empty);
    return;
  }
  for (const pallet of pallets) {
    const item = document.createElement('li');
    item.className = 'pallet-list-item';
    const details = document.createElement('div');
    details.className = 'pallet-list-details';
    const title = document.createElement('strong');
    title.textContent = `Paleta ${pallet.number}`;
    const meta = document.createElement('small');
    meta.textContent = `${pallet.scanCount ?? pallet.scans.length} / ${pallet.capacity ?? palletCapacity} kódů · ${new Date(pallet.createdAt).toLocaleString('cs-CZ')}`;
    const status = document.createElement('span');
    status.className = `pallet-status ${pallet.status === 'open' ? 'pallet-status-open' : ''}`;
    status.textContent = pallet.status === 'open' ? 'Otevřená' : 'Uzavřená';
    const viewCodes = document.createElement('button');
    viewCodes.type = 'button';
    viewCodes.className = 'button button-secondary pallet-view-codes';
    viewCodes.dataset.palletId = String(pallet.id);
    viewCodes.textContent = selectedPalletDetailId === pallet.id ? 'Zobrazeno' : 'Zobrazit kódy';
    viewCodes.setAttribute('aria-expanded', String(selectedPalletDetailId === pallet.id));
    details.append(title, meta);
    item.append(details, status, viewCodes);
    list.append(item);
  }
  renderPalletDetail();
}

function renderPalletDetail() {
  const panel = byId('pallet-detail');
  const list = byId('pallet-code-list');
  if (!panel || !list) return;
  const pallet = pallets.find((item) => item.id === selectedPalletDetailId);
  panel.hidden = !pallet;
  list.replaceChildren();
  if (!pallet) return;
  byId('pallet-detail-title').textContent = `Kódy palety ${pallet.number}`;
  byId('pallet-detail-meta').textContent = `${pallet.scans.length} načtených kódů · založena ${new Date(pallet.createdAt).toLocaleString('cs-CZ')}`;
  if (!pallet.scans.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-list';
    empty.textContent = 'Tato paleta zatím nemá žádné kódy.';
    list.append(empty);
    return;
  }
  for (const [index, scan] of pallet.scans.entries()) {
    const item = document.createElement('li');
    item.className = 'recent-scan-item';
    const body = document.createElement('div');
    body.className = 'recent-scan-body';
    const value = document.createElement('strong');
    value.textContent = scan.value;
    const meta = document.createElement('small');
    meta.textContent = `#${pallet.scans.length - index} · ${CODE_TYPES[scan.type]?.label ?? scan.type} · ${new Date(scan.scannedAt).toLocaleString('cs-CZ')}`;
    body.append(value, meta);
    item.append(body);
    list.append(item);
  }
}

async function handlePipelineResult(result) {
  if (result.status === 'accepted') {
    if (savingScan) return;
    savingScan = true;
    try {
      const saved = await addScanToPallet({ ...result, at: result.at ?? Date.now() }, palletCapacity);
      if (saved.status === 'duplicate') {
        byId('scan-notice').className = 'notice notice-error';
        byId('scan-notice').textContent = `Duplicitní kód – na paletě ${saved.pallet.number} už je uložen.`;
        playRejectedFeedback();
        return;
      }
      playAcceptedFeedback();
      await refreshPalletState();
      byId('scan-notice').className = 'notice notice-success';
      byId('scan-notice').textContent = saved.nextPallet
        ? `Paleta ${saved.pallet.number} je plná a uzavřela se. Pokračuješ na paletě ${saved.nextPallet.number}.`
        : `Uloženo na paletu ${saved.pallet.number}. ${saved.pallet.scanCount}/${palletCapacity} kódů.`;
      byId('last-scan-value').title = result.value;
    } catch (error) {
      byId('scan-notice').className = 'notice notice-error';
      byId('scan-notice').textContent = `Kód se nepodařilo bezpečně uložit: ${error.message}`;
      playRejectedFeedback();
    } finally {
      savingScan = false;
    }
    return;
  }
  if (result.status === 'rejected') {
    byId('scan-notice').className = 'notice notice-error';
    byId('scan-notice').textContent = result.reason;
    playRejectedFeedback();
  }
}

async function stopCamera() {
  const source = cameraSource;
  cameraSource = null;
  if (source) {
    await source.stop();
    source.destroy();
  }
  paused = false;
  torchEnabled = false;
}

async function startCamera() {
  if (!selectedType) {
    byId('type-error').textContent = 'Nejdřív vyber typ kódu.';
    byId('type-error').hidden = false;
    return;
  }
  showScreen('camera');
  byId('camera-title').textContent = 'Skenování';
  byId('active-code-type').textContent = CODE_TYPES[selectedType].label;
  byId('scan-notice').className = 'notice';
  byId('scan-notice').textContent = 'Skenuje se celý obraz kamery. Není potřeba mířit do rámečku.';
  pipeline = createScanPipeline({ type: selectedType, onResult: handlePipelineResult });
  cameraSource = new CameraScanSource({
    videoElement: byId('camera-video'),
    onScan: (rawScan) => pipeline.accept(rawScan),
    onStatus: (state) => {
      if (state === 'paused') paused = true;
      if (state === 'running') paused = false;
      setCameraStatus(state);
    },
    onError: (error) => {
      setCameraStatus('error', error.message);
    },
  });
  try {
    await cameraSource.start(selectedType);
    byId('pause-camera').disabled = false;
  } catch (error) {
    setCameraStatus('error', error.message);
    byId('scan-notice').className = 'notice notice-error';
    byId('scan-notice').textContent = error.message;
    byId('pause-camera').textContent = '▶ Zkusit znovu';
    if (cameraSource) {
      cameraSource.destroy();
      cameraSource = null;
    }
  }
}

async function togglePause() {
  if (!cameraSource) {
    await startCamera();
    return;
  }
  try {
    if (paused) {
      await cameraSource.resume();
      paused = false;
    } else {
      await cameraSource.pause();
      paused = true;
    }
  } catch (error) {
    setCameraStatus('error', error.message);
    byId('scan-notice').className = 'notice notice-error';
    byId('scan-notice').textContent = error.message;
  }
}

byId('start-scan').addEventListener('click', showTypePicker);
byId('type-back').addEventListener('click', () => showScreen('home'));
byId('camera-back').addEventListener('click', () => showTypePicker());
byId('begin-camera').addEventListener('click', startCamera);
byId('code-type-options').addEventListener('click', (event) => {
  const button = event.target.closest('[data-code-type]');
  if (button) selectType(button.dataset.codeType);
});
byId('pause-camera').addEventListener('click', togglePause);
byId('reticle-toggle').addEventListener('click', () => {
  reticleVisible = !reticleVisible;
  byId('scan-reticle').classList.toggle('scan-reticle-visible', reticleVisible);
  byId('reticle-toggle').setAttribute('aria-pressed', String(reticleVisible));
  byId('reticle-toggle').textContent = reticleVisible ? 'Skrýt zaměřovací pole' : 'Zobrazit zaměřovací pole';
  byId('scan-notice').className = 'notice';
  byId('scan-notice').textContent = reticleVisible
    ? 'Zaměřovací pole je pouze vizuální pomůcka. Skenování stále probíhá přes celý obraz kamery.'
    : 'Celý obraz kamery je aktivní skenovací plocha. Není potřeba mířit do rámečku.';
});
byId('torch-toggle').addEventListener('click', async () => {
  try {
    if (!cameraSource) throw new Error('Nejdřív spusť kameru.');
    await cameraSource.setTorch(!torchEnabled);
    torchEnabled = !torchEnabled;
    byId('torch-toggle').classList.toggle('torch-active', torchEnabled);
    byId('torch-toggle').setAttribute('aria-label', torchEnabled ? 'Vypnout svítilnu' : 'Zapnout svítilnu');
  } catch (error) {
    byId('scan-notice').className = 'notice notice-error';
    byId('scan-notice').textContent = error.message;
  }
});
byId('manual-entry').addEventListener('click', () => {
  byId('manual-value').value = '';
  byId('manual-dialog').showModal();
  byId('manual-value').focus();
});
function closeManualDialog() { byId('manual-dialog').close(); }
byId('manual-close').addEventListener('click', closeManualDialog);
byId('manual-cancel').addEventListener('click', closeManualDialog);
byId('manual-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = byId('manual-value').value.trim();
  if (!value || !selectedType) return;
  if (!pipeline) pipeline = createScanPipeline({ type: selectedType, onResult: handlePipelineResult });
  const format = CODE_TYPES[selectedType].formats[0];
  const result = pipeline.accept({ value, format, source: 'manual', at: Date.now() });
  if (result.status === 'accepted') closeManualDialog();
  else if (result.status === 'rejected') {
    byId('manual-value').setCustomValidity(result.reason);
    byId('manual-value').reportValidity();
    byId('manual-value').setCustomValidity('');
  } else if (result.status === 'cooldown') {
    closeManualDialog();
  }
});
byId('undo-scan').addEventListener('click', async () => {
  try {
    const undone = await undoLastScan();
    if (!undone) return;
    await refreshPalletState();
    byId('scan-notice').className = 'notice';
    byId('scan-notice').textContent = `Vrácen poslední sken z palety ${undone.palletNumber}.`;
  } catch (error) {
    byId('scan-notice').className = 'notice notice-error';
    byId('scan-notice').textContent = `Sken se nepodařilo vrátit: ${error.message}`;
  }
});
byId('open-settings').addEventListener('click', () => showScreen('settings'));
byId('settings-back').addEventListener('click', () => showScreen('home'));
byId('pallets-back').addEventListener('click', () => showScreen('home'));
byId('nav-home').addEventListener('click', () => showScreen('home'));
byId('brand-home').addEventListener('click', (event) => { event.preventDefault(); showScreen('home'); });
byId('nav-pallets').addEventListener('click', async () => { await refreshPalletState(); showScreen('pallets'); });
byId('pallet-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-pallet-id]');
  if (!button) return;
  const id = Number(button.dataset.palletId);
  selectedPalletDetailId = selectedPalletDetailId === id ? null : id;
  renderPalletList();
  if (selectedPalletDetailId !== null) byId('pallet-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
byId('pallet-detail-close').addEventListener('click', () => {
  selectedPalletDetailId = null;
  renderPalletList();
});
byId('close-pallet').addEventListener('click', async () => {
  try {
    const closed = await closeActivePallet();
    await refreshPalletState();
    announce(closed ? `Paleta ${closed.number} byla uzavřena.` : 'Není žádná otevřená paleta.');
  } catch (error) { announce(`Paletu se nepodařilo uzavřít: ${error.message}`); }
});
byId('save-capacity').addEventListener('click', async () => {
  const value = Number(byId('pallet-capacity').value);
  if (!Number.isInteger(value) || value < 1 || value > 10000) {
    byId('capacity-notice').textContent = 'Zadej celé číslo od 1 do 10 000.';
    byId('capacity-notice').className = 'notice notice-error';
    return;
  }
  try {
    palletCapacity = value;
    await saveSetting('palletCapacity', value);
    byId('capacity-notice').className = 'notice notice-success';
    byId('capacity-notice').textContent = `Limit ${value} kódů byl uložen. U otevřené palety se nový limit uplatní při dalším skenu.`;
    await refreshPalletState();
  } catch (error) {
    byId('capacity-notice').className = 'notice notice-error';
    byId('capacity-notice').textContent = error.message;
  }
});
byId('nav-settings').addEventListener('click', () => showScreen('settings'));
byId('setting-sound').addEventListener('change', async (event) => { soundEnabled = event.target.checked; await saveSetting('soundEnabled', soundEnabled); });
byId('setting-vibration').addEventListener('change', async (event) => { vibrationEnabled = event.target.checked; await saveSetting('vibrationEnabled', vibrationEnabled); });
window.addEventListener('pagehide', () => { if (cameraSource) void cameraSource.stop(); });

async function boot() {
  try {
    await openDatabase();
    setStorageStatus(true);
    const installedAt = await getSetting('firstRunAt');
    if (!installedAt) await saveSetting('firstRunAt', new Date().toISOString());
    palletCapacity = Number(await getSetting('palletCapacity')) || 40;
    soundEnabled = (await getSetting('soundEnabled')) ?? true;
    vibrationEnabled = (await getSetting('vibrationEnabled')) ?? true;
    byId('setting-sound').checked = soundEnabled;
    byId('setting-vibration').checked = vibrationEnabled;
    byId('pallet-capacity').value = String(palletCapacity);
    await refreshPalletState();
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

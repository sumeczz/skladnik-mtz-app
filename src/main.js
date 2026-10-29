import './styles.css';
import { openDatabase, getSetting, saveSetting } from './storage/db.js';
import { CameraScanSource } from './core/scanning/camera.js';
import { CODE_TYPES, createScanPipeline } from './core/scanning/pipeline.js';

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
    settings: byId('settings-screen'),
  };
  for (const [key, element] of Object.entries(screens)) element.hidden = key !== screen;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('nav-item-active'));
  const activeNav = screen === 'settings' ? byId('nav-settings') : screen === 'camera' || screen === 'types' ? null : byId('nav-home');
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
    running: 'Drž čárový kód uvnitř rámečku.',
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
  byId('session-scan-count').textContent = String(scans.length);
  byId('pallet-count').textContent = String(scans.length);
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

function handlePipelineResult(result) {
  if (result.status === 'accepted') {
    scans.unshift(result);
    renderScans();
    playAcceptedFeedback();
    byId('scan-notice').className = 'notice notice-success';
    byId('scan-notice').textContent = 'Načteno. Můžeš hned pokračovat dalším kódem.';
    byId('last-scan-value').title = result.value;
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
  byId('scan-notice').textContent = 'Drž kód v rámečku. Čtečka běží kontinuálně.';
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
byId('undo-scan').addEventListener('click', () => {
  if (!scans.length) return;
  scans.shift();
  renderScans();
  byId('scan-notice').className = 'notice';
  byId('scan-notice').textContent = 'Poslední sken byl vrácen z dočasného seznamu. Palety se spravují až v M2.';
});
byId('open-settings').addEventListener('click', () => showScreen('settings'));
byId('settings-back').addEventListener('click', () => showScreen('home'));
byId('nav-home').addEventListener('click', () => showScreen('home'));
byId('brand-home').addEventListener('click', (event) => { event.preventDefault(); showScreen('home'); });
byId('nav-pallets').addEventListener('click', () => {
  announce('Historie a ukládání palet budou doplněny v milníku M2.');
  showScreen('home');
});
byId('nav-settings').addEventListener('click', () => showScreen('settings'));
byId('setting-sound').addEventListener('change', (event) => { soundEnabled = event.target.checked; });
byId('setting-vibration').addEventListener('change', (event) => { vibrationEnabled = event.target.checked; });
window.addEventListener('pagehide', () => { if (cameraSource) void cameraSource.stop(); });

async function boot() {
  try {
    await openDatabase();
    setStorageStatus(true);
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

import './styles.css';
import { openDatabase, getDashboardSummary, getSetting, saveSetting } from './storage/db.js';
import { CameraScanSource } from './core/scanning/camera.js';
import { CODE_TYPES, createScanPipeline, parseGs1 } from './core/scanning/pipeline.js';
import bwipjs from 'bwip-js';
import { addScanToPallet, closeActivePallet, listPallets, undoLastScan, listOrders, createOrder, setActiveOrder, updateOrder, deleteOrder, updatePallet, deletePallet } from './core/scanning/pallet-store.js';

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
let orders = [];
let activeOrderId = null;
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

function playPalletClosedFeedback() {
  if (soundEnabled) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
        gain.connect(context.destination);
        for (const [frequency, start, duration] of [[660, 0, 0.12], [880, 0.14, 0.18]]) {
          const oscillator = context.createOscillator();
          oscillator.type = 'triangle';
          oscillator.frequency.value = frequency;
          oscillator.connect(gain);
          oscillator.start(context.currentTime + start);
          oscillator.stop(context.currentTime + start + duration);
        }
        window.setTimeout(() => void context.close(), 600);
      }
    } catch (error) { console.debug('Close sound unavailable', error); }
  }
  if (vibrationEnabled && 'vibrate' in navigator) navigator.vibrate([55, 45, 90]);
}

function showSuccessfulScan(value) {
  byId('scan-result-title').textContent = 'Kód načten a uložen';
  byId('scan-result-value').textContent = value;
  const flash = byId('scan-success-flash');
  flash.classList.remove('scan-success-flash-active');
  void flash.offsetWidth;
  flash.classList.add('scan-success-flash-active');
  window.clearTimeout(showSuccessfulScan.timeout);
  showSuccessfulScan.timeout = window.setTimeout(() => flash.classList.remove('scan-success-flash-active'), 650);
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
  [pallets, orders] = await Promise.all([listPallets(), listOrders()]);
  activeOrderId = (await getSetting('activeOrderId')) ?? null;
  if (activeOrderId !== null && !orders.some((order) => order.id === Number(activeOrderId) && order.status === 'open')) {
    activeOrderId = null;
    await setActiveOrder(null);
  }
  activePallet = pallets.find((pallet) => pallet.status === 'open') ?? null;
  scans = pallets.flatMap((pallet) => pallet.scans).sort((a, b) => b.scannedAt - a.scannedAt).map((scan) => ({ ...scan, at: scan.scannedAt, status: 'accepted' }));
  renderScans();
  const summary = await getDashboardSummary();
  byId('pallet-count').textContent = String(summary.palletCount);
  byId('open-pallet').textContent = activePallet ? `Paleta ${activePallet.number}` : 'Bez otevřené';
  byId('session-scan-count').textContent = String(activePallet?.scanCount ?? 0);
  const activeOrder = orders.find((order) => order.id === activePallet?.orderId);
  byId('active-pallet-label').textContent = activePallet ? `Paleta ${activePallet.number} · ${activePallet.scanCount}/${activePallet.capacity ?? palletCapacity}${activeOrder ? ` · ${activeOrder.name}` : ''}` : `Nová paleta při dalším skenu${orders.find((order) => order.id === Number(activeOrderId)) ? ` · ${orders.find((order) => order.id === Number(activeOrderId)).name}` : ''}`;
  renderPalletList();
  renderOrders();
}

function renderOrders() {
  const select = byId('scan-order-select');
  const selected = String(activeOrderId ?? '');
  select.replaceChildren(new Option('Bez objednávky', ''));
  for (const order of orders.filter((item) => item.status === 'open')) {
    select.add(new Option(`${order.name}${order.reference ? ' · ' + order.reference : ''}`, String(order.id)));
  }
  select.value = orders.some((order) => String(order.id) === selected && order.status === 'open') ? selected : '';
  const list = byId('order-list');
  const query = (byId('order-search')?.value ?? '').trim().toLocaleLowerCase('cs-CZ');
  list.replaceChildren();
  const visibleOrders = orders.filter((order) => {
    const relatedPallets = pallets.filter((pallet) => pallet.orderId === order.id);
    const haystack = [order.name, order.reference, order.note, ...relatedPallets.map((pallet) => `paleta ${pallet.number} ${pallet.name} ${pallet.note}`)].join(' ').toLocaleLowerCase('cs-CZ');
    return !query || haystack.includes(query);
  });
  byId('order-count').textContent = `${orders.length} objednávek`;
  if (!visibleOrders.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-list';
    empty.textContent = query ? 'Žádná objednávka neodpovídá hledání.' : 'Zatím nejsou žádné objednávky.';
    list.append(empty);
  }
  for (const order of visibleOrders) {
    const item = document.createElement('li');
    item.className = 'pallet-list-item order-list-item';
    const details = document.createElement('div');
    details.className = 'pallet-list-details';
    const title = document.createElement('strong');
    title.textContent = order.name;
    const meta = document.createElement('small');
    meta.textContent = `${order.reference || 'Bez čísla'} · ${order.palletCount} palet · ${order.scanCount} skenů · ${new Date(order.createdAt).toLocaleDateString('cs-CZ')}`;
    const status = document.createElement('span');
    status.className = `pallet-status ${order.status === 'open' ? 'pallet-status-open' : ''}`;
    status.textContent = order.status === 'open' ? 'Aktivní' : 'Uzavřená';
    details.append(title, meta, status);
    if (order.note) {
      const note = document.createElement('small');
      note.textContent = order.note;
      details.append(note);
    }
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    for (const [action, label] of [['select', 'Použít'], ['edit', 'Upravit'], [order.status === 'open' ? 'close' : 'reopen', order.status === 'open' ? 'Uzavřít' : 'Znovu otevřít'], ['delete', 'Smazat']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `button ${action === 'delete' ? 'button-danger' : 'button-secondary'}`;
      button.dataset.orderAction = action;
      button.dataset.orderId = String(order.id);
      button.textContent = label;
      if (action === 'select' && order.status !== 'open') button.disabled = true;
      actions.append(button);
    }
    item.append(details, actions);
    list.append(item);
    if (query) {
      for (const pallet of pallets.filter((entry) => entry.orderId === order.id && [`paleta ${entry.number}`, entry.name, entry.note].join(' ').toLocaleLowerCase('cs-CZ').includes(query))) {
        const palletItem = document.createElement('li');
        palletItem.className = 'pallet-list-item nested-pallet-item';
        const text = document.createElement('div');
        text.className = 'pallet-list-details';
        const name = document.createElement('strong');
        name.textContent = `↳ Paleta ${pallet.number}${pallet.name ? ' · ' + pallet.name : ''}`;
        const info = document.createElement('small');
        info.textContent = `${pallet.scanCount} kódů · ${pallet.status === 'open' ? 'Otevřená' : 'Uzavřená'}`;
        text.append(name, info);
        const edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'button button-secondary'; edit.dataset.palletAction = 'edit'; edit.dataset.palletId = String(pallet.id); edit.textContent = 'Upravit paletu';
        palletItem.append(text, edit);
        list.append(palletItem);
      }
    }
  }
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
  const query = (byId('order-search')?.value ?? '').trim().toLocaleLowerCase('cs-CZ');
  const visiblePallets = pallets.filter((pallet) => {
    const order = orders.find((entry) => entry.id === pallet.orderId);
    return !query || [pallet.number, pallet.name, pallet.note, order?.name, order?.reference, ...pallet.scans.map((scan) => scan.value)].join(' ').toLocaleLowerCase('cs-CZ').includes(query);
  });
  for (const pallet of visiblePallets) {
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
    const order = orders.find((entry) => entry.id === pallet.orderId);
    if (order) meta.textContent += ` · ${order.name}`;
    details.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    actions.append(viewCodes);
    for (const [action, label] of [['edit', 'Upravit'], ['delete', 'Smazat']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `button ${action === 'delete' ? 'button-danger' : 'button-secondary'}`;
      button.dataset.palletAction = action;
      button.dataset.palletId = String(pallet.id);
      button.textContent = label;
      actions.append(button);
    }
    item.append(details, status, actions);
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

    const barcodePanel = document.createElement('div');
    barcodePanel.className = 'pallet-generated-barcode';
    const barcodeLabel = document.createElement('small');
    barcodeLabel.textContent = `Vygenerovaný čárový kód · ${CODE_TYPES[scan.type]?.label ?? scan.type}`;
    barcodePanel.append(barcodeLabel);
    try {
      let bcid;
      let text = scan.value;
      if (scan.type === 'qr') bcid = 'qrcode';
      else if (scan.type === 'gs1128') { bcid = 'gs1-128'; text = parseGs1(scan.value).humanReadable; }
      else if (scan.type === 'code128') bcid = 'code128';
      else if (scan.type === 'ean13') bcid = 'ean13';
      else if (scan.type === 'ean8') bcid = 'ean8';
      else if (scan.type === 'code39') bcid = 'code39';
      else if (scan.type === 'dataMatrix') bcid = 'datamatrix';
      else if (scan.type === 'itf') bcid = 'interleaved2of5';
      else throw new Error('Unsupported barcode type');
      const svgText = bwipjs.toSVG({ bcid, text, scale: 2, height: 14, includetext: scan.type !== 'qr', textxalign: 'center', backgroundcolor: 'FFFFFF', barcolor: '17231A', padding: 8 });
      const generated = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
      generated.setAttribute('role', 'img');
      generated.setAttribute('aria-label', `Vygenerovan? k?d ${scan.value}`);
      generated.style.width = '100%'; generated.style.height = 'auto';
      barcodePanel.append(generated);
    } catch (error) {
      barcodePanel.classList.add('pallet-generated-barcode-error');
      barcodeLabel.textContent = 'K?d nelze v tomto form?tu vygenerovat.';
    }
    item.append(barcodePanel);
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
      if (saved.pallet.status === 'closed') playPalletClosedFeedback();
      showSuccessfulScan(result.value);
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
  byId('scan-notice').textContent = reticleVisible ? 'Skenování je omezené na vybranou oblast rámečku.' : 'Skenuje se celý obraz kamery. Zapni rámeček pro skenování v omezené oblasti.';
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
  cameraSource.setScanAreaSize(byId('scan-area-size').value);
  cameraSource.setScanAreaEnabled(reticleVisible);
  updateReticleGeometry();
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

function updateReticleGeometry() {
  const reticle = byId('scan-reticle');
  const frame = byId('camera-video');
  const frameBox = byId('camera-screen').querySelector('.camera-frame');
  const sizes = {
    small: { width: 0.42, height: 0.18 },
    medium: { width: 0.60, height: 0.28 },
    large: { width: 0.78, height: 0.42 },
    'extra-large': { width: 0.92, height: 0.62 },
  };
  const size = sizes[byId('scan-area-size').value] ?? sizes.medium;
  const frameWidth = frameBox.clientWidth;
  const frameHeight = frameBox.clientHeight;
  const videoWidth = frame.videoWidth || 16;
  const videoHeight = frame.videoHeight || 9;
  const scale = Math.min(frameWidth / videoWidth, frameHeight / videoHeight);
  const visibleWidth = videoWidth * scale;
  const visibleHeight = videoHeight * scale;
  reticle.style.width = `${(visibleWidth * size.width / frameWidth) * 100}%`;
  reticle.style.height = `${(visibleHeight * size.height / frameHeight) * 100}%`;
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
  cameraSource?.setScanAreaEnabled(reticleVisible);
  byId('reticle-toggle').setAttribute('aria-pressed', String(reticleVisible));
  byId('reticle-toggle').textContent = reticleVisible ? 'Skrýt zaměřovací pole' : 'Zobrazit zaměřovací pole';
  byId('scan-notice').className = 'notice';
  byId('scan-notice').textContent = reticleVisible
    ? 'Skenování je omezené pouze na obraz uvnitř rámečku.'
    : 'Skenuje se celý obraz kamery.';
});
byId('scan-area-size').addEventListener('change', (event) => {
  cameraSource?.setScanAreaSize(event.target.value);
  updateReticleGeometry();
  byId('scan-notice').className = 'notice';
  byId('scan-notice').textContent = reticleVisible
    ? 'Velikost rámečku i skutečné skenovací oblasti byla změněna.'
    : 'Velikost oblasti je připravena. Zapni zaměřovací pole, pokud chceš omezit skenování.';
});
byId('camera-video').addEventListener('loadedmetadata', updateReticleGeometry);
window.addEventListener('resize', updateReticleGeometry);
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
byId('pallet-list').addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-pallet-action]');
  if (actionButton) {
    const id = Number(actionButton.dataset.palletId);
    const pallet = pallets.find((item) => item.id === id);
    if (!pallet) return;
    try {
      if (actionButton.dataset.palletAction === 'delete') {
        if (!window.confirm(`Opravdu smazat paletu ${pallet.number} a všech ${pallet.scanCount} uložených skenů? Tuto akci nelze vrátit.`)) return;
        await deletePallet(id);
        if (selectedPalletDetailId === id) selectedPalletDetailId = null;
        announce(`Paleta ${pallet.number} a její skeny byly smazány.`);
      } else if (actionButton.dataset.palletAction === 'edit') {
        const name = window.prompt('Název palety / štítek:', pallet.name ?? '');
        if (name === null) return;
        const note = window.prompt('Poznámka k paletě:', pallet.note ?? '');
        if (note === null) return;
        const orderChoices = ['Bez objednávky', ...orders.map((order) => `${order.id}: ${order.name}`)].join('\n');
        const orderAnswer = window.prompt(`Přiřadit k objednávce (zadej ID, prázdné = bez objednávky):\n${orderChoices}`, pallet.orderId == null ? '' : String(pallet.orderId));
        if (orderAnswer === null) return;
        const orderId = orderAnswer.trim() ? Number(orderAnswer) : null;
        if (orderId !== null && !orders.some((order) => order.id === orderId)) throw new Error('Takové ID objednávky neexistuje.');
        await updatePallet(id, { name, note, orderId });
      }
      await refreshPalletState();
    } catch (error) { announce(error.message); }
    return;
  }
  const button = event.target.closest('[data-pallet-id]');
  if (!button) return;
  const id = Number(button.dataset.palletId);
  selectedPalletDetailId = selectedPalletDetailId === id ? null : id;
  renderPalletList();
  if (selectedPalletDetailId !== null) byId('pallet-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
byId('scan-order-select').addEventListener('change', async (event) => {
  try {
    activeOrderId = await setActiveOrder(event.target.value || null);
    byId('quick-order-notice').className = 'notice notice-success';
    byId('quick-order-notice').textContent = activeOrderId
      ? `Nové palety budou přiřazeny k objednávce „${orders.find((order) => order.id === Number(activeOrderId))?.name ?? ''}“.`
      : 'Nové palety nebudou přiřazeny k objednávce.';
    await refreshPalletState();
  } catch (error) {
    byId('quick-order-notice').className = 'notice notice-error';
    byId('quick-order-notice').textContent = error.message;
  }
});

async function submitNewOrder(name, reference, note, noticeElement) {
  try {
    const order = await createOrder({ name, reference, note });
    await refreshPalletState();
    byId('scan-order-select').value = String(order.id);
    noticeElement.className = 'notice notice-success';
    noticeElement.textContent = `Objednávka „${order.name}“ vytvořena a vybrána pro skenování.`;
    return order;
  } catch (error) {
    noticeElement.className = 'notice notice-error';
    noticeElement.textContent = error.message;
    return null;
  }
}
byId('quick-order-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const order = await submitNewOrder(byId('quick-order-name').value, byId('quick-order-reference').value, '', byId('quick-order-notice'));
  if (order) { byId('quick-order-form').reset(); byId('scan-order-select').value = String(order.id); }
});
byId('order-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const order = await submitNewOrder(byId('order-admin-name').value, byId('order-admin-reference').value, byId('order-admin-note').value, byId('order-admin-notice'));
  if (order) { byId('order-create-form').reset(); byId('order-search').value = ''; }
});
byId('order-search').addEventListener('input', () => { renderOrders(); renderPalletList(); });
byId('order-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-order-action]');
  if (!button) return;
  const id = Number(button.dataset.orderId);
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  try {
    switch (button.dataset.orderAction) {
      case 'select':
        await setActiveOrder(id);
        activeOrderId = id;
        byId('scan-order-select').value = String(id);
        announce(`Pro skenování je vybrána objednávka „${order.name}“.`);
        break;
      case 'edit': {
        const name = window.prompt('Název objednávky:', order.name);
        if (name === null) return;
        const reference = window.prompt('Číslo objednávky / reference:', order.reference ?? '');
        if (reference === null) return;
        const note = window.prompt('Poznámka:', order.note ?? '');
        if (note === null) return;
        await updateOrder(id, { name, reference, note });
        break;
      }
      case 'close':
        if (!window.confirm(`Uzavřít objednávku „${order.name}“? Stávající palety zůstanou zachovány.`)) return;
        await updateOrder(id, { status: 'closed' });
        break;
      case 'reopen':
        await updateOrder(id, { status: 'open' });
        break;
      case 'delete':
        if (!window.confirm(`Smazat objednávku „${order.name}“? Objednávku lze smazat pouze tehdy, pokud k ní nejsou přiřazeny palety.`)) return;
        await deleteOrder(id);
        break;
    }
    await refreshPalletState();
  } catch (error) {
    byId('order-admin-notice').className = 'notice notice-error';
    byId('order-admin-notice').textContent = error.message;
  }
});
byId('pallet-detail-close').addEventListener('click', () => {
  selectedPalletDetailId = null;
  renderPalletList();
});
byId('close-pallet').addEventListener('click', async () => {
  try {
    const closed = await closeActivePallet();
    if (closed) playPalletClosedFeedback();
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
byId('fullscreen-toggle').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } else {
      announce('Celá obrazovka není v tomto prohlížeči dostupná. Po instalaci PWA se aplikace otevře samostatně.');
    }
  } catch (error) {
    announce('Celou obrazovku nelze zapnout. Na iPhonu/iPadu přidej aplikaci na plochu a spusť ji odtud.');
  }
});
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  const button = byId('fullscreen-toggle');
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '↙' : '⛶';
  button.title = active ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
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
    try { await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }); }
    catch (error) { console.error('Service worker registration failed', error); }
  }
}

boot();

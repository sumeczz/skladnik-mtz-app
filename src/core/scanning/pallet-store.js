import { openDatabase, getSetting } from '../../storage/db.js';

const DEFAULT_CAPACITY = 40;

function req(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('Databázový požadavek selhal.')), { once: true });
  });
}

function completed(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Databázová transakce byla zrušena.')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Databázová transakce selhala.')), { once: true });
  });
}

function newPallet(number, capacity) {
  return {
    uuid: crypto.randomUUID(),
    number,
    status: 'open',
    scanCount: 0,
    capacity,
    createdAt: Date.now(),
    closedAt: null,
    closeReason: null,
  };
}

async function capacityValue() {
  const value = Number(await getSetting('palletCapacity'));
  return Number.isInteger(value) && value >= 1 && value <= 10000 ? value : DEFAULT_CAPACITY;
}

async function createPalletInTransaction(transaction, capacity) {
  const counters = transaction.objectStore('counters');
  const current = await req(counters.get('palletNumber'));
  const number = Number(current?.value ?? 0) + 1;
  const pallet = newPallet(number, capacity);
  const id = await req(transaction.objectStore('pallets').add(pallet));
  counters.put({ name: 'palletNumber', value: number });
  return { ...pallet, id };
}

export async function listPallets() {
  const db = await openDatabase();
  const tx = db.transaction(['pallets', 'scans'], 'readonly');
  const [pallets, scans] = await Promise.all([
    req(tx.objectStore('pallets').getAll()),
    req(tx.objectStore('scans').getAll()),
  ]);
  const byPallet = new Map();
  for (const scan of scans) {
    const items = byPallet.get(scan.palletId) ?? [];
    items.push(scan);
    byPallet.set(scan.palletId, items);
  }
  return pallets.sort((a, b) => b.number - a.number).map((pallet) => ({
    ...pallet,
    scans: (byPallet.get(pallet.id) ?? []).sort((a, b) => b.seq - a.seq),
  }));
}

export async function getActivePallet() {
  const pallets = await listPallets();
  return pallets.find((pallet) => pallet.status === 'open') ?? null;
}

export async function addScanToPallet(scan, capacity = undefined) {
  const db = await openDatabase();
  const max = capacity ?? await capacityValue();
  const tx = db.transaction(['pallets', 'scans', 'counters'], 'readwrite');
  const done = completed(tx);
  const palletsStore = tx.objectStore('pallets');
  const scansStore = tx.objectStore('scans');
  try {
    let openPallets = (await req(palletsStore.getAll())).filter((p) => p.status === 'open').sort((a, b) => a.number - b.number);
    let pallet = openPallets[0];
    if (!pallet) pallet = await createPalletInTransaction(tx, max);
    let currentScans = await req(scansStore.index('palletId').getAll(pallet.id));
    // If the user lowered the capacity below the current count, roll over before adding another scan.
    if (currentScans.length >= max) {
      pallet.status = 'closed';
      pallet.closedAt = Date.now();
      pallet.closeReason = 'capacity';
      palletsStore.put(pallet);
      pallet = await createPalletInTransaction(tx, max);
      currentScans = [];
    }
    if (currentScans.some((item) => item.value === scan.value)) {
      tx.abort();
      await done.catch(() => {});
      return { status: 'duplicate', pallet };
    }
    const seq = currentScans.reduce((highest, item) => Math.max(highest, item.seq ?? 0), 0) + 1;
    const storedScan = {
      value: scan.value,
      type: scan.type,
      format: scan.format,
      source: scan.source,
      scannedAt: scan.at ?? Date.now(),
      palletId: pallet.id,
      seq,
    };
    const scanId = await req(scansStore.add(storedScan));
    pallet.scanCount = seq;
    pallet.capacity = max;
    if (seq >= max) {
      pallet.status = 'closed';
      pallet.closedAt = Date.now();
      pallet.closeReason = 'capacity';
    }
    palletsStore.put(pallet);
    // Closing the full pallet and allocating the next pallet happen in the same transaction.
    const nextPallet = seq >= max ? await createPalletInTransaction(tx, max) : null;
    await done;
    return { status: 'accepted', scan: { ...storedScan, id: scanId }, pallet: { ...pallet }, nextPallet };
  } catch (error) {
    await done.catch(() => {});
    throw error;
  }
}

export async function undoLastScan() {
  const db = await openDatabase();
  const tx = db.transaction(['pallets', 'scans'], 'readwrite');
  const done = completed(tx);
  const palletsStore = tx.objectStore('pallets');
  const scansStore = tx.objectStore('scans');
  try {
    const [pallets, scans] = await Promise.all([req(palletsStore.getAll()), req(scansStore.getAll())]);
    const last = scans.sort((a, b) => (b.scannedAt - a.scannedAt) || (b.id - a.id))[0];
    if (!last) { await done; return null; }
    scansStore.delete(last.id);
    const pallet = pallets.find((item) => item.id === last.palletId);
    if (pallet) {
      pallet.scanCount = Math.max(0, (pallet.scanCount ?? 1) - 1);
      if (pallet.closeReason === 'capacity') {
        pallet.status = 'open';
        pallet.closedAt = null;
        pallet.closeReason = null;
      }
      palletsStore.put(pallet);
    }
    // If the capacity rollover created an unused next pallet, remove it so undo restores the prior state.
    const emptyOpen = pallets.filter((item) => item.status === 'open' && item.id !== pallet?.id && (item.scanCount ?? 0) === 0);
    for (const empty of emptyOpen) palletsStore.delete(empty.id);
    await done;
    return { ...last, palletNumber: pallet?.number };
  } catch (error) {
    await done.catch(() => {});
    throw error;
  }
}

export async function closeActivePallet() {
  const db = await openDatabase();
  const tx = db.transaction('pallets', 'readwrite');
  const done = completed(tx);
  const store = tx.objectStore('pallets');
  const pallets = await req(store.getAll());
  const pallet = pallets.filter((item) => item.status === 'open').sort((a, b) => a.number - b.number)[0];
  if (!pallet) { await done; return null; }
  pallet.status = 'closed';
  pallet.closedAt = Date.now();
  pallet.closeReason = 'manual';
  store.put(pallet);
  await done;
  return pallet;
}

import { openDatabase, getSetting, saveSetting } from '../../storage/db.js';

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

function newPallet(number, capacity, orderId = null) {
  return {
    uuid: crypto.randomUUID(), number, status: 'open', scanCount: 0, capacity,
    orderId: orderId ?? null, name: '', note: '',
    createdAt: Date.now(), closedAt: null, closeReason: null,
  };
}

async function capacityValue() {
  const value = Number(await getSetting('palletCapacity'));
  return Number.isInteger(value) && value >= 1 && value <= 10000 ? value : DEFAULT_CAPACITY;
}

async function createPalletInTransaction(transaction, capacity, orderId = null) {
  const counters = transaction.objectStore('counters');
  const current = await req(counters.get('palletNumber'));
  const number = Number(current?.value ?? 0) + 1;
  const pallet = newPallet(number, capacity, orderId);
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

export async function listOrders() {
  const db = await openDatabase();
  const tx = db.transaction(['orders', 'pallets', 'scans'], 'readonly');
  const [orders, pallets, scans] = await Promise.all([
    req(tx.objectStore('orders').getAll()),
    req(tx.objectStore('pallets').getAll()),
    req(tx.objectStore('scans').getAll()),
  ]);
  const scanCounts = new Map();
  for (const scan of scans) scanCounts.set(scan.palletId, (scanCounts.get(scan.palletId) ?? 0) + 1);
  return orders.sort((a, b) => b.createdAt - a.createdAt).map((order) => {
    const orderPallets = pallets.filter((pallet) => pallet.orderId === order.id);
    return {
      ...order,
      palletCount: orderPallets.length,
      scanCount: orderPallets.reduce((sum, pallet) => sum + (scanCounts.get(pallet.id) ?? 0), 0),
      pallets: orderPallets.map((pallet) => pallet.number),
    };
  });
}

export async function createOrder({ name, reference = '', note = '' }) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) throw new Error('Zadej název objednávky.');
  const db = await openDatabase();
  const tx = db.transaction('orders', 'readwrite');
  const done = completed(tx);
  const order = {
    uuid: crypto.randomUUID(), name: cleanName, reference: String(reference).trim(),
    note: String(note).trim(), status: 'open', createdAt: Date.now(), closedAt: null,
  };
  const id = await req(tx.objectStore('orders').add(order));
  await done;
  await setActiveOrder(id);
  return { ...order, id };
}

export async function setActiveOrder(orderId) {
  const id = orderId === null || orderId === '' ? null : Number(orderId);
  if (id !== null && !(await listOrders()).some((order) => order.id === id && order.status === 'open')) {
    throw new Error('Vybraná objednávka neexistuje nebo je uzavřená.');
  }
  await saveSetting('activeOrderId', id);
  const openPallet = (await listPallets()).find((pallet) => pallet.status === 'open');
  if (openPallet) await updatePallet(openPallet.id, { orderId: id });
  return id;
}

export async function updateOrder(orderId, patch) {
  const db = await openDatabase();
  const tx = db.transaction('orders', 'readwrite');
  const done = completed(tx);
  const store = tx.objectStore('orders');
  const order = await req(store.get(Number(orderId)));
  if (!order) { tx.abort(); await done.catch(() => {}); throw new Error('Objednávka nebyla nalezena.'); }
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) { tx.abort(); await done.catch(() => {}); throw new Error('Název objednávky nesmí být prázdný.'); }
    order.name = name;
  }
  if (patch.reference !== undefined) order.reference = String(patch.reference).trim();
  if (patch.note !== undefined) order.note = String(patch.note).trim();
  if (patch.status === 'closed' || patch.status === 'open') {
    order.status = patch.status;
    order.closedAt = patch.status === 'closed' ? Date.now() : null;
  }
  store.put(order);
  await done;
  if (order.status === 'closed' && Number(await getSetting('activeOrderId')) === order.id) await setActiveOrder(null);
  return order;
}

export async function deleteOrder(orderId) {
  const db = await openDatabase();
  const tx = db.transaction(['orders', 'pallets'], 'readwrite');
  const done = completed(tx);
  const palletsStore = tx.objectStore('pallets');
  const orderPallets = (await req(palletsStore.getAll())).filter((pallet) => pallet.orderId === Number(orderId));
  if (orderPallets.length) {
    tx.abort();
    await done.catch(() => {});
    throw new Error('Objednávku nelze smazat, dokud obsahuje palety. Nejprve palety přesuň nebo smaž.');
  }
  tx.objectStore('orders').delete(Number(orderId));
  await done;
  if (Number(await getSetting('activeOrderId')) === Number(orderId)) await saveSetting('activeOrderId', null);
}

export async function getActivePallet() {
  const pallets = await listPallets();
  return pallets.find((pallet) => pallet.status === 'open') ?? null;
}

export async function addScanToPallet(scan, capacity = undefined) {
  const db = await openDatabase();
  const max = capacity ?? await capacityValue();
  const activeOrderId = Number(await getSetting('activeOrderId')) || null;
  const tx = db.transaction(['pallets', 'scans', 'counters'], 'readwrite');
  const done = completed(tx);
  const palletsStore = tx.objectStore('pallets');
  const scansStore = tx.objectStore('scans');
  try {
    let openPallets = (await req(palletsStore.getAll())).filter((p) => p.status === 'open').sort((a, b) => a.number - b.number);
    let pallet = openPallets[0];
    if (!pallet) pallet = await createPalletInTransaction(tx, max, activeOrderId);
    let currentScans = await req(scansStore.index('palletId').getAll(pallet.id));
    if (currentScans.length >= max) {
      pallet.status = 'closed'; pallet.closedAt = Date.now(); pallet.closeReason = 'capacity';
      palletsStore.put(pallet);
      pallet = await createPalletInTransaction(tx, max, activeOrderId);
      currentScans = [];
    }
    if (currentScans.some((item) => item.value === scan.value)) {
      tx.abort(); await done.catch(() => {});
      return { status: 'duplicate', pallet };
    }
    const seq = currentScans.reduce((highest, item) => Math.max(highest, item.seq ?? 0), 0) + 1;
    const storedScan = {
      value: scan.value, type: scan.type, format: scan.format, source: scan.source,
      scannedAt: scan.at ?? Date.now(), palletId: pallet.id, seq,
    };
    const scanId = await req(scansStore.add(storedScan));
    pallet.scanCount = seq;
    pallet.capacity = max;
    if (seq >= max) {
      pallet.status = 'closed'; pallet.closedAt = Date.now(); pallet.closeReason = 'capacity';
    }
    palletsStore.put(pallet);
    const nextPallet = seq >= max ? await createPalletInTransaction(tx, max, activeOrderId) : null;
    await done;
    return { status: 'accepted', scan: { ...storedScan, id: scanId }, pallet: { ...pallet }, nextPallet };
  } catch (error) {
    await done.catch(() => {});
    throw error;
  }
}

export async function updatePallet(palletId, patch) {
  const db = await openDatabase();
  const tx = db.transaction('pallets', 'readwrite');
  const done = completed(tx);
  const store = tx.objectStore('pallets');
  const pallet = await req(store.get(Number(palletId)));
  if (!pallet) { tx.abort(); await done.catch(() => {}); throw new Error('Paleta nebyla nalezena.'); }
  if (patch.name !== undefined) pallet.name = String(patch.name).trim();
  if (patch.note !== undefined) pallet.note = String(patch.note).trim();
  if (patch.orderId !== undefined) pallet.orderId = patch.orderId === '' || patch.orderId === null ? null : Number(patch.orderId);
  if (patch.status === 'closed' && pallet.status !== 'closed') {
    pallet.status = 'closed'; pallet.closedAt = Date.now(); pallet.closeReason = 'manual';
  } else if (patch.status === 'open') {
    const all = await req(store.getAll());
    if (all.some((item) => item.status === 'open' && item.id !== pallet.id)) {
      tx.abort(); await done.catch(() => {}); throw new Error('Nejprve uzavři jinou otevřenou paletu.');
    }
    pallet.status = 'open'; pallet.closedAt = null; pallet.closeReason = null;
  }
  store.put(pallet);
  await done;
  return pallet;
}

export async function deletePallet(palletId) {
  const db = await openDatabase();
  const tx = db.transaction(['pallets', 'scans'], 'readwrite');
  const done = completed(tx);
  const pallet = await req(tx.objectStore('pallets').get(Number(palletId)));
  if (!pallet) { tx.abort(); await done.catch(() => {}); throw new Error('Paleta nebyla nalezena.'); }
  const scans = await req(tx.objectStore('scans').index('palletId').getAll(pallet.id));
  for (const scan of scans) tx.objectStore('scans').delete(scan.id);
  tx.objectStore('pallets').delete(pallet.id);
  await done;
  return { ...pallet, deletedScans: scans.length };
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
      if (pallet.closeReason === 'capacity') { pallet.status = 'open'; pallet.closedAt = null; pallet.closeReason = null; }
      palletsStore.put(pallet);
    }
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
  pallet.status = 'closed'; pallet.closedAt = Date.now(); pallet.closeReason = 'manual';
  store.put(pallet);
  await done;
  return pallet;
}

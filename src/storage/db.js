const DB_NAME = 'skladnik-mtz';
const DB_VERSION = 1;
let dbPromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')), { once: true });
  });
}

export function openDatabase() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pallets')) {
        const store = db.createObjectStore('pallets', { keyPath: 'id', autoIncrement: true });
        store.createIndex('uuid', 'uuid', { unique: true });
        store.createIndex('number', 'number', { unique: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('scans')) {
        const store = db.createObjectStore('scans', { keyPath: 'id', autoIncrement: true });
        store.createIndex('palletId', 'palletId', { unique: false });
        store.createIndex('palletSeq', ['palletId', 'seq'], { unique: true });
        store.createIndex('value', 'value', { unique: false });
        store.createIndex('scannedAt', 'scannedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('counters')) db.createObjectStore('counters', { keyPath: 'name' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    });
    request.addEventListener('success', () => {
      const db = request.result;
      db.addEventListener('versionchange', () => db.close());
      resolve(db);
    }, { once: true });
    request.addEventListener('error', () => { dbPromise = undefined; reject(request.error ?? new Error('Unable to open IndexedDB.')); }, { once: true });
    request.addEventListener('blocked', () => { dbPromise = undefined; reject(new Error('IndexedDB upgrade is blocked by another open tab.')); }, { once: true });
  });
  return dbPromise;
}

export async function getSetting(key) {
  const db = await openDatabase();
  const result = await requestToPromise(db.transaction('settings', 'readonly').objectStore('settings').get(key));
  return result?.value;
}

export async function saveSetting(key, value) {
  const db = await openDatabase();
  const transaction = db.transaction('settings', 'readwrite');
  transaction.objectStore('settings').put({ key, value });
  await new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Setting write aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Setting write failed')), { once: true });
  });
}

export async function getDashboardSummary() {
  const db = await openDatabase();
  const store = db.transaction('pallets', 'readonly').objectStore('pallets');
  const [palletCount, openPallets] = await Promise.all([
    requestToPromise(store.count()),
    requestToPromise(store.index('status').getAll('open')),
  ]);
  return { palletCount, openPalletNumber: openPallets.length ? openPallets[0].number : null };
}

export async function __resetDatabaseForTests() {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
    dbPromise = undefined;
  }
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.addEventListener('success', resolve, { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Database deletion blocked')), { once: true });
  });
}
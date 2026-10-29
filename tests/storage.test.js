import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetDatabaseForTests, getDashboardSummary, getSetting, openDatabase, saveSetting } from '../src/storage/db.js';

describe('IndexedDB foundation', () => {
  beforeEach(async () => { await __resetDatabaseForTests(); });
  afterEach(async () => { await __resetDatabaseForTests(); });

  it('opens a versioned database and creates all required stores', async () => {
    const db = await openDatabase();
    expect(db.version).toBe(2);
    expect([...db.objectStoreNames].sort()).toEqual(['counters', 'orders', 'pallets', 'scans', 'settings']);
  });
  it('persists a setting between database transactions', async () => {
    await openDatabase();
    await saveSetting('palletCapacity', 3);
    await expect(getSetting('palletCapacity')).resolves.toBe(3);
  });
  it('returns an empty dashboard summary for a fresh database', async () => {
    await openDatabase();
    await expect(getDashboardSummary()).resolves.toEqual({ palletCount: 0, openPalletNumber: null });
  });
  it('counts existing pallets and identifies the currently open one', async () => {
    const db = await openDatabase();
    const transaction = db.transaction('pallets', 'readwrite');
    const store = transaction.objectStore('pallets');
    store.add({ uuid: 'pallet-1', number: 1, status: 'closed', createdAt: Date.now() });
    store.add({ uuid: 'pallet-2', number: 2, status: 'open', createdAt: Date.now() });
    await new Promise((resolve, reject) => {
      transaction.addEventListener('complete', resolve, { once: true });
      transaction.addEventListener('error', () => reject(transaction.error), { once: true });
      transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    });
    await expect(getDashboardSummary()).resolves.toEqual({ palletCount: 2, openPalletNumber: 2 });
  });
});
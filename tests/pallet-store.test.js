import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetDatabaseForTests, openDatabase, saveSetting } from '../src/storage/db.js';
import { addScanToPallet, closeActivePallet, getActivePallet, listPallets, undoLastScan, createOrder, listOrders, setActiveOrder, updatePallet, deletePallet, deleteOrder } from '../src/core/scanning/pallet-store.js';

describe('pallet persistence', () => {
  beforeEach(async () => { await __resetDatabaseForTests(); await openDatabase(); });
  afterEach(async () => { await __resetDatabaseForTests(); });

  it('persists scans and restores the active pallet from IndexedDB', async () => {
    await saveSetting('palletCapacity', 5);
    const result = await addScanToPallet({ value: 'ABC123', type: 'code128', format: 'CODE_128', source: 'manual', at: 1000 });
    expect(result.status).toBe('accepted');
    const active = await getActivePallet();
    expect(active.number).toBe(1);
    expect(active.scanCount).toBe(1);
    expect(active.scans[0].value).toBe('ABC123');
  });

  it('rejects duplicate values on the same active pallet', async () => {
    await addScanToPallet({ value: 'DUP', type: 'code128', at: 1000 }, 5);
    const result = await addScanToPallet({ value: 'DUP', type: 'code128', at: 2000 }, 5);
    expect(result.status).toBe('duplicate');
    expect((await listPallets())[0].scans).toHaveLength(1);
  });

  it('automatically closes a full pallet and starts the next one', async () => {
    await addScanToPallet({ value: 'A', type: 'code128', at: 1000 }, 2);
    const second = await addScanToPallet({ value: 'B', type: 'code128', at: 2000 }, 2);
    expect(second.pallet.status).toBe('closed');
    expect(second.nextPallet.number).toBe(2);
    expect((await getActivePallet()).number).toBe(2);
    expect((await listPallets()).find((p) => p.number === 1).scanCount).toBe(2);
  });

  it('undoes the latest scan and restores the previous pallet after rollover', async () => {
    await addScanToPallet({ value: 'A', type: 'code128', at: 1000 }, 1);
    const undone = await undoLastScan();
    expect(undone.value).toBe('A');
    const pallets = await listPallets();
    expect(pallets).toHaveLength(1);
    expect(pallets[0].status).toBe('open');
    expect(pallets[0].scanCount).toBe(0);
  });

  it('closes the active pallet manually and creates a new one on the next scan', async () => {
    await addScanToPallet({ value: 'A', type: 'code128', at: 1000 }, 10);
    expect((await closeActivePallet()).status).toBe('closed');
    await addScanToPallet({ value: 'B', type: 'code128', at: 2000 }, 10);
    expect((await getActivePallet()).number).toBe(2);
  });

  it('starts a new pallet before scanning when the configured capacity is lowered', async () => {
    await addScanToPallet({ value: 'A', type: 'code128', at: 1000 }, 5);
    await addScanToPallet({ value: 'B', type: 'code128', at: 2000 }, 5);
    const result = await addScanToPallet({ value: 'C', type: 'code128', at: 3000 }, 1);
    expect(result.pallet.number).toBe(2);
    expect(result.pallet.scanCount).toBe(1);
    expect((await listPallets()).find((p) => p.number === 1).scanCount).toBe(2);
  });

  it('creates an order and assigns its new scans and pallets', async () => {
    const order = await createOrder({ name: 'Zakázka 2026-42', reference: 'ORD-42', note: 'Expedice' });
    const saved = await addScanToPallet({ value: 'ORDER-SCAN', type: 'code128', at: 1000 }, 5);
    expect(saved.pallet.orderId).toBe(order.id);
    const orders = await listOrders();
    expect(orders[0]).toMatchObject({ id: order.id, name: 'Zakázka 2026-42', reference: 'ORD-42', palletCount: 1, scanCount: 1 });
  });

  it('edits pallet metadata and deletes its scans together with the pallet', async () => {
    await addScanToPallet({ value: 'REMOVE-ME', type: 'code128', at: 1000 }, 5);
    const pallet = (await listPallets())[0];
    await updatePallet(pallet.id, { name: 'Křehké zboží', note: 'Horní patro' });
    expect((await listPallets())[0]).toMatchObject({ name: 'Křehké zboží', note: 'Horní patro' });
    expect(await deletePallet(pallet.id)).toMatchObject({ number: pallet.number, deletedScans: 1 });
    expect(await listPallets()).toHaveLength(0);
  });

  it('prevents deleting an order while pallets are assigned to it', async () => {
    const order = await createOrder({ name: 'Nesmí zmizet' });
    await addScanToPallet({ value: 'KEEP', type: 'code128', at: 1000 }, 5);
    await expect(deleteOrder(order.id)).rejects.toThrow('obsahuje palety');
    await setActiveOrder(null);
    expect((await listOrders())[0].name).toBe('Nesmí zmizet');
  });
});

export class ScanSource {
  async start(_type) { throw new Error('ScanSource.start must be implemented by an adapter.'); }
  async stop() {}
  async pause() {}
  async resume() {}
  async setTorch(_enabled) { throw new Error('Torch is not supported by this source.'); }
  destroy() {}
}

export class FakeScanSource extends ScanSource {
  constructor() {
    super();
    this.listeners = new Set();
    this.running = false;
    this.torchOn = false;
    this.type = null;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(value, { format, source = 'hardware', at = Date.now() } = {}) {
    if (!this.running) return;
    const defaultFormat = {
      code128: 'CODE_128', gs1128: 'CODE_128', qr: 'QR_CODE', ean13: 'EAN_13',
      ean8: 'EAN_8', code39: 'CODE_39', dataMatrix: 'DATA_MATRIX', itf: 'ITF',
    }[this.type];
    const event = { value, format: format ?? defaultFormat, source, at };
    for (const listener of this.listeners) listener(event);
  }
  async start(type) { this.type = type; this.running = true; }
  async stop() { this.running = false; }
  async pause() { this.running = false; }
  async resume() { if (this.type) this.running = true; }
  async setTorch(enabled) { this.torchOn = Boolean(enabled); }
  destroy() { this.running = false; this.listeners.clear(); }
}

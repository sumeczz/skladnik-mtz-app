import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { CODE_TYPES } from './pipeline.js';
import { ScanSource } from './scan-source.js';

const FORMAT_MAP = {
  CODE_128: BarcodeFormat.CODE_128,
  QR_CODE: BarcodeFormat.QR_CODE,
  EAN_13: BarcodeFormat.EAN_13,
  EAN_8: BarcodeFormat.EAN_8,
  CODE_39: BarcodeFormat.CODE_39,
  DATA_MATRIX: BarcodeFormat.DATA_MATRIX,
  ITF: BarcodeFormat.ITF,
};

export class CameraScanSource extends ScanSource {
  constructor({ onScan, onError, onStatus, videoElement }) {
    super();
    this.onScan = onScan;
    this.onError = onError;
    this.onStatus = onStatus;
    this.videoElement = videoElement;
    this.reader = null;
    this.controls = null;
    this.type = null;
    this.active = false;
    this.paused = false;
    this.torchOn = false;
    this.lastError = null;
    this.onVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  async start(type) {
    if (!CODE_TYPES[type]) throw new Error('Nejdřív vyber typ kódu.');
    await this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Tento prohlížeč nepodporuje přístup ke kameře. Otevři aplikaci přes HTTPS nebo localhost.');
    this.type = type;
    this.active = true;
    this.paused = false;
    const formats = CODE_TYPES[type].formats.map((format) => FORMAT_MAP[format]);
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, formats], [DecodeHintType.TRY_HARDER, true]]);
    this.reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 120 });
    this.onStatus('requesting');
    try {
      this.controls = await this.reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        this.videoElement,
        (result, error) => {
          if (!this.active || this.paused) return;
          if (result) {
            this.lastError = null;
            this.onScan({ value: result.getText(), format: this.formatName(result.getBarcodeFormat()), source: 'camera', at: Date.now() });
          } else if (error && !String(error.name).includes('NotFoundException')) {
            this.lastError = error;
          }
        },
      );
      if (!this.active) { this.controls.stop(); return; }
      this.onStatus('running');
    } catch (error) {
      this.active = false;
      this.onStatus('error');
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        throw new Error('Přístup ke kameře byl odepřen. Povol kameru v nastavení prohlížeče a spusť skenování znovu.');
      }
      if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        throw new Error('V zařízení nebyla nalezena kamera.');
      }
      if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        throw new Error('Kamera je obsazená jinou aplikací. Zavři ji a zkus to znovu.');
      }
      throw new Error(error?.message || 'Kameru se nepodařilo spustit.');
    }
  }

  formatName(format) {
    return Object.entries(FORMAT_MAP).find(([, value]) => value === format)?.[0] ?? 'UNKNOWN';
  }

  async stop() {
    this.active = false;
    this.paused = false;
    this.torchOn = false;
    this.controls?.stop();
    this.controls = null;
    const stream = this.videoElement?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
    this.onStatus?.('stopped');
  }

  async pause() {
    this.paused = true;
    this.controls?.stop();
    this.controls = null;
    const stream = this.videoElement?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (this.videoElement) this.videoElement.srcObject = null;
    this.onStatus('paused');
  }

  async resume() {
    if (!this.active || !this.type) return;
    const type = this.type;
    this.active = false;
    await this.start(type);
  }

  async setTorch(enabled) {
    const stream = this.videoElement?.srcObject;
    const track = stream?.getVideoTracks?.()[0];
    if (!track?.applyConstraints) throw new Error('Svítilna není na tomto zařízení podporována.');
    const capabilities = track.getCapabilities?.();
    if (!capabilities?.torch) throw new Error('Svítilna není na tomto zařízení podporována.');
    await track.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
    this.torchOn = Boolean(enabled);
  }

  async handleVisibilityChange() {
    if (!this.active) return;
    if (document.hidden) await this.pause();
    else if (this.paused) await this.resume();
  }

  destroy() {
    void this.stop();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

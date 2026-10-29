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
    this.scanAreaSize = 'medium';
    this.scanAreaEnabled = false;
    this.scanLoopId = null;
    this.scanCanvas = document.createElement('canvas');
    this.scanContext = this.scanCanvas.getContext('2d', { willReadFrequently: true });
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
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, formats], [DecodeHintType.TRY_HARDER, true], ...(type === 'gs1128' ? [[DecodeHintType.ASSUME_GS1, true]] : [])]);
    this.reader = new BrowserMultiFormatReader(hints);
    this.onStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!this.active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.videoElement.srcObject = stream;
      await this.videoElement.play();
      this.onStatus('running');
      this.scanFrame();
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

  setScanAreaSize(size) {
    if (['small', 'medium', 'large', 'extra-large'].includes(size)) this.scanAreaSize = size;
  }

  setScanAreaEnabled(enabled) {
    this.scanAreaEnabled = Boolean(enabled);
  }

  getScanArea() {
    if (!this.scanAreaEnabled) return { width: 1, height: 1 };
    return ({
      small: { width: 0.42, height: 0.18 },
      medium: { width: 0.60, height: 0.28 },
      large: { width: 0.78, height: 0.42 },
      'extra-large': { width: 0.92, height: 0.62 },
    })[this.scanAreaSize];
  }

  scanFrame() {
    if (!this.active || this.paused) return;
    const video = this.videoElement;
    if (video?.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const area = this.getScanArea();
      const width = Math.max(1, Math.round(video.videoWidth * area.width));
      const height = Math.max(1, Math.round(video.videoHeight * area.height));
      const left = Math.round((video.videoWidth - width) / 2);
      const top = Math.round((video.videoHeight - height) / 2);
      if (this.scanCanvas.width !== width) this.scanCanvas.width = width;
      if (this.scanCanvas.height !== height) this.scanCanvas.height = height;
      this.scanContext.drawImage(video, left, top, width, height, 0, 0, width, height);
      try {
        const result = this.reader.decodeFromCanvas(this.scanCanvas);
        if (result) this.onScan({ value: result.getText(), format: this.formatName(result.getBarcodeFormat()), source: 'camera', at: Date.now() });
      } catch (error) {
        if (!String(error?.name ?? error).includes('NotFoundException')) this.lastError = error;
      }
    }
    this.scanLoopId = requestAnimationFrame(() => this.scanFrame());
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
    if (this.scanLoopId !== null) cancelAnimationFrame(this.scanLoopId);
    this.scanLoopId = null;
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
    if (this.scanLoopId !== null) cancelAnimationFrame(this.scanLoopId);
    this.scanLoopId = null;
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

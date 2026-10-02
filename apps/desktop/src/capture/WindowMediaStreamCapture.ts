import { BaseScreenCapture } from './ScreenCaptureAdapter';
import { CaptureSource, CapturedFrame } from '../../../../packages/shared-types/src';
import { CircularFrameBuffer, FrameMetrics } from './CircularFrameBuffer';
import { WindowLifecycleMonitor } from './WindowLifecycleMonitor';

export class WindowMediaStreamCapture extends BaseScreenCapture {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ringBuffer: CircularFrameBuffer;
  private windowMonitor: WindowLifecycleMonitor;

  constructor(bufferCapacity = 4) {
    super();
    this.ringBuffer = new CircularFrameBuffer(bufferCapacity);
    this.windowMonitor = new WindowLifecycleMonitor();

    if (typeof document !== 'undefined') {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;

      this.canvasElement = document.createElement('canvas');
      this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
    }
  }

  public getRingBuffer(): CircularFrameBuffer {
    return this.ringBuffer;
  }

  public getWindowMonitor(): WindowLifecycleMonitor {
    return this.windowMonitor;
  }

  public getBufferMetrics(): FrameMetrics {
    return this.ringBuffer.getMetrics();
  }

  public async select_source(): Promise<CaptureSource | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('DisplayMedia API indisponível neste ambiente de execução.');
    }

    try {
      // Request display media with window preference
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          frameRate: { ideal: this.targetFps, max: 30 }
        } as MediaTrackConstraints,
        audio: false
      });

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const trackLabel = videoTrack.label || 'Authorized Poker Window';

      const source: CaptureSource = {
        id: `native_source_${Date.now()}`,
        name: trackLabel,
        type: 'window',
        isAuthorized: true, // validated in modal/policy
        appIdentifier: 'com.auth.poker.client',
        bounds: {
          x: 0,
          y: 0,
          width: settings.width || 1280,
          height: settings.height || 720
        }
      };

      this.mediaStream = stream;
      this.activeSource = source;
      this.windowMonitor.setMonitoredSource(source);
      this.attachTrackHandlers(stream);

      return source;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return null; // User cancelled permission dialog
      }
      throw err;
    }
  }

  private attachTrackHandlers(stream: MediaStream): void {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.addEventListener('ended', () => {
      this.windowMonitor.checkWindowHealth(null, false);
      this.stop();
    });

    videoTrack.addEventListener('mute', () => {
      this.windowMonitor.checkWindowHealth({ x: 0, y: 0, width: 0, height: 0 }, true);
      this.pause();
    });

    videoTrack.addEventListener('unmute', () => {
      const currentSettings = videoTrack.getSettings();
      this.windowMonitor.checkWindowHealth(
        { x: 0, y: 0, width: currentSettings.width || 1280, height: currentSettings.height || 720 },
        true
      );
      this.resume();
    });
  }

  public async start(source: CaptureSource, fps: number): Promise<void> {
    if (!source.isAuthorized) {
      throw new Error(
        `Security Exception: Cannot capture unauthorized source [${source.name}]. Window must be explicitly authorized.`
      );
    }

    this.stop();
    this.activeSource = source;
    this.windowMonitor.setMonitoredSource(source);
    this.targetFps = Math.max(1, Math.min(30, fps));
    this.ringBuffer.clear();

    if (!this.mediaStream) {
      if (source.id.startsWith('window:') || source.id.startsWith('screen:')) {
        try {
          const constraints: any = {
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                minWidth: 480,
                maxWidth: 1920,
                minHeight: 480,
                maxHeight: 1080
              }
            }
          };
          const stream = await (navigator.mediaDevices as any).getUserMedia(constraints);
          this.mediaStream = stream;
          this.attachTrackHandlers(stream);
        } catch (err) {
          console.error('[WindowMediaStreamCapture] Failed to get stream for electron source:', err);
          const selected = await this.select_source();
          if (!selected) return;
        }
      } else {
        const selected = await this.select_source();
        if (!selected) return;
      }
    }

    if (this.videoElement && this.mediaStream) {
      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play().catch(() => {});
    }

    this.capturing = true;
    this.paused = false;
    this.lastFpsCalculationTime = performance.now();
    this.frameCount = 0;

    const intervalMs = Math.floor(1000 / this.targetFps);
    this.intervalId = setInterval(() => {
      if (!this.paused && this.capturing) {
        const frame = this.captureFrameFromVideo();
        if (frame) {
          this.ringBuffer.push(frame);
          this.notifyFrame(frame);
        }
      }
    }, intervalMs);

    this.notifyStatus();
  }

  public read(): CapturedFrame | null {
    return this.ringBuffer.peekLatest();
  }

  public override stop(): void {
    super.stop();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    // Clean frame buffers immediately to free GPU & RAM memory
    this.ringBuffer.clear();
    this.windowMonitor.setMonitoredSource(null);
  }

  private captureFrameFromVideo(): CapturedFrame | null {
    if (!this.videoElement || !this.canvasElement || !this.ctx) return null;
    if (this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;

    const width = this.videoElement.videoWidth || 1280;
    const height = this.videoElement.videoHeight || 720;

    if (this.canvasElement.width !== width || this.canvasElement.height !== height) {
      this.canvasElement.width = width;
      this.canvasElement.height = height;
    }

    // Check window health (resize / minimized)
    this.windowMonitor.checkWindowHealth({ x: 0, y: 0, width, height }, true);

    this.ctx.drawImage(this.videoElement, 0, 0, width, height);
    const dataUrl = this.canvasElement.toDataURL('image/webp', 0.85);

    return {
      id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: performance.now(),
      width,
      height,
      sourceId: this.activeSource?.id || 'native_window',
      dataUrl
    };
  }
}

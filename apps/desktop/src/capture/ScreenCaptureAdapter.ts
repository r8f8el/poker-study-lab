import { CaptureSource, CapturedFrame, RectRegion } from '../../../packages/shared-types/src';

export interface ScreenCaptureListener {
  onFrame?: (frame: CapturedFrame) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: { isCapturing: boolean; isPaused: boolean; fps: number }) => void;
}

export abstract class BaseScreenCapture {
  protected activeSource: CaptureSource | null = null;
  protected capturing = false;
  protected paused = false;
  protected targetFps = 15;
  protected listeners: ScreenCaptureListener[] = [];
  protected lastFrame: CapturedFrame | null = null;
  protected intervalId: ReturnType<typeof setInterval> | null = null;
  protected frameCount = 0;
  protected lastFpsCalculationTime = 0;
  protected currentMeasuredFps = 0;

  public abstract select_source(): Promise<CaptureSource | null>;
  public abstract start(source: CaptureSource, fps: number): Promise<void>;
  public abstract read(): CapturedFrame | null;
  
  public pause(): void {
    this.paused = true;
    this.notifyStatus();
  }

  public resume(): void {
    if (this.capturing) {
      this.paused = false;
      this.notifyStatus();
    }
  }

  public stop(): void {
    this.capturing = false;
    this.paused = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Memory hygiene: discard cached frames immediately
    this.lastFrame = null;
    this.notifyStatus();
  }

  public isCapturing(): boolean {
    return this.capturing;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getMeasuredFps(): number {
    return this.currentMeasuredFps;
  }

  public getActiveSource(): CaptureSource | null {
    return this.activeSource;
  }

  public addListener(listener: ScreenCaptureListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  protected notifyStatus(): void {
    this.listeners.forEach(l =>
      l.onStatusChange?.({
        isCapturing: this.capturing,
        isPaused: this.paused,
        fps: this.currentMeasuredFps
      })
    );
  }

  protected notifyFrame(frame: CapturedFrame): void {
    this.lastFrame = frame;
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsCalculationTime >= 1000) {
      this.currentMeasuredFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsCalculationTime));
      this.frameCount = 0;
      this.lastFpsCalculationTime = now;
      this.notifyStatus();
    }
    this.listeners.forEach(l => l.onFrame?.(frame));
  }
}

/**
 * Synthetic capture adapter: Generates reproducible poker table frames 
 * with guaranteed isolation, zero OS privileged hooks, and configurable mock scenarios.
 */
export class SyntheticPokerCapture extends BaseScreenCapture {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private scenarioStep = 0;
  private cachedDataUrl: string | null = null;
  private lastRenderTime = 0;

  constructor() {
    super();
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.ctx = this.canvas.getContext('2d');
    }
  }

  public async select_source(): Promise<CaptureSource | null> {
    const mockSource: CaptureSource = {
      id: 'simulated_poker_app_01',
      name: 'Poker Study Lab Simulation Table (Authorized)',
      type: 'synthetic_mock',
      isAuthorized: true,
      appIdentifier: 'com.auth.poker.client',
      bounds: { x: 0, y: 0, width: 1280, height: 720 }
    };
    this.activeSource = mockSource;
    return mockSource;
  }

  public async start(source: CaptureSource, fps: number): Promise<void> {
    if (!source.isAuthorized) {
      throw new Error(`Security Exception: Cannot capture unauthorized source [${source.name}]. Window must be authorized.`);
    }
    this.stop();
    this.activeSource = source;
    this.targetFps = Math.max(1, Math.min(30, fps));
    this.capturing = true;
    this.paused = false;
    this.lastFpsCalculationTime = performance.now();
    this.frameCount = 0;
    this.cachedDataUrl = null;

    const intervalMs = Math.floor(1000 / this.targetFps);
    this.intervalId = setInterval(() => {
      if (!this.paused && this.capturing) {
        const frame = this.generateSyntheticFrame();
        if (frame) {
          this.notifyFrame(frame);
        }
      }
    }, intervalMs);

    this.notifyStatus();
  }

  public read(): CapturedFrame | null {
    return this.lastFrame;
  }

  private generateSyntheticFrame(): CapturedFrame {
    this.scenarioStep++;
    const frameId = `synth_frame_${Date.now()}_${this.scenarioStep}`;
    const now = performance.now();

    // Re-render canvas and encode dataUrl at most once every 300ms to preserve UI responsiveness
    if (this.ctx && this.canvas && (!this.cachedDataUrl || now - this.lastRenderTime > 300)) {
      this.lastRenderTime = now;
      const { width, height } = this.canvas;
      // Draw poker table felt
      this.ctx.fillStyle = '#064e3b'; // deep emerald felt
      this.ctx.fillRect(0, 0, width, height);

      // Draw table rim
      this.ctx.lineWidth = 14;
      this.ctx.strokeStyle = '#78350f'; // mahogany border
      this.ctx.strokeRect(40, 40, width - 80, height - 80);

      // Table felt inner border
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = '#047857';
      this.ctx.strokeRect(54, 54, width - 108, height - 108);

      // Title & watermark
      this.ctx.fillStyle = '#10b981';
      this.ctx.font = 'bold 18px monospace';
      this.ctx.fillText(`[AUTHORIZED CLIENT FEED] - FPS Target: ${this.targetFps}`, 70, 85);

      // Pot display
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(540, 210, 200, 50);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(540, 210, 200, 50);
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = 'bold 22px sans-serif';
      this.ctx.fillText('POT: $150', 585, 244);

      // Community cards (Board: 7h 8h Qs)
      this.drawCard(460, 290, '7', '♥', '#ef4444');
      this.drawCard(535, 290, '8', '♥', '#ef4444');
      this.drawCard(610, 290, 'Q', '♠', '#0f172a');

      // Hero Hole Cards: As Kc
      this.drawCard(565, 540, 'A', '♠', '#0f172a');
      this.drawCard(640, 540, 'K', '♣', '#0f172a');

      // Hero info box
      this.ctx.fillStyle = '#0f172a';
      this.ctx.fillRect(545, 650, 190, 40);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 14px sans-serif';
      this.ctx.fillText('HERO (BTN) - Stack: $850', 555, 675);

      // Action buttons
      this.drawButton(860, 630, 90, 45, 'FOLD', '#dc2626');
      this.drawButton(965, 630, 90, 45, 'CHECK', '#16a34a');
      this.drawButton(1070, 630, 110, 45, 'BET $50', '#2563eb');

      this.cachedDataUrl = this.canvas.toDataURL('image/webp', 0.85);
    }

    return {
      id: frameId,
      timestamp: performance.now(),
      width: 1280,
      height: 720,
      sourceId: this.activeSource?.id || 'synthetic',
      dataUrl: this.cachedDataUrl || undefined
    };
  }

  private drawCard(x: number, y: number, rank: string, suit: string, color: string): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x, y, 65, 95);
    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, 65, 95);

    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 20px sans-serif';
    this.ctx.fillText(rank, x + 8, y + 26);
    this.ctx.font = 'bold 22px sans-serif';
    this.ctx.fillText(suit, x + 8, y + 54);
  }

  private drawButton(x: number, y: number, w: number, h: number, label: string, bg: string): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = '#ffffff44';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 14px sans-serif';
    this.ctx.fillText(label, x + 12, y + 28);
  }
}

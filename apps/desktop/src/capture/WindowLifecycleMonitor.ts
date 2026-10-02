import { CaptureSource, RectRegion } from '../../../../packages/shared-types/src';

export type WindowStatus =
  | 'NORMAL'
  | 'MINIMIZED'
  | 'RESIZED'
  | 'UNAVAILABLE'
  | 'UNAUTHORIZED';

export interface WindowLifecycleEvent {
  status: WindowStatus;
  sourceId: string;
  timestamp: number;
  reason: string;
  currentBounds?: RectRegion;
  referenceBounds?: RectRegion;
}

export type WindowLifecycleListener = (event: WindowLifecycleEvent) => void;

export class WindowLifecycleMonitor {
  private activeSource: CaptureSource | null = null;
  private referenceBounds: RectRegion | null = null;
  private currentStatus: WindowStatus = 'NORMAL';
  private listeners: WindowLifecycleListener[] = [];
  private resizeTolerancePercent = 0.05; // 5% tolerance before triggering alert

  constructor(tolerancePercent = 0.05) {
    this.resizeTolerancePercent = tolerancePercent;
  }

  public setMonitoredSource(source: CaptureSource | null): void {
    this.activeSource = source;
    this.referenceBounds = source?.bounds ? { ...source.bounds } : null;
    this.currentStatus = source ? (source.isAuthorized ? 'NORMAL' : 'UNAUTHORIZED') : 'UNAVAILABLE';
  }

  public getStatus(): WindowStatus {
    return this.currentStatus;
  }

  public addListener(listener: WindowLifecycleListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Inspects current bounds and window characteristics (from OS capture or video track).
   */
  public checkWindowHealth(
    currentBounds?: RectRegion | null,
    isStreamActive = true,
    detectedAppIdentifier?: string
  ): WindowStatus {
    if (!this.activeSource) {
      this.updateStatus('UNAVAILABLE', 'Nenhuma janela selecionada para monitoramento.');
      return 'UNAVAILABLE';
    }

    // 1. Check stream availability
    if (!isStreamActive) {
      this.updateStatus('UNAVAILABLE', 'Janela fechada ou stream de captura finalizado pelo sistema.');
      return 'UNAVAILABLE';
    }

    // 2. Check authorized app identity
    if (detectedAppIdentifier && detectedAppIdentifier !== this.activeSource.appIdentifier) {
      this.updateStatus(
        'UNAUTHORIZED',
        `Janela trocada acidentalmente. Observado: [${detectedAppIdentifier}], Esperado: [${this.activeSource.appIdentifier}].`
      );
      return 'UNAUTHORIZED';
    }

    // 3. Check minimized (bounds 0x0 or negative)
    if (currentBounds && (currentBounds.width <= 0 || currentBounds.height <= 0)) {
      this.updateStatus('MINIMIZED', 'A janela de jogo autorizada foi minimizada.', currentBounds);
      return 'MINIMIZED';
    }

    // 4. Check resized beyond calibration tolerance
    if (currentBounds && this.referenceBounds) {
      const widthDiff = Math.abs(currentBounds.width - this.referenceBounds.width) / this.referenceBounds.width;
      const heightDiff = Math.abs(currentBounds.height - this.referenceBounds.height) / this.referenceBounds.height;

      if (widthDiff > this.resizeTolerancePercent || heightDiff > this.resizeTolerancePercent) {
        this.updateStatus(
          'RESIZED',
          `Janela redimensionada de ${this.referenceBounds.width}x${this.referenceBounds.height} para ${currentBounds.width}x${currentBounds.height}. Calibração de ROI necessária.`,
          currentBounds
        );
        return 'RESIZED';
      }
    }

    this.updateStatus('NORMAL', 'Janela autorizada em estado regular.', currentBounds);
    return 'NORMAL';
  }

  private updateStatus(newStatus: WindowStatus, reason: string, currentBounds?: RectRegion): void {
    if (this.currentStatus !== newStatus) {
      this.currentStatus = newStatus;
      const event: WindowLifecycleEvent = {
        status: newStatus,
        sourceId: this.activeSource?.id || 'none',
        timestamp: performance.now(),
        reason,
        currentBounds,
        referenceBounds: this.referenceBounds || undefined
      };
      this.listeners.forEach(l => l(event));
    }
  }
}

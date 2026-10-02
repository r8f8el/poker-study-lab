import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowLifecycleMonitor } from '../../apps/desktop/src/capture/WindowLifecycleMonitor';
import { MOCK_AUTHORIZED_SOURCE } from '../../packages/test-fixtures/src';

describe('WindowLifecycleMonitor - Minimized, Resized, and Unavailable Window Detection', () => {
  let monitor: WindowLifecycleMonitor;

  beforeEach(() => {
    monitor = new WindowLifecycleMonitor(0.05); // 5% resize tolerance
    monitor.setMonitoredSource({
      ...MOCK_AUTHORIZED_SOURCE,
      bounds: { x: 100, y: 100, width: 1280, height: 720 }
    });
  });

  it('reports NORMAL status when dimensions and appIdentifier match authorized source', () => {
    const status = monitor.checkWindowHealth(
      { x: 100, y: 100, width: 1280, height: 720 },
      true,
      'com.auth.poker.client'
    );
    expect(status).toBe('NORMAL');
  });

  it('detects MINIMIZED status when width or height is 0', () => {
    const listenerSpy = vi.fn();
    monitor.addListener(listenerSpy);

    const status = monitor.checkWindowHealth({ x: 0, y: 0, width: 0, height: 0 }, true);
    expect(status).toBe('MINIMIZED');
    expect(listenerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'MINIMIZED',
        reason: expect.stringContaining('minimizada')
      })
    );
  });

  it('detects RESIZED status when dimensions vary beyond tolerance', () => {
    const listenerSpy = vi.fn();
    monitor.addListener(listenerSpy);

    // Resized to 1600x900 (25% increase, exceeds 5% tolerance)
    const status = monitor.checkWindowHealth({ x: 100, y: 100, width: 1600, height: 900 }, true);
    expect(status).toBe('RESIZED');
    expect(listenerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'RESIZED',
        reason: expect.stringContaining('redimensionada')
      })
    );
  });

  it('detects UNAVAILABLE status when stream is inactive or window closed', () => {
    const status = monitor.checkWindowHealth(null, false);
    expect(status).toBe('UNAVAILABLE');
  });

  it('detects UNAUTHORIZED status if appIdentifier differs', () => {
    const status = monitor.checkWindowHealth(
      { x: 100, y: 100, width: 1280, height: 720 },
      true,
      'com.google.chrome'
    );
    expect(status).toBe('UNAUTHORIZED');
  });
});

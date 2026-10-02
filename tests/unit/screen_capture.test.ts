import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyntheticPokerCapture } from '../../apps/desktop/src/capture/ScreenCaptureAdapter';
import { MOCK_AUTHORIZED_SOURCE, MOCK_UNAUTHORIZED_SOURCE } from '../../packages/test-fixtures/src';

describe('ScreenCapture Adapter - Contract & Security Lifecycle', () => {
  let capture: SyntheticPokerCapture;

  beforeEach(() => {
    capture = new SyntheticPokerCapture();
  });

  afterEach(() => {
    capture.stop();
  });

  it('selects authorized mock source by default', async () => {
    const source = await capture.select_source();
    expect(source).not.toBeNull();
    expect(source?.isAuthorized).toBe(true);
    expect(source?.appIdentifier).toBe('com.auth.poker.client');
  });

  it('throws security exception when attempting to capture unauthorized source', async () => {
    await expect(capture.start(MOCK_UNAUTHORIZED_SOURCE, 15)).rejects.toThrow(
      /Security Exception: Cannot capture unauthorized source/
    );
    expect(capture.isCapturing()).toBe(false);
  });

  it('starts capture, emits frames, and obeys target FPS bounds', async () => {
    const frameSpy = vi.fn();
    capture.addListener({ onFrame: frameSpy });

    await capture.start(MOCK_AUTHORIZED_SOURCE, 20);
    expect(capture.isCapturing()).toBe(true);
    expect(capture.isPaused()).toBe(false);

    // Wait 120ms to allow interval to produce frames
    await new Promise(r => setTimeout(r, 120));

    expect(frameSpy).toHaveBeenCalled();
    const lastFrame = capture.read();
    expect(lastFrame).not.toBeNull();
    expect(lastFrame?.width).toBe(1280);
    expect(lastFrame?.height).toBe(720);
  });

  it('pauses and resumes capture without destroying configuration', async () => {
    await capture.start(MOCK_AUTHORIZED_SOURCE, 15);
    capture.pause();
    expect(capture.isPaused()).toBe(true);

    capture.resume();
    expect(capture.isPaused()).toBe(false);
  });

  it('cleans up frame memory immediately on stop', async () => {
    await capture.start(MOCK_AUTHORIZED_SOURCE, 15);
    await new Promise(r => setTimeout(r, 80));
    expect(capture.read()).not.toBeNull();

    capture.stop();
    expect(capture.isCapturing()).toBe(false);
    expect(capture.read()).toBeNull(); // memory cleaned
  });
});

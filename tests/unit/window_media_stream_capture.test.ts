/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WindowMediaStreamCapture } from '../../apps/desktop/src/capture/WindowMediaStreamCapture';

describe('WindowMediaStreamCapture stream lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses the display stream granted in select_source instead of prompting again', async () => {
    const stop = vi.fn();
    const track = {
      label: 'SupremaPoker',
      getSettings: () => ({ width: 540, height: 960 }),
      addEventListener: () => undefined,
      stop
    };
    const stream = {
      getVideoTracks: () => [track],
      getTracks: () => [track]
    };
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });
    HTMLVideoElement.prototype.play = () => Promise.resolve();

    const capture = new WindowMediaStreamCapture();
    const source = await capture.select_source();
    expect(source).not.toBeNull();

    await capture.start(source!, 10);

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    expect(capture.isCapturing()).toBe(true);

    capture.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(capture.isCapturing()).toBe(false);
  });
});

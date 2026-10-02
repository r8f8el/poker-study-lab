import { describe, it, expect, beforeEach } from 'vitest';
import { CircularFrameBuffer } from '../../apps/desktop/src/capture/CircularFrameBuffer';
import { CapturedFrame } from '../../packages/shared-types/src';

describe('CircularFrameBuffer - Memory Bounds & Discard Policy', () => {
  let buffer: CircularFrameBuffer;

  beforeEach(() => {
    buffer = new CircularFrameBuffer(3); // Small capacity for strict testing
  });

  const createMockFrame = (id: string, timestamp = performance.now()): CapturedFrame => ({
    id,
    timestamp,
    width: 1280,
    height: 720,
    sourceId: 'src_01',
    dataUrl: `data:image/webp;base64,mock_${id}`
  });

  it('initializes with zero size and fixed capacity', () => {
    expect(buffer.getSize()).toBe(0);
    expect(buffer.getCapacity()).toBe(3);
    const metrics = buffer.getMetrics();
    expect(metrics.totalFramesIngested).toBe(0);
    expect(metrics.totalFramesDropped).toBe(0);
  });

  it('pushes frames and retrieves freshest via peekLatest', () => {
    const f1 = createMockFrame('f1');
    const f2 = createMockFrame('f2');

    buffer.push(f1);
    buffer.push(f2);

    expect(buffer.getSize()).toBe(2);
    expect(buffer.peekLatest()?.id).toBe('f2');
  });

  it('discards oldest frame when capacity is exceeded (FIFO overwrite)', () => {
    const f1 = createMockFrame('f1');
    const f2 = createMockFrame('f2');
    const f3 = createMockFrame('f3');
    const f4 = createMockFrame('f4'); // causes f1 to be discarded

    buffer.push(f1);
    buffer.push(f2);
    buffer.push(f3);
    expect(buffer.getSize()).toBe(3);

    buffer.push(f4);
    expect(buffer.getSize()).toBe(3); // capped at capacity

    const metrics = buffer.getMetrics();
    expect(metrics.totalFramesIngested).toBe(4);
    expect(metrics.totalFramesDropped).toBe(1);

    // Oldest remaining is f2
    expect(buffer.pop()?.id).toBe('f2');
    expect(buffer.pop()?.id).toBe('f3');
    expect(buffer.pop()?.id).toBe('f4');
    expect(buffer.pop()).toBeNull();
  });

  it('wipes references on clear to avoid memory leaks', () => {
    buffer.push(createMockFrame('f1'));
    buffer.push(createMockFrame('f2'));
    expect(buffer.getSize()).toBe(2);

    buffer.clear();
    expect(buffer.getSize()).toBe(0);
    expect(buffer.peekLatest()).toBeNull();
  });

  it('calculates latency correctly', () => {
    const pastTimestamp = performance.now() - 40; // 40ms ago
    buffer.push(createMockFrame('f_lag', pastTimestamp));

    const metrics = buffer.getMetrics();
    expect(metrics.latestFrameLatencyMs).toBeGreaterThanOrEqual(30);
  });
});

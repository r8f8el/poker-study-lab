import { CapturedFrame } from '../../../../packages/shared-types/src';

export interface FrameMetrics {
  totalFramesIngested: number;
  totalFramesDropped: number;
  currentBufferOccupancy: number;
  bufferCapacity: number;
  latestFrameLatencyMs: number;
  averageLatencyMs: number;
}

/**
 * CircularFrameBuffer / RingBuffer for real-time video frames.
 * Guarantees zero memory creep by capping buffer depth to a fixed size (e.g. 3-5 frames)
 * and automatically discarding stale frames when inference or temporal validation takes longer.
 */
export class CircularFrameBuffer {
  private capacity: number;
  private buffer: Array<CapturedFrame | null>;
  private head = 0;
  private tail = 0;
  private size = 0;
  private totalIngested = 0;
  private totalDropped = 0;
  private latencySamples: number[] = [];
  private maxLatencySamples = 50;

  constructor(capacity = 5) {
    if (capacity < 1) {
      throw new Error('CircularFrameBuffer capacity must be at least 1');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /**
   * Pushes a new frame into the buffer.
   * If the buffer is full, the oldest frame is discarded (FIFO overwrite).
   */
  public push(frame: CapturedFrame): void {
    this.totalIngested++;

    if (this.size === this.capacity) {
      // Buffer is full: discard the oldest frame
      const discarded = this.buffer[this.head];
      if (discarded) {
        // Hygiene: wipe references to large payload strings
        discarded.dataUrl = undefined;
      }
      this.head = (this.head + 1) % this.capacity;
      this.totalDropped++;
      this.size--;
    }

    this.buffer[this.tail] = frame;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;

    // Track latency
    const latency = Math.max(0, performance.now() - frame.timestamp);
    this.latencySamples.push(latency);
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }
  }

  /**
   * Reads and pops the oldest available frame.
   */
  public pop(): CapturedFrame | null {
    if (this.size === 0) return null;

    const frame = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return frame;
  }

  /**
   * Reads the freshest (most recently added) frame without removing it.
   */
  public peekLatest(): CapturedFrame | null {
    if (this.size === 0) return null;
    const latestIndex = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIndex];
  }

  /**
   * Discards all buffered frames and frees references to prevent leaks.
   */
  public clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.buffer[i]) {
        this.buffer[i]!.dataUrl = undefined;
        this.buffer[i] = null;
      }
    }
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  public getSize(): number {
    return this.size;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getMetrics(): FrameMetrics {
    const avgLatency =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
        : 0;

    const latestFrame = this.peekLatest();
    const latestLatency = latestFrame ? Math.max(0, performance.now() - latestFrame.timestamp) : 0;

    return {
      totalFramesIngested: this.totalIngested,
      totalFramesDropped: this.totalDropped,
      currentBufferOccupancy: this.size,
      bufferCapacity: this.capacity,
      latestFrameLatencyMs: Math.round(latestLatency * 10) / 10,
      averageLatencyMs: Math.round(avgLatency * 10) / 10
    };
  }
}

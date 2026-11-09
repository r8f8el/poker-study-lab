import { describe, it, expect } from 'vitest';
import { ButtonDetector } from '../../apps/desktop/src/vision/ButtonDetector';

describe('ButtonDetector - Action Buttons & Player Turn Recognition', () => {
  it('returns false when region is empty felt without buttons', () => {
    const w = 100;
    const h = 40;
    const feltPx = new Uint8ClampedArray(w * h * 4);
    // Green felt
    for (let i = 0; i < feltPx.length; i += 4) {
      feltPx[i] = 20;     // r
      feltPx[i + 1] = 85; // g
      feltPx[i + 2] = 35; // b
      feltPx[i + 3] = 255;
    }

    const result = ButtonDetector.detectActionButtons(feltPx, w, h);
    expect(result.isHeroTurn).toBe(false);
    expect(result.availableActions).toEqual([]);
    expect(result.hasFold).toBe(false);
  });

  it('detects active Fold, Call, and Raise buttons when Hero must act', () => {
    const w = 150;
    const h = 40;
    const px = new Uint8ClampedArray(w * h * 4);

    // 1. Fold Button (Red, left: x: 10..45, y: 10..30)
    for (let y = 10; y <= 30; y++) {
      for (let x = 10; x <= 45; x++) {
        const idx = (y * w + x) * 4;
        px[idx] = 190;    // r
        px[idx + 1] = 30; // g
        px[idx + 2] = 30; // b
        px[idx + 3] = 255;
      }
    }

    // 2. Call Button (Green, center: x: 55..90, y: 10..30)
    for (let y = 10; y <= 30; y++) {
      for (let x = 55; x <= 90; x++) {
        const idx = (y * w + x) * 4;
        px[idx] = 20;     // r
        px[idx + 1] = 170;// g
        px[idx + 2] = 40; // b
        px[idx + 3] = 255;
      }
    }

    // 3. Raise Button (Orange, right: x: 100..135, y: 10..30)
    for (let y = 10; y <= 30; y++) {
      for (let x = 100; x <= 135; x++) {
        const idx = (y * w + x) * 4;
        px[idx] = 220;    // r
        px[idx + 1] = 140;// g
        px[idx + 2] = 20; // b
        px[idx + 3] = 255;
      }
    }

    const result = ButtonDetector.detectActionButtons(px, w, h);
    expect(result.isHeroTurn).toBe(true);
    expect(result.hasFold).toBe(true);
    expect(result.hasCheckOrCall).toBe(true);
    expect(result.hasBetOrRaise).toBe(true);
    expect(result.availableActions).toContain('fold');
    expect(result.availableActions).toContain('call');
    expect(result.availableActions).toContain('raise');
    expect(result.confidence).toBeGreaterThan(0.85);
  });
});

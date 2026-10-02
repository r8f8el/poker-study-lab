import { describe, it, expect, beforeEach } from 'vitest';
import { CardDetector } from '../../apps/desktop/src/vision/CardDetector';
import { RoiManager } from '../../apps/desktop/src/capture/RoiManager';
import { generateSyntheticPixelCrop } from '../../packages/test-fixtures/src';

describe('CardDetector & RoiManager - Visual State & Feature Extraction', () => {
  let detector: CardDetector;
  let roiManager: RoiManager;

  beforeEach(() => {
    detector = new CardDetector(0.85);
    roiManager = new RoiManager();
  });

  describe('RoiManager Coordinate Calculations', () => {
    it('computes 5 distinct board card slots with equal widths', () => {
      const regions = roiManager.getComputedCardRegions(1280, 720);
      expect(regions.board_flop_1.width).toBeGreaterThan(0);
      expect(regions.board_flop_2.x).toBe(regions.board_flop_1.x + regions.board_flop_1.width);
      expect(regions.board_flop_3.x).toBe(regions.board_flop_2.x + regions.board_flop_2.width);
      expect(regions.board_turn.x).toBe(regions.board_flop_3.x + regions.board_flop_3.width);
      expect(regions.board_river.x).toBe(regions.board_turn.x + regions.board_turn.width);
    });

    it('splits hero cards ROI into two halves', () => {
      const regions = roiManager.getComputedCardRegions(1280, 720);
      expect(regions.hero_card_1.width).toBe(regions.hero_card_2.width);
      expect(regions.hero_card_2.x).toBe(regions.hero_card_1.x + regions.hero_card_1.width);
    });

    it('scales proportionally when frame resolution differs (e.g. 1920x1080)', () => {
      const regions720 = roiManager.getComputedCardRegions(1280, 720);
      const regions1080 = roiManager.getComputedCardRegions(1920, 1080);

      const ratio = 1920 / 1280;
      expect(regions1080.pot.width).toBe(Math.round(regions720.pot.width * ratio));
    });
  });

  describe('CardDetector Visual State Classification', () => {
    it('classifies empty felt as EMPTY with zero card guessing', () => {
      const feltPixels = generateSyntheticPixelCrop('empty_felt', 60, 85);
      const result = detector.analyzeCrop(feltPixels, 60, 85);

      expect(result.visualState).toBe('EMPTY');
      expect(result.card).toBeNull();
      expect(result.rank).toBeNull();
      expect(result.suit).toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('classifies facedown card as CARD_BACK with zero card guessing', () => {
      const backPixels = generateSyntheticPixelCrop('card_back', 60, 85);
      const result = detector.analyzeCrop(backPixels, 60, 85);

      expect(result.visualState).toBe('CARD_BACK');
      expect(result.card).toBeNull();
      expect(result.rank).toBeNull();
      expect(result.suit).toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('classifies low contrast noise as UNKNOWN without hallucinating a card', () => {
      const noisePixels = generateSyntheticPixelCrop('low_contrast', 60, 85);
      const result = detector.analyzeCrop(noisePixels, 60, 85);

      expect(result.visualState).toBe('UNKNOWN');
      expect(result.card).toBeNull();
    });

    it('identifies VISIBLE_CARD and distinguishes red suits', () => {
      const redCardPixels = generateSyntheticPixelCrop('visible_card', 60, 85, true);
      const result = detector.analyzeCrop(redCardPixels, 60, 85);

      expect(result.visualState).toBe('VISIBLE_CARD');
      expect(result.suit).toBe('h'); // Red identified
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.card).not.toBeNull();
    });

    it('identifies VISIBLE_CARD and distinguishes black suits', () => {
      const blackCardPixels = generateSyntheticPixelCrop('visible_card', 60, 85, false);
      const result = detector.analyzeCrop(blackCardPixels, 60, 85);

      expect(result.visualState).toBe('VISIBLE_CARD');
      expect(result.suit).toBe('s'); // Black identified
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.card).not.toBeNull();
    });

    it('rejects tiny crops below minimum dimension bounds', () => {
      const tinyPixels = new Uint8ClampedArray(8 * 8 * 4);
      const result = detector.analyzeCrop(tinyPixels, 8, 8);
      expect(result.visualState).toBe('UNKNOWN');
      expect(result.card).toBeNull();
    });

    it('does not hallucinate Ace on a white card with no rank ink', () => {
      const whiteCardPixels = new Uint8ClampedArray(60 * 85 * 4);
      for (let i = 0; i < whiteCardPixels.length; i += 4) {
        whiteCardPixels[i] = 245;
        whiteCardPixels[i + 1] = 245;
        whiteCardPixels[i + 2] = 245;
        whiteCardPixels[i + 3] = 255;
      }
      // Add suit pip (black spade) in suit zone (y: 25..35, x: 10..20)
      for (let y = 25; y < 35; y++) {
        for (let x = 10; x < 20; x++) {
          const idx = (y * 60 + x) * 4;
          whiteCardPixels[idx] = 20;
          whiteCardPixels[idx + 1] = 20;
          whiteCardPixels[idx + 2] = 20;
        }
      }

      const result = detector.analyzeCrop(whiteCardPixels, 60, 85);
      expect(result.visualState).toBe('VISIBLE_CARD');
      expect(result.suit).toBe('s');
      expect(result.rank).toBeNull();
      expect(result.card).toBeNull(); // ZERO ace hallucination!
    });

    it('distinguishes 4-color deck suits (Diamonds: Blue, Clubs: Green)', () => {
      const create4ColorCard = (suitColor: 'blue' | 'green') => {
        const px = new Uint8ClampedArray(60 * 85 * 4);
        for (let i = 0; i < px.length; i += 4) {
          px[i] = 245;
          px[i + 1] = 245;
          px[i + 2] = 245;
          px[i + 3] = 255;
        }
        // Suit pip in suit zone
        for (let y = 25; y < 35; y++) {
          for (let x = 10; x < 20; x++) {
            const idx = (y * 60 + x) * 4;
            if (suitColor === 'blue') {
              px[idx] = 20;
              px[idx + 1] = 120;
              px[idx + 2] = 220; // Blue (Diamonds)
            } else {
              px[idx] = 20;
              px[idx + 1] = 180; // Green (Clubs)
              px[idx + 2] = 40;
            }
          }
        }
        return px;
      };

      const diamondResult = detector.analyzeCrop(create4ColorCard('blue'), 60, 85);
      expect(diamondResult.suit).toBe('d');

      const clubResult = detector.analyzeCrop(create4ColorCard('green'), 60, 85);
      expect(clubResult.suit).toBe('c');
    });

    it('discriminates 2-color deck suits (Heart vs Diamond for red, Spade vs Club for black)', () => {
      // 1. Create a 2-color Diamond (red rhombus with pointed top center)
      const diamondPx = new Uint8ClampedArray(60 * 85 * 4);
      for (let i = 0; i < diamondPx.length; i += 4) {
        diamondPx[i] = 250; diamondPx[i + 1] = 250; diamondPx[i + 2] = 250; diamondPx[i + 3] = 255;
      }
      // Top apex: center x=15 is red, sides x=11,19 are white
      for (let dy = 0; dy < 10; dy++) {
        const spread = dy < 5 ? dy : 9 - dy;
        for (let dx = -spread; dx <= spread; dx++) {
          const idx = ((22 + dy) * 60 + (15 + dx)) * 4;
          diamondPx[idx] = 220; diamondPx[idx + 1] = 20; diamondPx[idx + 2] = 20;
        }
      }
      const resDiamond = detector.analyzeCrop(diamondPx, 60, 85);
      expect(resDiamond.suit).toBe('d');

      // 2. Create a 2-color Heart (red with twin lobes and indented top center)
      const heartPx = new Uint8ClampedArray(60 * 85 * 4);
      for (let i = 0; i < heartPx.length; i += 4) {
        heartPx[i] = 250; heartPx[i + 1] = 250; heartPx[i + 2] = 250; heartPx[i + 3] = 255;
      }
      // Row 22-24: Left lobe x=11..13, Right lobe x=17..19, center x=14..16 white!
      for (let dy = 0; dy < 3; dy++) {
        for (let dx of [11, 12, 13, 17, 18, 19]) {
          const idx = ((22 + dy) * 60 + dx) * 4;
          heartPx[idx] = 220; heartPx[idx + 1] = 20; heartPx[idx + 2] = 20;
        }
      }
      // Lower body merging down to point
      for (let dy = 3; dy < 10; dy++) {
        const spread = 9 - dy;
        for (let dx = -spread; dx <= spread; dx++) {
          const idx = ((22 + dy) * 60 + (15 + dx)) * 4;
          heartPx[idx] = 220; heartPx[idx + 1] = 20; heartPx[idx + 2] = 20;
        }
      }
      const resHeart = detector.analyzeCrop(heartPx, 60, 85);
      expect(resHeart.suit).toBe('h');

      // 3. Create a 2-color Club (black clover with distinct waist at ~40% height)
      const clubPx = new Uint8ClampedArray(60 * 85 * 4);
      for (let i = 0; i < clubPx.length; i += 4) {
        clubPx[i] = 250; clubPx[i + 1] = 250; clubPx[i + 2] = 250; clubPx[i + 3] = 255;
      }
      // Top lobe (y=22..24): width 6 (x=12..17)
      for (let dy = 0; dy < 3; dy++) {
        for (let x = 12; x <= 17; x++) {
          const idx = ((22 + dy) * 60 + x) * 4;
          clubPx[idx] = 20; clubPx[idx + 1] = 20; clubPx[idx + 2] = 20;
        }
      }
      // Waist (y=25..26): width 2 (x=14..15)
      for (let dy = 3; dy < 5; dy++) {
        for (let x = 14; x <= 15; x++) {
          const idx = ((22 + dy) * 60 + x) * 4;
          clubPx[idx] = 20; clubPx[idx + 1] = 20; clubPx[idx + 2] = 20;
        }
      }
      // Side lobes (y=27..31): width 10 (x=10..19)
      for (let dy = 5; dy < 10; dy++) {
        for (let x = 10; x <= 19; x++) {
          const idx = ((22 + dy) * 60 + x) * 4;
          clubPx[idx] = 20; clubPx[idx + 1] = 20; clubPx[idx + 2] = 20;
        }
      }
      const resClub = detector.analyzeCrop(clubPx, 60, 85);
      expect(resClub.suit).toBe('c');

      // 4. Create a 2-color Spade (black arrowhead widening smoothly to bottom lobes)
      const spadePx = new Uint8ClampedArray(60 * 85 * 4);
      for (let i = 0; i < spadePx.length; i += 4) {
        spadePx[i] = 250; spadePx[i + 1] = 250; spadePx[i + 2] = 250; spadePx[i + 3] = 255;
      }
      for (let dy = 0; dy < 10; dy++) {
        const spread = Math.min(5, Math.floor(dy * 0.6) + 1);
        for (let dx = -spread; dx <= spread; dx++) {
          const idx = ((22 + dy) * 60 + (15 + dx)) * 4;
          spadePx[idx] = 20; spadePx[idx + 1] = 20; spadePx[idx + 2] = 20;
        }
      }
      const resSpade = detector.analyzeCrop(spadePx, 60, 85);
      expect(resSpade.suit).toBe('s');
    });
  });
});

import { Rank, Suit, CardString, CardVisualState } from '../../shared-types/src';

export interface LabeledCardFixture {
  id: string;
  expectedState: CardVisualState;
  expectedCard?: CardString;
  expectedRank?: Rank;
  expectedSuit?: Suit;
  description: string;
}

export const LABELED_CARD_FIXTURES: LabeledCardFixture[] = [
  // 1. All 13 Ranks
  { id: 'fix_as', expectedState: 'VISIBLE_CARD', expectedCard: 'As', expectedRank: 'A', expectedSuit: 's', description: 'Ace of Spades' },
  { id: 'fix_kd', expectedState: 'VISIBLE_CARD', expectedCard: 'Kd', expectedRank: 'K', expectedSuit: 'd', description: 'King of Diamonds' },
  { id: 'fix_qh', expectedState: 'VISIBLE_CARD', expectedCard: 'Qh', expectedRank: 'Q', expectedSuit: 'h', description: 'Queen of Hearts' },
  { id: 'fix_jc', expectedState: 'VISIBLE_CARD', expectedCard: 'Jc', expectedRank: 'J', expectedSuit: 'c', description: 'Jack of Clubs' },
  { id: 'fix_ts', expectedState: 'VISIBLE_CARD', expectedCard: 'Ts', expectedRank: 'T', expectedSuit: 's', description: 'Ten of Spades' },
  { id: 'fix_9h', expectedState: 'VISIBLE_CARD', expectedCard: '9h', expectedRank: '9', expectedSuit: 'h', description: 'Nine of Hearts' },
  { id: 'fix_8d', expectedState: 'VISIBLE_CARD', expectedCard: '8d', expectedRank: '8', expectedSuit: 'd', description: 'Eight of Diamonds' },
  { id: 'fix_7c', expectedState: 'VISIBLE_CARD', expectedCard: '7c', expectedRank: '7', expectedSuit: 'c', description: 'Seven of Clubs' },
  { id: 'fix_6s', expectedState: 'VISIBLE_CARD', expectedCard: '6s', expectedRank: '6', expectedSuit: 's', description: 'Six of Spades' },
  { id: 'fix_5h', expectedState: 'VISIBLE_CARD', expectedCard: '5h', expectedRank: '5', expectedSuit: 'h', description: 'Five of Hearts' },
  { id: 'fix_4d', expectedState: 'VISIBLE_CARD', expectedCard: '4d', expectedRank: '4', expectedSuit: 'd', description: 'Four of Diamonds' },
  { id: 'fix_3c', expectedState: 'VISIBLE_CARD', expectedCard: '3c', expectedRank: '3', expectedSuit: 'c', description: 'Three of Clubs' },
  { id: 'fix_2s', expectedState: 'VISIBLE_CARD', expectedCard: '2s', expectedRank: '2', expectedSuit: 's', description: 'Two of Spades' },

  // 2. Special Visual States
  { id: 'fix_empty_slot', expectedState: 'EMPTY', description: 'Empty table slot showing emerald felt' },
  { id: 'fix_card_back', expectedState: 'CARD_BACK', description: 'Facedown opponent card back' },
  { id: 'fix_motion_blur', expectedState: 'ANIMATION', description: 'Motion blur of dealing animation' },
  { id: 'fix_corrupted_noise', expectedState: 'UNKNOWN', description: 'Corrupted noisy crop' }
];

/**
 * Creates raw RGBA pixel arrays simulating table regions for testing.
 */
export function generateSyntheticPixelCrop(
  type: 'visible_card' | 'empty_felt' | 'card_back' | 'low_contrast',
  width = 60,
  height = 85,
  isRedSuit = false
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < pixels.length; i += 4) {
    if (type === 'visible_card') {
      // White card surface
      pixels[i] = 250;
      pixels[i + 1] = 250;
      pixels[i + 2] = 250;
      pixels[i + 3] = 255;

      // Simulate a red or black ink patch in corner
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      if (x > 5 && x < 25 && y > 5 && y < 35) {
        if (isRedSuit) {
          pixels[i] = 220; // Red
          pixels[i + 1] = 20;
          pixels[i + 2] = 20;
        } else {
          pixels[i] = 20; // Black
          pixels[i + 1] = 20;
          pixels[i + 2] = 20;
        }
      }
    } else if (type === 'empty_felt') {
      // Emerald felt green
      pixels[i] = 6;
      pixels[i + 1] = 78;
      pixels[i + 2] = 59;
      pixels[i + 3] = 255;
    } else if (type === 'card_back') {
      // Blue patterned back
      pixels[i] = 30;
      pixels[i + 1] = 58;
      pixels[i + 2] = 138;
      pixels[i + 3] = 255;
    } else {
      // Low contrast gray/noise
      pixels[i] = 110;
      pixels[i + 1] = 110;
      pixels[i + 2] = 110;
      pixels[i + 3] = 255;
    }
  }

  return pixels;
}

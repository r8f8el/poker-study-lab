import {
  CardString,
  Rank,
  Suit,
  CardVisualState
} from '../../../../packages/shared-types/src';

export interface CardDetectionOutput {
  visualState: CardVisualState;
  rank: Rank | null;
  suit: Suit | null;
  card: CardString | null;
  confidence: number;
  rankConfidence: number;
  suitConfidence: number;
  reasons: string[];
  debug?: {
    whiteRatio: number;
    suitColors: { red: number; blue: number; green: number; black: number; white: number };
    glyphBounds?: { x: number; y: number; width: number; height: number };
    aspectRatio?: number;
    matchScore?: number;
  };
}

/**
 * 8x12 normalized binary templates for all standard poker ranks.
 * Each entry is an array of 12 rows, where each row is an 8-bit integer mask (0bXXXXXXXX).
 */
const RANK_TEMPLATES: Record<Rank, number[][]> = {
  A: [
    [0x1c, 0x1c, 0x1c, 0x3e, 0x36, 0x36, 0x36, 0x63, 0x7f, 0x7f, 0xe3, 0xc1]
  ],
  K: [
    [0xc3, 0xc7, 0xc6, 0xce, 0xdc, 0xf8, 0xfc, 0xee, 0xc6, 0xc7, 0xc3, 0xc3],
    [0xe7, 0xe7, 0x6e, 0x6c, 0x6c, 0x78, 0x78, 0x6c, 0x6c, 0x6e, 0x67, 0x63] // PokerStars Desktop K
  ],
  Q: [
    [0x1c, 0x7e, 0x77, 0xe3, 0xc3, 0xc3, 0xc3, 0xc3, 0x6f, 0x7e, 0x3f, 0x09],
    [0x1c, 0x3e, 0x63, 0x63, 0x63, 0x63, 0x63, 0x63, 0x63, 0x77, 0x7f, 0x39] // PokerStars Desktop Q
  ],
  J: [
    [0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0xe3, 0xe3, 0xe7, 0xff, 0x3e],
    [0x3e, 0x1c, 0x0c, 0x0c, 0x0c, 0x0c, 0x0c, 0x0c, 0x6c, 0xec, 0xfe, 0x38] // PokerStars Desktop J
  ],
  T: [
    [0x26, 0x2f, 0x6d, 0xed, 0xed, 0xb9, 0x39, 0x39, 0x2d, 0x2d, 0x2f, 0x27],
    [0x8f, 0x8b, 0x91, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x91, 0x91, 0x8f] // PokerStars Desktop 10
  ],
  '9': [
    [0x3c, 0x66, 0xc3, 0xc3, 0xc7, 0x7f, 0x03, 0x03, 0x06, 0xcc, 0x78, 0x30]
  ],
  '8': [
    [0x1c, 0x1c, 0x3e, 0x26, 0x26, 0x3c, 0x3e, 0x3e, 0xe6, 0xe6, 0x3e, 0x3c]
  ],
  '7': [
    [0x7f, 0x7f, 0x06, 0x0c, 0x0c, 0x18, 0x18, 0x30, 0x30, 0x60, 0x60, 0x60]
  ],
  '6': [
    [0x1c, 0x30, 0x60, 0xc0, 0xdc, 0xe6, 0xc3, 0xc3, 0xc3, 0xc3, 0x66, 0x3c]
  ],
  '5': [
    [0x3e, 0x3e, 0xfe, 0xe0, 0xc0, 0xfe, 0xce, 0xce, 0x0e, 0xce, 0xfe, 0xfc]
  ],
  '4': [
    [0x0c, 0x1c, 0x3c, 0x6c, 0xcc, 0xff, 0xff, 0x0c, 0x0c, 0x0c, 0x0c, 0x0c]
  ],
  '3': [
    [0x7c, 0xc6, 0x03, 0x03, 0x1e, 0x0f, 0x03, 0x03, 0x03, 0xc3, 0x66, 0x3c],
    [0xfe, 0xfe, 0x0e, 0x1c, 0x38, 0x3e, 0x07, 0x03, 0x03, 0xc7, 0xc7, 0x7e] // PokerStars Desktop 3
  ],
  '2': [
    [0x3c, 0x66, 0xc3, 0x03, 0x06, 0x0c, 0x18, 0x30, 0x60, 0xc0, 0xff, 0xff],
    [0x3e, 0x7f, 0x63, 0x43, 0x07, 0x0e, 0x1c, 0x38, 0x70, 0xe0, 0xff, 0xff] // PokerStars Desktop 2
  ]
};

export class CardDetector {
  private minConfidence: number;

  constructor(minConfidence = 0.85) {
    this.minConfidence = minConfidence;
  }

  /**
   * Differentiates 2-color deck suits when blue/green inks are absent:
   * - Red: Heart ('h') vs. Diamond ('d') via top clef notch test
   * - Black: Spade ('s') vs. Club ('c') via clover waist / narrowing test
   */
  private classifyTwoColorPip(
    pixelData: Uint8ClampedArray,
    width: number,
    _height: number,
    startY: number,
    endY: number,
    colorType: 'red' | 'black'
  ): { suit: Suit; confidence: number } {
    const isTargetColor = (r: number, g: number, b: number) => {
      if (colorType === 'red') {
        return r > 130 && r > g * 1.3 && r > b * 1.3;
      } else {
        return r < 80 && g < 80 && b < 80;
      }
    };

    // Scan columns in suit pip zone (x: 2 to width * 0.45)
    const pipXStart = 2;
    const pipXEnd = Math.min(width - 1, Math.max(8, Math.floor(width * 0.45)));
    const colInk = new Array(pipXEnd - pipXStart).fill(0);

    for (let x = pipXStart; x < pipXEnd; x++) {
      for (let y = startY; y < endY; y++) {
        const idx = (y * width + x) * 4;
        if (isTargetColor(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2])) {
          colInk[x - pipXStart]++;
        }
      }
    }

    let minX: number | null = null;
    let maxX: number | null = null;
    for (let i = 0; i < colInk.length; i++) {
      if (colInk[i] > 1 && minX === null) {
        minX = pipXStart + i;
      } else if (minX !== null && colInk[i] <= 1 && (pipXStart + i - minX) >= 5) {
        maxX = pipXStart + i - 1;
        break;
      }
    }
    if (minX !== null && maxX === null) maxX = pipXEnd - 1;
    if (minX === null) minX = pipXStart;
    if (maxX === null) maxX = pipXEnd;

    let minY = endY;
    let maxY = startY;
    let totalInk = 0;

    for (let y = startY; y < endY; y++) {
      let rowInk = 0;
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * width + x) * 4;
        if (isTargetColor(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2])) {
          rowInk++;
          totalInk++;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      // Stop before dark player pod (which spans the entire bottom row)
      if (colorType === 'black' && rowInk >= 12 && (y - minY) >= 6) {
        break;
      }
      // Stop when pip ends (blank row after pip has reached at least 5px height)
      if (rowInk === 0 && (maxY - minY + 1) >= 5) {
        break;
      }
    }

    const pipW = maxX >= minX ? maxX - minX + 1 : 0;
    const pipH = maxY >= minY ? maxY - minY + 1 : 0;

    if (totalInk < 10 || pipW < 4 || pipH < 5) {
      return {
        suit: colorType === 'red' ? 'h' : 's',
        confidence: 0.90
      };
    }

    if (colorType === 'red') {
      // In the upper 12% to 35% of the pip:
      // Heart (♥) has two distinct lobes separated by a whitespace notch (clef) in the middle.
      // Diamond (♦) has a single centered tip that widens towards the middle.
      let foundTwoLobes = false;
      let foundSingleCenteredApex = false;

      const testYStart = minY + Math.max(1, Math.floor(pipH * 0.12));
      const testYEnd = minY + Math.max(2, Math.floor(pipH * 0.35));
      const midX = Math.round((minX + maxX) / 2);

      // Measure width of the very top apex row
      let apexWidth = 0;
      for (let x = minX; x <= maxX; x++) {
        const idx = (minY * width + x) * 4;
        if (isTargetColor(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2])) {
          apexWidth++;
        }
      }

      for (let y = testYStart; y <= testYEnd; y++) {
        let segments = 0;
        let inSegment = false;
        let centerInk = false;

        for (let x = minX; x <= maxX; x++) {
          const idx = (y * width + x) * 4;
          const ink = isTargetColor(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]);
          if (x === midX && ink) centerInk = true;

          if (ink && !inSegment) {
            segments++;
            inSegment = true;
          } else if (!ink && inSegment) {
            inSegment = false;
          }
        }

        if (segments >= 2) {
          foundTwoLobes = true;
          break;
        }
        if (segments === 1 && centerInk) {
          foundSingleCenteredApex = true;
        }
      }

      if (foundTwoLobes) {
        return { suit: 'h', confidence: 0.98 };
      }
      // A diamond has a narrow apex tip (<= 45% of total pip width) that widens downwards
      if (foundSingleCenteredApex && apexWidth <= Math.max(3, Math.floor(pipW * 0.45))) {
        return { suit: 'd', confidence: 0.97 };
      }

      return { suit: 'h', confidence: 0.90 };
    } else {
      const rowWidths: number[] = [];
      for (let y = minY; y <= maxY; y++) {
        let count = 0;
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * width + x) * 4;
          if (isTargetColor(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2])) {
            count++;
          }
        }
        rowWidths.push(count);
      }

      let hasWaistBeforeMax = false;
      const maxW = Math.max(...rowWidths);
      const maxIndex = rowWidths.indexOf(maxW);

      if (maxIndex >= 2) {
        for (let i = 1; i < maxIndex; i++) {
          if (rowWidths[i] < rowWidths[i - 1] && maxW >= (rowWidths[i] + 3)) {
            hasWaistBeforeMax = true;
            break;
          }
        }
      }

      if (hasWaistBeforeMax) {
        return { suit: 'c', confidence: 0.96 };
      }

      return { suit: 's', confidence: 0.93 };
    }
  }

  /**
   * Processes raw RGBA pixel data from a cropped card region.
   * Performs:
   * 1. Visual state determination (EMPTY felt vs CARD_BACK vs VISIBLE_CARD)
   * 2. Strict vertical zone segmentation:
   *    - Suit Pip Zone: y ~ 24% to 54%, x ~ 4% to 48% (4-Color & 2-Color Suit detection)
   *    - Rank Glyph Zone: y ~ 3% to 28%, x ~ 4% to 44% (Optical Rank isolation & 8x12 correlation)
   */
  public analyzeCrop(
    pixelData: Uint8ClampedArray,
    width: number,
    height: number
  ): CardDetectionOutput {
    if (width < 10 || height < 15 || pixelData.length < width * height * 4) {
      return {
        visualState: 'UNKNOWN',
        rank: null,
        suit: null,
        card: null,
        confidence: 0,
        rankConfidence: 0,
        suitConfidence: 0,
        reasons: ['Dimensões do recorte insuficientes para análise.']
      };
    }

    // 1. Overall Color and Luminance Analysis
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let whitePixels = 0;
    const totalPixels = width * height;

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];

      totalR += r;
      totalG += g;
      totalB += b;

      // White card surface detection
      if (r > 185 && g > 185 && b > 185) {
        whitePixels++;
      }
    }

    const avgR = totalR / totalPixels;
    const avgG = totalG / totalPixels;
    const avgB = totalB / totalPixels;
    const whiteRatio = whitePixels / totalPixels;

    // 2. Visual State Determination
    // Table felt: emerald/green (avgG higher than avgR and avgB, low white ratio)
    if (avgG > avgR * 1.25 && avgG > avgB * 1.1 && whiteRatio < 0.14) {
      return {
        visualState: 'EMPTY',
        rank: null,
        suit: null,
        card: null,
        confidence: 0.99,
        rankConfidence: 0,
        suitConfidence: 0,
        reasons: ['Região identificada como feltro vazio da mesa.']
      };
    }

    // Card Back: Dark blue or dark red pattern with very low white ratio
    if (whiteRatio < 0.15 && (avgB > avgG * 1.2 || avgR > avgG * 1.5)) {
      return {
        visualState: 'CARD_BACK',
        rank: null,
        suit: null,
        card: null,
        confidence: 0.97,
        rankConfidence: 0,
        suitConfidence: 0,
        reasons: ['Dorso de carta identificado.']
      };
    }

    // Visible card: White background surface must be significant
    if (whiteRatio < 0.18) {
      return {
        visualState: 'UNKNOWN',
        rank: null,
        suit: null,
        card: null,
        confidence: 0.45,
        rankConfidence: 0,
        suitConfidence: 0,
        reasons: ['Contraste insuficiente para caracterizar carta aberta visível.']
      };
    }

    // 3. Find white card surface boundary to discard outer table felt, chips, and shadows
    let cardTopY = 0;
    for (let y = 0; y < Math.min(height, 20); y++) {
      let whites = 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (pixelData[idx] > 190 && pixelData[idx + 1] > 190 && pixelData[idx + 2] > 190) {
          whites++;
        }
      }
      if (whites >= 5) {
        cardTopY = y;
        break;
      }
    }

    let cardLeftX = 0;
    for (let x = 0; x < Math.min(width, 15); x++) {
      let whites = 0;
      for (let y = cardTopY; y < Math.min(height, cardTopY + 25); y++) {
        const idx = (y * width + x) * 4;
        if (pixelData[idx] > 190 && pixelData[idx + 1] > 190 && pixelData[idx + 2] > 190) {
          whites++;
        }
      }
      if (whites >= 5) {
        cardLeftX = x;
        break;
      }
    }

    // 4. Strict Rank Glyph Zone Analysis
    const rankYStart = cardTopY + 1;
    const rankYEnd = Math.min(height - 1, cardTopY + Math.max(22, Math.floor(height * 0.38)));
    const rankXStart = cardLeftX + 1;
    const rankXEnd = Math.min(width - 1, cardLeftX + Math.max(22, Math.floor(width * 0.48)));

    // 4b. Find horizontal boundary of the rank glyph by scanning columns,
    // stopping before any face card portrait art (separated by whitespace gap)
    const colInk = new Array(rankXEnd - rankXStart).fill(0);
    for (let x = rankXStart; x < rankXEnd; x++) {
      for (let y = rankYStart; y < rankYEnd; y++) {
        const idx = (y * width + x) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];
        if ((r < 175 || g < 175 || b < 175) && !(r > 205 && g > 205 && b > 205)) {
          colInk[x - rankXStart]++;
        }
      }
    }

    let minX: number | null = null;
    let maxX: number | null = null;
    for (let i = 0; i < colInk.length; i++) {
      if (colInk[i] > 1 && minX === null) {
        minX = rankXStart + i;
      } else if (minX !== null && colInk[i] <= 1) {
        const currentWidth = rankXStart + i - minX;
        const nextStroke = (i + 1 < colInk.length && colInk[i + 1] > 1) || (i + 2 < colInk.length && colInk[i + 2] > 1);
        if (currentWidth < 4 && nextStroke) {
          // Skip whitespace gap inside '10'
          continue;
        }
        if (currentWidth >= 5) {
          maxX = rankXStart + i - 1;
          break;
        }
      }
    }
    if (minX !== null && maxX === null) maxX = rankXEnd - 1;
    if (minX === null) minX = rankXStart;
    if (maxX === null) maxX = rankXEnd;

    // 4c. Scan vertical rows between minX and maxX, stopping before the suit pip
    let minY = rankYEnd;
    let maxY = rankYStart;
    let inkPixels = 0;
    let glyphFound = false;

    for (let y = rankYStart; y < rankYEnd; y++) {
      let rowInk = 0;
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * width + x) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];

        const isInk = (r < 175 || g < 175 || b < 175) && !(r > 205 && g > 205 && b > 205);
        if (isInk) {
          rowInk++;
          inkPixels++;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      if (rowInk > 0) {
        glyphFound = true;
      } else if (glyphFound && (maxY - minY + 1) >= 6) {
        break;
      }
    }

    const glyphW = maxX >= minX ? maxX - minX + 1 : 0;
    const glyphH = maxY >= minY ? maxY - minY + 1 : 0;
    const minValidRankHeight = Math.max(5, Math.floor(height * 0.08));

    let detectedRank: Rank | null = null;
    let rankConfidence = 0.0;
    let bestScore = 0.0;

    // Rank glyph must start near the top-left card corner (not halfway down the card)
    const maxRankStartMargin = cardTopY + Math.max(14, Math.floor(height * 0.18));
    if (minY <= maxRankStartMargin && inkPixels >= 8 && glyphW >= 3 && glyphH >= minValidRankHeight) {
      // Rescale isolated rank glyph into 8x12 binary grid
      const grid = new Uint8Array(8 * 12);
      for (let gy = 0; gy < 12; gy++) {
        for (let gx = 0; gx < 8; gx++) {
          const srcX = Math.floor(minX + (gx / 8) * glyphW);
          const srcY = Math.floor(minY + (gy / 12) * glyphH);
          const idx = (srcY * width + srcX) * 4;
          const r = pixelData[idx];
          const g = pixelData[idx + 1];
          const b = pixelData[idx + 2];
          if ((r < 175 || g < 175 || b < 175) && !(r > 205 && g > 205 && b > 205)) {
            grid[gy * 8 + gx] = 1;
          }
        }
      }

      // Match against multi-templates using Hamming similarity + IoU
      let bestCandidate: Rank = 'A';
      let maxCompositeScore = -1;

      for (const [rankKey, templates] of Object.entries(RANK_TEMPLATES)) {
        for (const template of templates) {
          let matches = 0;
          let intersection = 0;
          let union = 0;

          for (let r = 0; r < 12; r++) {
            const rowMask = template[r];
            for (let c = 0; c < 8; c++) {
              const expected = (rowMask >> (7 - c)) & 1;
              const actual = grid[r * 8 + c];

              if (expected === actual) matches++;
              if (expected === 1 && actual === 1) intersection++;
              if (expected === 1 || actual === 1) union++;
            }
          }

          const hammingScore = matches / 96;
          const iouScore = union > 0 ? intersection / union : 0;
          const composite = hammingScore * 0.6 + iouScore * 0.4;

          if (composite > maxCompositeScore) {
            maxCompositeScore = composite;
            bestCandidate = rankKey as Rank;
          }
        }
      }

      bestScore = maxCompositeScore;

      // Strict threshold: do NOT accept low similarity noise as an Ace
      if (maxCompositeScore >= 0.45) {
        detectedRank = bestCandidate;
        rankConfidence = Math.min(0.99, Math.round((0.80 + Math.max(0, maxCompositeScore - 0.50) * 0.4) * 100) / 100);
      }
    }

    // 5. Suit Analysis: Count corner colors and isolate pip strictly below rank glyph
    const suitYStart = cardTopY + 1;
    const suitYEnd = Math.min(height - 1, cardTopY + Math.max(20, Math.floor(height * 0.54)));
    const suitXStart = cardLeftX + 1;
    const suitXEnd = Math.min(width - 1, cardLeftX + Math.max(20, Math.floor(width * 0.48)));

    let suitRed = 0;
    let suitBlue = 0;
    let suitGreen = 0;
    let suitBlack = 0;
    let suitWhite = 0;

    for (let y = suitYStart; y < suitYEnd; y++) {
      for (let x = suitXStart; x < suitXEnd; x++) {
        const idx = (y * width + x) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];

        if (r > 185 && g > 185 && b > 185) {
          suitWhite++;
        } else if (r > 135 && r > g * 1.35 && r > b * 1.35) {
          suitRed++; // Hearts / 2-color Diamonds
        } else if (b > 125 && b > r * 1.25 && b > g * 1.15) {
          suitBlue++; // Diamonds (Blue 4-color)
        } else if (g > 110 && g > r * 1.2 && g > b * 1.1) {
          suitGreen++; // Clubs (Green 4-color)
        } else if (r < 75 && g < 75 && b < 75) {
          suitBlack++; // Spades / 2-color Clubs
        }
      }
    }

    // Fallback: If suit zone has few colored pixels, sample wider corner band
    if (suitRed + suitBlue + suitGreen + suitBlack < 8) {
      const cornerH = Math.floor(height * 0.50);
      const cornerW = Math.floor(width * 0.50);
      for (let y = 1; y < cornerH; y++) {
        for (let x = 1; x < cornerW; x++) {
          const idx = (y * width + x) * 4;
          const r = pixelData[idx];
          const g = pixelData[idx + 1];
          const b = pixelData[idx + 2];

          if (r > 135 && r > g * 1.35 && r > b * 1.35) suitRed++;
          else if (b > 125 && b > r * 1.25 && b > g * 1.15) suitBlue++;
          else if (g > 110 && g > r * 1.2 && g > b * 1.1) suitGreen++;
          else if (r < 75 && g < 75 && b < 75) suitBlack++;
        }
      }
    }

    // Pip scanning starts strictly below the rank glyph (or at suitYStart if no rank was identified)
    const pipStartY = (detectedRank !== null && glyphFound && (maxY - minY + 1) >= 5) ? (maxY + 1) : suitYStart;
    const pipEndY = Math.min(height - 1, pipStartY + Math.max(20, Math.floor(height * 0.45)));

    let detectedSuit: Suit | null = null;
    let suitConfidence = 0.0;

    if (suitBlue >= 8 && suitBlue > suitGreen && suitBlue > suitRed && suitBlue > suitBlack) {
      detectedSuit = 'd'; // Diamonds (Blue in 4-color)
      suitConfidence = 0.98;
    } else if (suitGreen >= 8 && suitGreen > suitRed && suitGreen > suitBlue && suitGreen > suitBlack) {
      detectedSuit = 'c'; // Clubs (Green in 4-color)
      suitConfidence = 0.98;
    } else if (suitRed >= 8 && suitRed > suitBlue && suitRed > suitGreen && suitRed > suitBlack) {
      // 2-Color or 4-Color Red: Distinguish Heart ('h') vs Diamond ('d')
      const pipAnalysis = this.classifyTwoColorPip(pixelData, width, height, pipStartY, pipEndY, 'red');
      detectedSuit = pipAnalysis.suit;
      suitConfidence = pipAnalysis.confidence;
    } else if (suitBlack >= 8 && suitBlack > suitBlue && suitBlack > suitGreen && suitBlack > suitRed) {
      // 2-Color or 4-Color Black: Distinguish Spade ('s') vs Club ('c')
      const pipAnalysis = this.classifyTwoColorPip(pixelData, width, height, pipStartY, pipEndY, 'black');
      detectedSuit = pipAnalysis.suit;
      suitConfidence = pipAnalysis.confidence;
    }

    if (!detectedSuit) {
      return {
        visualState: 'VISIBLE_CARD',
        rank: detectedRank,
        suit: null,
        card: null,
        confidence: 0.4,
        rankConfidence: rankConfidence || 0,
        suitConfidence: 0,
        reasons: ['Naipe não identificado com contraste ou cor suficiente.'],
        debug: {
          whiteRatio,
          suitColors: { red: suitRed, blue: suitBlue, green: suitGreen, black: suitBlack, white: suitWhite }
        }
      };
    }

    if (!detectedRank) {
      return {
        visualState: 'VISIBLE_CARD',
        rank: null,
        suit: detectedSuit,
        card: null,
        confidence: 0.4,
        rankConfidence: 0,
        suitConfidence,
        reasons: ['Dígito do valor da carta não identificado com nitidez suficiente.'],
        debug: {
          whiteRatio,
          suitColors: { red: suitRed, blue: suitBlue, green: suitGreen, black: suitBlack, white: suitWhite },
          glyphBounds: { x: minX, y: minY, width: glyphW, height: glyphH },
          aspectRatio: glyphH > 0 ? glyphW / glyphH : 0,
          matchScore: bestScore
        }
      };
    }

    const overallConfidence = Math.round(Math.sqrt(rankConfidence * suitConfidence) * 100) / 100;

    if (overallConfidence < this.minConfidence) {
      return {
        visualState: 'VISIBLE_CARD',
        rank: detectedRank,
        suit: detectedSuit,
        card: null,
        confidence: overallConfidence,
        rankConfidence,
        suitConfidence,
        reasons: ['Confiança abaixo do limiar para confirmação do valor da carta.'],
        debug: {
          whiteRatio,
          suitColors: { red: suitRed, blue: suitBlue, green: suitGreen, black: suitBlack, white: suitWhite },
          glyphBounds: { x: minX, y: minY, width: glyphW, height: glyphH },
          aspectRatio: glyphH > 0 ? glyphW / glyphH : 0,
          matchScore: bestScore
        }
      };
    }

    const cardString: CardString = `${detectedRank}${detectedSuit}`;

    return {
      visualState: 'VISIBLE_CARD',
      rank: detectedRank,
      suit: detectedSuit,
      card: cardString,
      confidence: overallConfidence,
      rankConfidence,
      suitConfidence,
      reasons: ['Carta reconhecida via classificação óptica determinística.'],
      debug: {
        whiteRatio,
        suitColors: { red: suitRed, blue: suitBlue, green: suitGreen, black: suitBlack, white: suitWhite },
        glyphBounds: { x: minX, y: minY, width: glyphW, height: glyphH },
        aspectRatio: glyphH > 0 ? glyphW / glyphH : 0,
        matchScore: bestScore
      }
    };
  }
}


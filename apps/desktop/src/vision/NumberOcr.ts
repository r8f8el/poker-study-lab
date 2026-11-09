/**
 * Ultra-fast, deterministic OCR engine for poker pot and stack numbers.
 * Zero external dependencies, 100% offline, privacy-safe, <2ms execution.
 */

export interface NumberOcrResult {
  rawText: string;
  value: number | null;
  confidence: number;
  glyphCount: number;
}

export const DIGIT_TEMPLATES: Record<string, number[]> = {
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'M': [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11]
};

export class NumberOcr {
  /**
   * Recognizes numbers from raw RGBA pixel data (pot or stack region).
   */
  public static recognizeNumber(
    pixelData: Uint8ClampedArray,
    width: number,
    height: number
  ): NumberOcrResult {
    if (width < 8 || height < 8 || pixelData.length < width * height * 4) {
      return { rawText: '', value: null, confidence: 0, glyphCount: 0 };
    }

    // 1. Identify high-contrast text pixels (white, gold/yellow, cyan)
    const binary = new Uint8Array(width * height);
    let textPixelCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];

        // White text
        const isWhite = r > 185 && g > 185 && b > 185;
        // Yellow/Gold text (common in PokerStars / Suprema POT displays)
        const isGold = r > 160 && g > 130 && b < 100 && r > b * 1.4;
        // Cyan / Light green text
        const isCyan = g > 160 && b > 130 && r < 120;

        if (isWhite || isGold || isCyan) {
          binary[y * width + x] = 1;
          textPixelCount++;
        }
      }
    }

    if (textPixelCount < 10) {
      return { rawText: '', value: null, confidence: 0, glyphCount: 0 };
    }

    // 2. Compute column ink projection to isolate character segments
    const colInk = new Int32Array(width);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (binary[y * width + x] === 1) {
          colInk[x]++;
        }
      }
    }

    // 3. Segment character clusters separated by blank columns
    interface Segment {
      startX: number;
      endX: number;
      width: number;
    }
    const segments: Segment[] = [];
    let inChar = false;
    let startX = 0;

    for (let x = 0; x < width; x++) {
      if (colInk[x] > 0 && !inChar) {
        inChar = true;
        startX = x;
      } else if (colInk[x] === 0 && inChar) {
        inChar = false;
        if (x - startX >= 1) {
          segments.push({ startX, endX: x - 1, width: x - startX });
        }
      }
    }
    if (inChar && width - startX >= 1) {
      segments.push({ startX, endX: width - 1, width: width - startX });
    }

    if (segments.length === 0) {
      return { rawText: '', value: null, confidence: 0, glyphCount: 0 };
    }

    // 4. Classify each segment
    let recognizedChars = '';
    let totalScore = 0;
    let validGlyphs = 0;

    for (const seg of segments) {
      // Find vertical ink bounds for this segment
      let minY = height;
      let maxY = 0;
      let segInkCount = 0;

      for (let y = 0; y < height; y++) {
        for (let x = seg.startX; x <= seg.endX; x++) {
          if (binary[y * width + x] === 1) {
            segInkCount++;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const glyphH = maxY >= minY ? maxY - minY + 1 : 0;
      const glyphW = seg.width;

      // Check if it's a dot / decimal comma (small glyph near bottom)
      if (glyphW <= 3 && glyphH <= 4 && minY >= height * 0.40) {
        recognizedChars += '.';
        continue;
      }

      if (glyphH < 5 || segInkCount < 5) continue;

      // Rescale segment into 5x7 binary matrix
      const matrix = new Uint8Array(5 * 7);
      for (let my = 0; my < 7; my++) {
        for (let mx = 0; mx < 5; mx++) {
          const srcX = Math.floor(seg.startX + (mx / 5) * glyphW);
          const srcY = Math.floor(minY + (my / 7) * glyphH);
          if (binary[srcY * width + srcX] === 1) {
            matrix[my * 5 + mx] = 1;
          }
        }
      }

      // Match against templates
      let bestChar = '';
      let bestScore = -1;

      for (const [char, template] of Object.entries(DIGIT_TEMPLATES)) {
        let matches = 0;
        let intersection = 0;
        let union = 0;

        for (let r = 0; r < 7; r++) {
          const rowMask = template[r];
          for (let c = 0; c < 5; c++) {
            const expected = (rowMask >> (4 - c)) & 1;
            const actual = matrix[r * 5 + c];

            if (expected === actual) matches++;
            if (expected === 1 && actual === 1) intersection++;
            if (expected === 1 || actual === 1) union++;
          }
        }

        const score = (matches / 35) * 0.5 + (union > 0 ? intersection / union : 0) * 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestChar = char;
        }
      }

      if (bestScore >= 0.55) {
        recognizedChars += bestChar;
        totalScore += bestScore;
        validGlyphs++;
      }
    }

    if (validGlyphs === 0) {
      return { rawText: '', value: null, confidence: 0, glyphCount: 0 };
    }

    // 5. Parse value with multiplier support (e.g. 1.5K -> 1500)
    let parsedValue: number | null = null;
    let cleanText = recognizedChars;

    // Filter out common prefix words if any (P, O, T)
    cleanText = cleanText.replace(/^[POTpote$:]+/, '').trim();

    if (cleanText.length > 0) {
      parsedValue = interpretMoney(cleanText, 1);
    }

    const avgConfidence = validGlyphs > 0 ? Math.round((totalScore / validGlyphs) * 100) / 100 : 0;

    return {
      rawText: recognizedChars,
      value: parsedValue,
      confidence: avgConfidence,
      glyphCount: validGlyphs
    };
  }
}

/**
 * Accepts 48,00 / 48.00 / 16 / 2.5K. Rejects a one-decimal fragment such as 0.7,
 * which is what a misplaced crop was publishing as the pot.
 */
export function paintDigitText(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  originX: number,
  originY: number,
  text: string,
  color: [number, number, number],
  scale = 2
): void {
  let cursor = originX;
  for (const char of text) {
    if (char === ',' || char === '.') {
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = cursor + x;
          const py = originY + 6 * scale + y;
          const i = (py * imageWidth + px) * 4;
          pixels[i] = color[0];
          pixels[i + 1] = color[1];
          pixels[i + 2] = color[2];
          pixels[i + 3] = 255;
        }
      }
      cursor += scale * 2;
      continue;
    }
    const template = DIGIT_TEMPLATES[char];
    if (!template) continue;
    for (let row = 0; row < 7; row++) {
      const mask = template[row];
      for (let col = 0; col < 5; col++) {
        if (((mask >> (4 - col)) & 1) === 0) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cursor + col * scale + sx;
            const py = originY + row * scale + sy;
            const i = (py * imageWidth + px) * 4;
            pixels[i] = color[0];
            pixels[i + 1] = color[1];
            pixels[i + 2] = color[2];
            pixels[i + 3] = 255;
          }
        }
      }
    }
    cursor += 6 * scale;
  }
}

export function interpretMoney(raw: string, confidence: number): number | null {
  if (confidence < 0.55) return null;
  const clean = raw.replace(/^[POTpote$:]+/, '').replace(/,/g, '.').trim();
  const match = clean.match(/^(\d+)(?:\.(\d+))?([KM])?$/);
  if (!match) return null;
  const decimals = match[2] ?? '';
  const suffix = match[3];
  const whole = match[1];
  // A lone digit is a fragment (the "4" inside 48,00), not a pot.
  if (whole.length < 2 && decimals.length !== 2 && !suffix) return null;
  if (decimals.length === 1 && !suffix) return null;
  if (decimals.length > 2) return null;
  let value = Number(`${match[1]}${decimals ? `.${decimals}` : ''}`);
  if (suffix === 'K') value *= 1000;
  if (suffix === 'M') value *= 1000000;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

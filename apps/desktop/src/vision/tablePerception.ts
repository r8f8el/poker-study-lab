import { CardString, TableLayoutProfile } from '../../../../packages/shared-types/src';
import { ButtonDetector, ButtonDetectionResult } from './ButtonDetector';
import { CardDetector, CardDetectionOutput } from './CardDetector';
import { interpretMoney, NumberOcr } from './NumberOcr';

export interface PerceptionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BadgeAction = 'fold' | 'raise' | 'call' | 'sitting_out';

export interface ObservedBadge {
  action: BadgeAction;
  x: number;
  y: number;
  text: string;
}

export interface TablePerception {
  heroOutputs: [CardDetectionOutput, CardDetectionOutput];
  boardOutputs: [
    CardDetectionOutput,
    CardDetectionOutput,
    CardDetectionOutput,
    CardDetectionOutput,
    CardDetectionOutput
  ];
  heroCards: CardString[];
  boardCards: CardString[];
  potValue: number | null;
  potConfidence: number;
  potRaw: string;
  badges: ObservedBadge[];
  heroButtons: ButtonDetectionResult;
  /** Real optical confidence. Empty hero cards stay well below a fake 0.95. */
  confidence: number;
}

interface Point {
  x: number;
  y: number;
}

const LETTERS: Record<string, number[]> = {
  A: [0x04, 0x0a, 0x11, 0x11, 0x1f, 0x11, 0x11],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e]
};

export function paintBadgeWord(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  originX: number,
  originY: number,
  word: string,
  color: [number, number, number] = [240, 240, 240],
  scale = 2
): void {
  let cursor = originX;
  for (const char of word.toUpperCase()) {
    const template = LETTERS[char];
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

const BADGE_WORDS: Array<{ word: string; action: BadgeAction }> = [
  { word: 'FOLD', action: 'fold' },
  { word: 'RAISE', action: 'raise' },
  { word: 'CALL', action: 'call' },
  { word: 'SIT', action: 'sitting_out' }
];

function emptyCard(reason: string): CardDetectionOutput {
  return {
    visualState: 'EMPTY',
    rank: null,
    suit: null,
    card: null,
    confidence: 0,
    rankConfidence: 0,
    suitConfidence: 0,
    reasons: [reason]
  };
}

function isFelt(r: number, g: number, b: number): boolean {
  return g > 45 && g > r * 1.12 && g > b * 1.02 && r < 150 && b < 170;
}

function isCardWhite(r: number, g: number, b: number): boolean {
  return r > 195 && g > 195 && b > 195 && Math.max(r, g, b) - Math.min(r, g, b) < 48;
}

function isGold(r: number, g: number, b: number): boolean {
  return r > 165 && g > 120 && b < 145 && r > b * 1.25 && g > b * 0.85;
}

function isLightText(r: number, g: number, b: number): boolean {
  return r > 185 && g > 185 && b > 185 && !isGold(r, g, b);
}

interface Component {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

function connectedComponents(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: PerceptionBox,
  accept: (r: number, g: number, b: number) => boolean,
  minArea: number
): Component[] {
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];
  const x0 = Math.max(0, bounds.x);
  const y0 = Math.max(0, bounds.y);
  const x1 = Math.min(width, bounds.x + bounds.width);
  const y1 = Math.min(height, bounds.y + bounds.height);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const start = y * width + x;
      if (visited[start]) continue;
      const pi = start * 4;
      if (!accept(pixels[pi], pixels[pi + 1], pixels[pi + 2])) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      const stack = [start];
      visited[start] = 1;

      while (stack.length > 0) {
        const idx = stack.pop() as number;
        const cx = idx % width;
        const cy = (idx - cx) / width;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
        for (const n of neighbors) {
          if (n < 0 || n >= visited.length || visited[n]) continue;
          const nx = n % width;
          const ny = (n - nx) / width;
          if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
          const npi = n * 4;
          if (!accept(pixels[npi], pixels[npi + 1], pixels[npi + 2])) continue;
          visited[n] = 1;
          stack.push(n);
        }
      }

      if (area >= minArea) {
        components.push({ minX, minY, maxX, maxY, area });
      }
    }
  }
  return components;
}

function largestFelt(pixels: Uint8ClampedArray, width: number, height: number): PerceptionBox {
  const comps = connectedComponents(
    pixels,
    width,
    height,
    { x: 0, y: 0, width, height },
    isFelt,
    Math.max(200, Math.floor(width * height * 0.02))
  );
  if (comps.length === 0) return { x: 0, y: 0, width, height };
  comps.sort((a, b) => b.area - a.area);
  const felt = comps[0];
  const pad = 4;
  const x = Math.max(0, felt.minX - pad);
  const y = Math.max(0, felt.minY - pad);
  return {
    x,
    y,
    width: Math.min(width - x, felt.maxX - felt.minX + 1 + pad * 2),
    height: Math.min(height - y, felt.maxY - felt.minY + 1 + pad * 2)
  };
}

function crop(
  pixels: Uint8ClampedArray,
  width: number,
  box: PerceptionBox
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const sx = box.x + x;
      const sy = box.y + y;
      const si = (sy * width + sx) * 4;
      const di = (y * box.width + x) * 4;
      out[di] = pixels[si];
      out[di + 1] = pixels[si + 1];
      out[di + 2] = pixels[si + 2];
      out[di + 3] = pixels[si + 3] || 255;
    }
  }
  return out;
}

function expandShortFace(box: PerceptionBox, imageHeight: number): PerceptionBox {
  const targetH = Math.round(box.width / 0.62);
  if (box.height >= targetH * 0.85) return box;
  const height = Math.min(targetH, imageHeight - box.y);
  return { ...box, height: Math.max(box.height, height) };
}

function splitWideCard(
  pixels: Uint8ClampedArray,
  width: number,
  box: PerceptionBox
): PerceptionBox[] {
  const aspect = box.width / Math.max(1, box.height);
  if (aspect < 1.05 || box.width < 24) return [box];

  const columns = new Int32Array(box.width);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const i = ((box.y + y) * width + (box.x + x)) * 4;
      if (isCardWhite(pixels[i], pixels[i + 1], pixels[i + 2])) columns[x]++;
    }
  }
  const start = Math.floor(box.width * 0.3);
  const end = Math.floor(box.width * 0.7);
  let valley = start;
  let valleyCount = columns[start];
  let peak = 0;
  for (let x = 0; x < box.width; x++) if (columns[x] > peak) peak = columns[x];
  for (let x = start; x <= end; x++) {
    if (columns[x] < valleyCount) {
      valleyCount = columns[x];
      valley = x;
    }
  }
  if (peak > 0 && valleyCount > peak * 0.8) return [box];

  const pad = 3;
  const left: PerceptionBox = {
    x: box.x,
    y: box.y,
    width: Math.min(box.width, Math.max(10, valley + pad)),
    height: box.height
  };
  const rightX = Math.max(box.x, box.x + valley - pad);
  const right: PerceptionBox = {
    x: rightX,
    y: box.y,
    width: Math.max(10, box.x + box.width - rightX),
    height: box.height
  };
  return [left, right];
}

function findCardFaces(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  felt: PerceptionBox
): PerceptionBox[] {
  const comps = connectedComponents(pixels, width, height, felt, isCardWhite, 40);
  const faces: PerceptionBox[] = [];
  for (const comp of comps) {
    const box: PerceptionBox = {
      x: comp.minX,
      y: comp.minY,
      width: comp.maxX - comp.minX + 1,
      height: comp.maxY - comp.minY + 1
    };
    if (box.height < 16 || box.width < 10) continue;
    if (box.width > felt.width * 0.7 || box.height > felt.height * 0.45) continue;
    const aspect = box.width / box.height;
    if (aspect < 0.35 || aspect > 2.4) continue;
    for (const part of splitWideCard(pixels, width, box)) {
      const grown = expandShortFace(part, height);
      const aspect = grown.width / grown.height;
      if (grown.height >= 16 && grown.width >= 10 && aspect >= 0.4 && aspect < 1.15) {
        faces.push(grown);
      }
    }
  }
  return faces;
}

function clusterRows(boxes: PerceptionBox[]): PerceptionBox[][] {
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  const rows: PerceptionBox[][] = [];
  for (const box of sorted) {
    const cy = box.y + box.height / 2;
    const row = rows.find(group => {
      const mean = group.reduce((sum, item) => sum + item.y + item.height / 2, 0) / group.length;
      return Math.abs(mean - cy) < Math.max(box.height, 12) * 0.65;
    });
    if (row) row.push(box);
    else rows.push([box]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

function boxCenter(box: PerceptionBox): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function priorFromProfile(
  profile: TableLayoutProfile | undefined,
  frameWidth: number,
  frameHeight: number
): { hero: Point; board: Point } | null {
  if (!profile) return null;
  const sx = frameWidth / profile.referenceResolution.width;
  const sy = frameHeight / profile.referenceResolution.height;
  const center = (region: { x: number; y: number; width: number; height: number }): Point => ({
    x: (region.x + region.width / 2) * sx,
    y: (region.y + region.height / 2) * sy
  });
  return {
    hero: center(profile.regions.hero_cards),
    board: center(profile.regions.board)
  };
}

function assignCards(
  faces: PerceptionBox[],
  frameHeight: number,
  prior: { hero: Point; board: Point } | null
): { hero: PerceptionBox[]; board: PerceptionBox[] } {
  const rows = clusterRows(faces);
  let hero: PerceptionBox[] = [];
  let board: PerceptionBox[] = [];

  const bottomRows = rows.filter(row => {
    const y = row.reduce((sum, box) => sum + boxCenter(box).y, 0) / row.length;
    return y > frameHeight * 0.5 && row.length <= 2;
  });
  if (bottomRows.length > 0) {
    bottomRows.sort((a, b) => boxCenter(b[0]).y - boxCenter(a[0]).y);
    hero = bottomRows[0];
  }

  const boardRows = rows.filter(row => row !== hero && row.length >= 3);
  if (boardRows.length > 0) {
    boardRows.sort((a, b) => b.length - a.length);
    board = boardRows[0].slice(0, 5);
  }

  // Soft prior only breaks a tie. A prior that lands on felt or an avatar
  // (no card face nearby) is ignored.
  if (prior && hero.length === 0) {
    const near = faces.filter(box => {
      const c = boxCenter(box);
      return Math.hypot(c.x - prior.hero.x, c.y - prior.hero.y) < frameHeight * 0.16;
    });
    if (near.length > 0 && near.length <= 2 && near.every(box => boxCenter(box).y > frameHeight * 0.45)) {
      hero = near.sort((a, b) => a.x - b.x);
    }
  }

  return { hero, board };
}

function readCard(detector: CardDetector, pixels: Uint8ClampedArray, width: number, box: PerceptionBox): CardDetectionOutput {
  const data = crop(pixels, width, box);
  return detector.analyzeCrop(data, box.width, box.height);
}

function lineBox(comp: Component): PerceptionBox {
  return {
    x: comp.minX,
    y: comp.minY,
    width: comp.maxX - comp.minX + 1,
    height: comp.maxY - comp.minY + 1
  };
}

function mergeHorizontal(boxes: PerceptionBox[], gap: number): PerceptionBox[] {
  const sorted = [...boxes].sort((a, b) => a.x - b.x);
  const lines: PerceptionBox[] = [];
  for (const box of sorted) {
    const line = lines.find(item => {
      const vertical = Math.abs(item.y + item.height / 2 - (box.y + box.height / 2));
      const touches = box.x <= item.x + item.width + gap;
      return vertical < Math.max(item.height, box.height) && touches;
    });
    if (!line) {
      lines.push({ ...box });
      continue;
    }
    const x2 = Math.max(line.x + line.width, box.x + box.width);
    const y2 = Math.max(line.y + line.height, box.y + box.height);
    line.x = Math.min(line.x, box.x);
    line.y = Math.min(line.y, box.y);
    line.width = x2 - line.x;
    line.height = y2 - line.y;
  }
  return lines;
}

function overlapsCard(box: PerceptionBox, cards: PerceptionBox[]): boolean {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return cards.some(card => cx >= card.x && cx <= card.x + card.width && cy >= card.y && cy <= card.y + card.height);
}

function readMoney(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  felt: PerceptionBox,
  cards: PerceptionBox[]
): { value: number | null; confidence: number; raw: string } {
  const glyphs = connectedComponents(pixels, width, height, felt, isGold, 4)
    .map(lineBox)
    .filter(box => box.height >= 2 && box.height <= 28 && box.width <= 24 && !overlapsCard(box, cards));
  const lines = mergeHorizontal(glyphs, 14).filter(line => line.width >= 8 && line.height <= 36);
  const center = { x: felt.x + felt.width / 2, y: felt.y + felt.height * 0.42 };
  let best: { value: number; confidence: number; raw: string; distance: number } | null = null;

  for (const line of lines) {
    const data = crop(pixels, width, line);
    const ocr = NumberOcr.recognizeNumber(data, line.width, line.height);
    const value = interpretMoney(ocr.rawText, ocr.confidence);
    if (value === null) continue;
    const distance = Math.hypot(line.x + line.width / 2 - center.x, line.y + line.height / 2 - center.y);
    if (!best || distance < best.distance) {
      best = { value, confidence: ocr.confidence, raw: ocr.rawText, distance };
    }
  }

  if (!best) return { value: null, confidence: 0, raw: '' };
  return { value: best.value, confidence: best.confidence, raw: best.raw };
}

function classifyWord(text: string): BadgeAction | null {
  const upper = text.toUpperCase();
  for (const entry of BADGE_WORDS) {
    if (upper === entry.word) return entry.action;
  }
  return null;
}

function matchLetter(matrix: Uint8Array): string {
  let best = '';
  let bestScore = -1;
  for (const [char, template] of Object.entries(LETTERS)) {
    let matches = 0;
    let intersection = 0;
    let union = 0;
    for (let row = 0; row < 7; row++) {
      const mask = template[row];
      for (let col = 0; col < 5; col++) {
        const expected = (mask >> (4 - col)) & 1;
        const actual = matrix[row * 5 + col];
        if (expected === actual) matches++;
        if (expected === 1 && actual === 1) intersection++;
        if (expected === 1 || actual === 1) union++;
      }
    }
    const score = (matches / 35) * 0.5 + (union > 0 ? intersection / union : 0) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = char;
    }
  }
  return bestScore >= 0.52 ? best : '';
}

function readWord(pixels: Uint8ClampedArray, imageWidth: number, line: PerceptionBox): string {
  const columns = new Int32Array(line.width);
  for (let y = 0; y < line.height; y++) {
    for (let x = 0; x < line.width; x++) {
      const i = ((line.y + y) * imageWidth + (line.x + x)) * 4;
      if (isLightText(pixels[i], pixels[i + 1], pixels[i + 2])) columns[x]++;
    }
  }
  let text = '';
  let x = 0;
  while (x < line.width) {
    while (x < line.width && columns[x] === 0) x++;
    if (x >= line.width) break;
    const start = x;
    while (x < line.width && columns[x] > 0) x++;
    const glyphW = x - start;
    if (glyphW < 2) continue;
    let minY = line.height;
    let maxY = 0;
    for (let gy = 0; gy < line.height; gy++) {
      for (let gx = start; gx < x; gx++) {
        const i = ((line.y + gy) * imageWidth + (line.x + gx)) * 4;
        if (isLightText(pixels[i], pixels[i + 1], pixels[i + 2])) {
          if (gy < minY) minY = gy;
          if (gy > maxY) maxY = gy;
        }
      }
    }
    const glyphH = maxY - minY + 1;
    if (glyphH < 4) continue;
    const matrix = new Uint8Array(5 * 7);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        const sx = line.x + start + Math.min(glyphW - 1, Math.floor((col / 5) * glyphW));
        const sy = line.y + minY + Math.min(glyphH - 1, Math.floor((row / 7) * glyphH));
        const i = (sy * imageWidth + sx) * 4;
        if (isLightText(pixels[i], pixels[i + 1], pixels[i + 2])) matrix[row * 5 + col] = 1;
      }
    }
    text += matchLetter(matrix);
  }
  return text;
}

function readBadges(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  felt: PerceptionBox,
  cards: PerceptionBox[]
): ObservedBadge[] {
  const glyphs = connectedComponents(pixels, width, height, felt, isLightText, 4)
    .map(lineBox)
    .filter(box => box.height >= 2 && box.height <= 24 && box.width <= 20 && !overlapsCard(box, cards));
  const lines = mergeHorizontal(glyphs, 8).filter(line => line.width >= 12 && line.height <= 28);
  const badges: ObservedBadge[] = [];
  for (const line of lines) {
    const text = readWord(pixels, width, line);
    const action = classifyWord(text);
    if (!action) continue;
    badges.push({ action, x: line.x, y: line.y, text });
  }
  return badges;
}

function readHeroButtons(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  felt: PerceptionBox
): ButtonDetectionResult {
  const band: PerceptionBox = {
    x: felt.x,
    y: felt.y + Math.floor(felt.height * 0.72),
    width: felt.width,
    height: Math.max(10, Math.floor(felt.height * 0.28))
  };
  if (band.y + band.height > height) band.height = height - band.y;
  if (band.width < 20 || band.height < 10) {
    return ButtonDetector.detectActionButtons(new Uint8ClampedArray(0), 0, 0);
  }
  const data = crop(pixels, width, band);
  const result = ButtonDetector.detectActionButtons(data, band.width, band.height);
  // A bright felt band satisfies the green-button test across most of the crop.
  // A real check/call button is a compact cluster, not the table.
  if (result.hasCheckOrCall && !result.hasFold && !result.hasBetOrRaise) {
    let green = 0;
    const total = band.width * band.height;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (g > 110 && g > r * 1.2 && g > b * 1.1) green++;
    }
    if (total > 0 && green / total > 0.12) {
      return {
        isHeroTurn: false,
        hasFold: false,
        hasCheckOrCall: false,
        hasBetOrRaise: false,
        availableActions: [],
        confidence: 0
      };
    }
  }
  return result;
}

/**
 * Finds card faces, money, and action badges on the felt, then recognizes them.
 * Layout profiles are optional tie-breakers. A prior that does not land on a
 * card face does not invent cards.
 */
export function perceiveTable(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  profile?: TableLayoutProfile,
  detector: CardDetector = new CardDetector(0.7)
): TablePerception {
  const felt = largestFelt(pixels, width, height);
  const faces = findCardFaces(pixels, width, height, felt);
  const prior = priorFromProfile(profile, width, height);
  const assigned = assignCards(faces, height, prior);

  const heroReads = assigned.hero.slice(0, 2).map(box => readCard(detector, pixels, width, box));
  const boardReads = assigned.board.slice(0, 5).map(box => readCard(detector, pixels, width, box));

  const heroOutputs: [CardDetectionOutput, CardDetectionOutput] = [
    heroReads[0] && heroReads[0].card ? heroReads[0] : emptyCard('Nenhuma face de carta do Hero encontrada.'),
    heroReads[1] && heroReads[1].card ? heroReads[1] : emptyCard('Nenhuma face de carta do Hero encontrada.')
  ];
  const boardOutputs = [0, 1, 2, 3, 4].map(index => {
    const read = boardReads[index];
    return read && read.card ? read : emptyCard('Slot comunitário sem carta visível.');
  }) as TablePerception['boardOutputs'];

  const heroCards = heroOutputs.filter(slot => slot.card).map(slot => slot.card as CardString);
  const boardCards = boardOutputs.filter(slot => slot.card).map(slot => slot.card as CardString);
  const money = readMoney(pixels, width, height, felt, faces);
  const badges = readBadges(pixels, width, height, felt, faces);
  const heroButtons = readHeroButtons(pixels, width, height, felt);

  const published = [...heroCards, ...boardCards];
  const confidences = [...heroOutputs, ...boardOutputs]
    .filter(slot => slot.card)
    .map(slot => slot.confidence);
  const confidence =
    published.length === 0
      ? 0
      : Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 1000) / 1000;

  return {
    heroOutputs,
    boardOutputs,
    heroCards: heroCards.length >= 2 ? heroCards : [],
    boardCards,
    potValue: money.value,
    potConfidence: money.value === null ? 0 : money.confidence,
    potRaw: money.raw,
    badges,
    heroButtons,
    confidence
  };
}

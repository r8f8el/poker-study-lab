import {
  CardString,
  CapturedFrame,
  TableLayoutProfile,
  GameState,
  Street,
  Rank,
  Suit,
  CardVisualState
} from '../../../../packages/shared-types/src';
import { CardDetector, CardDetectionOutput } from './CardDetector';
import { RoiManager, CardRegions } from '../capture/RoiManager';
import { TemporalTableValidator } from './TemporalValidator';

export interface SlotDebugInfo {
  id: string; // 'hero_1' | 'hero_2' | 'flop_1' | 'flop_2' | 'flop_3' | 'turn' | 'river'
  name: string;
  visualState: CardVisualState;
  card: CardString | null;
  rank: Rank | null;
  suit: Suit | null;
  confidence: number;
  rankConfidence: number;
  suitConfidence: number;
  cropDataUrl: string;
  colors: {
    white: number;
    black: number;
    red: number;
    blue: number;
    green: number;
  };
  reasons: string[];
}

export interface VisionDetectionResult {
  heroCards: CardString[];
  boardCards: CardString[];
  potValue: number | null;
  street: Street;
  confidence: number;
  slotsDebug: SlotDebugInfo[];
}

export class TableVisionAnalyzer {
  private cardDetector: CardDetector;
  private roiManager: RoiManager;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private slotCanvas: HTMLCanvasElement | null = null;
  private slotCtx: CanvasRenderingContext2D | null = null;
  private isProcessing = false;
  private lastAnalysisTime = 0;

  constructor(minConfidence = 0.80) {
    this.cardDetector = new CardDetector(minConfidence);
    this.roiManager = new RoiManager();

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.slotCanvas = document.createElement('canvas');
      this.slotCtx = this.slotCanvas.getContext('2d', { willReadFrequently: true });
    }
  }

  /**
   * Analyzes a captured frame against the specified table layout profile.
   * Throttled to max 2-3 analyses per second to avoid any UI frame drops.
   */
  public async analyzeFrame(
    frame: CapturedFrame,
    profile: TableLayoutProfile,
    temporalValidator?: TemporalTableValidator
  ): Promise<VisionDetectionResult | null> {
    if (!frame.dataUrl || this.isProcessing) return null;

    const now = performance.now();
    // Throttle vision processing to at most once every 350ms
    if (now - this.lastAnalysisTime < 350) return null;
    this.lastAnalysisTime = now;
    this.isProcessing = true;

    try {
      this.roiManager.setProfile(profile);
      const img = await this.loadImage(frame.dataUrl);

      const frameWidth = frame.width || img.width;
      const frameHeight = frame.height || img.height;

      if (!this.canvas || !this.ctx) {
        this.isProcessing = false;
        return null;
      }

      if (this.canvas.width !== frameWidth || this.canvas.height !== frameHeight) {
        this.canvas.width = frameWidth;
        this.canvas.height = frameHeight;
      }

      this.ctx.drawImage(img, 0, 0, frameWidth, frameHeight);

      // Compute pixel regions scaled to the actual frame dimensions
      const regions: CardRegions = this.roiManager.getComputedCardRegions(frameWidth, frameHeight);

      // 1. Analyze Hero Cards
      const hero1 = this.analyzeSlot('hero_1', 'Hero 1', regions.hero_card_1);
      const hero2 = this.analyzeSlot('hero_2', 'Hero 2', regions.hero_card_2);

      // 2. Analyze Board Cards (Flop 1, 2, 3, Turn, River)
      const flop1 = this.analyzeSlot('flop_1', 'Flop 1', regions.board_flop_1);
      const flop2 = this.analyzeSlot('flop_2', 'Flop 2', regions.board_flop_2);
      const flop3 = this.analyzeSlot('flop_3', 'Flop 3', regions.board_flop_3);
      const turn = this.analyzeSlot('turn', 'Turn', regions.board_turn);
      const river = this.analyzeSlot('river', 'River', regions.board_river);

      const allSlotResults = [hero1, hero2, flop1, flop2, flop3, turn, river];

      // Extract unique cards without duplicates across the single 52-card deck
      const usedCards = new Set<string>();

      const boardCards: CardString[] = [];
      for (const res of [flop1, flop2, flop3, turn, river]) {
        const slot = res.output;
        if (slot.visualState === 'VISIBLE_CARD' && slot.card) {
          if (!usedCards.has(slot.card)) {
            usedCards.add(slot.card);
            boardCards.push(slot.card);
          } else {
            res.debug.card = null;
            res.debug.reasons.push('Carta duplicada suprimida (conflito de baralho).');
          }
        }
      }

      const heroCards: CardString[] = [];
      for (const res of [hero1, hero2]) {
        const slot = res.output;
        if (slot.visualState === 'VISIBLE_CARD' && slot.card) {
          if (!usedCards.has(slot.card)) {
            usedCards.add(slot.card);
            heroCards.push(slot.card);
          } else {
            res.debug.card = null;
            res.debug.reasons.push('Carta duplicada suprimida (já presente no board ou na mão).');
          }
        }
      }

      // Determine Street based on actual board cards count
      let street: Street = 'PREFLOP';
      if (boardCards.length >= 5) street = 'RIVER';
      else if (boardCards.length === 4) street = 'TURN';
      else if (boardCards.length >= 3) street = 'FLOP';

      const potValue = this.estimatePotFromRegion(regions.pot);

      const slotsDebug: SlotDebugInfo[] = allSlotResults.map(r => r.debug);

      this.isProcessing = false;

      return {
        heroCards,
        boardCards,
        potValue,
        street,
        confidence: 0.95,
        slotsDebug
      };
    } catch {
      this.isProcessing = false;
      return null;
    }
  }

  private analyzeSlot(
    id: string,
    name: string,
    region: { x: number; y: number; width: number; height: number }
  ): { output: CardDetectionOutput; debug: SlotDebugInfo } {
    const emptyColors = { white: 0, black: 0, red: 0, blue: 0, green: 0 };

    if (!this.ctx || region.width <= 0 || region.height <= 0) {
      const fallbackOutput: CardDetectionOutput = {
        visualState: 'UNKNOWN',
        rank: null,
        suit: null,
        card: null,
        confidence: 0,
        rankConfidence: 0,
        suitConfidence: 0,
        reasons: ['Dimensões inválidas do slot']
      };
      return {
        output: fallbackOutput,
        debug: {
          id,
          name,
          visualState: 'UNKNOWN',
          card: null,
          rank: null,
          suit: null,
          confidence: 0,
          rankConfidence: 0,
          suitConfidence: 0,
          cropDataUrl: '',
          colors: emptyColors,
          reasons: fallbackOutput.reasons
        }
      };
    }

    try {
      const imgData = this.ctx.getImageData(region.x, region.y, region.width, region.height);
      const output = this.cardDetector.analyzeCrop(imgData.data, region.width, region.height);

      let cropDataUrl = '';
      if (this.slotCanvas && this.slotCtx) {
        this.slotCanvas.width = region.width;
        this.slotCanvas.height = region.height;
        this.slotCtx.putImageData(imgData, 0, 0);
        try {
          cropDataUrl = this.slotCanvas.toDataURL('image/jpeg', 0.85);
        } catch {}
      }

      const colors = output.debug?.suitColors || emptyColors;

      return {
        output,
        debug: {
          id,
          name,
          visualState: output.visualState,
          card: output.card,
          rank: output.rank,
          suit: output.suit,
          confidence: output.confidence,
          rankConfidence: output.rankConfidence,
          suitConfidence: output.suitConfidence,
          cropDataUrl,
          colors: {
            white: colors.white || 0,
            black: colors.black || 0,
            red: colors.red || 0,
            blue: colors.blue || 0,
            green: colors.green || 0
          },
          reasons: output.reasons
        }
      };
    } catch {
      const errOutput: CardDetectionOutput = {
        visualState: 'UNKNOWN',
        rank: null,
        suit: null,
        card: null,
        confidence: 0,
        rankConfidence: 0,
        suitConfidence: 0,
        reasons: ['Erro ao obter ImageData da região']
      };
      return {
        output: errOutput,
        debug: {
          id,
          name,
          visualState: 'UNKNOWN',
          card: null,
          rank: null,
          suit: null,
          confidence: 0,
          rankConfidence: 0,
          suitConfidence: 0,
          cropDataUrl: '',
          colors: emptyColors,
          reasons: errOutput.reasons
        }
      };
    }
  }

  private estimatePotFromRegion(potRegion: { x: number; y: number; width: number; height: number }): number | null {
    if (!this.ctx) return null;
    try {
      const imgData = this.ctx.getImageData(potRegion.x, potRegion.y, potRegion.width, potRegion.height);
      let nonFeltPixels = 0;
      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        // Yellow or white text detection for pot numbers (like "POT 16" or "1.2K")
        if ((r > 180 && g > 160 && b < 80) || (r > 200 && g > 200 && b > 200)) {
          nonFeltPixels++;
        }
      }
      return nonFeltPixels > 25 ? null : null; // don't hallucinate 16 unless parsed
    } catch {
      return null;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}

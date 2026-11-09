import {
  CardString,
  CapturedFrame,
  TableLayoutProfile,
  Street,
  Rank,
  Suit,
  CardVisualState
} from '../../../../packages/shared-types/src';
import { CardDetector } from './CardDetector';
import { TemporalTableValidator } from './TemporalValidator';
import { resolveLiveCards } from './resolveLiveCards';
import { perceiveTable, TablePerception } from './tablePerception';

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
  heroConfidences: [number, number];
  boardCards: CardString[];
  boardConfidence: number;
  potValue: number | null;
  potConfidence: number;
  street: Street;
  confidence: number;
  temporalConsistency: number;
  isAnimationActive: boolean;
  isHeroTurn: boolean;
  availableActions: Array<'fold' | 'check' | 'call' | 'bet' | 'raise'>;
  observedBadges: string[];
  slotsDebug: SlotDebugInfo[];
}

export class TableVisionAnalyzer {
  private cardDetector: CardDetector;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isProcessing = false;
  private lastAnalysisTime = 0;

  constructor(minConfidence = 0.80) {
    this.cardDetector = new CardDetector(minConfidence);

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
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
      const framePixels = this.ctx.getImageData(0, 0, frameWidth, frameHeight).data;
      // Profile is only a soft prior. Objects are found on the felt itself,
      // and the prior is recomputed from this frame's width and height.
      const perceived = perceiveTable(framePixels, frameWidth, frameHeight, profile, this.cardDetector);

      const reading = resolveLiveCards(
        perceived.heroOutputs,
        perceived.boardOutputs,
        temporalValidator,
        performance.now()
      );

      const potValue = perceived.potValue;
      const slotsDebug = this.debugFromPerception(perceived);

      this.isProcessing = false;

      return {
        heroCards: reading.heroCards,
        heroConfidences: reading.heroConfidences,
        boardCards: reading.boardCards,
        boardConfidence: reading.boardConfidence,
        potValue,
        potConfidence: perceived.potConfidence,
        street: reading.street,
        confidence: reading.overallConfidence,
        temporalConsistency: reading.temporalConsistency,
        isAnimationActive: reading.isAnimationActive,
        isHeroTurn: perceived.heroButtons.isHeroTurn,
        availableActions: perceived.heroButtons.availableActions,
        observedBadges: perceived.badges.map(badge => badge.action),
        slotsDebug
      };
    } catch {
      this.isProcessing = false;
      return null;
    }
  }

  private debugFromPerception(perceived: TablePerception): SlotDebugInfo[] {
    const slots = [
      ['hero_1', 'Hero 1', perceived.heroOutputs[0]],
      ['hero_2', 'Hero 2', perceived.heroOutputs[1]],
      ['flop_1', 'Flop 1', perceived.boardOutputs[0]],
      ['flop_2', 'Flop 2', perceived.boardOutputs[1]],
      ['flop_3', 'Flop 3', perceived.boardOutputs[2]],
      ['turn', 'Turn', perceived.boardOutputs[3]],
      ['river', 'River', perceived.boardOutputs[4]]
    ] as const;
    return slots.map(([id, name, output]) => ({
      id,
      name,
      visualState: output.visualState,
      card: output.card,
      rank: output.rank,
      suit: output.suit,
      confidence: output.confidence,
      rankConfidence: output.rankConfidence,
      suitConfidence: output.suitConfidence,
      cropDataUrl: '',
      colors: { white: 0, black: 0, red: 0, blue: 0, green: 0 },
      reasons: output.reasons
    }));
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

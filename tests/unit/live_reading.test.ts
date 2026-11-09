import { describe, it, expect } from 'vitest';
import { CardDetectionOutput } from '../../apps/desktop/src/vision/CardDetector';
import { resolveLiveCards } from '../../apps/desktop/src/vision/resolveLiveCards';
import { TemporalTableValidator } from '../../apps/desktop/src/vision/TemporalValidator';
import { mergeVisionIntoGameState } from '../../apps/desktop/src/vision/mergeVisionState';
import { VisionDetectionResult } from '../../apps/desktop/src/vision/TableVisionAnalyzer';
import { MOCK_SUPREMA_POKER_STATE, MOCK_VALID_FLOP_STATE } from '../../packages/test-fixtures/src';
import { CardString, CardVisualState } from '../../packages/shared-types/src';

function slot(card: CardString | null, confidence = 0.96, visualState: CardVisualState = 'VISIBLE_CARD'): CardDetectionOutput {
  const [rank, suit] = card ? [card[0], card[1]] : [null, null];
  return {
    visualState: card ? visualState : 'EMPTY',
    rank: rank as CardDetectionOutput['rank'],
    suit: suit as CardDetectionOutput['suit'],
    card,
    confidence: card ? confidence : 1,
    rankConfidence: card ? confidence : 0,
    suitConfidence: card ? confidence : 0,
    reasons: []
  };
}

const empty = slot(null);

describe('resolveLiveCards', () => {
  it('does not publish a card until five agreeing frames', () => {
    const validator = new TemporalTableValidator(7, 5, 0.85);
    const hero: [CardDetectionOutput, CardDetectionOutput] = [slot('As'), slot('Kd')];
    const board = [empty, empty, empty, empty, empty] as [
      CardDetectionOutput,
      CardDetectionOutput,
      CardDetectionOutput,
      CardDetectionOutput,
      CardDetectionOutput
    ];

    let reading = resolveLiveCards(hero, board, validator, 1);
    expect(reading.heroCards).toEqual([]);
    expect(reading.overallConfidence).toBeLessThanOrEqual(0.5);

    for (let frame = 0; frame < 3; frame++) {
      reading = resolveLiveCards(hero, board, validator, frame + 2);
    }
    expect(reading.heroCards).toEqual([]);

    reading = resolveLiveCards(hero, board, validator, 10);
    expect(reading.heroCards).toEqual(['As', 'Kd']);
    expect(reading.street).toBe('PREFLOP');
    expect(reading.overallConfidence).toBeGreaterThanOrEqual(0.85);
  });

  it('keeps a confirmed card when a single frame flickers', () => {
    const validator = new TemporalTableValidator(7, 5, 0.85);
    const board = [empty, empty, empty, empty, empty] as [
      CardDetectionOutput,
      CardDetectionOutput,
      CardDetectionOutput,
      CardDetectionOutput,
      CardDetectionOutput
    ];
    for (let frame = 0; frame < 5; frame++) {
      resolveLiveCards([slot('As'), slot('Kd')], board, validator, frame);
    }
    const flickered = resolveLiveCards([slot('Qs'), slot('Kd')], board, validator, 20);
    expect(flickered.heroCards).toEqual(['As', 'Kd']);
  });

  it('does not treat a confirmed river past an uncertain turn as five board cards', () => {
    const reading = resolveLiveCards(
      [slot('As'), slot('Kd')],
      [slot('2h'), slot('Qc'), slot('3d'), empty, slot('9s')],
      undefined,
      1
    );
    expect(reading.boardCards).toEqual(['2h', 'Qc', '3d']);
    expect(reading.street).toBe('FLOP');
  });
});

describe('mergeVisionIntoGameState', () => {
  const baseDetection = (overrides: Partial<VisionDetectionResult> = {}): VisionDetectionResult => ({
    heroCards: ['Kh', '4c'],
    heroConfidences: [0.9, 0.88],
    boardCards: [],
    boardConfidence: 1,
    potValue: null,
    potConfidence: 0,
    street: 'PREFLOP',
    confidence: 0.88,
    temporalConsistency: 0.99,
    isAnimationActive: false,
    isHeroTurn: false,
    availableActions: [],
    observedBadges: [],
    slotsDebug: [],
    ...overrides
  });

  it('keeps the previous pot when the reader did not parse a number', () => {
    const next = mergeVisionIntoGameState(MOCK_SUPREMA_POKER_STATE, baseDetection(), 'PREFLOP');
    expect(next.pot).toBe(MOCK_SUPREMA_POKER_STATE.pot);
    expect(next.confidence.pot).toEqual(MOCK_SUPREMA_POKER_STATE.confidence.pot);
    expect(next.confidence.hero_cards[0].confidence).toBe(0.9);
    expect(next.confidence.overall_confidence).toBe(0.88);
  });

  it('does not invent a zero pot over a hand that already has one', () => {
    const next = mergeVisionIntoGameState(
      MOCK_VALID_FLOP_STATE,
      baseDetection({ potValue: null, street: 'FLOP', boardCards: ['7h', '8h', 'Qs'] }),
      'FLOP'
    );
    expect(next.pot).toBe(150);
    expect(next.pot).not.toBe(0);
  });
});

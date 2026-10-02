import { describe, it, expect } from 'vitest';
import { HandEvaluator } from '../../apps/desktop/src/decision/HandEvaluator';
import { EquityCalculator } from '../../apps/desktop/src/decision/EquityCalculator';
import { DeterministicDecisionEngine } from '../../apps/desktop/src/decision/DeterministicDecisionEngine';
import { GameState, RecommendationGateResult } from '../../packages/shared-types/src';
import { MOCK_VALID_FLOP_STATE } from '../../packages/test-fixtures/src';

describe('Incremento 6 — HandEvaluator', () => {
  it('identifies Royal Flush correctly', () => {
    const hand = HandEvaluator.evaluate(['As', 'Ks', 'Qs', 'Js', 'Ts', '2c', '3d']);
    expect(hand.category).toBe('ROYAL_FLUSH');
    expect(hand.categoryRank).toBe(10);
  });

  it('identifies Four of a Kind and breaks ties by quad rank then kicker', () => {
    const quadKings = HandEvaluator.evaluate(['Kh', 'Kd', 'Kc', 'Ks', '9s', '2h', '3d']);
    const quadQueens = HandEvaluator.evaluate(['Qh', 'Qd', 'Qc', 'Qs', 'As', '2h', '3d']);

    expect(quadKings.category).toBe('FOUR_OF_A_KIND');
    expect(quadQueens.category).toBe('FOUR_OF_A_KIND');
    expect(HandEvaluator.compare(quadKings, quadQueens)).toBe(1);
  });

  it('identifies Full House and compares boat ranks', () => {
    const boatAces = HandEvaluator.evaluate(['As', 'Ah', 'Ad', 'Ks', 'Kh', '2c', '3c']);
    const boatKings = HandEvaluator.evaluate(['Ks', 'Kh', 'Kd', 'As', 'Ah', '2c', '3c']);

    expect(boatAces.category).toBe('FULL_HOUSE');
    expect(boatKings.category).toBe('FULL_HOUSE');
    expect(HandEvaluator.compare(boatAces, boatKings)).toBe(1);
  });

  it('identifies Flushes and breaks ties by highest card', () => {
    const aceFlush = HandEvaluator.evaluate(['As', 'Js', '8s', '4s', '2s', 'Kd', 'Qc']);
    const kingFlush = HandEvaluator.evaluate(['Ks', 'Qs', 'Js', '8s', '4s', 'Ad', '2c']);

    expect(aceFlush.category).toBe('FLUSH');
    expect(kingFlush.category).toBe('FLUSH');
    expect(HandEvaluator.compare(aceFlush, kingFlush)).toBe(1);
  });

  it('handles Wheel Straight (A-2-3-4-5) as a 5-high straight', () => {
    const wheel = HandEvaluator.evaluate(['As', '2c', '3d', '4h', '5s', 'Kh', 'Qd']);
    const sixHigh = HandEvaluator.evaluate(['2c', '3d', '4h', '5s', '6h', 'Kh', 'Qd']);

    expect(wheel.category).toBe('STRAIGHT');
    expect(sixHigh.category).toBe('STRAIGHT');
    expect(HandEvaluator.compare(sixHigh, wheel)).toBe(1); // 6-high beats 5-high wheel
  });

  it('identifies Two Pair and breaks ties correctly', () => {
    const twoPairAces = HandEvaluator.evaluate(['As', 'Ah', 'Ks', 'Kh', 'Qd', '2c', '3c']);
    const twoPairKings = HandEvaluator.evaluate(['Ks', 'Kh', 'Qs', 'Qh', 'Jd', '2c', '3c']);

    expect(twoPairAces.category).toBe('TWO_PAIR');
    expect(twoPairKings.category).toBe('TWO_PAIR');
    expect(HandEvaluator.compare(twoPairAces, twoPairKings)).toBe(1);
  });
});

describe('Incremento 6 — EquityCalculator & Pot Odds', () => {
  it('calculates Pot Odds accurately', () => {
    // Calling $50 into a $100 pot -> 50 / (100 + 50) = 50 / 150 = 33.3%
    expect(EquityCalculator.calculatePotOdds(50, 100)).toBeCloseTo(0.333, 2);

    // Free check -> callAmount 0 -> 0%
    expect(EquityCalculator.calculatePotOdds(0, 150)).toBe(0);

    // Calling $20 into an $80 pot -> 20 / 100 = 20%
    expect(EquityCalculator.calculatePotOdds(20, 80)).toBe(0.2);
  });

  it('simulates AA vs KK preflop equity accurately (>75% for AA)', () => {
    const result = EquityCalculator.estimateEquity(['As', 'Ah'], [], ['Ks', 'Kh'], 400);
    expect(result.heroEquity).toBeGreaterThan(0.75);
    expect(result.villainEquity).toBeLessThan(0.25);
    expect(result.samples).toBe(400);
  });

  it('simulates As Ks vs 2c 7d preflop equity accurately (>60% for AKs)', () => {
    const result = EquityCalculator.estimateEquity(['As', 'Ks'], [], ['2c', '7d'], 400);
    expect(result.heroEquity).toBeGreaterThan(0.60);
  });
});

describe('Incremento 6 — DeterministicDecisionEngine', () => {
  const allowedGate: RecommendationGateResult = {
    allowed: true,
    reasons: []
  };

  const blockedGate: RecommendationGateResult = {
    allowed: false,
    reasons: ['Janela desautorizada ou baixa confiança.']
  };

  it('suppresses recommendation when RecommendationGate is blocked', () => {
    const rec = DeterministicDecisionEngine.evaluate(MOCK_VALID_FLOP_STATE, blockedGate);
    expect(rec.confidence).toBe(0);
    expect(rec.action).toBe('fold');
    expect(rec.explanation_factors).toContain('Janela desautorizada ou baixa confiança.');
  });

  it('generates deterministic recommendation with valid frequency sum of 1.0 when gate is allowed', () => {
    const rec = DeterministicDecisionEngine.evaluate(MOCK_VALID_FLOP_STATE, allowedGate);

    expect(rec.source).toBe('reference_strategy');
    expect(rec.confidence).toBeGreaterThanOrEqual(0.9);
    expect(rec.explanation_factors.length).toBeGreaterThan(2);

    const freqSum = Object.values(rec.frequencies).reduce((a, b) => a + b, 0);
    expect(freqSum).toBeCloseTo(1.0, 2);
  });

  it('recommends bet or raise when hero holds a monster hand on the flop', () => {
    const monsterState: GameState = {
      ...MOCK_VALID_FLOP_STATE,
      hero: {
        ...MOCK_VALID_FLOP_STATE.hero,
        cards: ['Qs', 'Qd'] // Sets set of Queens on Q-8-7 flop
      },
      board: ['Qc', '8h', '7d'],
      action_history: []
    };

    const rec = DeterministicDecisionEngine.evaluate(monsterState, allowedGate);
    expect(rec.action).toBe('bet');
    expect(rec.frequencies.bet_66 || rec.frequencies.bet_33).toBeGreaterThan(0);
    expect(rec.equity_estimate).toBeGreaterThan(0.70);
  });

  it('recommends fold when facing a bet with severe negative equity edge (-EV)', () => {
    const trashState: GameState = {
      ...MOCK_VALID_FLOP_STATE,
      hero: {
        ...MOCK_VALID_FLOP_STATE.hero,
        cards: ['2c', '7d']
      },
      board: ['Ah', 'Kh', 'Qd'],
      action_history: [
        {
          street: 'FLOP',
          player: 'Villain',
          action: 'bet',
          amount: 80,
          potBefore: 100,
          timestamp: new Date().toISOString()
        }
      ]
    };

    const rec = DeterministicDecisionEngine.evaluate(trashState, allowedGate);
    expect(rec.action).toBe('fold');
    expect(rec.frequencies.fold).toBeGreaterThan(0.5);
  });

  it('recommends raise when facing a small bet with monster top set (+EV)', () => {
    const monsterFacingBet: GameState = {
      ...MOCK_VALID_FLOP_STATE,
      hero: {
        ...MOCK_VALID_FLOP_STATE.hero,
        cards: ['As', 'Ah']
      },
      board: ['Ad', '8c', '2s'],
      action_history: [
        {
          street: 'FLOP',
          player: 'Villain',
          action: 'bet',
          amount: 20,
          potBefore: 100,
          timestamp: new Date().toISOString()
        }
      ]
    };

    const rec = DeterministicDecisionEngine.evaluate(monsterFacingBet, allowedGate);
    expect(rec.action).toBe('raise');
    expect(rec.frequencies.raise).toBeGreaterThan(0.5);
  });
});

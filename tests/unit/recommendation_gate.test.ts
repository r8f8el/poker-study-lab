import { describe, it, expect } from 'vitest';
import { RecommendationGate } from '../../apps/desktop/src/app-state/RecommendationGate';
import {
  MOCK_VALID_PREFLOP_STATE,
  MOCK_VALID_FLOP_STATE,
  MOCK_INCONSISTENT_DUPLICATE_CARD_STATE,
  MOCK_UNCERTAIN_STATE
} from '../../packages/test-fixtures/src';
import { AppSettings } from '../../packages/shared-types/src';

const TEST_SETTINGS: AppSettings = {
  authorizedAppIdentifier: 'com.auth.poker.client',
  fps: 15,
  minConfidenceAutoAccept: 0.98,
  minConfidenceTemporalAccept: 0.95,
  minConfidenceProbable: 0.85,
  temporalWindowFrames: 7,
  temporalMinConsensusFrames: 5,
  enableAIExplanations: false,
  theme: 'midnight',
  activeProfileId: 'default'
};

describe('RecommendationGate - Security & Consistency Enforcement', () => {
  const gate = new RecommendationGate(TEST_SETTINGS);

  it('allows recommendation when all table fields and security checks are valid', () => {
    const result = gate.evaluate(MOCK_VALID_FLOP_STATE);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toContain('Todos os critérios de segurança e integridade foram satisfeitos.');
  });

  it('blocks recommendation immediately when analysis is paused', () => {
    const pausedState = { ...MOCK_VALID_FLOP_STATE, isPaused: true };
    const result = gate.evaluate(pausedState);
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('PAUSED');
  });

  it('blocks recommendation when window is unauthorized', () => {
    const unauthState = { ...MOCK_VALID_FLOP_STATE, app_id: 'com.malicious.fake.client' };
    const result = gate.evaluate(unauthState);
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('UNAUTHORIZED_APP');
  });

  it('blocks recommendation when table animation is actively running', () => {
    const animatingState = { ...MOCK_VALID_FLOP_STATE, isAnimationActive: true };
    const result = gate.evaluate(animatingState);
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('ANIMATION_IN_PROGRESS');
  });

  it('blocks recommendation when duplicate cards are detected between Hero and Board', () => {
    const result = gate.evaluate(MOCK_INCONSISTENT_DUPLICATE_CARD_STATE);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.includes('Cartas duplicadas'))).toBe(true);
  });

  it('blocks recommendation when overall confidence is below threshold', () => {
    const result = gate.evaluate(MOCK_UNCERTAIN_STATE);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.includes('Confiança geral'))).toBe(true);
  });

  it('blocks recommendation when flop card count is invalid', () => {
    const invalidFlop = {
      ...MOCK_VALID_FLOP_STATE,
      board: ['7h', '8h'] // only 2 cards on flop!
    };
    const result = gate.evaluate(invalidFlop as any);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.includes('Flop requer exatamente 3 cartas'))).toBe(true);
  });

  it('blocks recommendation when not Hero turn', () => {
    const opponentTurn = {
      ...MOCK_VALID_FLOP_STATE,
      active_player: 'Shark99'
    };
    const result = gate.evaluate(opponentTurn);
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('NOT_HERO_TURN');
  });

  // Incremento 7: Advanced checks
  it('blocks recommendation when frame latency exceeds safety tolerance', () => {
    const result = gate.evaluate(MOCK_VALID_FLOP_STATE, { frameLatencyMs: 2500, maxLatencyMs: 2000 });
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('LATENCY_EXCEEDED');
    expect(result.reasons.some(r => r.includes('Latência do frame (2500ms) excede o limite'))).toBe(true);
  });

  it('blocks recommendation when Hero has already folded in current hand', () => {
    const foldedState = {
      ...MOCK_VALID_FLOP_STATE,
      hero: {
        ...MOCK_VALID_FLOP_STATE.hero,
        has_folded: true
      }
    };
    const result = gate.evaluate(foldedState);
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('HERO_FOLDED');
  });

  it('blocks recommendation when Hero stack is negative or marked All-in with positive stack', () => {
    const negativeStack = {
      ...MOCK_VALID_FLOP_STATE,
      hero: { ...MOCK_VALID_FLOP_STATE.hero, stack: -10 }
    };
    const resNeg = gate.evaluate(negativeStack);
    expect(resNeg.allowed).toBe(false);
    expect(resNeg.blockCode).toBe('INVALID_STACK');

    const allInWithChips = {
      ...MOCK_VALID_FLOP_STATE,
      hero: { ...MOCK_VALID_FLOP_STATE.hero, is_all_in: true, stack: 150 }
    };
    const resAllIn = gate.evaluate(allInWithChips);
    expect(resAllIn.allowed).toBe(false);
    expect(resAllIn.blockCode).toBe('INVALID_STACK');
  });

  it('blocks recommendation when fewer than 2 active players remain in hand', () => {
    const singlePlayerLeft = {
      ...MOCK_VALID_FLOP_STATE,
      players: [
        { id: 'p1', name: 'Hero', seat: 1, stack: 200, position: 'BTN' as const, is_hero: true, has_folded: false, is_all_in: false, current_bet: 0 },
        { id: 'p2', name: 'SB', seat: 2, stack: 190, position: 'SB' as const, is_hero: false, has_folded: true, is_all_in: false, current_bet: 0 },
        { id: 'p3', name: 'BB', seat: 3, stack: 180, position: 'BB' as const, is_hero: false, has_folded: true, is_all_in: false, current_bet: 0 }
      ]
    };
    const result = gate.evaluate(singlePlayerLeft);
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('INSUFFICIENT_ACTIVE_PLAYERS');
  });

  it('blocks recommendation when sum of current round bets exceeds total pot', () => {
    const betPotMismatch = {
      ...MOCK_VALID_FLOP_STATE,
      pot: 50,
      players: [
        { id: 'p1', name: 'Hero', seat: 1, stack: 200, position: 'BTN' as const, is_hero: true, has_folded: false, is_all_in: false, current_bet: 40 },
        { id: 'p2', name: 'SB', seat: 2, stack: 190, position: 'SB' as const, is_hero: false, has_folded: false, is_all_in: false, current_bet: 40 }
      ]
    };
    const result = gate.evaluate(betPotMismatch);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.includes('Soma das apostas da rodada ($80) excede o pote total ($50)'))).toBe(true);
  });
});

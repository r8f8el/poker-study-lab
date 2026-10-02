import { describe, it, expect } from 'vitest';
import {
  buildRangeMatrix,
  expandComboToCardPairs,
  getCombosForPercentage,
  OPPONENT_PROFILES
} from '../../apps/desktop/src/decision/RangeModel';
import { EquityCalculator } from '../../apps/desktop/src/decision/EquityCalculator';
import { DeterministicDecisionEngine } from '../../apps/desktop/src/decision/DeterministicDecisionEngine';
import { MOCK_VALID_FLOP_STATE } from '../../packages/test-fixtures/src';
import { RecommendationGateResult, CardString } from '../../packages/shared-types/src';

describe('Incremento 8 — RangeModel & 13x13 Matrix', () => {
  it('builds a valid 13x13 matrix with pairs on diagonal, suited on top, offsuit on bottom', () => {
    const matrix = buildRangeMatrix();
    expect(matrix.length).toBe(13);
    expect(matrix[0].length).toBe(13);

    // Diagonal: Pairs
    expect(matrix[0][0]).toBe('AA');
    expect(matrix[1][1]).toBe('KK');
    expect(matrix[12][12]).toBe('22');

    // Upper triangle: Suited
    expect(matrix[0][1]).toBe('AKs');
    expect(matrix[0][2]).toBe('AQs');
    expect(matrix[1][2]).toBe('KQs');

    // Lower triangle: Offsuit
    expect(matrix[1][0]).toBe('AKo');
    expect(matrix[2][0]).toBe('AQo');
    expect(matrix[2][1]).toBe('KQo');
  });

  it('expands combo symbols to exact concrete card pairs excluding dead cards', () => {
    // Pocket Aces: 6 combinations
    const aaPairs = expandComboToCardPairs('AA', []);
    expect(aaPairs.length).toBe(6);

    // If 'As' is dead, combinations drops from 6 to 3 (AcAd, AcAh, AdAh)
    const aaWithDead = expandComboToCardPairs('AA', ['As']);
    expect(aaWithDead.length).toBe(3);

    // Suited: 4 combinations
    const aksPairs = expandComboToCardPairs('AKs', []);
    expect(aksPairs.length).toBe(4);

    // Offsuit: 12 combinations
    const akoPairs = expandComboToCardPairs('AKo', []);
    expect(akoPairs.length).toBe(12);
  });

  it('generates standard hand order according to requested percentage', () => {
    const top10 = getCombosForPercentage(10);
    expect(top10.length).toBe(17);
    expect(top10).toContain('AA');
    expect(top10).toContain('KK');
    expect(top10).toContain('AKs');

    const top100 = getCombosForPercentage(100);
    expect(top100.length).toBe(169);
  });

  it('calculates higher equity against wide Calling Station range than tight Nit range', () => {
    // Pocket Tens (TT) preflop is crushed by Nit range (dominated by JJ-AA, AK)
    // but dominates a wide Calling Station range
    const heroCards = ['Td', 'Th'] as const;
    const boardCards: CardString[] = [];

    const nitProfile = OPPONENT_PROFILES.find(p => p.type === 'NIT')!;
    const stationProfile = OPPONENT_PROFILES.find(p => p.type === 'STATION')!;

    const equityVsNit = EquityCalculator.estimateEquityAgainstRange(
      [...heroCards],
      boardCards,
      nitProfile.combos,
      400
    );

    const equityVsStation = EquityCalculator.estimateEquityAgainstRange(
      [...heroCards],
      boardCards,
      stationProfile.combos,
      400
    );

    expect(equityVsStation.heroEquity).toBeGreaterThan(equityVsNit.heroEquity);
    expect(equityVsStation.heroEquity).toBeGreaterThan(0.60);
  });

  it('incorporates modeled opponent profile into explanation factors in DeterministicDecisionEngine', () => {
    const gate: RecommendationGateResult = { allowed: true, reasons: [] };
    const nitProfile = OPPONENT_PROFILES.find(p => p.type === 'NIT')!;

    const rec = DeterministicDecisionEngine.evaluate(MOCK_VALID_FLOP_STATE, gate, {
      opponentCombos: nitProfile.combos,
      opponentProfileName: nitProfile.name
    });

    expect(rec.explanation_factors.some(f => f.includes('Perfil do Adversário'))).toBe(true);
    expect(rec.explanation_factors.some(f => f.includes(nitProfile.name))).toBe(true);
  });
});

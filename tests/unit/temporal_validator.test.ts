import { describe, it, expect, beforeEach } from 'vitest';
import {
  TemporalSlotValidator,
  TemporalTableValidator
} from '../../apps/desktop/src/vision/TemporalValidator';
import { CardObservation } from '../../packages/shared-types/src';

describe('TemporalSlotValidator - Multi-Frame Consensus, Hysteresis & Animation Handling', () => {
  let validator: TemporalSlotValidator;

  beforeEach(() => {
    // 7 frames window, 5 consensus, 0.95 min confidence
    validator = new TemporalSlotValidator(7, 5, 0.95);
  });

  const createObs = (
    label: string | null,
    confidence = 0.98,
    visualState: 'VISIBLE_CARD' | 'EMPTY' | 'CARD_BACK' | 'ANIMATION' | 'UNKNOWN' = 'VISIBLE_CARD'
  ): CardObservation => ({
    label: label as any,
    confidence,
    visible: visualState === 'VISIBLE_CARD',
    visualState,
    timestamp: performance.now()
  });

  it('confirms a card after 5 identical observations in a 7-frame window', () => {
    let res = validator.addObservation(createObs('As', 0.97));
    expect(res.status).toBe('UNCERTAIN'); // 1 sample

    validator.addObservation(createObs('As', 0.98));
    validator.addObservation(createObs('As', 0.99));
    validator.addObservation(createObs('As', 0.99));
    res = validator.addObservation(createObs('As', 0.99)); // 5th sample

    expect(res.status).toBe('CONFIRMED');
    expect(res.label).toBe('As');
    expect(res.confidence).toBeGreaterThanOrEqual(0.95);
    expect(res.samples).toBe(5);
  });

  it('blocks confirmation when readings diverge (e.g. 3 As and 4 Ac)', () => {
    // Window of 7 frames with divergence
    validator.addObservation(createObs('As', 0.97));
    validator.addObservation(createObs('Ac', 0.96));
    validator.addObservation(createObs('As', 0.98));
    validator.addObservation(createObs('Ac', 0.96));
    validator.addObservation(createObs('As', 0.97));
    validator.addObservation(createObs('Ac', 0.95));
    const res = validator.addObservation(createObs('Ac', 0.96));

    // Neither has 5 consensus frames (3 As vs 4 Ac)
    expect(res.status).toBe('UNCERTAIN');
    expect(res.reason).toContain('Consenso insuficiente');
  });

  it('suspends validator immediately when table animation is detected', () => {
    // First confirm As
    for (let i = 0; i < 5; i++) {
      validator.addObservation(createObs('As', 0.99));
    }
    expect(validator.getConfirmed()?.status).toBe('CONFIRMED');

    // Dealing animation occurs
    const res = validator.addObservation(createObs(null, 0, 'ANIMATION'));
    expect(res.status).toBe('ANIMATING');
    expect(res.confidence).toBe(0);
    expect(res.reason).toContain('Animação visual ativa');
  });

  it('protects against single-frame flicker via hysteresis (an isolated wrong reading does not overwrite confirmed card)', () => {
    // Confirm As
    for (let i = 0; i < 5; i++) {
      validator.addObservation(createObs('As', 0.99));
    }
    expect(validator.getConfirmed()?.label).toBe('As');

    // Single flickering frame with Ks
    const flickerRes = validator.addObservation(createObs('Ks', 0.99));

    // Hysteresis keeps As confirmed!
    expect(flickerRes.status).toBe('CONFIRMED');
    expect(flickerRes.label).toBe('As');
    expect(flickerRes.reason).toContain('Histerese ativa');
  });

  it('accepts a new card only after persistent consecutive observations (>= 5 frames)', () => {
    // Confirm As
    for (let i = 0; i < 5; i++) {
      validator.addObservation(createObs('As', 0.99));
    }
    expect(validator.getConfirmed()?.label).toBe('As');

    // New card Kh appears (e.g. new deal)
    validator.addObservation(createObs('Kh', 0.98));
    validator.addObservation(createObs('Kh', 0.98));
    validator.addObservation(createObs('Kh', 0.99));
    validator.addObservation(createObs('Kh', 0.99));
    // 5th consecutive frame of Kh
    const newRes = validator.addObservation(createObs('Kh', 0.99));

    expect(newRes.status).toBe('CONFIRMED');
    expect(newRes.label).toBe('Kh');
  });

  it('confirms EMPTY slot when 5 frames show empty felt', () => {
    for (let i = 0; i < 5; i++) {
      validator.addObservation(createObs(null, 1.0, 'EMPTY'));
    }
    const res = validator.getConfirmed();
    expect(res?.status).toBe('EMPTY');
    expect(res?.label).toBeNull();
    expect(res?.confidence).toBe(1.0);
  });
});

describe('TemporalTableValidator - Multi-Slot Coordination & Dispersion', () => {
  it('computes field confidences, temporal consistency and dispersion', () => {
    const tableValidator = new TemporalTableValidator(7, 5, 0.95);

    // Confirm Hero card 1 (As) and Hero card 2 (Kc)
    for (let i = 0; i < 5; i++) {
      tableValidator.heroSlots[0].addObservation({
        label: 'As',
        confidence: 0.99,
        visible: true,
        visualState: 'VISIBLE_CARD',
        timestamp: performance.now()
      });
      tableValidator.heroSlots[1].addObservation({
        label: 'Kc',
        confidence: 0.98,
        visible: true,
        visualState: 'VISIBLE_CARD',
        timestamp: performance.now()
      });
    }

    const conf = tableValidator.getFieldConfidences(150, 'hero');
    expect(conf.hero_cards[0].value).toBe('As');
    expect(conf.hero_cards[0].confidence).toBeGreaterThanOrEqual(0.98);
    expect(conf.hero_cards[1].value).toBe('Kc');
    expect(conf.overall_confidence).toBeGreaterThanOrEqual(0.97);
    expect(conf.temporal_consistency).toBeGreaterThanOrEqual(0.98);
  });
});

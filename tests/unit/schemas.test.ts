import { describe, it, expect } from 'vitest';
import {
  CardStringSchema,
  RectRegionSchema,
  TableLayoutProfileSchema,
  AppSettingsSchema,
  AIExplanationSchema,
  GameEventSchema
} from '../../packages/schemas/src';
import { DEFAULT_LAYOUT_PROFILE } from '../../packages/test-fixtures/src';

describe('Canonical Schemas - Strict Input Validation', () => {
  it('validates canonical card strings accurately', () => {
    expect(CardStringSchema.safeParse('As').success).toBe(true);
    expect(CardStringSchema.safeParse('Kh').success).toBe(true);
    expect(CardStringSchema.safeParse('2c').success).toBe(true);
    expect(CardStringSchema.safeParse('Td').success).toBe(true);

    // Invalid cards
    expect(CardStringSchema.safeParse('10s').success).toBe(false); // must use T
    expect(CardStringSchema.safeParse('Ax').success).toBe(false);
    expect(CardStringSchema.safeParse('').success).toBe(false);
    expect(CardStringSchema.safeParse('AS').success).toBe(false); // suit must be lowercase
  });

  it('validates RectRegionSchema coordinates', () => {
    expect(RectRegionSchema.safeParse({ x: 10, y: 20, width: 100, height: 50 }).success).toBe(true);
    expect(RectRegionSchema.safeParse({ x: -1, y: 20, width: 100, height: 50 }).success).toBe(false);
    expect(RectRegionSchema.safeParse({ x: 10, y: 20, width: 0, height: 50 }).success).toBe(false);
  });

  it('validates default table layout profile schema', () => {
    const parseResult = TableLayoutProfileSchema.safeParse(DEFAULT_LAYOUT_PROFILE);
    expect(parseResult.success).toBe(true);
  });

  it('validates AppSettings default values and ranges', () => {
    const validConfig = {
      authorizedAppIdentifier: 'com.auth.poker.client',
      fps: 15,
      minConfidenceAutoAccept: 0.98,
      minConfidenceTemporalAccept: 0.95,
      minConfidenceProbable: 0.85,
      temporalWindowFrames: 7,
      temporalMinConsensusFrames: 5,
      enableAIExplanations: false,
      theme: 'midnight',
      activeProfileId: 'profile_default_9max'
    };
    expect(AppSettingsSchema.safeParse(validConfig).success).toBe(true);

    const invalidFps = { ...validConfig, fps: 120 }; // exceeds max 30 fps
    expect(AppSettingsSchema.safeParse(invalidFps).success).toBe(false);
  });

  it('validates AI Explanation schema strictly', () => {
    const validAI = {
      summary: 'Recomendação de check mantida no turn',
      decision: 'check',
      factors: ['posição BTN', 'range do BB'],
      alternatives: ['bet_33'],
      uncertainties: [],
      confidence: 0.95
    };
    expect(AIExplanationSchema.safeParse(validAI).success).toBe(true);

    const invalidAI = {
      summary: '',
      decision: 'check',
      factors: []
    };
    expect(AIExplanationSchema.safeParse(invalidAI).success).toBe(false);
  });
});

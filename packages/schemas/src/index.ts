import { z } from 'zod';

export const RankSchema = z.enum([
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'
]);

export const SuitSchema = z.enum(['c', 'd', 'h', 's']);

export const CardStringSchema = z.string().regex(/^[2-9TJQKA][cdhs]$/);

export const CardVisualStateSchema = z.enum([
  'EMPTY',
  'CARD_BACK',
  'VISIBLE_CARD',
  'ANIMATION',
  'UNKNOWN'
]);

export const CardObservationSchema = z.object({
  label: CardStringSchema.nullable(),
  confidence: z.number().min(0).max(1),
  visible: z.boolean(),
  visualState: CardVisualStateSchema,
  timestamp: z.number().nonnegative()
});

export const ConfirmedStatusSchema = z.enum([
  'CONFIRMED',
  'UNCERTAIN',
  'EMPTY',
  'ANIMATING'
]);

export const ConfirmedCardValueSchema = z.object({
  label: CardStringSchema.nullable(),
  confidence: z.number().min(0).max(1),
  status: ConfirmedStatusSchema,
  samples: z.number().int().nonnegative(),
  reason: z.string().nullable()
});

export const StreetSchema = z.enum(['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN']);

export const TableStatusSchema = z.enum([
  'WAITING_FOR_APP',
  'WAITING_FOR_TABLE',
  'NEW_HAND',
  'PREFLOP',
  'FLOP',
  'TURN',
  'RIVER',
  'SHOWDOWN',
  'HAND_COMPLETE',
  'TRANSITION_UNKNOWN',
  'INCONSISTENT',
  'PAUSED'
]);

export const RectRegionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive()
});

export const TableLayoutProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  appIdentifier: z.string().min(1),
  referenceResolution: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  }),
  regions: z.object({
    hero_cards: RectRegionSchema,
    board: RectRegionSchema,
    pot: RectRegionSchema,
    players: z.array(RectRegionSchema),
    action_buttons: RectRegionSchema,
    active_player_indicator: RectRegionSchema
  })
});

export const FieldConfidenceSchema = z.object({
  hero_cards: z.array(
    z.object({
      value: CardStringSchema.nullable(),
      confidence: z.number().min(0).max(1)
    })
  ),
  board: z.object({
    value: z.array(CardStringSchema),
    confidence: z.number().min(0).max(1)
  }),
  pot: z.object({
    value: z.number().min(0),
    confidence: z.number().min(0).max(1)
  }),
  active_player: z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1)
  }),
  temporal_consistency: z.number().min(0).max(1),
  overall_confidence: z.number().min(0).max(1)
});

export const PokerActionTypeSchema = z.enum([
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'all_in'
]);

export const ActionHistoryEntrySchema = z.object({
  street: StreetSchema,
  player: z.string().min(1),
  action: PokerActionTypeSchema,
  amount: z.number().nonnegative().optional(),
  potBefore: z.number().nonnegative(),
  timestamp: z.string()
});

export const EventTypeSchema = z.enum([
  'APP_DETECTED',
  'TABLE_DETECTED',
  'HAND_STARTED',
  'HOLE_CARDS_CONFIRMED',
  'BOARD_CARD_CONFIRMED',
  'PLAYER_ACTION_CONFIRMED',
  'POT_UPDATED',
  'STACK_UPDATED',
  'ACTIVE_PLAYER_CHANGED',
  'AVAILABLE_ACTIONS_CHANGED',
  'STREET_CHANGED',
  'HAND_FINISHED',
  'VISION_UNCERTAIN',
  'STATE_INCONSISTENT',
  'MANUAL_CORRECTION'
]);

export const GameEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  event_id: z.string().min(1),
  hand_id: z.string().min(1),
  type: EventTypeSchema,
  street: StreetSchema,
  data: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  timestamp: z.string()
});

export const RecommendationGateResultSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string()),
  blockCode: z
    .enum([
      'UNAUTHORIZED_APP',
      'LOW_CONFIDENCE',
      'ANIMATION_IN_PROGRESS',
      'INCONSISTENT_STATE',
      'UNCERTAIN_CARDS',
      'PAUSED',
      'NOT_HERO_TURN',
      'MISSING_MANDATORY_FIELDS'
    ])
    .optional()
});

export const DecisionRecommendationSchema = z.object({
  action: PokerActionTypeSchema,
  frequencies: z.record(z.string(), z.number().min(0).max(1)),
  source: z.enum(['reference_strategy', 'heuristic_strategy', 'solver_precomputed']),
  confidence: z.number().min(0).max(1),
  explanation_factors: z.array(z.string()),
  pot_odds: z.number().optional(),
  equity_estimate: z.number().optional(),
  gate_result: RecommendationGateResultSchema
});

export const AIExplanationSchema = z.object({
  summary: z.string().min(1),
  decision: z.string().min(1),
  factors: z.array(z.string()),
  alternatives: z.array(z.string()),
  uncertainties: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const AppSettingsSchema = z.object({
  authorizedAppIdentifier: z.string().min(1),
  fps: z.number().min(1).max(30).default(15),
  minConfidenceAutoAccept: z.number().min(0.5).max(1).default(0.98),
  minConfidenceTemporalAccept: z.number().min(0.5).max(1).default(0.95),
  minConfidenceProbable: z.number().min(0.5).max(1).default(0.85),
  temporalWindowFrames: z.number().int().min(3).max(30).default(7),
  temporalMinConsensusFrames: z.number().int().min(2).max(25).default(5),
  enableAIExplanations: z.boolean().default(false),
  aiProvider: z.enum(['offline_heuristic', 'custom_api']).default('offline_heuristic').optional(),
  externalApiConsent: z.boolean().default(false).optional(),
  aiApiKey: z.string().optional(),
  aiApiEndpoint: z.string().url().optional().or(z.literal('')),
  theme: z.enum(['dark', 'midnight', 'emerald']).default('midnight'),
  activeProfileId: z.string().default('default_profile')
});

export const IPCMessageSchema = z.object({
  topic: z.string().min(1),
  senderToken: z.string().min(8),
  payload: z.unknown(),
  timestamp: z.number().nonnegative()
});

/**
 * Poker Study Lab - Canonical Shared Types
 * Strictly decoupled data contracts for Computer Vision, Game State, 
 * Recommendation Engine, and Desktop Shell.
 */

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'c' | 'd' | 'h' | 's'; // clubs, diamonds, hearts, spades

export type CardString = `${Rank}${Suit}`;

export type CardVisualState =
  | 'EMPTY'
  | 'CARD_BACK'
  | 'VISIBLE_CARD'
  | 'ANIMATION'
  | 'UNKNOWN';

export interface CardObservation {
  label: CardString | null;
  confidence: number;
  visible: boolean;
  visualState: CardVisualState;
  timestamp: number;
}

export type ConfirmedStatus = 'CONFIRMED' | 'UNCERTAIN' | 'EMPTY' | 'ANIMATING';

export interface ConfirmedCardValue {
  label: CardString | null;
  confidence: number;
  status: ConfirmedStatus;
  samples: number;
  reason: string | null;
}

export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export type TableStatus =
  | 'WAITING_FOR_APP'
  | 'WAITING_FOR_TABLE'
  | 'NEW_HAND'
  | 'PREFLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'HAND_COMPLETE'
  | 'TRANSITION_UNKNOWN'
  | 'INCONSISTENT'
  | 'PAUSED';

export interface RectRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TableLayoutProfile {
  id: string;
  name: string;
  appIdentifier: string;
  referenceResolution: { width: number; height: number };
  regions: {
    hero_cards: RectRegion;
    board: RectRegion;
    pot: RectRegion;
    players: RectRegion[];
    action_buttons: RectRegion;
    active_player_indicator: RectRegion;
  };
}

export interface FieldConfidence {
  hero_cards: Array<{ value: string | null; confidence: number }>;
  board: { value: string[]; confidence: number };
  pot: { value: number; confidence: number };
  active_player: { value: string; confidence: number };
  temporal_consistency: number;
  overall_confidence: number;
}

export interface HeroState {
  position: 'SB' | 'BB' | 'UTG' | 'MP' | 'CO' | 'BTN' | string;
  cards: [CardString, CardString] | [];
  stack: number;
}

export interface PlayerState {
  id: string;
  seat: number;
  name: string;
  stack: number;
  position: string;
  isActive: boolean;
  isFolded: boolean;
  currentBet: number;
}

export type PokerActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export interface ActionHistoryEntry {
  street: Street;
  player: string;
  action: PokerActionType;
  amount?: number;
  potBefore: number;
  timestamp: string;
}

export interface GameState {
  app_id: string;
  table_id: string;
  hand_id: string;
  game_type: 'NLH' | 'PLO';
  street: Street;
  status: TableStatus;
  blinds: { small: number; big: number; ante?: number };
  hero: HeroState;
  board: CardString[];
  pot: number;
  players: PlayerState[];
  action_history: ActionHistoryEntry[];
  active_player: string; // 'hero' or player name/id
  available_actions: PokerActionType[];
  confidence: FieldConfidence;
  isPaused: boolean;
  isAnimationActive: boolean;
  lastUpdated: string;
}

export type EventType =
  | 'APP_DETECTED'
  | 'TABLE_DETECTED'
  | 'HAND_STARTED'
  | 'HOLE_CARDS_CONFIRMED'
  | 'BOARD_CARD_CONFIRMED'
  | 'PLAYER_ACTION_CONFIRMED'
  | 'POT_UPDATED'
  | 'STACK_UPDATED'
  | 'ACTIVE_PLAYER_CHANGED'
  | 'AVAILABLE_ACTIONS_CHANGED'
  | 'STREET_CHANGED'
  | 'HAND_FINISHED'
  | 'VISION_UNCERTAIN'
  | 'STATE_INCONSISTENT'
  | 'MANUAL_CORRECTION';

export interface GameEvent {
  sequence: number;
  event_id: string;
  hand_id: string;
  type: EventType;
  street: Street;
  data: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

export interface HandRecord {
  hand_id: string;
  table_id: string;
  game_type: 'NLH' | 'PLO';
  started_at: string;
  finished_at?: string;
  total_events: number;
}

export interface RecommendationGateResult {
  allowed: boolean;
  reasons: string[];
  blockCode?:
    | 'UNAUTHORIZED_APP'
    | 'LOW_CONFIDENCE'
    | 'ANIMATION_IN_PROGRESS'
    | 'INCONSISTENT_STATE'
    | 'UNCERTAIN_CARDS'
    | 'PAUSED'
    | 'NOT_HERO_TURN'
    | 'MISSING_MANDATORY_FIELDS'
    | 'LATENCY_EXCEEDED'
    | 'HERO_FOLDED'
    | 'INVALID_STACK'
    | 'INSUFFICIENT_ACTIVE_PLAYERS';
}

export interface DecisionRecommendation {
  action: PokerActionType;
  frequencies: Record<string, number>;
  source: 'reference_strategy' | 'heuristic_strategy' | 'solver_precomputed';
  confidence: number;
  explanation_factors: string[];
  pot_odds?: number;
  equity_estimate?: number;
  gate_result: RecommendationGateResult;
}

export type OpponentProfileType = 'NIT' | 'TAG' | 'LAG' | 'STATION' | 'CUSTOM';

export interface OpponentProfile {
  id: string;
  name: string;
  type: OpponentProfileType;
  description: string;
  vpip: number;
  pfr: number;
  aggressionFactor: number;
  rangePercentage: number;
  combos: string[];
}

export interface AIExplanationRequest {
  hand_id: string;
  stage: Street;
  hero_cards: CardString[];
  board: CardString[];
  pot_size: number;
  to_call: number;
  equity: number;
  pot_odds: number;
  primary_action: PokerActionType;
  action_frequencies: Record<string, number>;
  opponent_range_profile: string;
  strategic_factors: string[];
  is_gate_open: boolean;
  gate_reasons?: string[];
}

export interface AIExplanationResult {
  summary: string;
  concept_summary: string;
  tactical_rationale: string;
  alternative_lines: string[];
  risk_and_uncertainty: string[];
  confidence: number;
  is_ai_generated: boolean;
  source_label: 'rule_based_fallback' | 'llm_assistant' | 'offline_heuristic';
  latency_ms: number;
  timestamp: string;
}

export interface AIExplanationPayload extends AIExplanationResult {
  decision: string;
  factors: string[];
  alternatives: string[];
  uncertainties: string[];
}

export interface CaptureSource {
  id: string;
  name: string;
  type: 'window' | 'region' | 'screen' | 'synthetic_mock';
  isAuthorized: boolean;
  appIdentifier: string;
  bounds?: RectRegion;
}

export interface CapturedFrame {
  id: string;
  timestamp: number;
  width: number;
  height: number;
  sourceId: string;
  dataUrl?: string; // base64 preview or canvas ref
}

export interface ScreenCaptureAdapter {
  select_source(): Promise<CaptureSource | null>;
  start(source: CaptureSource, fps: number): Promise<void>;
  read(): CapturedFrame | null;
  pause(): void;
  resume(): void;
  stop(): void;
  isCapturing(): boolean;
  isPaused(): boolean;
}

export interface AppSettings {
  authorizedAppIdentifier: string;
  fps: number;
  minConfidenceAutoAccept: number; // e.g. 0.98
  minConfidenceTemporalAccept: number; // e.g. 0.95
  minConfidenceProbable: number; // e.g. 0.85
  temporalWindowFrames: number; // e.g. 7
  temporalMinConsensusFrames: number; // e.g. 5
  enableAIExplanations: boolean;
  aiProvider?: 'offline_heuristic' | 'custom_api';
  aiApiKey?: string;
  aiApiEndpoint?: string;
  theme: 'dark' | 'midnight' | 'emerald';
  activeProfileId: string;
}

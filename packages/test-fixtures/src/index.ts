import { GameState, TableLayoutProfile, CaptureSource } from '../../shared-types/src';

export * from './card_fixtures';

export const DEFAULT_LAYOUT_PROFILE: TableLayoutProfile = {
  id: 'profile_default_9max',
  name: 'Default 9-Max Poker Layout (Widescreen 16:9)',
  appIdentifier: 'com.auth.poker.client',
  referenceResolution: { width: 1280, height: 720 },
  regions: {
    hero_cards: { x: 550, y: 560, width: 180, height: 100 },
    board: { x: 440, y: 280, width: 400, height: 90 },
    pot: { x: 560, y: 220, width: 160, height: 45 },
    players: [
      { x: 200, y: 480, width: 120, height: 60 },
      { x: 140, y: 310, width: 120, height: 60 },
      { x: 260, y: 150, width: 120, height: 60 },
      { x: 580, y: 110, width: 120, height: 60 },
      { x: 900, y: 150, width: 120, height: 60 },
      { x: 1020, y: 310, width: 120, height: 60 },
      { x: 960, y: 480, width: 120, height: 60 }
    ],
    action_buttons: { x: 860, y: 620, width: 380, height: 80 },
    active_player_indicator: { x: 550, y: 660, width: 180, height: 20 }
  }
};

export const POKERSTARS_LAYOUT_PROFILE: TableLayoutProfile = {
  id: 'profile_pokerstars_desktop',
  name: 'PokerStars (Mesa Horizontal Desktop / Spin & Go)',
  appIdentifier: 'com.pokerstars.client',
  referenceResolution: { width: 1280, height: 720 },
  regions: {
    hero_cards: { x: 575, y: 425, width: 130, height: 70 },
    board: { x: 475, y: 225, width: 330, height: 95 },
    pot: { x: 580, y: 195, width: 120, height: 35 },
    players: [
      { x: 190, y: 215, width: 180, height: 90 }, // Player 1 (top-left)
      { x: 910, y: 215, width: 180, height: 90 }, // Player 2 (top-right)
      { x: 550, y: 510, width: 180, height: 90 }  // Hero (bottom-center)
    ],
    action_buttons: { x: 810, y: 615, width: 440, height: 90 },
    active_player_indicator: { x: 550, y: 595, width: 180, height: 25 }
  }
};

export const SUPREMA_POKER_LAYOUT_PROFILE: TableLayoutProfile = {
  id: 'profile_suprema_poker_vertical',
  name: 'Suprema Poker (Layout Vertical Mobile)',
  appIdentifier: 'com.auth.poker.client',
  referenceResolution: { width: 540, height: 960 },
  regions: {
    // No Suprema Poker, as cartas do Hero (ex: 8c 5s) ficam à direita do avatar inferior do Rafael
    hero_cards: { x: 265, y: 720, width: 110, height: 80 },
    // O board com as cartas comunitárias fica centralizado entre o pote e o centro da mesa
    board: { x: 130, y: 310, width: 280, height: 100 },
    // O pote fica centralizado logo acima das cartas comunitárias
    pot: { x: 215, y: 260, width: 110, height: 45 },
    players: [
      { x: 210, y: 160, width: 120, height: 60 }, // Topo (Jamil)
      { x: 380, y: 360, width: 110, height: 60 }, // Direita (Dan Ala)
      { x: 380, y: 580, width: 110, height: 60 }, // Inferior dir (pedros1)
      { x: 50, y: 580, width: 110, height: 60 },  // Inferior esq
      { x: 50, y: 360, width: 110, height: 60 }   // Lateral esq
    ],
    action_buttons: { x: 170, y: 815, width: 200, height: 65 },
    active_player_indicator: { x: 200, y: 735, width: 80, height: 80 }
  }
};

export const MOCK_AUTHORIZED_SOURCE: CaptureSource = {
  id: 'win_poker_client_01',
  name: 'Authorized Poker Client v3.4 [Target Window]',
  type: 'window',
  isAuthorized: true,
  appIdentifier: 'com.auth.poker.client',
  bounds: { x: 50, y: 50, width: 1280, height: 720 }
};

export const MOCK_UNAUTHORIZED_SOURCE: CaptureSource = {
  id: 'win_browser_unauth',
  name: 'Web Browser / Unauthorized Window',
  type: 'window',
  isAuthorized: false,
  appIdentifier: 'com.google.chrome',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 }
};

export const MOCK_VALID_PREFLOP_STATE: GameState = {
  app_id: 'com.auth.poker.client',
  table_id: 'table-emerald-001',
  hand_id: 'hand-20260930-101',
  game_type: 'NLH',
  street: 'PREFLOP',
  status: 'PREFLOP',
  blinds: { small: 1, big: 2 },
  hero: {
    position: 'BTN',
    cards: ['As', 'Kc'],
    stack: 200
  },
  board: [],
  pot: 7,
  players: [
    { id: 'p1', seat: 1, name: 'Hero', stack: 200, position: 'BTN', isActive: true, isFolded: false, currentBet: 0 },
    { id: 'p2', seat: 2, name: 'Shark99', stack: 198, position: 'SB', isActive: false, isFolded: false, currentBet: 1 },
    { id: 'p3', seat: 3, name: 'AggroFish', stack: 196, position: 'BB', isActive: false, isFolded: false, currentBet: 2 },
    { id: 'p4', seat: 4, name: 'NitPro', stack: 200, position: 'UTG', isActive: false, isFolded: true, currentBet: 0 },
    { id: 'p5', seat: 5, name: 'BlufferX', stack: 196, position: 'CO', isActive: false, isFolded: false, currentBet: 4 }
  ],
  action_history: [
    { street: 'PREFLOP', player: 'Shark99', action: 'bet', amount: 1, potBefore: 0, timestamp: '16:14:01' },
    { street: 'PREFLOP', player: 'AggroFish', action: 'bet', amount: 2, potBefore: 1, timestamp: '16:14:02' },
    { street: 'PREFLOP', player: 'NitPro', action: 'fold', potBefore: 3, timestamp: '16:14:05' },
    { street: 'PREFLOP', player: 'BlufferX', action: 'raise', amount: 4, potBefore: 3, timestamp: '16:14:10' }
  ],
  active_player: 'hero',
  available_actions: ['fold', 'call', 'raise'],
  confidence: {
    hero_cards: [
      { value: 'As', confidence: 0.99 },
      { value: 'Kc', confidence: 0.99 }
    ],
    board: { value: [], confidence: 1.0 },
    pot: { value: 7, confidence: 0.98 },
    active_player: { value: 'hero', confidence: 0.99 },
    temporal_consistency: 0.99,
    overall_confidence: 0.988
  },
  isPaused: false,
  isAnimationActive: false,
  lastUpdated: new Date().toISOString()
};

export const MOCK_VALID_FLOP_STATE: GameState = {
  ...MOCK_VALID_PREFLOP_STATE,
  street: 'FLOP',
  status: 'FLOP',
  board: ['7h', '8h', 'Qs'],
  pot: 150,
  available_actions: ['check', 'bet'],
  confidence: {
    hero_cards: [
      { value: 'As', confidence: 0.99 },
      { value: 'Kc', confidence: 0.98 }
    ],
    board: { value: ['7h', '8h', 'Qs'], confidence: 0.97 },
    pot: { value: 150, confidence: 0.96 },
    active_player: { value: 'hero', confidence: 0.98 },
    temporal_consistency: 0.98,
    overall_confidence: 0.976
  }
};

export const MOCK_INCONSISTENT_DUPLICATE_CARD_STATE: GameState = {
  ...MOCK_VALID_FLOP_STATE,
  board: ['As', '8h', 'Qs'], // 'As' is duplicated in Hero's hand!
  status: 'INCONSISTENT'
};

export const MOCK_UNCERTAIN_STATE: GameState = {
  ...MOCK_VALID_FLOP_STATE,
  confidence: {
    hero_cards: [
      { value: 'As', confidence: 0.72 }, // low confidence
      { value: 'Kc', confidence: 0.98 }
    ],
    board: { value: ['7h', '8h', 'Qs'], confidence: 0.97 },
    pot: { value: 150, confidence: 0.96 },
    active_player: { value: 'hero', confidence: 0.98 },
    temporal_consistency: 0.65,
    overall_confidence: 0.74
  }
};

export const MOCK_SUPREMA_POKER_STATE: GameState = {
  ...MOCK_VALID_FLOP_STATE,
  table_id: 'table-suprema-nlh-01',
  hand_id: 'hand-suprema-live-002',
  street: 'FLOP',
  status: 'FLOP',
  blinds: { small: 2, big: 4 },
  hero: {
    position: 'BB',
    cards: ['Kh', '4c'],
    stack: 386
  },
  board: ['Js', 'Qh'],
  pot: 16,
  available_actions: ['check', 'bet'],
  action_history: [],
  confidence: {
    hero_cards: [
      { value: 'Kh', confidence: 0.98 },
      { value: '4c', confidence: 0.97 }
    ],
    board: { value: ['Js', 'Qh'], confidence: 0.99 },
    pot: { value: 16, confidence: 0.98 },
    active_player: { value: 'hero', confidence: 0.99 },
    temporal_consistency: 0.98,
    overall_confidence: 0.98
  }
};

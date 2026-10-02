import {
  GameState,
  GameEvent,
  CardString,
  FieldConfidence,
  PokerActionType,
  ActionHistoryEntry,
  normalizeHeroCards
} from '../../../../packages/shared-types/src';

export class HandStateEngine {
  /**
   * Generates a blank, baseline GameState.
   */
  public static createInitialState(
    app_id = 'com.auth.poker.client',
    table_id = 'tbl_01',
    hand_id = 'hand_init'
  ): GameState {
    const defaultConfidence: FieldConfidence = {
      hero_cards: [
        { value: null, confidence: 1.0 },
        { value: null, confidence: 1.0 }
      ],
      board: { value: [], confidence: 1.0 },
      pot: { value: 0, confidence: 1.0 },
      active_player: { value: 'hero', confidence: 1.0 },
      temporal_consistency: 1.0,
      overall_confidence: 1.0
    };

    return {
      app_id,
      table_id,
      hand_id,
      game_type: 'NLH',
      street: 'PREFLOP',
      status: 'WAITING_FOR_APP',
      blinds: { small: 1, big: 2 },
      hero: {
        cards: [],
        position: 'BTN',
        stack: 200,
        currentBet: 0,
        isFolded: false,
        isAllIn: false
      },
      board: [],
      pot: 3, // SB + BB initial
      players: [
        { id: 'p1', name: 'Hero', seat: 1, stack: 200, position: 'BTN', isHero: true, isFolded: false, isAllIn: false, currentBet: 0, isActive: true },
        { id: 'p2', name: 'SB', seat: 2, stack: 199, position: 'SB', isHero: false, isFolded: false, isAllIn: false, currentBet: 1, isActive: true },
        { id: 'p3', name: 'BB', seat: 3, stack: 198, position: 'BB', isHero: false, isFolded: false, isAllIn: false, currentBet: 2, isActive: true }
      ],
      action_history: [],
      active_player: 'hero',
      available_actions: ['fold', 'call', 'raise'],
      confidence: defaultConfidence,
      isPaused: false,
      isAnimationActive: false,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Pure reducer function: applies a single GameEvent to a GameState and returns a brand new GameState.
   */
  public static applyEvent(state: GameState, event: GameEvent): GameState {
    const next: GameState = JSON.parse(JSON.stringify(state));
    next.lastUpdated = event.timestamp;

    switch (event.type) {
      case 'APP_DETECTED': {
        const appIdentifier = (event.data?.appIdentifier as string) || next.app_id;
        next.app_id = appIdentifier;
        if (next.status === 'WAITING_FOR_APP') {
          next.status = 'WAITING_FOR_TABLE';
        }
        break;
      }

      case 'TABLE_DETECTED': {
        const tableId = (event.data?.tableId as string) || next.table_id;
        next.table_id = tableId;
        if (next.status === 'WAITING_FOR_TABLE' || next.status === 'WAITING_FOR_APP') {
          next.status = 'NEW_HAND';
        }
        break;
      }

      case 'HAND_STARTED': {
        next.hand_id = event.hand_id;
        next.street = 'PREFLOP';
        next.status = 'PREFLOP';
        next.hero.cards = [];
        next.hero.isFolded = false;
        next.hero.isAllIn = false;
        next.board = [];
        next.action_history = [];
        const smallBlind = (event.data?.smallBlind as number) || next.blinds.small;
        const bigBlind = (event.data?.bigBlind as number) || next.blinds.big;
        next.blinds = { small: smallBlind, big: bigBlind };
        next.pot = smallBlind + bigBlind;
        next.active_player = (event.data?.active_player as string) || 'hero';
        next.available_actions = ['fold', 'call', 'raise'];
        break;
      }

      case 'HOLE_CARDS_CONFIRMED': {
        const cards = (event.data?.cards as CardString[]) || [];
        next.hero.cards = normalizeHeroCards(cards);
        next.confidence.hero_cards = cards.map(c => ({
          value: c,
          confidence: event.confidence || 0.99
        }));
        if (next.street === 'PREFLOP') {
          next.status = 'PREFLOP';
        }
        break;
      }

      case 'BOARD_CARD_CONFIRMED': {
        const board = (event.data?.board as CardString[]) || [];
        next.board = [...board];
        next.street = event.street;
        next.confidence.board = {
          value: [...board],
          confidence: event.confidence || 0.98
        };

        if (board.length === 3) {
          next.street = 'FLOP';
          next.status = 'FLOP';
        } else if (board.length === 4) {
          next.street = 'TURN';
          next.status = 'TURN';
        } else if (board.length === 5) {
          next.street = 'RIVER';
          next.status = 'RIVER';
        }
        break;
      }

      case 'PLAYER_ACTION_CONFIRMED': {
        const actionEntry: ActionHistoryEntry = {
          street: event.street,
          player: (event.data?.player as string) || 'unknown',
          action: (event.data?.action as PokerActionType) || 'call',
          amount: event.data?.amount as number | undefined,
          potBefore: next.pot,
          timestamp: event.timestamp
        };
        next.action_history.push(actionEntry);

        if (actionEntry.amount && actionEntry.amount > 0) {
          next.pot += actionEntry.amount;
        }

        if (actionEntry.player === 'Hero' || actionEntry.player === 'hero') {
          if (actionEntry.action === 'fold') {
            next.hero.isFolded = true;
          } else if (actionEntry.action === 'all_in') {
            next.hero.isAllIn = true;
          }
        }
        break;
      }

      case 'POT_UPDATED': {
        const newPot = (event.data?.pot as number) ?? (event.data?.amount as number);
        if (typeof newPot === 'number') {
          next.pot = newPot;
          next.confidence.pot = {
            value: newPot,
            confidence: event.confidence || 0.99
          };
        }
        break;
      }

      case 'ACTIVE_PLAYER_CHANGED': {
        const player = (event.data?.player as string) || (event.data?.active_player as string);
        if (player) {
          next.active_player = player;
          next.confidence.active_player = {
            value: player,
            confidence: event.confidence || 0.99
          };
        }
        break;
      }

      case 'AVAILABLE_ACTIONS_CHANGED': {
        const actions = event.data?.actions as PokerActionType[];
        if (Array.isArray(actions)) {
          next.available_actions = [...actions];
        }
        break;
      }

      case 'STREET_CHANGED': {
        next.street = event.street;
        if (event.street === 'PREFLOP') next.status = 'PREFLOP';
        else if (event.street === 'FLOP') next.status = 'FLOP';
        else if (event.street === 'TURN') next.status = 'TURN';
        else if (event.street === 'RIVER') next.status = 'RIVER';
        else if (event.street === 'SHOWDOWN') next.status = 'SHOWDOWN';
        break;
      }

      case 'HAND_FINISHED': {
        next.status = 'HAND_COMPLETE';
        break;
      }

      case 'VISION_UNCERTAIN': {
        next.confidence.overall_confidence = Math.min(
          next.confidence.overall_confidence,
          event.confidence || 0.70
        );
        break;
      }

      case 'STATE_INCONSISTENT': {
        next.status = 'INCONSISTENT';
        break;
      }

      case 'MANUAL_CORRECTION': {
        const changes = (event.data?.changes as Partial<GameState>) || {};
        Object.assign(next, changes);
        next.confidence.overall_confidence = 0.99;
        break;
      }

      default:
        break;
    }

    return next;
  }

  /**
   * Deterministically reconstructs the complete GameState by replaying an ordered list of events.
   */
  public static reconstructState(
    events: GameEvent[],
    baseState?: GameState
  ): GameState {
    const initial = baseState || this.createInitialState();
    // Sort strictly by sequence
    const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
    return sorted.reduce((state, evt) => this.applyEvent(state, evt), initial);
  }
}

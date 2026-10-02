import { TableStatus, Street, CardString } from '../../packages/shared-types/src';

export interface TransitionInput {
  hasAuthorizedApp: boolean;
  hasTable: boolean;
  heroCards: CardString[];
  boardCards: CardString[];
  isHandFinished?: boolean;
}

export class TableStateMachine {
  private currentStatus: TableStatus = 'WAITING_FOR_APP';

  public getStatus(): TableStatus {
    return this.currentStatus;
  }

  public setStatus(status: TableStatus): void {
    this.currentStatus = status;
  }

  public evaluateTransition(input: TransitionInput): { newStatus: TableStatus; valid: boolean; reason?: string } {
    if (!input.hasAuthorizedApp) {
      this.currentStatus = 'WAITING_FOR_APP';
      return { newStatus: 'WAITING_FOR_APP', valid: true };
    }

    if (!input.hasTable) {
      this.currentStatus = 'WAITING_FOR_TABLE';
      return { newStatus: 'WAITING_FOR_TABLE', valid: true };
    }

    // Check duplicate cards
    const allCards = [...input.heroCards, ...input.boardCards];
    const uniqueCards = new Set(allCards);
    if (uniqueCards.size !== allCards.length) {
      this.currentStatus = 'INCONSISTENT';
      return { newStatus: 'INCONSISTENT', valid: false, reason: 'Cartas duplicadas detectadas.' };
    }

    const boardLen = input.boardCards.length;
    const heroCardCount = input.heroCards.length;

    // Check valid transitions
    if (heroCardCount < 2) {
      this.currentStatus = 'NEW_HAND';
      return { newStatus: 'NEW_HAND', valid: true };
    }

    // Board count evaluation
    if (boardLen === 0) {
      this.currentStatus = 'PREFLOP';
      return { newStatus: 'PREFLOP', valid: true };
    }

    if (boardLen === 3) {
      if (this.currentStatus === 'PREFLOP' || this.currentStatus === 'FLOP') {
        this.currentStatus = 'FLOP';
        return { newStatus: 'FLOP', valid: true };
      }
      // Re-entering flop directly from valid state
      this.currentStatus = 'FLOP';
      return { newStatus: 'FLOP', valid: true };
    }

    if (boardLen === 4) {
      if (this.currentStatus === 'PREFLOP') {
        // Impossible jump: PREFLOP -> TURN directly without flop!
        this.currentStatus = 'TRANSITION_UNKNOWN';
        return { newStatus: 'TRANSITION_UNKNOWN', valid: false, reason: 'Salto inválido de PREFLOP para TURN.' };
      }
      this.currentStatus = 'TURN';
      return { newStatus: 'TURN', valid: true };
    }

    if (boardLen === 5) {
      if (this.currentStatus === 'PREFLOP' || this.currentStatus === 'FLOP') {
        // Impossible jump: PREFLOP/FLOP -> RIVER directly!
        this.currentStatus = 'TRANSITION_UNKNOWN';
        return { newStatus: 'TRANSITION_UNKNOWN', valid: false, reason: 'Salto inválido para RIVER sem street intermediária.' };
      }
      if (input.isHandFinished) {
        this.currentStatus = 'HAND_COMPLETE';
        return { newStatus: 'HAND_COMPLETE', valid: true };
      }
      this.currentStatus = 'RIVER';
      return { newStatus: 'RIVER', valid: true };
    }

    // Invalid board count (e.g. 1 or 2 cards)
    this.currentStatus = 'INCONSISTENT';
    return { newStatus: 'INCONSISTENT', valid: false, reason: `Quantidade inválida de cartas no board: ${boardLen}.` };
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { TableStateMachine } from '../../services/game_state/TableStateMachine';

describe('TableStateMachine - Street Transitions & Inconsistency Handling', () => {
  let sm: TableStateMachine;

  beforeEach(() => {
    sm = new TableStateMachine();
  });

  it('starts in WAITING_FOR_APP state', () => {
    expect(sm.getStatus()).toBe('WAITING_FOR_APP');
  });

  it('transitions to WAITING_FOR_TABLE when app is authorized but no table recognized', () => {
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: false,
      heroCards: [],
      boardCards: []
    });
    expect(res.newStatus).toBe('WAITING_FOR_TABLE');
  });

  it('transitions to NEW_HAND when table detected but hero cards not yet confirmed', () => {
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: true,
      heroCards: ['As'], // only 1 card
      boardCards: []
    });
    expect(res.newStatus).toBe('NEW_HAND');
  });

  it('transitions NEW_HAND -> PREFLOP when 2 hole cards are confirmed', () => {
    sm.setStatus('NEW_HAND');
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: true,
      heroCards: ['As', 'Kc'],
      boardCards: []
    });
    expect(res.newStatus).toBe('PREFLOP');
    expect(res.valid).toBe(true);
  });

  it('transitions PREFLOP -> FLOP when exactly 3 board cards appear', () => {
    sm.setStatus('PREFLOP');
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: true,
      heroCards: ['As', 'Kc'],
      boardCards: ['7h', '8h', 'Qs']
    });
    expect(res.newStatus).toBe('FLOP');
    expect(res.valid).toBe(true);
  });

  it('transitions FLOP -> TURN when exactly 4 board cards appear', () => {
    sm.setStatus('FLOP');
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: true,
      heroCards: ['As', 'Kc'],
      boardCards: ['7h', '8h', 'Qs', '2d']
    });
    expect(res.newStatus).toBe('TURN');
    expect(res.valid).toBe(true);
  });

  it('prevents illegal jump PREFLOP -> RIVER without flop or turn', () => {
    sm.setStatus('PREFLOP');
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: true,
      heroCards: ['As', 'Kc'],
      boardCards: ['7h', '8h', 'Qs', '2d', 'Jc']
    });
    expect(res.newStatus).toBe('TRANSITION_UNKNOWN');
    expect(res.valid).toBe(false);
  });

  it('detects duplicate cards and triggers INCONSISTENT status', () => {
    sm.setStatus('FLOP');
    const res = sm.evaluateTransition({
      hasAuthorizedApp: true,
      hasTable: true,
      heroCards: ['As', 'Kc'],
      boardCards: ['As', '8h', 'Qs'] // 'As' is duplicated
    });
    expect(res.newStatus).toBe('INCONSISTENT');
    expect(res.valid).toBe(false);
  });
});

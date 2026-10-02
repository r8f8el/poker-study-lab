import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore, generateHandId, generateEventId } from '../../apps/desktop/src/event-store/EventStore';
import { HandStateEngine } from '../../apps/desktop/src/event-store/HandStateEngine';
import { GameEvent, GameState } from '../../packages/shared-types/src';

describe('Incremento 5 — EventStore & HandStateEngine', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = new InMemoryEventStore();
  });

  it('guarantees append-only immutability (modifying returned event does not change store)', () => {
    const handId = generateHandId();
    store.createHand(handId, 'tbl_01');

    const event: GameEvent = {
      sequence: 1,
      event_id: generateEventId(),
      hand_id: handId,
      type: 'HAND_STARTED',
      street: 'PREFLOP',
      data: { smallBlind: 1, bigBlind: 2 },
      confidence: 1.0,
      timestamp: new Date().toISOString()
    };

    store.appendEvent(event);
    const retrieved = store.getEvents(handId);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].type).toBe('HAND_STARTED');

    // Attempt mutation
    (retrieved[0].data as Record<string, unknown>).smallBlind = 999;
    (retrieved[0] as unknown as { type: string }).type = 'MUTATED';

    // Verify internal state remains untouched
    const freshFetch = store.getEvents(handId);
    expect((freshFetch[0].data as Record<string, unknown>).smallBlind).toBe(1);
    expect(freshFetch[0].type).toBe('HAND_STARTED');
  });

  it('assigns strictly ascending sequence numbers if sequence is omitted or zero', () => {
    const handId = generateHandId();
    store.appendEvent({
      sequence: 0,
      event_id: 'e1',
      hand_id: handId,
      type: 'APP_DETECTED',
      street: 'PREFLOP',
      data: { appIdentifier: 'com.auth.poker.client' },
      confidence: 1.0,
      timestamp: '2026-09-30T12:00:00Z'
    });

    store.appendEvent({
      sequence: 0,
      event_id: 'e2',
      hand_id: handId,
      type: 'TABLE_DETECTED',
      street: 'PREFLOP',
      data: { tableId: 'tbl_99' },
      confidence: 1.0,
      timestamp: '2026-09-30T12:00:01Z'
    });

    const events = store.getEvents(handId);
    expect(events[0].sequence).toBe(1);
    expect(events[1].sequence).toBe(2);
    expect(store.getHand(handId)?.total_events).toBe(2);
  });

  it('reconstructs complete hand state from event sequence (Preflop -> Flop -> Turn -> River)', () => {
    const handId = generateHandId();
    const events: GameEvent[] = [
      {
        sequence: 1,
        event_id: 'evt_1',
        hand_id: handId,
        type: 'APP_DETECTED',
        street: 'PREFLOP',
        data: { appIdentifier: 'com.auth.poker.client' },
        confidence: 1.0,
        timestamp: '2026-09-30T12:00:00Z'
      },
      {
        sequence: 2,
        event_id: 'evt_2',
        hand_id: handId,
        type: 'TABLE_DETECTED',
        street: 'PREFLOP',
        data: { tableId: 'table_high_stakes' },
        confidence: 1.0,
        timestamp: '2026-09-30T12:00:01Z'
      },
      {
        sequence: 3,
        event_id: 'evt_3',
        hand_id: handId,
        type: 'HAND_STARTED',
        street: 'PREFLOP',
        data: { smallBlind: 5, bigBlind: 10 },
        confidence: 1.0,
        timestamp: '2026-09-30T12:00:02Z'
      },
      {
        sequence: 4,
        event_id: 'evt_4',
        hand_id: handId,
        type: 'HOLE_CARDS_CONFIRMED',
        street: 'PREFLOP',
        data: { cards: ['As', 'Kd'] },
        confidence: 0.99,
        timestamp: '2026-09-30T12:00:03Z'
      },
      {
        sequence: 5,
        event_id: 'evt_5',
        hand_id: handId,
        type: 'BOARD_CARD_CONFIRMED',
        street: 'FLOP',
        data: { board: ['Qs', 'Jd', '10c'] },
        confidence: 0.98,
        timestamp: '2026-09-30T12:00:10Z'
      },
      {
        sequence: 6,
        event_id: 'evt_6',
        hand_id: handId,
        type: 'PLAYER_ACTION_CONFIRMED',
        street: 'FLOP',
        data: { player: 'Villain', action: 'bet', amount: 30 },
        confidence: 0.99,
        timestamp: '2026-09-30T12:00:15Z'
      },
      {
        sequence: 7,
        event_id: 'evt_7',
        hand_id: handId,
        type: 'BOARD_CARD_CONFIRMED',
        street: 'TURN',
        data: { board: ['Qs', 'Jd', '10c', '2h'] },
        confidence: 0.98,
        timestamp: '2026-09-30T12:00:20Z'
      },
      {
        sequence: 8,
        event_id: 'evt_8',
        hand_id: handId,
        type: 'BOARD_CARD_CONFIRMED',
        street: 'RIVER',
        data: { board: ['Qs', 'Jd', '10c', '2h', '7s'] },
        confidence: 0.98,
        timestamp: '2026-09-30T12:00:30Z'
      },
      {
        sequence: 9,
        event_id: 'evt_9',
        hand_id: handId,
        type: 'HAND_FINISHED',
        street: 'RIVER',
        data: {},
        confidence: 1.0,
        timestamp: '2026-09-30T12:00:40Z'
      }
    ];

    events.forEach(e => store.appendEvent(e));
    const storedEvents = store.getEvents(handId);
    expect(storedEvents.length).toBe(9);

    const reconstructed = HandStateEngine.reconstructState(storedEvents);

    expect(reconstructed.app_id).toBe('com.auth.poker.client');
    expect(reconstructed.table_id).toBe('table_high_stakes');
    expect(reconstructed.hand_id).toBe(handId);
    expect(reconstructed.hero.cards).toEqual(['As', 'Kd']);
    expect(reconstructed.board).toEqual(['Qs', 'Jd', '10c', '2h', '7s']);
    expect(reconstructed.pot).toBe(15 + 30); // 5+10 blinds + 30 bet
    expect(reconstructed.street).toBe('RIVER');
    expect(reconstructed.status).toBe('HAND_COMPLETE');
    expect(reconstructed.action_history.length).toBe(1);
    expect(reconstructed.action_history[0].action).toBe('bet');
  });

  it('correctly incorporates MANUAL_CORRECTION events into state reconstitution', () => {
    const handId = generateHandId();
    const events: GameEvent[] = [
      {
        sequence: 1,
        event_id: 'e1',
        hand_id: handId,
        type: 'HAND_STARTED',
        street: 'PREFLOP',
        data: { smallBlind: 1, bigBlind: 2 },
        confidence: 1.0,
        timestamp: '2026-09-30T12:00:00Z'
      },
      {
        sequence: 2,
        event_id: 'e2',
        hand_id: handId,
        type: 'HOLE_CARDS_CONFIRMED',
        street: 'PREFLOP',
        data: { cards: ['Ah', 'Kh'] },
        confidence: 0.99,
        timestamp: '2026-09-30T12:00:01Z'
      },
      {
        sequence: 3,
        event_id: 'e3',
        hand_id: handId,
        type: 'MANUAL_CORRECTION',
        street: 'PREFLOP',
        data: {
          reason: 'Visão leu Ah Kh incorretamente em mesa com reflexo, hero tem Ad Kd',
          changes: {
            hero: {
              cards: ['Ad', 'Kd'],
              position: 'BTN',
              stack: 200,
              bet_current_round: 0,
              has_folded: false,
              is_all_in: false
            }
          }
        },
        confidence: 1.0,
        timestamp: '2026-09-30T12:00:05Z'
      }
    ];

    const state = HandStateEngine.reconstructState(events);
    expect(state.hero.cards).toEqual(['Ad', 'Kd']);
    expect(state.confidence.overall_confidence).toBe(0.99);
  });
});

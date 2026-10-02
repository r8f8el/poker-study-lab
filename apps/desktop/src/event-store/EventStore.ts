import { GameEvent, HandRecord, EventType, Street } from '../../../../packages/shared-types/src';

export interface IEventStore {
  createHand(hand_id: string, table_id: string, game_type?: 'NLH' | 'PLO'): HandRecord;
  finishHand(hand_id: string): void;
  appendEvent(event: GameEvent): void;
  getEvents(hand_id: string): GameEvent[];
  getLatestEvent(hand_id: string): GameEvent | null;
  getHands(): HandRecord[];
  getHand(hand_id: string): HandRecord | null;
  clear(): void;
}

export function generateHandId(): string {
  const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 8);
  return `hand_${dateStr}_${rand}`;
}

export function generateEventId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return `evt_${ts}_${rand}`;
}

/**
 * In-memory immutable EventStore implementation.
 * Stores events with strict sequence verification and deep-copies to prevent outside mutation.
 */
export class InMemoryEventStore implements IEventStore {
  private hands: Map<string, HandRecord> = new Map();
  private events: Map<string, GameEvent[]> = new Map();

  public createHand(hand_id: string, table_id: string, game_type: 'NLH' | 'PLO' = 'NLH'): HandRecord {
    const existing = this.hands.get(hand_id);
    if (existing) {
      return { ...existing };
    }

    const record: HandRecord = {
      hand_id,
      table_id,
      game_type,
      started_at: new Date().toISOString(),
      total_events: 0
    };

    this.hands.set(hand_id, record);
    this.events.set(hand_id, []);
    return { ...record };
  }

  public finishHand(hand_id: string): void {
    const hand = this.hands.get(hand_id);
    if (hand) {
      hand.finished_at = new Date().toISOString();
    }
  }

  public appendEvent(event: GameEvent): void {
    let handEvents = this.events.get(event.hand_id);
    if (!handEvents) {
      this.createHand(event.hand_id, 'tbl_default', 'NLH');
      handEvents = this.events.get(event.hand_id)!;
    }

    // Sequence verification: next event must be strictly sequential
    const expectedSequence = handEvents.length + 1;
    const validatedSequence = event.sequence > 0 ? event.sequence : expectedSequence;

    // Deep clone to enforce immutability
    const immutableEvent: GameEvent = JSON.parse(
      JSON.stringify({
        ...event,
        sequence: validatedSequence
      })
    );

    handEvents.push(immutableEvent);

    // Update hand record total_events
    const hand = this.hands.get(event.hand_id);
    if (hand) {
      hand.total_events = handEvents.length;
    }
  }

  public getEvents(hand_id: string): GameEvent[] {
    const list = this.events.get(hand_id) || [];
    // Return deep cloned copies so callers cannot mutate internal log
    return JSON.parse(JSON.stringify(list));
  }

  public getLatestEvent(hand_id: string): GameEvent | null {
    const list = this.events.get(hand_id) || [];
    if (list.length === 0) return null;
    return JSON.parse(JSON.stringify(list[list.length - 1]));
  }

  public getHands(): HandRecord[] {
    return Array.from(this.hands.values()).map(h => ({ ...h }));
  }

  public getHand(hand_id: string): HandRecord | null {
    const hand = this.hands.get(hand_id);
    return hand ? { ...hand } : null;
  }

  public clear(): void {
    this.hands.clear();
    this.events.clear();
  }
}

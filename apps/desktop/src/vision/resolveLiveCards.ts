import {
  CardObservation,
  CardString,
  Street
} from '../../../../packages/shared-types/src';
import { CardDetectionOutput } from './CardDetector';
import { TemporalSlotValidator, TemporalTableValidator } from './TemporalValidator';

export interface ResolvedSlot {
  label: CardString | null;
  confidence: number;
  status: 'CONFIRMED' | 'EMPTY' | 'UNCERTAIN' | 'ANIMATING';
}

export interface LiveCardResolution {
  heroCards: CardString[];
  heroConfidences: [number, number];
  boardCards: CardString[];
  boardConfidence: number;
  overallConfidence: number;
  temporalConsistency: number;
  street: Street;
  isAnimationActive: boolean;
}

function toObservation(output: CardDetectionOutput, now: number): CardObservation {
  return {
    label: output.card,
    confidence: output.confidence,
    visible: output.visualState === 'VISIBLE_CARD' && output.card !== null,
    visualState: output.visualState,
    timestamp: now
  };
}

/**
 * Turns one optical crop into a slot the rest of the pipeline can trust.
 * Without a temporal validator, a single frame is published with its real
 * detector confidence (never a hardcoded 0.98). With a validator, a card is
 * published only after consensus, and a one-frame flicker cannot replace it.
 */
export function resolveSlot(
  output: CardDetectionOutput,
  validator: TemporalSlotValidator | undefined,
  now: number
): ResolvedSlot {
  if (!validator) {
    if (output.visualState === 'ANIMATION') {
      return { label: null, confidence: 0, status: 'ANIMATING' };
    }
    if (output.visualState === 'VISIBLE_CARD' && output.card) {
      return { label: output.card, confidence: output.confidence, status: 'CONFIRMED' };
    }
    if (output.visualState === 'EMPTY' || output.visualState === 'CARD_BACK') {
      return { label: null, confidence: 1, status: 'EMPTY' };
    }
    return { label: null, confidence: output.confidence, status: 'UNCERTAIN' };
  }

  const confirmed = validator.addObservation(toObservation(output, now));
  if (confirmed.status === 'ANIMATING') {
    return { label: null, confidence: 0, status: 'ANIMATING' };
  }
  if (confirmed.status === 'CONFIRMED' && confirmed.label) {
    return { label: confirmed.label, confidence: confirmed.confidence, status: 'CONFIRMED' };
  }
  if (confirmed.status === 'EMPTY') {
    return { label: null, confidence: confirmed.confidence, status: 'EMPTY' };
  }
  return { label: null, confidence: confirmed.confidence, status: 'UNCERTAIN' };
}

function streetForBoard(count: number): Street {
  if (count >= 5) return 'RIVER';
  if (count === 4) return 'TURN';
  if (count === 3) return 'FLOP';
  return 'PREFLOP';
}

/**
 * Publishes only a contiguous run of confirmed cards. A hole in the middle
 * of the board (uncertain turn, confirmed river) is not treated as a river.
 */
export function resolveLiveCards(
  hero: [CardDetectionOutput, CardDetectionOutput],
  board: [
    CardDetectionOutput,
    CardDetectionOutput,
    CardDetectionOutput,
    CardDetectionOutput,
    CardDetectionOutput
  ],
  temporalValidator: TemporalTableValidator | undefined,
  now: number
): LiveCardResolution {
  const heroResolved = [
    resolveSlot(hero[0], temporalValidator?.heroSlots[0], now),
    resolveSlot(hero[1], temporalValidator?.heroSlots[1], now)
  ] as [ResolvedSlot, ResolvedSlot];

  const boardResolved = board.map((output, index) =>
    resolveSlot(output, temporalValidator?.boardSlots[index], now)
  );

  let isAnimationActive = heroResolved.some(slot => slot.status === 'ANIMATING');
  const used = new Set<string>();
  const boardCards: CardString[] = [];
  const boardConfidences: number[] = [];
  let boardOpen = false;

  for (const slot of boardResolved) {
    if (slot.status === 'ANIMATING') {
      isAnimationActive = true;
      boardOpen = true;
      break;
    }
    if (slot.status === 'CONFIRMED' && slot.label) {
      if (used.has(slot.label)) {
        boardOpen = true;
        break;
      }
      used.add(slot.label);
      boardCards.push(slot.label);
      boardConfidences.push(slot.confidence);
      continue;
    }
    if (slot.status === 'EMPTY') break;
    boardOpen = true;
    break;
  }

  const heroCards: CardString[] = [];
  const heroConfidences: [number, number] = [0, 0];
  let heroOpen = false;
  heroResolved.forEach((slot, index) => {
    if (slot.status === 'CONFIRMED' && slot.label && !used.has(slot.label)) {
      used.add(slot.label);
      heroCards.push(slot.label);
      heroConfidences[index] = slot.confidence;
    } else if (slot.status !== 'EMPTY') {
      heroOpen = true;
    }
  });

  const publishedConfidences = [
    ...heroConfidences.filter(confidence => confidence > 0),
    ...boardConfidences
  ];
  const mean =
    publishedConfidences.length > 0
      ? publishedConfidences.reduce((sum, confidence) => sum + confidence, 0) / publishedConfidences.length
      : 0;
  const minimum = publishedConfidences.length > 0 ? Math.min(...publishedConfidences) : 0;
  let overallConfidence = publishedConfidences.length > 0 ? Math.min(mean, minimum) : 0;
  if (heroOpen || boardOpen || isAnimationActive || heroCards.length < 2) {
    overallConfidence = Math.min(overallConfidence, 0.5);
  }

  const dispersion =
    publishedConfidences.length > 1
      ? Math.sqrt(
          publishedConfidences.reduce((sum, confidence) => sum + (confidence - mean) ** 2, 0) /
            publishedConfidences.length
        )
      : 0;

  const boardConfidence =
    boardConfidences.length > 0
      ? boardConfidences.reduce((sum, confidence) => sum + confidence, 0) / boardConfidences.length
      : boardOpen
        ? 0
        : 1;

  return {
    heroCards,
    heroConfidences,
    boardCards,
    boardConfidence: Math.round(boardConfidence * 1000) / 1000,
    overallConfidence: Math.round(overallConfidence * 1000) / 1000,
    temporalConsistency: Math.round(Math.max(0, 1 - dispersion) * 1000) / 1000,
    street: streetForBoard(boardCards.length),
    isAnimationActive
  };
}

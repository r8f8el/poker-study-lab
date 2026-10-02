import { CardString, Rank, Suit } from '../../../../packages/shared-types/src';

export type HandCategory =
  | 'HIGH_CARD'
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export interface HandEvaluation {
  category: HandCategory;
  categoryRank: number; // 1 (High Card) to 10 (Royal Flush)
  categoryName: string;
  tiebreakerRanks: number[]; // Ranks used to break ties within the same category
  score: number; // Single comparable numeric score
  bestFiveCards: CardString[];
}

const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

const CATEGORY_NAMES: Record<HandCategory, string> = {
  ROYAL_FLUSH: 'Royal Flush',
  STRAIGHT_FLUSH: 'Straight Flush',
  FOUR_OF_A_KIND: 'Quadra',
  FULL_HOUSE: 'Full House',
  FLUSH: 'Flush',
  STRAIGHT: 'Sequência (Straight)',
  THREE_OF_A_KIND: 'Trinca',
  TWO_PAIR: 'Dois Pares',
  ONE_PAIR: 'Um Par',
  HIGH_CARD: 'Carta Alta'
};

const CATEGORY_RANKS: Record<HandCategory, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

export class HandEvaluator {
  public static parseCard(card: CardString): { rank: Rank; suit: Suit; value: number } {
    const rank = card[0] as Rank;
    const suit = card[1] as Suit;
    return { rank, suit, value: RANK_VALUES[rank] || 0 };
  }

  /**
   * Evaluates the best 5-card poker hand from an array of 5 to 7 cards.
   */
  public static evaluate(cards: CardString[]): HandEvaluation {
    if (cards.length < 5) {
      // Less than 5 cards: evaluate partial hand (e.g. hole cards only)
      return this.evaluatePartial(cards);
    }

    // Generate all 5-card combinations from the given cards
    const combos = this.combinations(cards, 5);
    let bestEval: HandEvaluation | null = null;

    for (const combo of combos) {
      const currentEval = this.evaluateFiveCards(combo);
      if (!bestEval || currentEval.score > bestEval.score) {
        bestEval = currentEval;
      }
    }

    return bestEval!;
  }

  /**
   * Compares two evaluations: returns 1 if a wins, -1 if b wins, 0 if tie.
   */
  public static compare(a: HandEvaluation, b: HandEvaluation): number {
    if (a.score > b.score) return 1;
    if (a.score < b.score) return -1;
    return 0;
  }

  private static evaluatePartial(cards: CardString[]): HandEvaluation {
    const parsed = cards.map(c => this.parseCard(c)).sort((a, b) => b.value - a.value);
    if (parsed.length === 2 && parsed[0].value === parsed[1].value) {
      const score = CATEGORY_RANKS.ONE_PAIR * 1e8 + parsed[0].value * 1e4;
      return {
        category: 'ONE_PAIR',
        categoryRank: CATEGORY_RANKS.ONE_PAIR,
        categoryName: 'Um Par',
        tiebreakerRanks: [parsed[0].value],
        score,
        bestFiveCards: cards
      };
    }
    const tiebreakers = parsed.map(p => p.value);
    let score = CATEGORY_RANKS.HIGH_CARD * 1e8;
    tiebreakers.forEach((v, idx) => {
      score += v * Math.pow(15, 4 - idx);
    });
    return {
      category: 'HIGH_CARD',
      categoryRank: CATEGORY_RANKS.HIGH_CARD,
      categoryName: 'Carta Alta',
      tiebreakerRanks: tiebreakers,
      score,
      bestFiveCards: cards
    };
  }

  private static evaluateFiveCards(cards: CardString[]): HandEvaluation {
    const parsed = cards.map(c => this.parseCard(c)).sort((a, b) => b.value - a.value);
    const values = parsed.map(c => c.value);
    const suits = parsed.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);

    // Check straight
    let isStraight = false;
    let straightHigh = 0;

    // Normal straight (values in strict descending order of -1)
    if (
      values[0] - values[1] === 1 &&
      values[1] - values[2] === 1 &&
      values[2] - values[3] === 1 &&
      values[3] - values[4] === 1
    ) {
      isStraight = true;
      straightHigh = values[0];
    } else if (
      // A-2-3-4-5 (Wheel / Broadway baby straight)
      values[0] === 14 &&
      values[1] === 5 &&
      values[2] === 4 &&
      values[3] === 3 &&
      values[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5; // 5-high straight
    }

    // Straight Flush & Royal Flush
    if (isFlush && isStraight) {
      if (straightHigh === 14) {
        return this.buildResult('ROYAL_FLUSH', [14], cards);
      }
      return this.buildResult('STRAIGHT_FLUSH', [straightHigh], cards);
    }

    // Value frequencies (counts)
    const counts: Record<number, number> = {};
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }

    // Sort by count descending, then by card value descending
    const freqGroups = Object.entries(counts)
      .map(([val, count]) => ({ value: parseInt(val), count }))
      .sort((a, b) => b.count - a.count || b.value - a.value);

    // Four of a kind
    if (freqGroups[0].count === 4) {
      return this.buildResult(
        'FOUR_OF_A_KIND',
        [freqGroups[0].value, freqGroups[1].value],
        cards
      );
    }

    // Full House (3 + 2)
    if (freqGroups[0].count === 3 && freqGroups[1].count === 2) {
      return this.buildResult(
        'FULL_HOUSE',
        [freqGroups[0].value, freqGroups[1].value],
        cards
      );
    }

    // Flush
    if (isFlush) {
      return this.buildResult('FLUSH', values, cards);
    }

    // Straight
    if (isStraight) {
      return this.buildResult('STRAIGHT', [straightHigh], cards);
    }

    // Three of a kind (3 + 1 + 1)
    if (freqGroups[0].count === 3) {
      return this.buildResult(
        'THREE_OF_A_KIND',
        [freqGroups[0].value, freqGroups[1].value, freqGroups[2].value],
        cards
      );
    }

    // Two Pair (2 + 2 + 1)
    if (freqGroups[0].count === 2 && freqGroups[1].count === 2) {
      return this.buildResult(
        'TWO_PAIR',
        [freqGroups[0].value, freqGroups[1].value, freqGroups[2].value],
        cards
      );
    }

    // One Pair (2 + 1 + 1 + 1)
    if (freqGroups[0].count === 2) {
      return this.buildResult(
        'ONE_PAIR',
        [freqGroups[0].value, freqGroups[1].value, freqGroups[2].value, freqGroups[3].value],
        cards
      );
    }

    // High Card
    return this.buildResult('HIGH_CARD', values, cards);
  }

  private static buildResult(
    category: HandCategory,
    tiebreakers: number[],
    bestFiveCards: CardString[]
  ): HandEvaluation {
    const categoryRank = CATEGORY_RANKS[category];
    let score = categoryRank * 1e8;

    for (let i = 0; i < tiebreakers.length; i++) {
      score += tiebreakers[i] * Math.pow(15, 4 - i);
    }

    return {
      category,
      categoryRank,
      categoryName: CATEGORY_NAMES[category],
      tiebreakerRanks: tiebreakers,
      score,
      bestFiveCards
    };
  }

  private static combinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const head = arr[0];
    const tail = arr.slice(1);
    const withHead = this.combinations(tail, k - 1).map(c => [head, ...c]);
    const withoutHead = this.combinations(tail, k);
    return [...withHead, ...withoutHead];
  }
}

import { CardString, Rank, Suit } from '../../../../packages/shared-types/src';
import { HandEvaluator } from './HandEvaluator';

const ALL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const ALL_SUITS: Suit[] = ['c', 'd', 'h', 's'];

export interface EquityResult {
  heroEquity: number; // 0.0 to 1.0 (e.g. 0.654 = 65.4%)
  villainEquity: number;
  tieEquity: number;
  samples: number;
}

export class EquityCalculator {
  /**
   * Generates a 52-card standard deck excluding known dead cards.
   */
  public static getRemainingDeck(deadCards: CardString[]): CardString[] {
    const deadSet = new Set(deadCards);
    const deck: CardString[] = [];

    for (const r of ALL_RANKS) {
      for (const s of ALL_SUITS) {
        const c = `${r}${s}` as CardString;
        if (!deadSet.has(c)) {
          deck.push(c);
        }
      }
    }
    return deck;
  }

  /**
   * Calculates pot odds given call amount and current pot.
   * Formula: callAmount / (pot + callAmount)
   */
  public static calculatePotOdds(callAmount: number, currentPot: number): number {
    if (callAmount <= 0) return 0;
    const totalPotAfterCall = currentPot + callAmount;
    if (totalPotAfterCall <= 0) return 0;
    return Math.round((callAmount / totalPotAfterCall) * 1000) / 1000;
  }

  /**
   * Fast Monte Carlo equity estimation for Texas Hold'em.
   * Runs N simulations by dealing out remaining board and opponent cards.
   */
  public static estimateEquity(
    heroCards: CardString[],
    boardCards: CardString[],
    villainCards?: CardString[],
    iterations = 600
  ): EquityResult {
    if (heroCards.length !== 2) {
      return { heroEquity: 0.5, villainEquity: 0.5, tieEquity: 0, samples: 0 };
    }

    const deadCards = [...heroCards, ...boardCards, ...(villainCards || [])];
    const remainingDeck = this.getRemainingDeck(deadCards);

    const neededBoardCount = 5 - boardCards.length;
    let heroWins = 0;
    let villainWins = 0;
    let ties = 0;

    const deckLen = remainingDeck.length;
    if (deckLen < neededBoardCount + (villainCards ? 0 : 2)) {
      return { heroEquity: 0.5, villainEquity: 0.5, tieEquity: 0, samples: 0 };
    }

    // Seeded/deterministic pseudo-random generator for fast and reproducible simulations
    let seed = 1337;
    const fastRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < iterations; i++) {
      // Shuffle indices with Fisher-Yates up to needed cards
      const available = [...remainingDeck];
      const drawnCards: CardString[] = [];

      const toDraw = neededBoardCount + (villainCards ? 0 : 2);
      for (let j = 0; j < toDraw; j++) {
        const randIdx = Math.floor(fastRandom() * (available.length - j));
        const picked = available[randIdx];
        available[randIdx] = available[available.length - 1 - j];
        available.pop();
        drawnCards.push(picked);
      }

      let runVillain: CardString[];
      let runBoard: CardString[];

      if (villainCards && villainCards.length === 2) {
        runVillain = villainCards;
        runBoard = [...boardCards, ...drawnCards.slice(0, neededBoardCount)];
      } else {
        runVillain = [drawnCards[0], drawnCards[1]];
        runBoard = [...boardCards, ...drawnCards.slice(2, 2 + neededBoardCount)];
      }

      const heroHand = HandEvaluator.evaluate([...heroCards, ...runBoard]);
      const villainHand = HandEvaluator.evaluate([...runVillain, ...runBoard]);

      const cmp = HandEvaluator.compare(heroHand, villainHand);
      if (cmp > 0) {
        heroWins++;
      } else if (cmp < 0) {
        villainWins++;
      } else {
        ties++;
      }
    }

    const heroEquity = Math.round(((heroWins + ties * 0.5) / iterations) * 1000) / 1000;
    const villainEquity = Math.round(((villainWins + ties * 0.5) / iterations) * 1000) / 1000;
    const tieEquity = Math.round((ties / iterations) * 1000) / 1000;

    return {
      heroEquity,
      villainEquity,
      tieEquity,
      samples: iterations
    };
  }

  /**
   * Estimates Hero equity against an opponent's customized range of starting hands.
   */
  public static estimateEquityAgainstRange(
    heroCards: CardString[],
    boardCards: CardString[],
    villainCombos: string[],
    iterations = 600
  ): EquityResult {
    if (heroCards.length !== 2) {
      return { heroEquity: 0.5, villainEquity: 0.5, tieEquity: 0, samples: 0 };
    }

    if (!villainCombos || villainCombos.length === 0) {
      return this.estimateEquity(heroCards, boardCards, undefined, iterations);
    }

    const deadCards = [...heroCards, ...boardCards];
    const candidatePairs: [CardString, CardString][] = [];

    // Import dynamically or inline combo expansion for zero dependency cycle
    for (const combo of villainCombos) {
      const r1 = combo[0] as Rank;
      const r2 = combo[1] as Rank;
      const type = combo.length === 3 ? combo[2] : 'pair';
      const deadSet = new Set(deadCards);

      if (type === 'pair') {
        for (let i = 0; i < ALL_SUITS.length; i++) {
          for (let j = i + 1; j < ALL_SUITS.length; j++) {
            const c1 = `${r1}${ALL_SUITS[i]}` as CardString;
            const c2 = `${r2}${ALL_SUITS[j]}` as CardString;
            if (!deadSet.has(c1) && !deadSet.has(c2)) candidatePairs.push([c1, c2]);
          }
        }
      } else if (type === 's') {
        for (const suit of ALL_SUITS) {
          const c1 = `${r1}${suit}` as CardString;
          const c2 = `${r2}${suit}` as CardString;
          if (!deadSet.has(c1) && !deadSet.has(c2)) candidatePairs.push([c1, c2]);
        }
      } else if (type === 'o') {
        for (const s1 of ALL_SUITS) {
          for (const s2 of ALL_SUITS) {
            if (s1 !== s2) {
              const c1 = `${r1}${s1}` as CardString;
              const c2 = `${r2}${s2}` as CardString;
              if (!deadSet.has(c1) && !deadSet.has(c2)) candidatePairs.push([c1, c2]);
            }
          }
        }
      }
    }

    if (candidatePairs.length === 0) {
      return this.estimateEquity(heroCards, boardCards, undefined, iterations);
    }

    const neededBoardCount = 5 - boardCards.length;
    let heroWins = 0;
    let villainWins = 0;
    let ties = 0;

    let seed = 1337;
    const fastRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const allDeck = this.getRemainingDeck([]);

    for (let i = 0; i < iterations; i++) {
      const vPairIdx = Math.floor(fastRandom() * candidatePairs.length);
      const [v1, v2] = candidatePairs[vPairIdx];

      const currentDead = new Set([...deadCards, v1, v2]);
      const availableDeck = allDeck.filter(c => !currentDead.has(c));

      const drawnBoard: CardString[] = [];
      for (let j = 0; j < neededBoardCount; j++) {
        const randIdx = Math.floor(fastRandom() * (availableDeck.length - j));
        const picked = availableDeck[randIdx];
        availableDeck[randIdx] = availableDeck[availableDeck.length - 1 - j];
        availableDeck.pop();
        drawnBoard.push(picked);
      }

      const runBoard = [...boardCards, ...drawnBoard];
      const heroHand = HandEvaluator.evaluate([...heroCards, ...runBoard]);
      const villainHand = HandEvaluator.evaluate([v1, v2, ...runBoard]);

      const cmp = HandEvaluator.compare(heroHand, villainHand);
      if (cmp > 0) heroWins++;
      else if (cmp < 0) villainWins++;
      else ties++;
    }

    const heroEquity = Math.round(((heroWins + ties * 0.5) / iterations) * 1000) / 1000;
    const villainEquity = Math.round(((villainWins + ties * 0.5) / iterations) * 1000) / 1000;
    const tieEquity = Math.round((ties / iterations) * 1000) / 1000;

    return {
      heroEquity,
      villainEquity,
      tieEquity,
      samples: iterations
    };
  }
}

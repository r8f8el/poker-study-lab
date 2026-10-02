import { CardString, OpponentProfile, Rank, Suit } from '../../../../packages/shared-types/src';

export const ORDERED_RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['c', 'd', 'h', 's'];

// 169 distinct canonical starting hands ordered roughly by heads-up preflop equity / power
export const STANDARD_HAND_ORDER: string[] = [
  'AA', 'KK', 'QQ', 'AKs', 'JJ', 'AQs', 'KQs', 'AJs', 'AKo', 'TT',
  'ATs', 'QJs', 'AQo', '99', 'KTs', 'KJs', 'QTs', 'JTs', 'A9s', 'A8s',
  '88', 'A5s', 'A7s', 'A4s', 'A3s', 'A6s', 'A2s', 'K9s', 'Q9s', 'J9s',
  'T9s', '77', 'AJo', 'KQo', 'ATo', 'K8s', 'Q8s', 'J8s', 'T8s', '98s',
  '66', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'Q7s', 'Q6s', 'Q5s',
  '55', 'J7s', 'T7s', '97s', '87s', '76s', '65s', '54s', '44', '33',
  '22', 'KJo', 'QJo', 'JTo', 'A9o', 'KTo', 'QTo', 'J9o', 'T9o', 'A8o',
  'K9o', 'Q9o', 'A7o', 'A5o', 'A6o', 'A4o', 'A3o', 'A2o', 'K8o', 'Q8o',
  'J8o', 'T8o', '98o', '87o', '76o', '65o', '54o', 'K7o', 'K6o', 'K5o',
  'K4o', 'K3o', 'K2o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o', 'J7o',
  'J6o', 'J5o', 'J4o', 'J3o', 'J2o', 'T7o', 'T6o', 'T5o', 'T4o', 'T3o',
  'T2o', '97o', '96o', '95o', '94o', '93o', '92o', '86s', '85s', '84s',
  '86o', '85o', '84o', '83o', '82o', '75s', '74s', '73s', '75o', '74o',
  '73o', '72o', '64s', '63s', '62s', '64o', '63o', '62o', '53s', '52s',
  '53o', '52o', '43s', '42s', '43o', '42o', '32s', '32o', 'Q4s', 'Q3s',
  'Q2s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'T6s', 'T5s', 'T4s', 'T3s',
  'T2s', '96s', '95s', '94s', '93s', '92s', '83s', '82s', '72s'
];

/**
 * Builds the canonical 13x13 grid:
 * Row i, Col j:
 * - i === j: Pair (e.g. AA, KK)
 * - i < j: Suited (e.g. AKs)
 * - i > j: Offsuit (e.g. AKo)
 */
export function buildRangeMatrix(): string[][] {
  const matrix: string[][] = [];
  for (let r = 0; r < 13; r++) {
    const row: string[] = [];
    for (let c = 0; c < 13; c++) {
      if (r === c) {
        row.push(`${ORDERED_RANKS[r]}${ORDERED_RANKS[c]}`);
      } else if (r < c) {
        row.push(`${ORDERED_RANKS[r]}${ORDERED_RANKS[c]}s`);
      } else {
        row.push(`${ORDERED_RANKS[c]}${ORDERED_RANKS[r]}o`);
      }
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Expands a 2-card combo symbol (e.g. 'AA', 'AKs', 'AKo') into concrete card pairs,
 * removing any dead cards already present in the hand or board.
 */
export function expandComboToCardPairs(comboStr: string, deadCards: CardString[]): [CardString, CardString][] {
  const deadSet = new Set(deadCards);
  const pairs: [CardString, CardString][] = [];

  const r1 = comboStr[0] as Rank;
  const r2 = comboStr[1] as Rank;
  const type = comboStr.length === 3 ? comboStr[2] : 'pair';

  if (type === 'pair') {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const c1 = `${r1}${SUITS[i]}` as CardString;
        const c2 = `${r2}${SUITS[j]}` as CardString;
        if (!deadSet.has(c1) && !deadSet.has(c2)) {
          pairs.push([c1, c2]);
        }
      }
    }
  } else if (type === 's') {
    for (const suit of SUITS) {
      const c1 = `${r1}${suit}` as CardString;
      const c2 = `${r2}${suit}` as CardString;
      if (!deadSet.has(c1) && !deadSet.has(c2)) {
        pairs.push([c1, c2]);
      }
    }
  } else if (type === 'o') {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 !== s2) {
          const c1 = `${r1}${s1}` as CardString;
          const c2 = `${r2}${s2}` as CardString;
          if (!deadSet.has(c1) && !deadSet.has(c2)) {
            pairs.push([c1, c2]);
          }
        }
      }
    }
  }

  return pairs;
}

/**
 * Generates hand combos for a given top percentage (0% to 100%).
 */
export function getCombosForPercentage(pct: number): string[] {
  const count = Math.max(1, Math.min(169, Math.round((pct / 100) * 169)));
  return STANDARD_HAND_ORDER.slice(0, count);
}

/**
 * Predefined Canonical Opponent Profiles.
 */
export const OPPONENT_PROFILES: OpponentProfile[] = [
  {
    id: 'profile_nit',
    name: 'Rock / Nit (Tight-Passive)',
    type: 'NIT',
    description: 'Joga apenas mãos premium, raramente blefa e aposta apenas por valor evidente.',
    vpip: 12,
    pfr: 9,
    aggressionFactor: 1.2,
    rangePercentage: 12,
    combos: getCombosForPercentage(12)
  },
  {
    id: 'profile_tag',
    name: 'TAG (Tight-Aggressive)',
    type: 'TAG',
    description: 'Padrão regular sólido: seleção seletiva pré-flop com forte agressão pós-flop.',
    vpip: 22,
    pfr: 19,
    aggressionFactor: 2.8,
    rangePercentage: 22,
    combos: getCombosForPercentage(22)
  },
  {
    id: 'profile_lag',
    name: 'LAG (Loose-Aggressive)',
    type: 'LAG',
    description: 'Ampla gama de mãos pré-flop, pressão constante com apostas e aumentos frequentes.',
    vpip: 34,
    pfr: 28,
    aggressionFactor: 3.6,
    rangePercentage: 34,
    combos: getCombosForPercentage(34)
  },
  {
    id: 'profile_station',
    name: 'Calling Station (Loose-Passive)',
    type: 'STATION',
    description: 'Paga apostas com quase qualquer pedaço do board, raramente aumenta ou desiste.',
    vpip: 48,
    pfr: 8,
    aggressionFactor: 0.8,
    rangePercentage: 48,
    combos: getCombosForPercentage(48)
  },
  {
    id: 'profile_custom',
    name: 'Customizado (Manual)',
    type: 'CUSTOM',
    description: 'Range ajustado manualmente pelo operador na matriz interativa.',
    vpip: 25,
    pfr: 18,
    aggressionFactor: 2.0,
    rangePercentage: 25,
    combos: getCombosForPercentage(25)
  }
];

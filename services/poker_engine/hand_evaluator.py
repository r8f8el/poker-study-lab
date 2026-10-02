"""
Texas Hold'em 5-7 Card Hand Evaluator in Python.
Computes deterministic numerical score and rank categories.
"""

from __future__ import annotations
import itertools
from typing import Any, Dict, List, Tuple

RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14
}

CATEGORY_NAMES = {
    10: "Royal Flush",
    9: "Straight Flush",
    8: "Quadra (Four of a Kind)",
    7: "Full House",
    6: "Flush",
    5: "Sequência (Straight)",
    4: "Trinca (Three of a Kind)",
    3: "Dois Pares (Two Pair)",
    2: "Um Par (One Pair)",
    1: "Carta Alta (High Card)"
}


def parse_card(card: str) -> Tuple[int, str]:
    rank = card[0]
    suit = card[1]
    return RANK_VALUES[rank], suit


def evaluate_5_cards(cards: List[str]) -> Tuple[int, List[int]]:
    parsed = sorted([parse_card(c) for c in cards], key=lambda x: x[0], reverse=True)
    values = [p[0] for p in parsed]
    suits = [p[1] for p in parsed]

    is_flush = len(set(suits)) == 1

    # Check Straight
    is_straight = False
    straight_high = 0

    if (
        values[0] - values[1] == 1
        and values[1] - values[2] == 1
        and values[2] - values[3] == 1
        and values[3] - values[4] == 1
    ):
        is_straight = True
        straight_high = values[0]
    elif values == [14, 5, 4, 3, 2]:  # Wheel A-2-3-4-5
        is_straight = True
        straight_high = 5

    # Straight Flush & Royal Flush
    if is_flush and is_straight:
        if straight_high == 14:
            return 10, [14]
        return 9, [straight_high]

    # Frequency counts
    counts: Dict[int, int] = {}
    for v in values:
        counts[v] = counts.get(v, 0) + 1

    freq_groups = sorted(counts.items(), key=lambda x: (x[1], x[0]), reverse=True)

    # Four of a kind
    if freq_groups[0][1] == 4:
        return 8, [freq_groups[0][0], freq_groups[1][0]]

    # Full House
    if freq_groups[0][1] == 3 and freq_groups[1][1] == 2:
        return 7, [freq_groups[0][0], freq_groups[1][0]]

    # Flush
    if is_flush:
        return 6, values

    # Straight
    if is_straight:
        return 5, [straight_high]

    # Three of a kind
    if freq_groups[0][1] == 3:
        return 4, [freq_groups[0][0], freq_groups[1][0], freq_groups[2][0]]

    # Two Pair
    if freq_groups[0][1] == 2 and freq_groups[1][1] == 2:
        return 3, [freq_groups[0][0], freq_groups[1][0], freq_groups[2][0]]

    # One Pair
    if freq_groups[0][1] == 2:
        return 2, [freq_groups[0][0], freq_groups[1][0], freq_groups[2][0], freq_groups[3][0]]

    # High Card
    return 1, values


def evaluate_hand(cards: List[str]) -> Dict[str, Any]:
    """
    Evaluates the best 5-card combination from 5 to 7 cards.
    """
    if len(cards) < 5:
        parsed = sorted([parse_card(c) for c in cards], key=lambda x: x[0], reverse=True)
        if len(cards) == 2 and parsed[0][0] == parsed[1][0]:
            cat = 2
            tiebreakers = [parsed[0][0]]
        else:
            cat = 1
            tiebreakers = [p[0] for p in parsed]
        score = cat * int(1e8)
        for i, val in enumerate(tiebreakers):
            score += val * (15 ** (4 - i))
        return {
            "category_rank": cat,
            "category_name": CATEGORY_NAMES[cat],
            "tiebreakers": tiebreakers,
            "score": score
        }

    best_score = -1
    best_cat = 1
    best_tiebreakers: List[int] = []

    for combo in itertools.combinations(cards, 5):
        cat, tiebreakers = evaluate_5_cards(list(combo))
        score = cat * int(1e8)
        for i, val in enumerate(tiebreakers):
            score += val * (15 ** (4 - i))
        if score > best_score:
            best_score = score
            best_cat = cat
            best_tiebreakers = tiebreakers

    return {
        "category_rank": best_cat,
        "category_name": CATEGORY_NAMES[best_cat],
        "tiebreakers": best_tiebreakers,
        "score": best_score
    }

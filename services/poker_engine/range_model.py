"""
Opponent Range Matrix and Profiles in Python for Texas Hold'em.
"""

from __future__ import annotations
from typing import Dict, List, Set, Tuple

ORDERED_RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]
SUITS = ["c", "d", "h", "s"]

STANDARD_HAND_ORDER = [
    "AA", "KK", "QQ", "AKs", "JJ", "AQs", "KQs", "AJs", "AKo", "TT",
    "ATs", "QJs", "AQo", "99", "KTs", "KJs", "QTs", "JTs", "A9s", "A8s",
    "88", "A5s", "A7s", "A4s", "A3s", "A6s", "A2s", "K9s", "Q9s", "J9s",
    "T9s", "77", "AJo", "KQo", "ATo", "K8s", "Q8s", "J8s", "T8s", "98s",
    "66", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "Q7s", "Q6s", "Q5s",
    "55", "J7s", "T7s", "97s", "87s", "76s", "65s", "54s", "44", "33",
    "22", "KJo", "QJo", "JTo", "A9o", "KTo", "QTo", "J9o", "T9o", "A8o",
    "K9o", "Q9o", "A7o", "A5o", "A6o", "A4o", "A3o", "A2o", "K8o", "Q8o",
    "J8o", "T8o", "98o", "87o", "76o", "65o", "54o", "K7o", "K6o", "K5o",
    "K4o", "K3o", "K2o", "Q7o", "Q6o", "Q5o", "Q4o", "Q3o", "Q2o", "J7o",
    "J6o", "J5o", "J4o", "J3o", "J2o", "T7o", "T6o", "T5o", "T4o", "T3o",
    "T2o", "97o", "96o", "95o", "94o", "93o", "92o", "86s", "85s", "84s",
    "86o", "85o", "84o", "83o", "82o", "75s", "74s", "73s", "75o", "74o",
    "73o", "72o", "64s", "63s", "62s", "64o", "63o", "62o", "53s", "52s",
    "53o", "52o", "43s", "42s", "43o", "42o", "32s", "32o", "Q4s", "Q3s",
    "Q2s", "J6s", "J5s", "J4s", "J3s", "J2s", "T6s", "T5s", "T4s", "T3s",
    "T2s", "96s", "95s", "94s", "93s", "92s", "83s", "82s", "72s"
]


def build_range_matrix() -> List[List[str]]:
    matrix: List[List[str]] = []
    for r in range(13):
        row: List[str] = []
        for c in range(13):
            if r == c:
                row.append(f"{ORDERED_RANKS[r]}{ORDERED_RANKS[c]}")
            elif r < c:
                row.append(f"{ORDERED_RANKS[r]}{ORDERED_RANKS[c]}s")
            else:
                row.append(f"{ORDERED_RANKS[c]}{ORDERED_RANKS[r]}o")
        matrix.append(row)
    return matrix


def expand_combo(combo_str: str, dead_cards: List[str]) -> List[Tuple[str, str]]:
    dead_set = set(dead_cards)
    pairs: List[Tuple[str, str]] = []
    r1 = combo_str[0]
    r2 = combo_str[1]
    is_pair = len(combo_str) == 2
    is_suited = combo_str.endswith("s")
    is_offsuit = combo_str.endswith("o")

    if is_pair:
        for i in range(len(SUITS)):
            for j in range(i + 1, len(SUITS)):
                c1 = f"{r1}{SUITS[i]}"
                c2 = f"{r2}{SUITS[j]}"
                if c1 not in dead_set and c2 not in dead_set:
                    pairs.append((c1, c2))
    elif is_suited:
        for s in SUITS:
            c1 = f"{r1}{s}"
            c2 = f"{r2}{s}"
            if c1 not in dead_set and c2 not in dead_set:
                pairs.append((c1, c2))
    elif is_offsuit:
        for s1 in SUITS:
            for s2 in SUITS:
                if s1 != s2:
                    c1 = f"{r1}{s1}"
                    c2 = f"{r2}{s2}"
                    if c1 not in dead_set and c2 not in dead_set:
                        pairs.append((c1, c2))

    return pairs


def get_combos_for_percentage(pct: float) -> List[str]:
    count = max(1, min(169, round((pct / 100.0) * 169)))
    return STANDARD_HAND_ORDER[:count]


OPPONENT_PROFILES = {
    "NIT": {
        "name": "Rock / Nit",
        "range_percentage": 12,
        "combos": get_combos_for_percentage(12),
    },
    "TAG": {
        "name": "TAG",
        "range_percentage": 22,
        "combos": get_combos_for_percentage(22),
    },
    "LAG": {
        "name": "LAG",
        "range_percentage": 34,
        "combos": get_combos_for_percentage(34),
    },
    "STATION": {
        "name": "Calling Station",
        "range_percentage": 48,
        "combos": get_combos_for_percentage(48),
    },
}

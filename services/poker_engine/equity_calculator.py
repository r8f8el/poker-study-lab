"""
Monte Carlo and Pot Odds Calculator in Python for Texas Hold'em.
"""

from __future__ import annotations
import random
from typing import Any, Dict, List, Optional
from services.poker_engine.hand_evaluator import evaluate_hand

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
SUITS = ["c", "d", "h", "s"]


def calculate_pot_odds(call_amount: float, current_pot: float) -> float:
    if call_amount <= 0:
        return 0.0
    total = current_pot + call_amount
    if total <= 0:
        return 0.0
    return round(call_amount / total, 3)


def get_remaining_deck(dead_cards: List[str]) -> List[str]:
    dead_set = set(dead_cards)
    return [f"{r}{s}" for r in RANKS for s in SUITS if f"{r}{s}" not in dead_set]


def estimate_equity(
    hero_cards: List[str],
    board_cards: List[str],
    villain_cards: Optional[List[str]] = None,
    iterations: int = 500,
) -> Dict[str, Any]:
    if len(hero_cards) != 2:
        return {"hero_equity": 0.5, "villain_equity": 0.5, "samples": 0}

    dead = list(hero_cards) + list(board_cards) + (list(villain_cards) if villain_cards else [])
    deck = get_remaining_deck(dead)

    needed_board = 5 - len(board_cards)
    needed_draw = needed_board + (0 if villain_cards else 2)

    if len(deck) < needed_draw:
        return {"hero_equity": 0.5, "villain_equity": 0.5, "samples": 0}

    hero_wins = 0
    villain_wins = 0
    ties = 0

    rng = random.Random(1337)

    for _ in range(iterations):
        drawn = rng.sample(deck, needed_draw)

        if villain_cards and len(villain_cards) == 2:
            v_cards = villain_cards
            run_board = board_cards + drawn[:needed_board]
        else:
            v_cards = drawn[:2]
            run_board = board_cards + drawn[2:2 + needed_board]

        h_res = evaluate_hand(hero_cards + run_board)
        v_res = evaluate_hand(v_cards + run_board)

        if h_res["score"] > v_res["score"]:
            hero_wins += 1
        elif h_res["score"] < v_res["score"]:
            villain_wins += 1
        else:
            ties += 1

    hero_equity = round((hero_wins + ties * 0.5) / iterations, 3)
    villain_equity = round((villain_wins + ties * 0.5) / iterations, 3)

    return {
        "hero_equity": hero_equity,
        "villain_equity": villain_equity,
        "ties": ties,
        "samples": iterations,
    }

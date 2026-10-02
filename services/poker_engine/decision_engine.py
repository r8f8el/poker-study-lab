"""
Deterministic Reference Decision Engine for Poker Study Lab.
"""

from __future__ import annotations
from typing import Any, Dict
from services.poker_engine.hand_evaluator import evaluate_hand
from services.poker_engine.equity_calculator import calculate_pot_odds, estimate_equity


def evaluate_decision(game_state: Dict[str, Any], gate_allowed: bool) -> Dict[str, Any]:
    if not gate_allowed:
        return {
            "action": "fold",
            "frequencies": {"fold": 1.0},
            "source": "reference_strategy",
            "confidence": 0.0,
            "explanation_factors": ["Gate bloqueado: análise pausada até confirmação do estado."],
            "pot_odds": 0.0,
            "equity_estimate": 0.0,
        }

    hero_cards = game_state.get("hero_cards", [])
    board_cards = game_state.get("board", [])
    pot = float(game_state.get("pot", 10.0))
    position = game_state.get("hero_position", "BTN")

    hand_eval = evaluate_hand(hero_cards + board_cards)

    call_amount = float(game_state.get("call_amount", 0.0))
    pot_odds = calculate_pot_odds(call_amount, pot)

    eq_res = estimate_equity(hero_cards, board_cards, iterations=500)
    hero_equity = eq_res["hero_equity"]

    factors = [
        f"Mão avaliada: {hand_eval['category_name']}",
        f"Equity estimada: {round(hero_equity * 100, 1)}%",
        f"Pot Odds: {round(pot_odds * 100, 1)}%" if call_amount > 0 else "Opção de check livre",
        f"Posição: {position}",
    ]

    is_strong = hand_eval["category_rank"] >= 3
    is_monster = hand_eval["category_rank"] >= 5

    frequencies: Dict[str, float] = {}

    if call_amount == 0.0:
        if is_monster:
            action = "bet"
            frequencies = {"bet_66": 0.60, "bet_33": 0.25, "check": 0.15}
            factors.append("Mão monstro: extração prioritária de valor")
        elif is_strong:
            action = "bet"
            frequencies = {"bet_33": 0.55, "check": 0.45}
            factors.append("Mão forte feita: aposta para valor e proteção")
        else:
            action = "check"
            frequencies = {"check": 0.80, "bet_33": 0.20}
            factors.append("Check livre prioritário para controle de pote")
    else:
        edge = hero_equity - pot_odds
        if is_monster and edge > 0.20:
            action = "raise"
            frequencies = {"raise": 0.65, "call": 0.35}
            factors.append("Vantagem de equity esmagadora sobre o pote: raise de valor")
        elif edge >= 0.0:
            action = "call"
            frequencies = {"call": 0.70, "fold": 0.30}
            factors.append("Equity suficiente para cobrir os Pot Odds: call lucrativo")
        else:
            action = "fold"
            frequencies = {"fold": 0.75, "call": 0.25}
            factors.append("Equity insuficiente para pagar a aposta: fold prudente")

    return {
        "action": action,
        "frequencies": frequencies,
        "source": "reference_strategy",
        "confidence": 0.96,
        "explanation_factors": factors,
        "pot_odds": pot_odds,
        "equity_estimate": hero_equity,
    }

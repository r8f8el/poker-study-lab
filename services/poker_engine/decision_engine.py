"""
Deterministic Reference Decision Engine for Poker Study Lab.
"""

from __future__ import annotations
from typing import Any, Dict
from services.poker_engine.hand_evaluator import evaluate_hand
from services.poker_engine.equity_calculator import calculate_pot_odds, estimate_equity


def evaluate_decision(
    game_state: Dict[str, Any],
    gate_allowed: bool | Dict[str, Any] = True,
    iterations: int = 600
) -> Dict[str, Any]:
    if isinstance(gate_allowed, dict):
        is_allowed = bool(gate_allowed.get("allowed", False))
        reasons = gate_allowed.get("reasons", [])
        gate_res = gate_allowed
    else:
        is_allowed = bool(gate_allowed)
        reasons = [] if is_allowed else ["Gate bloqueado: análise pausada até confirmação do estado."]
        gate_res = {"allowed": is_allowed, "reasons": reasons}

    if not is_allowed:
        return {
            "action": "fold",
            "frequencies": {"fold": 1.0},
            "source": "reference_strategy",
            "confidence": 0.0,
            "explanation_factors": reasons if reasons else ["Gate bloqueado: análise pausada até confirmação do estado."],
            "pot_odds": 0.0,
            "equity_estimate": 0.0,
            "gate_result": gate_res,
        }

    hero_cards = game_state.get("hero_cards", [])
    board_cards = game_state.get("board", [])
    pot = float(game_state.get("pot", 10.0))
    position = game_state.get("hero_position", "BTN")

    hand_eval = evaluate_hand(hero_cards + board_cards)

    call_amount = float(game_state.get("call_amount", 0.0))
    pot_odds = calculate_pot_odds(call_amount, pot)

    eq_res = estimate_equity(hero_cards, board_cards, iterations=iterations)
    hero_equity = eq_res["hero_equity"]

    factors = [
        f"Mão avaliada: {hand_eval['category_name']}",
        f"Equity estimada: {round(hero_equity * 100, 1)}%",
        f"Pot Odds: {round(pot_odds * 100, 1)}%" if call_amount > 0 else "Opção de check livre",
        f"Posição: {position}",
    ]

    is_strong = hand_eval["category_rank"] >= 3
    is_monster = hand_eval["category_rank"] >= 4

    frequencies: Dict[str, float] = {}

    if call_amount == 0.0:
        if is_monster:
            action = "bet"
            frequencies = {"bet_66": 0.60, "bet_33": 0.25, "check": 0.15}
            factors.append("Mão de valor monstruoso: extração máxima recomendada com aposta de valor")
        elif is_strong:
            action = "bet"
            frequencies = {"bet_33": 0.55, "check": 0.45}
            factors.append("Mão forte feita: aposta moderada para proteção e valor fino contra ranges de call")
        elif hero_equity >= 0.55:
            action = "check"
            frequencies = {"check": 0.70, "bet_33": 0.30}
            factors.append("Equity favorável com valor de showdown moderado: controle de pote via check prioritário")
        else:
            action = "check"
            frequencies = {"check": 0.85, "bet_33": 0.15}
            factors.append("Mão marginal: check livre para ver próxima carta sem inflacionar o pote")
    else:
        edge = hero_equity - pot_odds
        if is_monster and edge > 0.20:
            action = "raise"
            frequencies = {"raise": 0.65, "call": 0.35}
            factors.append("Vantagem matemática esmagadora sobre o pote: raise para valor e construção de pote")
        elif edge >= 0.10:
            action = "call"
            frequencies = {"call": 0.75, "raise": 0.25}
            factors.append("Equity estimada supera com folga os Pot Odds exigidos: call lucrativo no longo prazo")
        elif edge >= 0.0:
            action = "call"
            frequencies = {"call": 0.65, "fold": 0.35}
            factors.append("Equity compatível com os Pot Odds: call defensivo matematicamente aceitável")
        elif edge > -0.06:
            action = "fold"
            frequencies = {"fold": 0.60, "call": 0.40}
            factors.append("Pot odds ligeiramente desfavoráveis: fold prudente de frequência mista")
        else:
            action = "fold"
            frequencies = {"fold": 0.85, "call": 0.15}
            factors.append("Equity insuficiente para justificar o investimento no pote: fold matematicamente indicado")

    return {
        "action": action,
        "frequencies": frequencies,
        "source": "reference_strategy",
        "confidence": 0.96,
        "explanation_factors": factors,
        "pot_odds": pot_odds,
        "equity_estimate": hero_equity,
        "gate_result": gate_res,
    }

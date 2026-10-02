import pytest
from services.poker_engine.hand_evaluator import evaluate_hand
from services.poker_engine.equity_calculator import calculate_pot_odds, estimate_equity
from services.poker_engine.decision_engine import evaluate_decision


def test_hand_evaluator_categories():
    royal = evaluate_hand(["As", "Ks", "Qs", "Js", "Ts", "2c", "3d"])
    assert royal["category_rank"] == 10
    assert royal["category_name"] == "Royal Flush"

    boat = evaluate_hand(["As", "Ah", "Ad", "Ks", "Kh", "2c", "3c"])
    assert boat["category_rank"] == 7
    assert boat["category_name"] == "Full House"

    flush = evaluate_hand(["As", "Js", "8s", "4s", "2s", "Kd", "Qc"])
    assert flush["category_rank"] == 6

    wheel = evaluate_hand(["As", "2c", "3d", "4h", "5s", "Kh", "Qd"])
    assert wheel["category_rank"] == 5  # Straight


def test_equity_calculator_and_pot_odds():
    # Pot odds: call 50 in 100 pot -> 50 / 150 = 33.3%
    po = calculate_pot_odds(50.0, 100.0)
    assert abs(po - 0.333) < 0.01

    # Free check -> 0%
    assert calculate_pot_odds(0.0, 100.0) == 0.0

    # Equity AA vs KK
    eq = estimate_equity(["As", "Ah"], [], villain_cards=["Ks", "Kh"], iterations=300)
    assert eq["hero_equity"] > 0.75
    assert eq["samples"] == 300


def test_decision_engine_recommendations():
    # Blocked gate
    res_blocked = evaluate_decision({}, gate_allowed=False)
    assert res_blocked["confidence"] == 0.0
    assert res_blocked["action"] == "fold"

    # Monster hand check situation
    state = {
        "hero_cards": ["Qs", "Qd"],
        "board": ["Qc", "8h", "7d"],
        "pot": 100.0,
        "hero_position": "BTN",
        "call_amount": 0.0,
    }
    res_allowed = evaluate_decision(state, gate_allowed=True)
    assert res_allowed["confidence"] > 0.9
    assert res_allowed["action"] == "bet"
    assert "bet_33" in res_allowed["frequencies"] or "bet_66" in res_allowed["frequencies"]
    assert res_allowed["equity_estimate"] > 0.70

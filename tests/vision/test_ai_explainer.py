"""Tests for AIExplainer service."""
from services.explanation_ai.ai_explainer import (
    AIExplainer,
    AIExplanationRequest,
)


def test_ai_explainer_preserves_deterministic_decision():
    explainer = AIExplainer()

    req = AIExplanationRequest(
        hand_id="hand-py-01",
        stage="FLOP",
        hero_cards=["Ah", "Ad"],
        board=["Kd", "5c", "2s"],
        pot_size=120.0,
        to_call=0.0,
        equity=0.88,
        pot_odds=0.0,
        primary_action="bet",
        action_frequencies={"bet": 0.85, "check": 0.15},
        opponent_range_profile="TAG",
        strategic_factors=["Overpair AA", "Dry Rainbow Flop"],
        is_gate_open=True,
    )

    result = explainer.explain(req)

    # Inviolability check: action must remain "bet"
    assert result.decision == "bet"
    assert "Aposta por Valor Linear" in result.concept_summary
    assert "88.0%" in result.tactical_rationale
    assert result.is_ai_generated is False
    assert result.source_label == "offline_heuristic"


def test_ai_explainer_gate_closed_safeguard():
    explainer = AIExplainer()

    req = AIExplanationRequest(
        hand_id="hand-py-02",
        stage="TURN",
        hero_cards=["Jh", "Th"],
        board=["9c", "8d", "2s", "Kd"],
        pot_size=180.0,
        to_call=60.0,
        equity=0.35,
        pot_odds=0.25,
        primary_action="call",
        action_frequencies={"call": 1.0},
        opponent_range_profile="LAG",
        strategic_factors=["Open-ended straight draw"],
        is_gate_open=False,
        gate_reasons=["ANIMATION_IN_PROGRESS: Fichas em movimento", "LATENCY_EXCEEDED: 2500ms > 2000ms"],
    )

    result = explainer.explain(req)

    assert "Salvaguarda de Integridade" in result.concept_summary
    assert "Recommendation Gate" in result.tactical_rationale
    assert "ANIMATION_IN_PROGRESS" in result.tactical_rationale
    assert any("Correção Manual (F2)" in line for line in result.alternative_lines)
    assert any("UNKNOWN" in r for r in result.risk_and_uncertainty)


def test_ai_explainer_pot_odds_and_ev_positive_call():
    explainer = AIExplainer()

    req = AIExplanationRequest(
        hand_id="hand-py-03",
        stage="RIVER",
        hero_cards=["Ac", "Jc"],
        board=["Jd", "7s", "2h", "5c", "3d"],
        pot_size=250.0,
        to_call=50.0,
        equity=0.40,
        pot_odds=0.166,  # 50 / (250 + 50) = 0.166
        primary_action="call",
        action_frequencies={"call": 0.95, "fold": 0.05},
        opponent_range_profile="STATION",
        strategic_factors=["Top pair top kicker", "Bluff catcher favoravel"],
        is_gate_open=True,
    )

    result = explainer.explain(req)

    assert "Call por Pot Odds Favoráveis (EV+ Direto)" in result.concept_summary
    assert "retorno matematicamente positivo (+EV)" in result.tactical_rationale
    assert any("Calling Station" in alt for alt in result.alternative_lines)


def test_ai_explainer_disciplined_fold():
    explainer = AIExplainer()

    req = AIExplanationRequest(
        hand_id="hand-py-04",
        stage="RIVER",
        hero_cards=["7c", "6c"],
        board=["Kd", "Qd", "Jc", "Ts", "2h"],
        pot_size=400.0,
        to_call=200.0,
        equity=0.04,
        pot_odds=0.333,
        primary_action="fold",
        action_frequencies={"fold": 1.0},
        opponent_range_profile="NIT",
        strategic_factors=["Mão fraca dominada"],
        is_gate_open=True,
    )

    result = explainer.explain(req)

    assert "Fold Disciplinado" in result.concept_summary
    assert "perda contínua no longo prazo (-EV)" in result.tactical_rationale
    assert any("Nit" in alt for alt in result.alternative_lines)


def test_ai_explainer_caching():
    explainer = AIExplainer()

    req = AIExplanationRequest(
        hand_id="hand-py-05",
        stage="PREFLOP",
        hero_cards=["Qh", "Qs"],
        board=[],
        pot_size=45.0,
        to_call=15.0,
        equity=0.72,
        pot_odds=0.25,
        primary_action="raise",
        action_frequencies={"raise": 0.9, "call": 0.1},
        opponent_range_profile="TAG",
        strategic_factors=["Premium pair QQ"],
        is_gate_open=True,
    )

    res1 = explainer.explain(req)
    res2 = explainer.explain(req)

    assert res1.concept_summary == res2.concept_summary
    assert res1.tactical_rationale == res2.tactical_rationale

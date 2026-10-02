import pytest
from services.game_state.recommendation_gate import RecommendationGate


@pytest.fixture
def valid_state():
    return {
        "app_id": "com.auth.poker.client",
        "is_paused": False,
        "is_animation_active": False,
        "active_player": "hero",
        "status": "FLOP",
        "street": "FLOP",
        "pot": 100.0,
        "confidence": 0.99,
        "hero": {
            "cards": ["As", "Kd"],
            "stack": 200.0,
            "has_folded": False,
            "is_all_in": False,
        },
        "board": ["Qs", "8h", "7d"],
        "players": [
            {"id": "p1", "has_folded": False},
            {"id": "p2", "has_folded": False},
        ],
    }


def test_gate_allows_valid_state(valid_state):
    gate = RecommendationGate()
    res = gate.evaluate(valid_state)
    assert res["allowed"] is True
    assert res["block_code"] is None


def test_gate_blocks_latency_exceeded(valid_state):
    gate = RecommendationGate()
    res = gate.evaluate(valid_state, frame_latency_ms=2500, max_latency_ms=2000)
    assert res["allowed"] is False
    assert res["block_code"] == "LATENCY_EXCEEDED"


def test_gate_blocks_hero_folded(valid_state):
    gate = RecommendationGate()
    valid_state["hero"]["has_folded"] = True
    res = gate.evaluate(valid_state)
    assert res["allowed"] is False
    assert res["block_code"] == "HERO_FOLDED"


def test_gate_blocks_invalid_stack(valid_state):
    gate = RecommendationGate()
    valid_state["hero"]["stack"] = -50
    res = gate.evaluate(valid_state)
    assert res["allowed"] is False
    assert res["block_code"] == "INVALID_STACK"


def test_gate_blocks_insufficient_players(valid_state):
    gate = RecommendationGate()
    valid_state["players"][1]["has_folded"] = True
    res = gate.evaluate(valid_state)
    assert res["allowed"] is False
    assert res["block_code"] == "INSUFFICIENT_ACTIVE_PLAYERS"


def test_gate_blocks_unauthorized_app(valid_state):
    gate = RecommendationGate()
    valid_state["app_id"] = "com.unauthorized.poker"
    res = gate.evaluate(valid_state)
    assert res["allowed"] is False
    assert res["block_code"] == "UNAUTHORIZED_APP"

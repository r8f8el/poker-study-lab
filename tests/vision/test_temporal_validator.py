import pytest
import time
from services.vision.temporal_validation.temporal_validator import (
    TemporalSlotValidator,
    TemporalCardValidator,
    Observation,
    ConfirmedValue
)


def make_obs(label: str | None, conf: float = 0.98, visual_state: str = 'VISIBLE_CARD') -> Observation:
    return Observation(
        label=label,
        confidence=conf,
        visible=visual_state == 'VISIBLE_CARD',
        visual_state=visual_state,
        timestamp=time.monotonic()
    )


def test_five_identical_frames_confirm_card():
    val = TemporalSlotValidator(window_size=7, min_consensus=5, min_confidence=0.95)

    for _ in range(4):
        res = val.add_observation(make_obs('As', 0.99))
        assert res.status == 'UNCERTAIN'

    # 5th frame reaches consensus
    res = val.add_observation(make_obs('As', 0.99))
    assert res.status == 'CONFIRMED'
    assert res.label == 'As'
    assert res.confidence >= 0.95
    assert res.samples == 5


def test_divergent_frames_block_confirmation():
    val = TemporalSlotValidator(window_size=7, min_consensus=5, min_confidence=0.95)

    # 3 As and 4 Ac in window
    for _ in range(3):
        val.add_observation(make_obs('As', 0.98))
    for _ in range(4):
        res = val.add_observation(make_obs('Ac', 0.98))

    assert res.status == 'UNCERTAIN'
    assert "Consenso insuficiente" in res.reason


def test_hysteresis_ignores_isolated_flicker():
    val = TemporalSlotValidator(window_size=7, min_consensus=5, min_confidence=0.95)

    # Confirm As
    for _ in range(5):
        val.add_observation(make_obs('As', 0.99))
    assert val.confirmed.status == 'CONFIRMED'

    # Isolated flickering frame with Ks
    res = val.add_observation(make_obs('Ks', 0.99))
    assert res.status == 'CONFIRMED'
    assert res.label == 'As'
    assert "Histerese ativa" in res.reason


def test_animation_suspends_validator():
    val = TemporalSlotValidator(window_size=7, min_consensus=5, min_confidence=0.95)

    # Confirm As
    for _ in range(5):
        val.add_observation(make_obs('As', 0.99))

    # Dealing animation occurs
    res = val.add_observation(make_obs(None, 0.0, 'ANIMATION'))
    assert res.status == 'ANIMATING'
    assert res.confidence == 0.0


def test_temporal_card_validator_multi_slots():
    tc_val = TemporalCardValidator(window_size=7, min_consensus=5, min_confidence=0.95)

    # Feed 5 frames for hero cards
    for _ in range(5):
        c1, c2 = tc_val.update_hero_cards(make_obs('As', 0.99), make_obs('Kc', 0.98))

    assert c1.status == 'CONFIRMED'
    assert c1.label == 'As'
    assert c2.status == 'CONFIRMED'
    assert c2.label == 'Kc'

    confs = tc_val.get_field_confidences()
    assert confs['hero_cards'][0]['value'] == 'As'
    assert confs['hero_cards'][1]['value'] == 'Kc'
    assert confs['overall_confidence'] >= 0.98

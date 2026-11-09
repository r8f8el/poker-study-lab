import numpy as np
import pytest
from services.vision.button_detector.action_button_detector import ActionButtonDetector


def test_button_detector_empty_felt():
    felt_img = np.zeros((40, 120, 3), dtype=np.uint8)
    felt_img[:, :] = [35, 85, 20]  # Green felt in BGR
    res = ActionButtonDetector.detect_buttons(felt_img)
    assert not res.is_hero_turn
    assert res.available_actions == []
    assert not res.has_fold


def test_button_detector_active_buttons():
    img = np.zeros((40, 150, 3), dtype=np.uint8)
    # Red button (Fold) at x: 10..45, y: 10..30
    img[10:31, 10:46] = [30, 30, 190]  # BGR Red
    # Green button (Check/Call) at x: 55..90, y: 10..30
    img[10:31, 55:91] = [40, 170, 20]  # BGR Green
    # Orange button (Bet/Raise) at x: 100..135, y: 10..30
    img[10:31, 100:136] = [20, 140, 220]  # BGR Orange

    res = ActionButtonDetector.detect_buttons(img)
    assert res.is_hero_turn
    assert res.has_fold
    assert res.has_check_or_call
    assert res.has_bet_or_raise
    assert 'fold' in res.available_actions
    assert 'call' in res.available_actions
    assert 'raise' in res.available_actions
    assert res.confidence >= 0.85

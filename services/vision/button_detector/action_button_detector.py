"""
Poker Study Lab - Action Button & Player Turn Detector (Python Service)
Detects active action buttons (Fold, Check/Call, Bet/Raise) and Hero turn state.
"""

from dataclasses import dataclass, field
from typing import List
import numpy as np


@dataclass
class ButtonDetectionResult:
    is_hero_turn: bool
    has_fold: bool
    has_check_or_call: bool
    has_bet_or_raise: bool
    available_actions: List[str] = field(default_factory=list)
    confidence: float = 0.0


class ActionButtonDetector:
    """
    Classifies the table's action button region into active buttons and Hero turn state.
    """

    @classmethod
    def detect_buttons(cls, buttons_bgr: np.ndarray) -> ButtonDetectionResult:
        if buttons_bgr is None or buttons_bgr.size == 0:
            return ButtonDetectionResult(
                is_hero_turn=False,
                has_fold=False,
                has_check_or_call=False,
                has_bet_or_raise=False,
                available_actions=[],
                confidence=0.0
            )

        h, w = buttons_bgr.shape[:2]
        if h < 10 or w < 20:
            return ButtonDetectionResult(
                is_hero_turn=False,
                has_fold=False,
                has_check_or_call=False,
                has_bet_or_raise=False,
                available_actions=[],
                confidence=0.0
            )

        total_pixels = h * w
        b = buttons_bgr[:, :, 0]
        g = buttons_bgr[:, :, 1]
        r = buttons_bgr[:, :, 2]

        # Orange / Gold button (Bet / Raise)
        orange_mask = (r > 150) & (g >= 95) & (b < 100) & (r >= (g.astype(np.int32) * 1.05))
        # Pure Red button (Fold)
        red_mask = (r > 130) & (g < 95) & (r > g.astype(np.int32) * 1.5) & (r > b.astype(np.int32) * 1.5)
        # Green button (Check / Call)
        green_mask = (g > 110) & (g > r.astype(np.int32) * 1.2) & (g > b.astype(np.int32) * 1.1)

        red_pixels = int(np.sum(red_mask))
        green_pixels = int(np.sum(green_mask))
        orange_pixels = int(np.sum(orange_mask))

        min_pixels = max(15, int(total_pixels * 0.015))

        has_fold = red_pixels >= min_pixels
        has_check_or_call = green_pixels >= min_pixels
        has_bet_or_raise = orange_pixels >= min_pixels

        available_actions: List[str] = []
        if has_fold:
            available_actions.append('fold')
        if has_check_or_call:
            available_actions.extend(['check', 'call'])
        if has_bet_or_raise:
            available_actions.extend(['bet', 'raise'])

        is_hero_turn = len(available_actions) > 0
        coverage = (red_pixels + green_pixels + orange_pixels) / total_pixels
        confidence = min(0.99, round(0.80 + min(0.18, coverage * 2), 2)) if is_hero_turn else 0.0

        return ButtonDetectionResult(
            is_hero_turn=is_hero_turn,
            has_fold=has_fold,
            has_check_or_call=has_check_or_call,
            has_bet_or_raise=has_bet_or_raise,
            available_actions=available_actions,
            confidence=confidence
        )

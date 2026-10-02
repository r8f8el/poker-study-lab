import pytest
import numpy as np
import cv2
from services.vision.card_detector.card_classifier import (
    CardClassifier,
    CardDetectionResult,
    RANKS,
    SUITS
)


def create_synthetic_card_image(rank_char: str = 'A', suit_color: str = 'black', width: int = 65, height: int = 95) -> np.ndarray:
    """Creates a synthetic BGR card image with white background, rank text, and suit patch."""
    img = np.full((height, width, 3), 250, dtype=np.uint8)

    # Draw border
    cv2.rectangle(img, (0, 0), (width - 1, height - 1), (150, 150, 150), 1)

    # Draw rank in top-left
    font = cv2.FONT_HERSHEY_SIMPLEX
    color = (20, 20, 220) if suit_color == 'red' else (20, 20, 20)
    cv2.putText(img, rank_char, (6, 26), font, 0.75, color, 2, cv2.LINE_AA)

    # Draw suit shape below rank
    if suit_color == 'red':
        # Diamond shape
        pts = np.array([[16, 38], [24, 48], [16, 58], [8, 48]], np.int32)
        cv2.fillPoly(img, [pts], (20, 20, 220))
    else:
        # Spade shape (triangle + base)
        pts = np.array([[16, 38], [24, 52], [8, 52]], np.int32)
        cv2.fillPoly(img, [pts], (20, 20, 20))
        cv2.rectangle(img, (14, 52), (18, 56), (20, 20, 20), -1)

    return img


def test_card_classifier_templates_initialization():
    classifier = CardClassifier()
    assert len(classifier.rank_templates) == 13
    for r in RANKS:
        assert r in classifier.rank_templates
        assert classifier.rank_templates[r].shape == (32, 24)


def test_detect_empty_slot():
    classifier = CardClassifier()
    # Green poker felt
    felt = np.zeros((95, 65, 3), dtype=np.uint8)
    felt[:] = (59, 78, 6)  # BGR emerald felt

    result = classifier.classify_crop(felt)
    assert result.visual_state == 'EMPTY'
    assert result.card_label is None
    assert result.confidence >= 0.95


def test_detect_card_back():
    classifier = CardClassifier()
    # Deep blue patterned back
    back = np.zeros((95, 65, 3), dtype=np.uint8)
    back[:] = (138, 58, 30)

    result = classifier.classify_crop(back)
    assert result.visual_state == 'CARD_BACK'
    assert result.card_label is None
    assert result.confidence >= 0.90


def test_detect_visible_card_rank_and_suit():
    classifier = CardClassifier(min_confidence=0.80)
    card_img = create_synthetic_card_image('A', 'black')

    result = classifier.classify_crop(card_img)
    assert result.visual_state == 'VISIBLE_CARD'
    assert result.rank == 'A'
    assert result.suit in ['s', 'c']
    assert result.confidence >= 0.80
    assert result.card_label is not None


def test_detect_red_diamond_card():
    classifier = CardClassifier(min_confidence=0.80)
    card_img = create_synthetic_card_image('K', 'red')

    result = classifier.classify_crop(card_img)
    assert result.visual_state == 'VISIBLE_CARD'
    assert result.suit in ['d', 'h']
    assert result.rank is not None


def test_never_hallucinates_on_tiny_or_noisy_input():
    classifier = CardClassifier()

    # Empty array
    res_empty = classifier.classify_crop(np.zeros((0, 0, 3), dtype=np.uint8))
    assert res_empty.visual_state == 'EMPTY'
    assert res_empty.card_label is None

    # Tiny array
    res_tiny = classifier.classify_crop(np.ones((10, 10, 3), dtype=np.uint8))
    assert res_tiny.visual_state == 'UNKNOWN'
    assert res_tiny.card_label is None
    assert res_tiny.confidence == 0.0

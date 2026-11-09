import numpy as np
import pytest
from services.vision.ocr.pot_ocr import PotOcr, PotOcrResult


def test_pot_ocr_empty_input():
    empty_img = np.zeros((30, 80, 3), dtype=np.uint8)
    res = PotOcr.recognize_pot(empty_img)
    assert res.value is None
    assert res.glyph_count == 0


def test_pot_ocr_gold_pot_16():
    # Construct synthetic 16 image in gold/yellow BGR
    img = np.zeros((20, 40, 3), dtype=np.uint8)

    # '1' at x: 10..14, y: 5..14
    img[5:15, 11:14] = [40, 180, 220]  # BGR gold
    img[14, 10:15] = [40, 180, 220]

    # '6' at x: 20..27, y: 5..14
    img[5:15, 20:23] = [40, 180, 220]
    img[9:15, 25:28] = [40, 180, 220]
    img[5, 20:28] = [40, 180, 220]
    img[9, 20:28] = [40, 180, 220]
    img[14, 20:28] = [40, 180, 220]

    res = PotOcr.recognize_pot(img)
    assert res.value == 16
    assert res.glyph_count == 2
    assert res.confidence >= 0.50

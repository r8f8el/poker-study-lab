"""
Poker Study Lab - Pot and Stack Number OCR Engine (Python Service)
Fast, offline, deterministic text recognition for poker pots, stacks, and bet amounts.
"""

from dataclasses import dataclass
from typing import Optional, List
import numpy as np
import cv2
import re


@dataclass
class PotOcrResult:
    raw_text: str
    value: Optional[float]
    confidence: float
    glyph_count: int


def _interpret_money(raw: str) -> Optional[float]:
    """Accept 48,00 / 16 / 2.5K. Reject a one-place fragment such as 0.7."""
    if not raw:
        return None
    match = re.fullmatch(r"(\d+)(?:[.,](\d+))?([KM])?", raw)
    if not match:
        return None
    whole, decimals, suffix = match.group(1), match.group(2) or "", match.group(3)
    if len(whole) < 2 and len(decimals) != 2 and not suffix:
        return None
    if len(decimals) == 1 and not suffix:
        return None
    if len(decimals) > 2:
        return None
    value = float(f"{whole}.{decimals}" if decimals else whole)
    if suffix == "K":
        value *= 1000
    elif suffix == "M":
        value *= 1_000_000
    if value <= 0:
        return None
    return round(value, 2)


DIGIT_PATTERNS = {
    '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    'M': [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11]
}


class PotOcr:
    """
    Deterministic number OCR tailored for poker table pot and stack regions.
    """

    @classmethod
    def recognize_pot(cls, pot_bgr: np.ndarray) -> PotOcrResult:
        if pot_bgr is None or pot_bgr.size == 0:
            return PotOcrResult(raw_text="", value=None, confidence=0.0, glyph_count=0)

        h, w = pot_bgr.shape[:2]
        if h < 8 or w < 8:
            return PotOcrResult(raw_text="", value=None, confidence=0.0, glyph_count=0)

        # 1. Binarize by text color: bright white or yellow/gold
        b = pot_bgr[:, :, 0]
        g = pot_bgr[:, :, 1]
        r = pot_bgr[:, :, 2]

        is_white = (r > 185) & (g > 185) & (b > 185)
        is_gold = (r > 160) & (g > 130) & (b < 100) & (r > b.astype(np.int32) * 1.4)
        is_cyan = (g > 160) & (b > 130) & (r < 120)

        binary = (is_white | is_gold | is_cyan).astype(np.uint8)
        text_pixels = int(np.sum(binary))

        if text_pixels < 10:
            return PotOcrResult(raw_text="", value=None, confidence=0.0, glyph_count=0)

        # 2. Column projection to find character clusters
        col_ink = np.sum(binary, axis=0)
        segments: List[tuple] = []
        in_char = False
        start_x = 0

        for x in range(w):
            if col_ink[x] > 0 and not in_char:
                in_char = True
                start_x = x
            elif col_ink[x] == 0 and in_char:
                in_char = False
                if x - start_x >= 1:
                    segments.append((start_x, x - 1))
        if in_char and w - start_x >= 1:
            segments.append((start_x, w - 1))

        if not segments:
            return PotOcrResult(raw_text="", value=None, confidence=0.0, glyph_count=0)

        recognized_chars = []
        total_score = 0.0
        valid_glyphs = 0

        for seg_start, seg_end in segments:
            seg_w = seg_end - seg_start + 1
            glyph_crop = binary[:, seg_start:seg_end + 1]

            row_ink = np.sum(glyph_crop, axis=1)
            active_y = np.where(row_ink > 0)[0]
            if len(active_y) == 0:
                continue

            min_y = int(active_y[0])
            max_y = int(active_y[-1])
            glyph_h = max_y - min_y + 1

            # Check if it's a decimal dot near bottom
            if seg_w <= 3 and glyph_h <= 4 and min_y >= h * 0.40:
                recognized_chars.append('.')
                continue

            if glyph_h < 5 or np.sum(glyph_crop) < 5:
                continue

            char_img = glyph_crop[min_y:max_y + 1, :]
            # Rescale to 5x7 matrix
            resized = cv2.resize(char_img, (5, 7), interpolation=cv2.INTER_NEAREST)

            best_char = ""
            best_score = -1.0

            for char, template in DIGIT_PATTERNS.items():
                expected_grid = np.zeros((7, 5), dtype=np.uint8)
                for row_idx in range(7):
                    mask = template[row_idx]
                    for col_idx in range(5):
                        expected_grid[row_idx, col_idx] = (mask >> (4 - col_idx)) & 1

                matches = np.sum(expected_grid == resized)
                intersection = np.sum((expected_grid == 1) & (resized == 1))
                union = np.sum((expected_grid == 1) | (resized == 1))

                score = (matches / 35.0) * 0.5 + ((intersection / union) if union > 0 else 0) * 0.5
                if score > best_score:
                    best_score = float(score)
                    best_char = char

            if best_score >= 0.50:
                recognized_chars.append(best_char)
                total_score += best_score
                valid_glyphs += 1

        raw_str = "".join(recognized_chars)
        clean_str = re.sub(r'^[POTpote$:]+', '', raw_str).strip()

        parsed_val = _interpret_money(clean_str)

        confidence = round(total_score / valid_glyphs, 2) if valid_glyphs > 0 else 0.0

        return PotOcrResult(
            raw_text=raw_str,
            value=parsed_val,
            confidence=confidence,
            glyph_count=valid_glyphs
        )

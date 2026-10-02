"""
Poker Study Lab - Deterministic Card Detector & Template Classifier
Processes card region crops, classifies visual states (EMPTY, CARD_BACK, VISIBLE_CARD, ANIMATION, UNKNOWN),
and extracts Rank and Suit with separate confidence scoring.
"""

from dataclasses import dataclass
from typing import Optional, Tuple, Dict, List
import numpy as np
import cv2


RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
SUITS = ['c', 'd', 'h', 's']  # clubs, diamonds, hearts, spades


@dataclass
class CardDetectionResult:
    visual_state: str  # 'EMPTY', 'CARD_BACK', 'VISIBLE_CARD', 'ANIMATION', 'UNKNOWN'
    rank: Optional[str] = None
    suit: Optional[str] = None
    card_label: Optional[str] = None  # e.g. "As", "Kh"
    confidence: float = 0.0
    rank_confidence: float = 0.0
    suit_confidence: float = 0.0
    reasons: Optional[List[str]] = None

    def __post_init__(self):
        if self.reasons is None:
            self.reasons = []


class CardClassifier:
    """
    Template and feature-based card classifier.
    Designed specifically for deterministic poker table regions.
    """

    def __init__(self, min_confidence: float = 0.85):
        self.min_confidence = min_confidence
        self.rank_templates = self._build_synthetic_rank_templates()

    def classify_crop(self, card_bgr: np.ndarray) -> CardDetectionResult:
        """
        Main pipeline:
        1. Dimension & noise validation
        2. Visual state detection (EMPTY, CARD_BACK, ANIMATION, VISIBLE_CARD)
        3. Rank localization & classification
        4. Suit color & shape classification
        5. Composite confidence score & sanity check
        """
        if card_bgr is None or card_bgr.size == 0:
            return CardDetectionResult(visual_state='EMPTY', confidence=1.0)

        h, w = card_bgr.shape[:2]
        if h < 20 or w < 14:
            return CardDetectionResult(
                visual_state='UNKNOWN',
                confidence=0.0,
                reasons=['Dimensões da imagem muito pequenas para análise.']
            )

        # 1. Visual state analysis
        visual_state, state_conf = self._detect_visual_state(card_bgr)
        if visual_state != 'VISIBLE_CARD':
            return CardDetectionResult(
                visual_state=visual_state,
                confidence=state_conf,
                reasons=[f'Estado visual identificado como {visual_state}.']
            )

        # 2. Rank classification
        rank, rank_conf = self._classify_rank(card_bgr)

        # 3. Suit classification
        suit, suit_conf = self._classify_suit(card_bgr)

        # 4. Composite confidence (geometric mean of rank and suit)
        combined_conf = round(float(np.sqrt(rank_conf * suit_conf)), 3)

        if combined_conf < self.min_confidence or not rank or not suit:
            return CardDetectionResult(
                visual_state='UNKNOWN',
                rank=rank,
                suit=suit,
                confidence=combined_conf,
                rank_confidence=rank_conf,
                suit_confidence=suit_conf,
                reasons=[f'Confiança combinada ({combined_conf:.2f}) abaixo do limite mínimo ({self.min_confidence:.2f}).']
            )

        card_label = f"{rank}{suit}"
        return CardDetectionResult(
            visual_state='VISIBLE_CARD',
            rank=rank,
            suit=suit,
            card_label=card_label,
            confidence=combined_conf,
            rank_confidence=rank_conf,
            suit_confidence=suit_conf,
            reasons=['Carta reconhecida com sucesso.']
        )

    def _detect_visual_state(self, bgr: np.ndarray) -> Tuple[str, float]:
        """
        Distinguishes EMPTY (felt), CARD_BACK, ANIMATION (blur/noise), or VISIBLE_CARD.
        """
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)

        mean_v = np.mean(v)
        mean_s = np.mean(s)
        std_v = np.std(v)

        # Green felt detection: Hue in green range [35, 85], high saturation, darker value
        mean_h = np.mean(h)
        if 35 <= mean_h <= 85 and mean_s > 60 and mean_v < 140:
            return 'EMPTY', 0.98

        # Card Back detection: High blue [95, 135] or high red with repeating pattern & low white area
        white_pixels = np.sum((v > 180) & (s < 50))
        white_ratio = white_pixels / (bgr.shape[0] * bgr.shape[1])

        if white_ratio < 0.20:
            # Check for blue or red card back
            if (100 <= mean_h <= 130 and mean_s > 80) or (mean_h <= 15 and mean_s > 80):
                return 'CARD_BACK', 0.96

        # Animation / motion blur: Very low Laplacian variance
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

        # If contrast is uniform or erratic
        if laplacian_var < 15.0 and white_ratio > 0.4:
            return 'ANIMATION', 0.90

        # Normal visible card must have substantial white/light background (> 25% of area)
        if white_ratio >= 0.20:
            return 'VISIBLE_CARD', 0.98

        return 'UNKNOWN', 0.50

    def _classify_rank(self, card_bgr: np.ndarray) -> Tuple[Optional[str], float]:
        """
        Extracts top-left rank corner, isolates glyph bounding box, and performs normalized cross-correlation.
        """
        h, w = card_bgr.shape[:2]
        # Crop top-left region where rank is located (avoiding the suit below)
        rank_crop = card_bgr[2:int(h * 0.35), 2:int(w * 0.48)]
        gray = cv2.cvtColor(rank_crop, cv2.COLOR_BGR2GRAY)

        # Contrast enhancement & thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Extract largest contour (the rank glyph)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None, 0.0

        largest_contour = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest_contour) < 15:
            return None, 0.0

        gx, gy, gw, gh = cv2.boundingRect(largest_contour)
        glyph = thresh[gy:gy + gh, gx:gx + gw]

        # Resize to standard template dimensions
        resized = cv2.resize(glyph, (24, 32), interpolation=cv2.INTER_AREA)

        best_rank = None
        best_score = -1.0

        for rank, template in self.rank_templates.items():
            res = cv2.matchTemplate(resized, template, cv2.TM_CCOEFF_NORMED)
            score = float(res[0][0])
            if score > best_score:
                best_score = score
                best_rank = rank

        confidence = max(0.0, min(1.0, (best_score + 1.0) / 2.0))
        if best_score > 0.60:
            confidence = round(0.90 + (best_score - 0.60) * 0.24, 3)

        return best_rank, confidence

    def _classify_suit(self, card_bgr: np.ndarray) -> Tuple[Optional[str], float]:
        """
        Extracts suit region, checks red vs black via HSV, then analyzes contour geometry.
        """
        h, w = card_bgr.shape[:2]
        # Suit region is typically in the corner below the rank
        suit_crop = card_bgr[int(h * 0.25):int(h * 0.65), 0:int(w * 0.55)]
        hsv = cv2.cvtColor(suit_crop, cv2.COLOR_BGR2HSV)

        # Red mask (Hearts or Diamonds)
        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 70, 50])
        upper_red2 = np.array([180, 255, 255])

        mask_red = cv2.bitwise_or(
            cv2.inRange(hsv, lower_red1, upper_red1),
            cv2.inRange(hsv, lower_red2, upper_red2)
        )
        red_pixel_count = np.count_nonzero(mask_red)

        # Dark/Black mask (Spades or Clubs)
        lower_black = np.array([0, 0, 0])
        upper_black = np.array([180, 120, 100])
        mask_black = cv2.inRange(hsv, lower_black, upper_black)
        black_pixel_count = np.count_nonzero(mask_black)

        is_red = red_pixel_count > black_pixel_count and red_pixel_count > 15

        target_mask = mask_red if is_red else mask_black
        contours, _ = cv2.findContours(target_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None, 0.0

        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        if area < 10:
            return None, 0.0

        perimeter = cv2.arcLength(largest_contour, True)
        circularity = 4 * np.pi * (area / (perimeter * perimeter)) if perimeter > 0 else 0

        # Geometry analysis:
        # Diamond has high convexity and 4 main vertices
        # Heart has top cleft indentation (convex defect)
        # Club has 3 distinct circular lobes
        # Spade has pointed apex and base stem
        if is_red:
            hull = cv2.convexHull(largest_contour)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / hull_area if hull_area > 0 else 0

            # Diamonds have very high solidity (> 0.88), hearts have indentation (< 0.85)
            if solidity > 0.86:
                return 'd', 0.97
            else:
                return 'h', 0.97
        else:
            # Black suit: Spades vs Clubs
            # Clubs have lower circularity due to three distinct lobes
            if circularity > 0.58:
                return 's', 0.96
            else:
                return 'c', 0.96

    def _build_synthetic_rank_templates(self) -> Dict[str, np.ndarray]:
        """
        Creates clean, high-contrast binary reference templates (24x32)
        for all 13 ranks (A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2)
        with glyph-isolated bounding boxes.
        """
        templates = {}
        for rank in RANKS:
            canvas = np.zeros((48, 48), dtype=np.uint8)
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.85 if rank != 'T' else 0.70
            thickness = 2
            text = rank if rank != 'T' else '10'

            cv2.putText(canvas, text, (6, 36), font, font_scale, 255, thickness, cv2.LINE_AA)
            contours, _ = cv2.findContours(canvas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                x, y, w, h = cv2.boundingRect(largest)
                glyph = canvas[y:y + h, x:x + w]
                templates[rank] = cv2.resize(glyph, (24, 32), interpolation=cv2.INTER_AREA)
            else:
                templates[rank] = cv2.resize(canvas, (24, 32))

        return templates

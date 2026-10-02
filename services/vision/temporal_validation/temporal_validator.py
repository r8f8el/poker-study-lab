"""
Poker Study Lab - Temporal Multi-Frame Validation Engine
Ensures visual hypotheses are confirmed only through multi-frame temporal consensus,
hysteresis protection against single-frame flickers, and animation rejection.
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from collections import deque, Counter
import time
import math


@dataclass
class Observation:
    label: Optional[str]
    confidence: float
    visible: bool
    visual_state: str  # 'EMPTY', 'CARD_BACK', 'VISIBLE_CARD', 'ANIMATION', 'UNKNOWN'
    timestamp: float


@dataclass
class ConfirmedValue:
    label: Optional[str]
    confidence: float
    status: str  # 'CONFIRMED', 'UNCERTAIN', 'EMPTY', 'ANIMATING'
    samples: int
    reason: Optional[str] = None


class TemporalSlotValidator:
    """
    Validates visual readings for a single table slot (e.g. Hero Card 1, Flop 2, Pot)
    over a sliding window of frames.
    """

    def __init__(
        self,
        window_size: int = 7,
        min_consensus: int = 5,
        min_confidence: float = 0.95,
        auto_accept_confidence: float = 0.98,
    ):
        self.window_size = window_size
        self.min_consensus = min_consensus
        self.min_confidence = min_confidence
        self.auto_accept_confidence = auto_accept_confidence

        self._observations: deque[Observation] = deque(maxlen=window_size)
        self._confirmed: Optional[ConfirmedValue] = None
        self._consecutive_new_target: Optional[str] = None
        self._consecutive_new_count = 0

    def add_observation(self, obs: Observation) -> ConfirmedValue:
        """
        Adds a single-frame observation and evaluates temporal consensus.
        """
        self._observations.append(obs)

        # 1. Handle animation state: Suspend validation immediately
        if obs.visual_state == 'ANIMATION':
            # Do not clear previous confirmed card immediately, but status is ANIMATING
            return ConfirmedValue(
                label=self._confirmed.label if self._confirmed else None,
                confidence=0.0,
                status='ANIMATING',
                samples=len(self._observations),
                reason='Animação detectada na mesa. Validador suspenso temporariamente.'
            )

        # 2. Check for empty slot consensus
        empty_count = sum(1 for o in self._observations if o.visual_state == 'EMPTY')
        if empty_count >= self.min_consensus:
            self._confirmed = ConfirmedValue(
                label=None,
                confidence=1.0,
                status='EMPTY',
                samples=empty_count,
                reason='Slot vazio confirmado por consenso temporal.'
            )
            return self._confirmed

        # 3. Filter valid card observations
        valid_obs = [
            o for o in self._observations
            if o.visual_state == 'VISIBLE_CARD' and o.label is not None
        ]

        if not valid_obs:
            return ConfirmedValue(
                label=None,
                confidence=0.0,
                status='UNCERTAIN',
                samples=0,
                reason='Nenhuma leitura visual válida na janela temporal.'
            )

        # Count label frequencies
        label_counts = Counter(o.label for o in valid_obs)
        most_common_label, count = label_counts.most_common(1)[0]

        # Observations matching the majority label
        matching_obs = [o for o in valid_obs if o.label == most_common_label]
        avg_confidence = sum(o.confidence for o in matching_obs) / len(matching_obs)

        # 4. Hysteresis Protection:
        # If we already have a confirmed card, a single or divergent reading cannot overwrite it!
        if self._confirmed and self._confirmed.status == 'CONFIRMED' and obs.label != self._confirmed.label:
            target_label = obs.label or most_common_label
            target_count = label_counts.get(target_label, 0)

            if target_count >= self.min_consensus and avg_confidence >= self.min_confidence and most_common_label == target_label:
                self._confirmed = ConfirmedValue(
                    label=most_common_label,
                    confidence=round(avg_confidence, 4),
                    status='CONFIRMED',
                    samples=target_count,
                    reason=f'Confirmado com {target_count}/{self.window_size} frames consistentes e confiança média {avg_confidence:.2%}.'
                )
                return self._confirmed

            return ConfirmedValue(
                label=self._confirmed.label,
                confidence=self._confirmed.confidence,
                status='CONFIRMED',
                samples=target_count,
                reason=f'Histerese ativa: Leitura divergente [{obs.label}] bloqueada até persistência ({target_count}/{self.min_consensus}).'
            )

        # 5. Consensus threshold verification for non-hysteresis state
        has_consensus = count >= self.min_consensus
        meets_confidence = avg_confidence >= self.min_confidence

        if has_consensus and meets_confidence:
            self._confirmed = ConfirmedValue(
                label=most_common_label,
                confidence=round(avg_confidence, 4),
                status='CONFIRMED',
                samples=count,
                reason=f'Confirmado com {count}/{self.window_size} frames consistentes e confiança média {avg_confidence:.2%}.'
            )
            self._consecutive_new_target = None
            self._consecutive_new_count = 0
            return self._confirmed
        else:
            reason = (
                f'Consenso insuficiente ({count}/{self.min_consensus})'
                if not has_consensus
                else f'Confiança média ({avg_confidence:.2%}) abaixo de {self.min_confidence:.2%}'
            )
            return ConfirmedValue(
                label=most_common_label if count >= 3 else None,
                confidence=round(avg_confidence, 4),
                status='UNCERTAIN',
                samples=count,
                reason=f'Carta incerta: {reason}.'
            )

    def reset(self) -> None:
        """Clears all historical observations and confirmed values."""
        self._observations.clear()
        self._confirmed = None
        self._consecutive_new_target = None
        self._consecutive_new_count = 0

    @property
    def confirmed(self) -> Optional[ConfirmedValue]:
        return self._confirmed


class TemporalCardValidator:
    """
    Coordinates temporal slot validators for Hero cards (2) and Board cards (5).
    """

    def __init__(self, window_size: int = 7, min_consensus: int = 5, min_confidence: float = 0.95):
        self.hero_slots = [
            TemporalSlotValidator(window_size, min_consensus, min_confidence),
            TemporalSlotValidator(window_size, min_consensus, min_confidence)
        ]
        self.board_slots = [
            TemporalSlotValidator(window_size, min_consensus, min_confidence)
            for _ in range(5)
        ]

    def update_hero_cards(self, obs_card1: Observation, obs_card2: Observation) -> Tuple[ConfirmedValue, ConfirmedValue]:
        c1 = self.hero_slots[0].add_observation(obs_card1)
        c2 = self.hero_slots[1].add_observation(obs_card2)
        return c1, c2

    def update_board_slot(self, slot_index: int, obs: Observation) -> ConfirmedValue:
        if 0 <= slot_index < 5:
            return self.board_slots[slot_index].add_observation(obs)
        raise IndexError(f"Board slot index {slot_index} out of range (0-4)")

    def reset_hand(self) -> None:
        """Resets all slots when a new hand begins."""
        for slot in self.hero_slots:
            slot.reset()
        for slot in self.board_slots:
            slot.reset()

    def get_field_confidences(self) -> Dict[str, any]:
        """
        Computes granular field confidences and overall temporal consistency.
        """
        hero_confs = [
            {"value": s.confirmed.label if s.confirmed else None, "confidence": s.confirmed.confidence if s.confirmed else 0.0}
            for s in self.hero_slots
        ]
        board_cards = [
            s.confirmed.label for s in self.board_slots
            if s.confirmed and s.confirmed.status == 'CONFIRMED' and s.confirmed.label is not None
        ]
        board_confs = [
            s.confirmed.confidence for s in self.board_slots
            if s.confirmed and s.confirmed.status == 'CONFIRMED'
        ]
        avg_board_conf = sum(board_confs) / len(board_confs) if board_confs else 1.0

        all_confs = [c["confidence"] for c in hero_confs] + board_confs
        overall_conf = sum(all_confs) / len(all_confs) if all_confs else 0.0

        # Calculate dispersion (standard deviation)
        variance = sum((c - overall_conf) ** 2 for c in all_confs) / len(all_confs) if all_confs else 0.0
        dispersion = math.sqrt(variance)
        temporal_consistency = max(0.0, 1.0 - dispersion)

        return {
            "hero_cards": hero_confs,
            "board": {"value": board_cards, "confidence": round(avg_board_conf, 3)},
            "temporal_consistency": round(temporal_consistency, 3),
            "overall_confidence": round(overall_conf, 3)
        }

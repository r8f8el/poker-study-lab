"""
Advanced RecommendationGate in Python.
Deterministic security and integrity checks before any recommendation is released.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional


class RecommendationGate:
    def __init__(
        self,
        authorized_app: str = "com.auth.poker.client",
        min_confidence: float = 0.95,
    ):
        self.authorized_app = authorized_app
        self.min_confidence = min_confidence

    def evaluate(
        self,
        game_state: Dict[str, Any],
        frame_latency_ms: Optional[float] = None,
        max_latency_ms: float = 2000.0,
    ) -> Dict[str, Any]:
        reasons: List[str] = []

        # 1. Latency limit check
        if frame_latency_ms is not None and frame_latency_ms > max_latency_ms:
            return {
                "allowed": False,
                "reasons": [
                    f"Latência do frame ({frame_latency_ms}ms) excede o limite máximo ({max_latency_ms}ms)."
                ],
                "block_code": "LATENCY_EXCEEDED",
            }

        # 2. Paused check
        if game_state.get("is_paused", False):
            return {
                "allowed": False,
                "reasons": ["Análise pausada pelo operador."],
                "block_code": "PAUSED",
            }

        # 3. Authorized app check
        app_id = game_state.get("app_id", "")
        if app_id != self.authorized_app:
            return {
                "allowed": False,
                "reasons": [
                    f"Janela desautorizada. Esperado [{self.authorized_app}], Observado [{app_id}]."
                ],
                "block_code": "UNAUTHORIZED_APP",
            }

        # 4. Animation in progress
        if game_state.get("is_animation_active", False):
            return {
                "allowed": False,
                "reasons": ["Animação ativa na mesa de pôquer."],
                "block_code": "ANIMATION_IN_PROGRESS",
            }

        # 5. Hero folded check
        hero = game_state.get("hero", {})
        if hero.get("has_folded", False):
            return {
                "allowed": False,
                "reasons": ["Hero já deu fold nesta mão."],
                "block_code": "HERO_FOLDED",
            }

        # 6. Stack integrity check
        hero_stack = hero.get("stack", 100.0)
        if hero_stack < 0:
            return {
                "allowed": False,
                "reasons": ["Inconsistência de stack: Stack negativo."],
                "block_code": "INVALID_STACK",
            }

        if hero.get("is_all_in", False) and hero_stack > 0:
            return {
                "allowed": False,
                "reasons": ["Inconsistência de stack: Jogador All-in com stack remanescente."],
                "block_code": "INVALID_STACK",
            }

        # 7. Active players count check
        players = game_state.get("players", [])
        if players:
            active_players = [p for p in players if not p.get("has_folded", False)]
            if len(active_players) < 2:
                return {
                    "allowed": False,
                    "reasons": ["Menos de 2 jogadores ativos restantes na mesa."],
                    "block_code": "INSUFFICIENT_ACTIVE_PLAYERS",
                }

        # 8. Active player turn check
        active_player = str(game_state.get("active_player", "")).lower()
        if active_player != "hero":
            return {
                "allowed": False,
                "reasons": [f"Vez de outro jogador [{active_player}]."],
                "block_code": "NOT_HERO_TURN",
            }

        # 9. Inconsistent state status check
        status = game_state.get("status", "")
        if status in ("INCONSISTENT", "TRANSITION_UNKNOWN"):
            return {
                "allowed": False,
                "reasons": ["Estado da mesa inconsistente."],
                "block_code": "INCONSISTENT_STATE",
            }

        # 10. Duplicate cards check
        hero_cards = hero.get("cards", [])
        board_cards = game_state.get("board", [])
        all_cards = list(hero_cards) + list(board_cards)
        if len(set(all_cards)) != len(all_cards):
            return {
                "allowed": False,
                "reasons": ["Cartas duplicadas detectadas."],
                "block_code": "INCONSISTENT_STATE",
            }

        # 11. Hole cards count check
        if len(hero_cards) != 2:
            reasons.append("Hero não possui exatamente 2 cartas confirmadas.")

        # 12. Board count check
        street = game_state.get("street", "PREFLOP")
        if street == "PREFLOP" and len(board_cards) != 0:
            reasons.append("Preflop não deve conter cartas no board.")
        elif street == "FLOP" and len(board_cards) != 3:
            reasons.append("Flop requer exatamente 3 cartas comunitárias.")
        elif street == "TURN" and len(board_cards) != 4:
            reasons.append("Turn requer exatamente 4 cartas comunitárias.")
        elif street in ("RIVER", "SHOWDOWN") and len(board_cards) != 5:
            reasons.append("River requer exatamente 5 cartas comunitárias.")

        # 13. Pot check
        pot = float(game_state.get("pot", 0.0))
        if pot <= 0:
            reasons.append("Valor do pote inválido.")

        # 14. Confidence check
        conf = float(game_state.get("confidence", 1.0))
        if conf < self.min_confidence:
            reasons.append(f"Confiança ({round(conf * 100, 1)}%) abaixo do limite ({round(self.min_confidence * 100, 1)}%).")

        if reasons:
            return {
                "allowed": False,
                "reasons": reasons,
                "block_code": "UNCERTAIN_CARDS",
            }

        return {
            "allowed": True,
            "reasons": ["Critérios de segurança satisfeitos."],
            "block_code": None,
        }

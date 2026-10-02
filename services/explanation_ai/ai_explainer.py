"""Pedagogical AI Explanation Service for Poker Study Lab.

Strict Rule:
The Explainer is purely educational and analytical. It CANNOT modify,
override, or bypass the deterministic engine's decision or frequencies.
"""

from dataclasses import dataclass, field
from datetime import datetime
import time
from typing import Dict, List, Optional


@dataclass
class AIExplanationRequest:
    hand_id: str
    stage: str
    hero_cards: List[str]
    board: List[str]
    pot_size: float
    to_call: float
    equity: float
    pot_odds: float
    primary_action: str
    action_frequencies: Dict[str, float]
    opponent_range_profile: str
    strategic_factors: List[str]
    is_gate_open: bool
    gate_reasons: Optional[List[str]] = None


@dataclass
class AIExplanationPayload:
    summary: str
    concept_summary: str
    tactical_rationale: str
    alternative_lines: List[str]
    risk_and_uncertainty: List[str]
    confidence: float
    is_ai_generated: bool
    source_label: str
    latency_ms: int
    timestamp: str
    decision: str
    factors: List[str]
    alternatives: List[str]
    uncertainties: List[str]


class AIExplainer:
    """Explains deterministic poker decisions with poker theory heuristics and LLM fallback."""

    def __init__(self, api_key: Optional[str] = None, endpoint: Optional[str] = None):
        self.api_key = api_key
        self.endpoint = endpoint
        self._cache: Dict[str, AIExplanationPayload] = {}

    def explain(self, req: AIExplanationRequest) -> AIExplanationPayload:
        """Generates structured pedagogical explanation.

        Never alters req.primary_action or req.action_frequencies.
        """
        start_time = time.perf_counter()
        cache_key = self._build_cache_key(req)

        if cache_key in self._cache:
            cached = self._cache[cache_key]
            return cached

        # 1. Gate closed safeguard
        if not req.is_gate_open:
            result = self._build_gate_closed_explanation(req, start_time)
            self._cache[cache_key] = result
            return result

        # 2. Heuristic offline rule-based explainer (deterministic, safe, instant)
        result = self._generate_heuristic_explanation(req, start_time)
        self._cache[cache_key] = result
        return result

    def clear_cache(self) -> None:
        self._cache.clear()

    def _build_cache_key(self, req: AIExplanationRequest) -> str:
        return (
            f"{req.hand_id}_{req.stage}_{''.join(req.hero_cards)}_{''.join(req.board)}_"
            f"{req.primary_action}_{req.opponent_range_profile}_{req.is_gate_open}_"
            f"{round(req.equity * 100)}_{round(req.pot_odds * 100)}"
        )

    def _build_gate_closed_explanation(
        self, req: AIExplanationRequest, start_time: float
    ) -> AIExplanationPayload:
        reasons_str = (
            "; ".join(req.gate_reasons)
            if req.gate_reasons
            else "Aguardando confirmação de integridade visual pelo Recommendation Gate."
        )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        now_iso = datetime.utcnow().isoformat()

        alternatives = [
            "Aguarde a finalização de animações ou transições de fichas.",
            "Utilize a Correção Manual (F2) caso cartas estejam incertas ou obscurecidas.",
            "Verifique se o cliente autorizado de poker não está minimizado ou fora de foco.",
        ]
        risks = [
            "ALERTA: Decisões tomadas com gate bloqueado apresentam risco elevado de dados incorretos.",
            "O sistema nunca infere cartas com rótulo UNKNOWN para manter 100% de precisão teórica.",
        ]

        concept = "Salvaguarda de Integridade & Confiabilidade (Recommendation Gate)"
        tactical = (
            f"O motor determinístico reteve a exibição de ações ativas porque o Recommendation Gate "
            f"detectou impedimento de segurança. Motivo: {reasons_str}. Nenhuma ação física é recomendada."
        )

        return AIExplanationPayload(
            summary="Análise suspensa por proteção do Recommendation Gate.",
            concept_summary=concept,
            tactical_rationale=tactical,
            alternative_lines=alternatives,
            risk_and_uncertainty=risks,
            confidence=1.0,
            is_ai_generated=False,
            source_label="offline_heuristic",
            latency_ms=elapsed_ms,
            timestamp=now_iso,
            decision=req.primary_action,
            factors=req.strategic_factors,
            alternatives=alternatives,
            uncertainties=risks,
        )

    def _generate_heuristic_explanation(
        self, req: AIExplanationRequest, start_time: float
    ) -> AIExplanationPayload:
        action = req.primary_action.lower()
        equity_pct = f"{req.equity * 100:.1f}%"
        pot_odds_pct = f"{req.pot_odds * 100:.1f}%"
        profile = req.opponent_range_profile.upper()
        stage = req.stage

        is_wet = self._is_board_wet(req.board)
        alternatives: List[str] = []
        risks: List[str] = []

        if req.to_call == 0 and action == "check":
            concept = "Realização Gratuita de Equidade (Free Showdown Value)"
            tactical = (
                f"Sem custo imediato para continuar ($0 to call) no {stage}, o check maximiza a "
                f"realização da sua equidade de {equity_pct} sem inflar o pote fora de posição ou "
                f"com mão de força média."
            )
            alternatives.append("Se o vilão der check atrás, reavalie a street seguinte para probe bets.")
            if is_wet:
                risks.append("Bordo com textura conectada: cartas futuras podem completar draws do vilão.")
        elif action == "fold":
            concept = "Fold Disciplinado (EV Negativo por Pot Odds Desfavoráveis)"
            tactical = (
                f"Sua equidade de {equity_pct} é matematicamente insuficiente para cobrir os pot odds "
                f"de {pot_odds_pct} exigidos para pagar. Contra a distribuição do perfil {profile}, "
                f"o call representa perda contínua no longo prazo (-EV)."
            )
            alternatives.append("Em caso de leituras específicas de blefe desbalanceado, reconsidere bluff-catchers.")
            risks.append("Evite pagar apostas fora de odds sem implied odds proporcionais ao stack restante.")
        elif action == "call":
            if req.equity >= req.pot_odds:
                concept = "Call por Pot Odds Favoráveis (EV+ Direto)"
                tactical = (
                    f"Sua equidade estimada ({equity_pct}) excede a probabilidade mínima exigida pelo "
                    f"pote ({pot_odds_pct}). O investimento imediato tem retorno matematicamente positivo (+EV)."
                )
                alternatives.append("Em posição (IP), pagar mantém o range de blefe do vilão aberto para o river.")
            else:
                concept = "Call por Implied Odds (Odds Implícitas)"
                tactical = (
                    f"A equidade imediata ({equity_pct}) é marginal para os pot odds ({pot_odds_pct}), "
                    f"mas as implied odds contra o stack efetivo do vilão sustentam a permanência."
                )
                alternatives.append("Se não conectar seu draw no turn/river, prepare-se para desistir de forma disciplinada.")
                risks.append("Atenção a Reverse Implied Odds se seu draw puder formar uma mão dominada.")
        elif action in ("bet", "raise", "all_in"):
            if req.equity >= 0.55:
                concept = "Aposta por Valor Linear (Value Bet Direta)"
                tactical = (
                    f"Com forte equidade ({equity_pct}) frente ao range de {profile}, a agressão "
                    f"extrai fichas de combinações inferiores que continuam pagando."
                )
                alternatives.append("Contra Calling Stations, utilize dimensionamentos maiores (75%-100% do pote).")
                if is_wet:
                    risks.append("Bordo dinâmico: cobre caro para cobrar o preço de draws concorrentes.")
            else:
                concept = "Semi-Blefe com Fold Equity & Saídas Futuras"
                tactical = (
                    f"Com equidade intermediária ({equity_pct}) e outs para melhorar, a aposta gera fold equity "
                    f"imediata e mantém a iniciativa estratégica da mão."
                )
                alternatives.append("Se encontrar resistência pesada (check-raise), desacelere dependendo do SPR.")
                risks.append("Vilões passivos do tipo Calling Station raramente desistem para semi-blefes.")
        else:
            concept = "Ajuste Estratégico de Frequência Balanceada"
            tactical = f"A linha recomendada equilibra sua frequência de {action.upper()} respeitando a estratégia GTO de referência."

        # Profile specific considerations
        if "NIT" in profile or "ROCK" in profile:
            alternatives.append("Vilão Nit: demonstrou agressão? Presuma topo de range e descarte mãos intermediárias.")
        elif "STATION" in profile:
            alternatives.append("Vilão Calling Station: nunca blefe; explore apostas por valor máximo.")
        elif "LAG" in profile:
            alternatives.append("Vilão LAG: mãos sólidas devem induzir blefes no lugar de apostas que afugentem.")

        if not risks:
            risks.append("Mantenha controle posicional e observe o dimensionamento das apostas.")

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        now_iso = datetime.utcnow().isoformat()
        summary = f"Decisão [{action.upper()}]: {concept}. Equidade {equity_pct} vs Pot Odds {pot_odds_pct}."

        return AIExplanationPayload(
            summary=summary,
            concept_summary=concept,
            tactical_rationale=tactical,
            alternative_lines=alternatives,
            risk_and_uncertainty=risks,
            confidence=0.95 if req.equity > 0 else 0.8,
            is_ai_generated=False,
            source_label="offline_heuristic",
            latency_ms=elapsed_ms,
            timestamp=now_iso,
            decision=req.primary_action,
            factors=req.strategic_factors,
            alternatives=alternatives,
            uncertainties=risks,
        )

    def _is_board_wet(self, board: List[str]) -> bool:
        if len(board) < 2:
            return False
        suits = [c[-1] for c in board if len(c) >= 2]
        suit_counts = {s: suits.count(s) for s in set(suits)}
        return any(cnt >= 2 for cnt in suit_counts.values())

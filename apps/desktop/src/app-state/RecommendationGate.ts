import {
  GameState,
  RecommendationGateResult,
  AppSettings,
  PlayerState
} from '../../../../packages/shared-types/src';

export interface GateEvaluationOptions {
  frameLatencyMs?: number;
  maxLatencyMs?: number;
}

export class RecommendationGate {
  private settings: AppSettings;

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  public updateSettings(settings: AppSettings): void {
    this.settings = settings;
  }

  public evaluate(
    gameState: GameState,
    options?: GateEvaluationOptions
  ): RecommendationGateResult {
    const reasons: string[] = [];

    // 1. Latency limit verification (anti-staleness)
    const maxLatency = options?.maxLatencyMs ?? 2000;
    if (options?.frameLatencyMs !== undefined && options.frameLatencyMs > maxLatency) {
      return {
        allowed: false,
        reasons: [
          `Latência do frame (${options.frameLatencyMs}ms) excede o limite máximo de segurança (${maxLatency}ms). Decisão bloqueada para evitar recomendações obsoletas.`
        ],
        blockCode: 'LATENCY_EXCEEDED'
      };
    }

    // 2. Check if paused
    if (gameState.isPaused) {
      return {
        allowed: false,
        reasons: ['Análise pausada pelo operador.'],
        blockCode: 'PAUSED'
      };
    }

    // 3. Check authorized app identifier
    if (gameState.app_id !== this.settings.authorizedAppIdentifier) {
      return {
        allowed: false,
        reasons: [
          `Janela não reconhecida como aplicativo autorizado. Esperado: [${this.settings.authorizedAppIdentifier}], Observado: [${gameState.app_id}].`
        ],
        blockCode: 'UNAUTHORIZED_APP'
      };
    }

    // 4. Animation in progress check
    if (gameState.isAnimationActive) {
      return {
        allowed: false,
        reasons: ['Animação visual detectada na mesa. Aguardando estabilização dos elementos.'],
        blockCode: 'ANIMATION_IN_PROGRESS'
      };
    }

    // 5. Hero folded check
    if (gameState.hero.isFolded) {
      return {
        allowed: false,
        reasons: ['Hero já efetuou fold nesta mão. Nenhuma recomendação necessária.'],
        blockCode: 'HERO_FOLDED'
      };
    }

    // 6. Stack integrity checks
    if (gameState.hero.stack < 0) {
      return {
        allowed: false,
        reasons: ['Inconsistência de stack: Stack do Hero não pode ser negativo.'],
        blockCode: 'INVALID_STACK'
      };
    }

    if (gameState.hero.isAllIn && gameState.hero.stack > 0) {
      return {
        allowed: false,
        reasons: [
          `Inconsistência de stack: Hero marcado como All-in mas possui stack positivo ($${gameState.hero.stack}).`
        ],
        blockCode: 'INVALID_STACK'
      };
    }

    // 7. Active players count check
    if (gameState.players && gameState.players.length > 0) {
      const activeInHand = gameState.players.filter((p: PlayerState) => !p.isFolded);
      if (activeInHand.length < 2) {
        return {
          allowed: false,
          reasons: [
            `Menos de 2 jogadores ativos restantes na mão (${activeInHand.length} ativos). Mão encerrada ou estado incompleto.`
          ],
          blockCode: 'INSUFFICIENT_ACTIVE_PLAYERS'
        };
      }
    }

    // 8. Active player turn check
    if (gameState.active_player.toLowerCase() !== 'hero') {
      return {
        allowed: false,
        reasons: [`Aguardando a vez do jogador Hero. Jogador ativo atual: [${gameState.active_player}].`],
        blockCode: 'NOT_HERO_TURN'
      };
    }

    // 9. Duplicate cards check
    const allCards = [...gameState.hero.cards, ...gameState.board];
    const uniqueCards = new Set(allCards);
    if (uniqueCards.size !== allCards.length) {
      return {
        allowed: false,
        reasons: ['Inconsistência crítica: Cartas duplicadas detectadas entre a mão do Hero e o board.'],
        blockCode: 'INCONSISTENT_STATE'
      };
    }

    // 10. Inconsistent state status check
    if (gameState.status === 'INCONSISTENT' || gameState.status === 'TRANSITION_UNKNOWN') {
      return {
        allowed: false,
        reasons: ['O estado da mesa precisa ser confirmado. Divergência ou transição ambígua detectada.'],
        blockCode: 'INCONSISTENT_STATE'
      };
    }

    // 11. Hole cards count check
    if (gameState.hero.cards.length !== 2) {
      reasons.push('Cartas próprias do Hero não confirmadas (esperado 2 cartas para Texas Hold\'em).');
    }

    // 12. Board card count validity per street
    switch (gameState.street) {
      case 'PREFLOP':
        if (gameState.board.length !== 0) reasons.push('Preflop não deve conter cartas comunitárias.');
        break;
      case 'FLOP':
        if (gameState.board.length !== 3) reasons.push('Flop requer exatamente 3 cartas comunitárias confirmadas.');
        break;
      case 'TURN':
        if (gameState.board.length !== 4) reasons.push('Turn requer exatamente 4 cartas comunitárias confirmadas.');
        break;
      case 'RIVER':
      case 'SHOWDOWN':
        if (gameState.board.length !== 5) reasons.push('River requer exatamente 5 cartas comunitárias confirmadas.');
        break;
    }

    // 13. Pot & Bet consistency checks
    if (gameState.pot <= 0) {
      reasons.push('Valor do pote inválido ou nulo.');
    }

    if (gameState.players && gameState.players.length > 0) {
      const sumRoundBets = gameState.players.reduce((sum: number, p: PlayerState) => sum + (p.currentBet || 0), 0);
      if (sumRoundBets > gameState.pot) {
        reasons.push(`Inconsistência: Soma das apostas da rodada ($${sumRoundBets}) excede o pote total ($${gameState.pot}).`);
      }
    }

    if (!gameState.available_actions || gameState.available_actions.length === 0) {
      reasons.push('Nenhuma ação legal disponível identificada para o Hero.');
    }

    // 14. Confidence threshold check
    const minThreshold = this.settings.minConfidenceTemporalAccept;
    if (gameState.confidence.overall_confidence < minThreshold) {
      reasons.push(
        `Confiança geral (${(gameState.confidence.overall_confidence * 100).toFixed(1)}%) abaixo do limite mínimo permitido (${(minThreshold * 100).toFixed(1)}%).`
      );
    }

    for (const cardConf of gameState.confidence.hero_cards) {
      if (cardConf.confidence < this.settings.minConfidenceProbable) {
        reasons.push(
          `Carta do Hero [${cardConf.value || '?'}] possui baixa confiança (${(cardConf.confidence * 100).toFixed(1)}%).`
        );
      }
    }

    if (reasons.length > 0) {
      return {
        allowed: false,
        reasons,
        blockCode: 'UNCERTAIN_CARDS'
      };
    }

    return {
      allowed: true,
      reasons: ['Todos os critérios de segurança e integridade foram satisfeitos.']
    };
  }
}

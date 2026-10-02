import {
  AIExplanationRequest,
  AIExplanationResult,
  CardString
} from '../../../../packages/shared-types/src';

export interface AIExplanationOptions {
  enableAI?: boolean;
  apiKey?: string;
  endpoint?: string;
  timeoutMs?: number;
  externalApiConsent?: boolean;
}

export class AIExplanationService {
  private cache: Map<string, AIExplanationResult> = new Map();

  /**
   * Generates a pedagogical explanation for the deterministic decision.
   * GUARANTEE: Never alters primary_action or frequencies.
   */
  public async explain(
    request: AIExplanationRequest,
    options: AIExplanationOptions = {}
  ): Promise<AIExplanationResult> {
    const startTime = performance.now();
    const cacheKey = this.buildCacheKey(request);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return {
        ...cached,
        latency_ms: Math.round(performance.now() - startTime)
      };
    }

    // 1. If gate is closed, return deterministic integrity & safety explanation
    if (!request.is_gate_open) {
      const gateExplanation = this.buildGateClosedExplanation(request, startTime);
      this.cache.set(cacheKey, gateExplanation);
      return gateExplanation;
    }

    // 2. If online AI is enabled, explicit consent is granted, and credentials are present
    if (options.enableAI && options.externalApiConsent && options.apiKey && options.endpoint) {
      try {
        const llmResult = await this.callExternalLLM(request, options, startTime);
        if (llmResult) {
          this.cache.set(cacheKey, llmResult);
          return llmResult;
        }
      } catch {
        // Fallback gracefully to offline heuristic explainer on any network/API failure
      }
    }

    // 3. Deterministic rule-based heuristic explainer (0ms, 100% offline, zero hallucination)
    const heuristicResult = this.generateRuleBasedExplanation(request, startTime);
    this.cache.set(cacheKey, heuristicResult);
    return heuristicResult;
  }

  /**
   * Clears in-memory explanation cache (useful upon new hand)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  private buildCacheKey(req: AIExplanationRequest): string {
    return [
      req.hand_id,
      req.stage,
      req.hero_cards.join(''),
      req.board.join(''),
      req.primary_action,
      req.opponent_range_profile,
      req.is_gate_open ? 'open' : 'closed',
      Math.round(req.equity * 100),
      Math.round(req.pot_odds * 100)
    ].join('_');
  }

  private buildGateClosedExplanation(
    req: AIExplanationRequest,
    startTime: number
  ): AIExplanationResult {
    const reasons = req.gate_reasons && req.gate_reasons.length > 0
      ? req.gate_reasons.join('; ')
      : 'Aguardando estabilização e validação temporal do estado da mesa.';

    return {
      summary: 'Análise estratégica suspensa temporariamente por salvaguarda de integridade.',
      concept_summary: 'Salvaguarda de Integridade & Confiabilidade (Recommendation Gate)',
      tactical_rationale:
        `O motor de recomendação está bloqueado pelo Recommendation Gate para prevenir tomadas de decisão precipitadas ou baseadas em dados ruidosos. Motivo detectado: ${reasons}. Nenhuma ação física é recomendada enquanto a visão computacional e o ciclo de vida da janela não atingirem 100% de certeza.`,
      alternative_lines: [
        'Aguarde a conclusão da animação de cartas/fichas no cliente de jogo.',
        'Se o bloqueio persistir por incerteza de visão, use a Correção Manual (F2) para fixar as cartas observadas.',
        'Certifique-se de que a janela autorizada está em foco e não minimizada ou ocluída.'
      ],
      risk_and_uncertainty: [
        'ALERTA: Tomar decisões sem confirmação temporal expõe a leitura a flickering ou cartas truncadas.',
        'O sistema nunca chuta cartas desconhecidas (UNKNOWN) para garantir integridade analítica.'
      ],
      confidence: 1.0,
      is_ai_generated: false,
      source_label: 'offline_heuristic',
      latency_ms: Math.round(performance.now() - startTime),
      timestamp: new Date().toISOString()
    };
  }

  public generateRuleBasedExplanation(
    req: AIExplanationRequest,
    startTime: number
  ): AIExplanationResult {
    const action = req.primary_action;
    const equityPct = (req.equity * 100).toFixed(1);
    const potOddsPct = (req.pot_odds * 100).toFixed(1);
    const profile = req.opponent_range_profile.toUpperCase();
    const stage = req.stage;

    let conceptSummary = 'Relação Pot Odds vs Equidade';
    let rationale = '';
    const alternatives: string[] = [];
    const risks: string[] = [];

    // Analyze board texture
    const boardTexture = this.analyzeBoardTexture(req.board);

    if (req.to_call === 0 && action === 'check') {
      conceptSummary = 'Realização Gratuita de Equidade (Free Showdown Value)';
      rationale = `Com valor a pagar zerado ($0 to call) no ${stage}, o check maximiza a realização da sua equidade estimada de ${equityPct}% sem arriscar fichas adicionais em um bordo ${boardTexture.description}.`;
      alternatives.push('Se o vilão apostar em street subsequente, avalie os pot odds oferecidos antes de continuar.');
      alternatives.push('Uma aposta pequena (1/3 pote) pode ser usada como probe bet contra jogadores excessivamente passivos.');
      if (boardTexture.isWet) {
        risks.push('Bordo dinâmico: cartas futuras podem dar cartas melhores para draws do adversário.');
      }
    } else if (action === 'fold') {
      conceptSummary = 'Fold Disciplinado (EV Negativo por Pot Odds Desfavoráveis)';
      rationale = `Sua equidade estimada (${equityPct}%) é inferior aos Pot Odds exigidos (${potOddsPct}%). Contra o range estimado de um perfil ${profile}, pagar esta aposta apresenta Expectativa de Valor negativa (-EV) a longo prazo.`;
      alternatives.push(`Se o adversário estiver demonstrando frequências anormais de blefe, float ou bluff-catchers marginais ganham valor.`);
      alternatives.push(`Sem odds implícitas claras ou posição, o fold preserva seu stack para spots de maior vantagem teórica.`);
      risks.push('Pagar sem os pot odds necessários corrói a taxa de vitória sustentável (winrate).');
    } else if (action === 'call') {
      if (req.equity >= req.pot_odds) {
        conceptSummary = 'Call por Pot Odds Favoráveis (EV+ Direto)';
        rationale = `Sua equidade de ${equityPct}% supera com folga os Pot Odds exigidos de ${potOddsPct}%. Você precisa vencer pelo menos ${potOddsPct}% das vezes para ter lucro; pagar com ${equityPct}% é uma decisão com lucro garantido a longo prazo (+EV).`;
        alternatives.push('Em posição (IP), manter o pote controlado dá a você a última palavra no street seguinte.');
        alternatives.push('Contra oponentes muito agressivos (LAG), pagar permite que continuem blefando mãos piores.');
      } else {
        conceptSummary = 'Call por Implied Odds (Odds Implícitas em Bordo Dinâmico)';
        rationale = `Embora a equidade imediata de ${equityPct}% esteja ligeiramente abaixo dos pot odds imediatos (${potOddsPct}%), os implied odds potenciais contra o stack do vilão no ${stage} justificam a permanência caso você acerte seus outs.`;
        alternatives.push('Se a carta do turn/river não conectar com seu draw, esteja preparado para desistir sem investir mais fichas.');
        risks.push('Cuidado com Reverse Implied Odds: se sua mão for dominada por um flush maior ou kicker superior.');
      }
    } else if (action === 'bet' || action === 'raise' || action === 'all_in') {
      if (req.equity >= 0.55) {
        conceptSummary = 'Aposta por Valor Linear (Value Bet Direta)';
        rationale = `Com alta equidade (${equityPct}%) contra o range do adversário (${profile}), a aposta extrai valor imediato de mãos piores (pares menores, draws fracos) que o adversário continuará pagando.`;
        alternatives.push('Contra Calling Stations, você pode aumentar o sizing da aposta pois eles raramente foldam.');
        alternatives.push('Contra Nits/Rocks, prepare-se para desacelerar se enfrentar um re-raise expressivo.');
        if (boardTexture.isWet) {
          risks.push('Proteja sua equidade: em bordo conectado, aposte para cobrar caro de flush e straight draws.');
        }
      } else {
        conceptSummary = 'Aposta de Semi-Blefe & Proteção com Fold Equity';
        rationale = `Com equidade moderada (${equityPct}%) e potencial de melhora em streets futuras, a agressão combina Fold Equity imediata com possibilidade de formar a melhor mão no river.`;
        alternatives.push('Se o oponente der call, reavalie no turn/river dependendo da textura da carta que bater.');
        alternatives.push('Evite blefar contra perfis Calling Station, pois sua fold equity cai drasticamente.');
        risks.push('Contra jogadores nits que continuam na mão, seu range de semi-blefe pode estar severamente dominado.');
      }
    }

    // Add profile-specific adjustments
    if (profile.includes('NIT') || profile.includes('ROCK')) {
      alternatives.push('Atenção ao perfil Nit: ranges de continuação são muito estreitos e focados em topo (JJ+, AK).');
    } else if (profile.includes('STATION')) {
      alternatives.push('Atenção ao perfil Calling Station: maximize sizing em apostas de valor e elimine blefes puros.');
    } else if (profile.includes('LAG')) {
      alternatives.push('Atenção ao perfil LAG: induza agressão com mãos sólidas em vez de expulsar blefes cedo.');
    }

    // Default risks if none
    if (risks.length === 0) {
      risks.push('Mantenha disciplina posicional e observe variações nas apostas dos vilões.');
    }

    const summary = `Recomendação [${action.toUpperCase()}]: ${conceptSummary}. Equidade estimada em ${equityPct}% vs Pot Odds de ${potOddsPct}%.`;

    return {
      summary,
      concept_summary: conceptSummary,
      tactical_rationale: rationale,
      alternative_lines: alternatives,
      risk_and_uncertainty: risks,
      confidence: req.equity > 0 ? 0.95 : 0.8,
      is_ai_generated: false,
      source_label: 'offline_heuristic',
      latency_ms: Math.round(performance.now() - startTime),
      timestamp: new Date().toISOString()
    };
  }

  private analyzeBoardTexture(board: CardString[]): { isWet: boolean; description: string } {
    if (board.length === 0) {
      return { isWet: false, description: 'Pré-flop (sem cartas comunitárias)' };
    }

    const suits = board.map(c => c.slice(-1));
    const suitCounts: Record<string, number> = {};
    for (const s of suits) {
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    }
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const isFlushDrawPossible = maxSuitCount >= 2;
    const isMonotone = maxSuitCount >= 3;

    if (isMonotone) {
      return { isWet: true, description: 'Monótono (alto perigo de Flush formado ou Flush Draw forte)' };
    }
    if (isFlushDrawPossible) {
      return { isWet: true, description: 'Conectado com Flush Draw de duas cartas do mesmo naipe' };
    }
    return { isWet: false, description: 'Seco e desfavorável a draws rápidos (Rainbow)' };
  }

  private isValidEndpoint(endpoint?: string): boolean {
    if (!endpoint) return false;
    try {
      const parsed = new URL(endpoint);
      const isHttps = parsed.protocol === 'https:';
      const isLocalhost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1';
      return isHttps || isLocalhost;
    } catch {
      return false;
    }
  }

  private async callExternalLLM(
    request: AIExplanationRequest,
    options: AIExplanationOptions,
    startTime: number
  ): Promise<AIExplanationResult | null> {
    if (!this.isValidEndpoint(options.endpoint)) {
      console.warn(
        `[AIExplanationService] Insecure external endpoint rejected: ${options.endpoint}. Only HTTPS or localhost endpoints are permitted.`
      );
      return null;
    }

    const timeout = options.timeoutMs || 3500;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const promptPayload = {
      role: 'poker_pedagogical_mentor',
      instructions:
        'Explain the deterministic poker decision strictly as an educational mentor. NEVER change or question the primary action or frequencies provided. Output pure JSON matching the specified structure.',
      data: {
        hand_id: request.hand_id,
        stage: request.stage,
        hero_cards: request.hero_cards,
        board: request.board,
        pot_size: request.pot_size,
        to_call: request.to_call,
        equity: request.equity,
        pot_odds: request.pot_odds,
        deterministic_action: request.primary_action,
        deterministic_frequencies: request.action_frequencies,
        opponent_profile: request.opponent_range_profile,
        strategic_factors: request.strategic_factors
      }
    };

    try {
      const response = await fetch(options.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`
        },
        body: JSON.stringify(promptPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      if (json && json.tactical_rationale && json.concept_summary) {
        return {
          summary: json.summary || `Análise IA: ${json.concept_summary}`,
          concept_summary: json.concept_summary,
          tactical_rationale: json.tactical_rationale,
          alternative_lines: Array.isArray(json.alternative_lines) ? json.alternative_lines : [],
          risk_and_uncertainty: Array.isArray(json.risk_and_uncertainty) ? json.risk_and_uncertainty : [],
          confidence: typeof json.confidence === 'number' ? json.confidence : 0.9,
          is_ai_generated: true,
          source_label: 'llm_assistant',
          latency_ms: Math.round(performance.now() - startTime),
          timestamp: new Date().toISOString()
        };
      }
      return null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { AIExplanationService } from '../../apps/desktop/src/ai/AIExplanationService';
import { AIExplanationRequest } from '../../packages/shared-types/src';

describe('AIExplanationService (Incremento 9)', () => {
  let service: AIExplanationService;

  beforeEach(() => {
    service = new AIExplanationService();
    service.clearCache();
  });

  it('deve respeitar a inviolabilidade da ação e frequências determinísticas', async () => {
    const request: AIExplanationRequest = {
      hand_id: 'hand-001',
      stage: 'FLOP',
      hero_cards: ['As', 'Ah'],
      board: ['Kd', '7c', '2s'],
      pot_size: 100,
      to_call: 0,
      equity: 0.85,
      pot_odds: 0,
      primary_action: 'bet',
      action_frequencies: { bet: 0.8, check: 0.2 },
      opponent_range_profile: 'TAG (Tight-Aggressive)',
      strategic_factors: ['Top Pair Overpair', 'Dry Rainbow Board'],
      is_gate_open: true
    };

    const result = await service.explain(request);

    expect(result).toBeDefined();
    // Guarantee: output must explain the exact primary action
    expect(result.summary).toContain('[BET]');
    expect(result.concept_summary).toContain('Aposta por Valor Linear');
    expect(result.tactical_rationale).toContain('85.0%');
    expect(result.is_ai_generated).toBe(false);
    expect(result.source_label).toBe('offline_heuristic');
  });

  it('deve gerar explicação de salvaguarda quando o Recommendation Gate estiver bloqueado', async () => {
    const request: AIExplanationRequest = {
      hand_id: 'hand-002',
      stage: 'TURN',
      hero_cards: ['Ts', '9s'],
      board: ['8s', '7c', '2d', 'Kh'],
      pot_size: 150,
      to_call: 50,
      equity: 0.42,
      pot_odds: 0.25,
      primary_action: 'call',
      action_frequencies: { call: 1.0 },
      opponent_range_profile: 'LAG (Loose-Aggressive)',
      strategic_factors: ['Open-ended straight draw'],
      is_gate_open: false,
      gate_reasons: ['Inconsistência de visão: animação de fichas em trânsito', 'Latência de frame 2100ms > 2000ms']
    };

    const result = await service.explain(request);

    expect(result.concept_summary).toContain('Salvaguarda de Integridade');
    expect(result.tactical_rationale).toContain('Recommendation Gate');
    expect(result.tactical_rationale).toContain('animação de fichas em trânsito');
    expect(result.tactical_rationale).toContain('Latência de frame 2100ms');
    expect(result.alternative_lines.some(l => l.includes('Correção Manual (F2)'))).toBe(true);
    expect(result.risk_and_uncertainty.some(r => r.includes('UNKNOWN'))).toBe(true);
  });

  it('deve identificar EV+ direto quando equidade supera pot odds', async () => {
    const request: AIExplanationRequest = {
      hand_id: 'hand-003',
      stage: 'RIVER',
      hero_cards: ['Qh', 'Qd'],
      board: ['Jh', '8c', '3s', '4d', '2c'],
      pot_size: 200,
      to_call: 50,
      equity: 0.45,
      pot_odds: 0.20, // 50 / (200 + 50) = 0.20
      primary_action: 'call',
      action_frequencies: { call: 0.9, fold: 0.1 },
      opponent_range_profile: 'STATION (Calling Station)',
      strategic_factors: ['Second pair overpair', 'Pot odds favoráveis'],
      is_gate_open: true
    };

    const result = await service.explain(request);

    expect(result.concept_summary).toContain('Call por Pot Odds Favoráveis (EV+ Direto)');
    expect(result.tactical_rationale).toContain('45.0% supera com folga');
    expect(result.alternative_lines.some(l => l.includes('Calling Station'))).toBe(true);
  });

  it('deve identificar fold disciplinado quando equidade é insuficiente para cobrir pot odds', async () => {
    const request: AIExplanationRequest = {
      hand_id: 'hand-004',
      stage: 'TURN',
      hero_cards: ['4s', '5s'],
      board: ['Ad', 'Kc', 'Jd', '9h'],
      pot_size: 300,
      to_call: 200,
      equity: 0.08,
      pot_odds: 0.40,
      primary_action: 'fold',
      action_frequencies: { fold: 1.0 },
      opponent_range_profile: 'NIT / ROCK',
      strategic_factors: ['Draw fraco dominado'],
      is_gate_open: true
    };

    const result = await service.explain(request);

    expect(result.concept_summary).toContain('Fold Disciplinado');
    expect(result.tactical_rationale).toContain('Expectativa de Valor negativa (-EV)');
    expect(result.alternative_lines.some(l => l.includes('Nit'))).toBe(true);
  });

  it('deve utilizar cache em memória para solicitações subsequentes idênticas', async () => {
    const request: AIExplanationRequest = {
      hand_id: 'hand-005',
      stage: 'FLOP',
      hero_cards: ['Kd', 'Qd'],
      board: ['Ad', 'Jd', '2c'],
      pot_size: 80,
      to_call: 0,
      equity: 0.58,
      pot_odds: 0,
      primary_action: 'check',
      action_frequencies: { check: 0.7, bet: 0.3 },
      opponent_range_profile: 'TAG',
      strategic_factors: ['Royal flush draw', 'Free showdown value'],
      is_gate_open: true
    };

    const first = await service.explain(request);
    const second = await service.explain(request);

    expect(first.concept_summary).toBe(second.concept_summary);
    expect(first.summary).toBe(second.summary);
  });

  it('deve realizar fallback transparente caso o endpoint externo de LLM falhe ou não responda', async () => {
    const request: AIExplanationRequest = {
      hand_id: 'hand-006',
      stage: 'PREFLOP',
      hero_cards: ['Ac', 'Kd'],
      board: [],
      pot_size: 30,
      to_call: 10,
      equity: 0.65,
      pot_odds: 0.25,
      primary_action: 'raise',
      action_frequencies: { raise: 0.85, call: 0.15 },
      opponent_range_profile: 'LAG',
      strategic_factors: ['Big slick suited/offsuit', '3-bet value linear'],
      is_gate_open: true
    };

    // Passing invalid endpoint to test graceful fallback
    const result = await service.explain(request, {
      enableAI: true,
      apiKey: 'test-key',
      endpoint: 'http://127.0.0.1:9999/nonexistent-llm',
      timeoutMs: 100
    });

    expect(result).toBeDefined();
    expect(result.source_label).toBe('offline_heuristic');
    expect(result.is_ai_generated).toBe(false);
    expect(result.concept_summary).toContain('Aposta por Valor Linear');
  });
});

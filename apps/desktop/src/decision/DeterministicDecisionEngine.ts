import {
  GameState,
  RecommendationGateResult,
  DecisionRecommendation,
  PokerActionType
} from '../../../../packages/shared-types/src';
import { HandEvaluator, HandEvaluation } from './HandEvaluator';
import { EquityCalculator, EquityResult } from './EquityCalculator';

export interface DecisionEngineOptions {
  opponentCombos?: string[];
  opponentProfileName?: string;
}

export class DeterministicDecisionEngine {
  /**
   * Generates a deterministic decision recommendation based on math (pot odds, equity, position, made hand).
   */
  public static evaluate(
    gameState: GameState,
    gateResult: RecommendationGateResult,
    options?: DecisionEngineOptions
  ): DecisionRecommendation {
    // If gate blocked, recommendation is immediately suppressed
    if (!gateResult.allowed) {
      return {
        action: 'fold',
        frequencies: { fold: 1.0 },
        source: 'reference_strategy',
        confidence: 0,
        explanation_factors: gateResult.reasons.length > 0 ? gateResult.reasons : ['Aguardando confirmação do estado da mesa.'],
        pot_odds: 0,
        equity_estimate: 0,
        gate_result: gateResult
      };
    }

    const heroCards = gameState.hero.cards;
    const boardCards = gameState.board;
    const position = gameState.hero.position || 'BTN';
    const pot = gameState.pot;

    // 1. Evaluate Current Made Hand
    const handEval: HandEvaluation = HandEvaluator.evaluate([...heroCards, ...boardCards]);

    // 2. Determine if facing a bet (amount to call)
    let callAmount = 0;
    const lastAction = gameState.action_history[gameState.action_history.length - 1];
    if (lastAction && (lastAction.action === 'bet' || lastAction.action === 'raise') && lastAction.player !== 'Hero') {
      callAmount = lastAction.amount || Math.round(pot * 0.33);
    } else if (gameState.street === 'PREFLOP') {
      // Facing big blind if not yet called
      callAmount = Math.max(0, gameState.blinds.big - (gameState.hero.currentBet ?? 0));
    }

    // 3. Compute Pot Odds
    const potOdds = EquityCalculator.calculatePotOdds(callAmount, pot);

    // 4. Compute Equity via Fast Monte Carlo (against Range if provided)
    const equityResult: EquityResult =
      options?.opponentCombos && options.opponentCombos.length > 0
        ? EquityCalculator.estimateEquityAgainstRange(heroCards, boardCards, options.opponentCombos, 600)
        : EquityCalculator.estimateEquity(heroCards, boardCards, undefined, 600);
    const heroEquity = equityResult.heroEquity;

    // 5. Strategy Decision Tree & Frequency Matrix
    let action: PokerActionType = 'check';
    const frequencies: Record<string, number> = {};
    const factors: string[] = [];

    // Explanation factors builder
    factors.push(`Mão avaliada: ${handEval.categoryName}`);
    factors.push(`Equity estimada: ${(heroEquity * 100).toFixed(1)}%`);

    if (callAmount > 0) {
      factors.push(`Pot Odds necessários: ${(potOdds * 100).toFixed(1)}% ($${callAmount} para pote de $${pot})`);
    } else {
      factors.push(`Nenhuma aposta pendente (Opção de Check livre)`);
    }

    factors.push(`Posição: ${position}`);

    if (options?.opponentProfileName) {
      factors.push(`Perfil do Adversário: ${options.opponentProfileName}`);
    }

    const isStrongHand = handEval.categoryRank >= 3; // Two pair or better
    const isMonsterHand = handEval.categoryRank >= 5; // Straight or better

    if (callAmount === 0) {
      // Situation A: Can check freely
      if (isMonsterHand) {
        action = 'bet';
        frequencies.bet_66 = 0.60;
        frequencies.bet_33 = 0.25;
        frequencies.check = 0.15;
        factors.push('Mão de valor monstruoso: extração máxima recomendada com aposta de valor');
      } else if (isStrongHand) {
        action = 'bet';
        frequencies.bet_33 = 0.55;
        frequencies.check = 0.45;
        factors.push('Mão forte feita: aposta moderada para proteção e valor fino contra ranges de call');
      } else if (heroEquity >= 0.55) {
        action = 'check';
        frequencies.check = 0.70;
        frequencies.bet_33 = 0.30;
        factors.push('Equity favorável com valor de showdown moderado: controle de pote via check prioritário');
      } else {
        action = 'check';
        frequencies.check = 0.85;
        frequencies.bet_33 = 0.15;
        factors.push('Mão marginal: check livre para ver próxima carta sem inflacionar o pote');
      }
    } else {
      // Situation B: Facing a bet
      const equityEdge = heroEquity - potOdds;

      if (isMonsterHand && equityEdge > 0.20) {
        action = 'raise';
        frequencies.raise = 0.65;
        frequencies.call = 0.35;
        factors.push('Vantagem matemática esmagadora sobre o pote: raise para valor e construção de pote');
      } else if (equityEdge >= 0.10) {
        action = 'call';
        frequencies.call = 0.75;
        frequencies.raise = 0.25;
        factors.push('Equity estimada supera com folga os Pot Odds exigidos: call lucrativo no longo prazo');
      } else if (equityEdge >= 0.0) {
        action = 'call';
        frequencies.call = 0.65;
        frequencies.fold = 0.35;
        factors.push('Equity compatível com os Pot Odds: call defensivo matematicamente aceitável');
      } else if (equityEdge > -0.06) {
        action = 'fold';
        frequencies.fold = 0.60;
        frequencies.call = 0.40;
        factors.push('Pot odds ligeiramente desfavoráveis: fold prudente de frequência mista');
      } else {
        action = 'fold';
        frequencies.fold = 0.85;
        frequencies.call = 0.15;
        factors.push('Equity insuficiente para justificar o investimento no pote: fold matematicamente indicado');
      }
    }

    return {
      action,
      frequencies,
      source: 'reference_strategy',
      confidence: 0.96,
      explanation_factors: factors,
      pot_odds: potOdds,
      equity_estimate: heroEquity,
      gate_result: gateResult
    };
  }
}

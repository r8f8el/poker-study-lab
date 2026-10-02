import {
  CardObservation,
  ConfirmedCardValue,
  FieldConfidence,
  CardString
} from '../../../../packages/shared-types/src';

export class TemporalSlotValidator {
  private windowSize: number;
  private minConsensus: number;
  private minConfidence: number;

  private observations: CardObservation[] = [];
  private confirmed: ConfirmedCardValue | null = null;

  constructor(windowSize = 7, minConsensus = 5, minConfidence = 0.95) {
    this.windowSize = windowSize;
    this.minConsensus = minConsensus;
    this.minConfidence = minConfidence;
  }

  public addObservation(obs: CardObservation): ConfirmedCardValue {
    this.observations.push(obs);
    if (this.observations.length > this.windowSize) {
      this.observations.shift();
    }

    // 1. Animation detection: Suspend validation immediately
    if (obs.visualState === 'ANIMATION') {
      return {
        label: this.confirmed?.label || null,
        confidence: 0,
        status: 'ANIMATING',
        samples: this.observations.length,
        reason: 'Animação visual ativa na mesa. Validador suspenso.'
      };
    }

    // 2. Empty slot verification
    const emptyCount = this.observations.filter(o => o.visualState === 'EMPTY').length;
    if (emptyCount >= this.minConsensus) {
      this.confirmed = {
        label: null,
        confidence: 1.0,
        status: 'EMPTY',
        samples: emptyCount,
        reason: 'Slot vazio confirmado por consenso temporal.'
      };
      return this.confirmed;
    }

    // 3. Filter valid card observations
    const validObs = this.observations.filter(
      o => o.visualState === 'VISIBLE_CARD' && o.label !== null
    );

    if (validObs.length === 0) {
      return {
        label: null,
        confidence: 0,
        status: 'UNCERTAIN',
        samples: 0,
        reason: 'Nenhuma leitura visual válida na janela temporal.'
      };
    }

    // Count frequencies of labels
    const counts: Record<string, number> = {};
    for (const o of validObs) {
      const lbl = o.label!;
      counts[lbl] = (counts[lbl] || 0) + 1;
    }

    let mostCommonLabel: CardString | null = null;
    let maxCount = 0;
    for (const [lbl, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonLabel = lbl as CardString;
      }
    }

    const matchingObs = validObs.filter(o => o.label === mostCommonLabel);
    const avgConfidence =
      matchingObs.reduce((sum, o) => sum + o.confidence, 0) / matchingObs.length;

    // 4. Hysteresis Protection:
    // If a card is already CONFIRMED, a reading differing from it cannot immediately replace it
    if (this.confirmed && this.confirmed.status === 'CONFIRMED' && obs.label !== this.confirmed.label) {
      const newTargetLabel = (obs.label || mostCommonLabel) as CardString;
      const newTargetCount = counts[newTargetLabel] || 0;

      if (newTargetCount >= this.minConsensus && avgConfidence >= this.minConfidence && mostCommonLabel === newTargetLabel) {
        this.confirmed = {
          label: mostCommonLabel,
          confidence: Math.round(avgConfidence * 1000) / 1000,
          status: 'CONFIRMED',
          samples: newTargetCount,
          reason: `Confirmado com ${newTargetCount}/${this.windowSize} frames e confiança ${Math.round(avgConfidence * 100)}%.`
        };
        return this.confirmed;
      }

      return {
        label: this.confirmed.label,
        confidence: this.confirmed.confidence,
        status: 'CONFIRMED',
        samples: newTargetCount,
        reason: `Histerese ativa: Leitura divergente [${obs.label}] ignorada até persistência (${newTargetCount}/${this.minConsensus}).`
      };
    }

    // 5. Consensus and Confidence Check for non-hysteresis state
    const hasConsensus = maxCount >= this.minConsensus;
    const meetsConfidence = avgConfidence >= this.minConfidence;

    if (hasConsensus && meetsConfidence) {
      this.confirmed = {
        label: mostCommonLabel,
        confidence: Math.round(avgConfidence * 1000) / 1000,
        status: 'CONFIRMED',
        samples: maxCount,
        reason: `Confirmado com ${maxCount}/${this.windowSize} frames e confiança ${Math.round(avgConfidence * 100)}%.`
      };
      return this.confirmed;
    }

    const reason = !hasConsensus
      ? `Consenso insuficiente (${maxCount}/${this.minConsensus})`
      : `Confiança média (${Math.round(avgConfidence * 100)}%) abaixo do limite (${Math.round(this.minConfidence * 100)}%)`;

    return {
      label: maxCount >= 3 ? mostCommonLabel : null,
      confidence: Math.round(avgConfidence * 1000) / 1000,
      status: 'UNCERTAIN',
      samples: maxCount,
      reason: `Carta incerta: ${reason}.`
    };
  }

  public reset(): void {
    this.observations = [];
    this.confirmed = null;
  }

  public getConfirmed(): ConfirmedCardValue | null {
    return this.confirmed;
  }
}

export class TemporalTableValidator {
  public heroSlots: [TemporalSlotValidator, TemporalSlotValidator];
  public boardSlots: [
    TemporalSlotValidator,
    TemporalSlotValidator,
    TemporalSlotValidator,
    TemporalSlotValidator,
    TemporalSlotValidator
  ];

  constructor(windowSize = 7, minConsensus = 5, minConfidence = 0.95) {
    this.heroSlots = [
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence),
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence)
    ];
    this.boardSlots = [
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence),
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence),
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence),
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence),
      new TemporalSlotValidator(windowSize, minConsensus, minConfidence)
    ];
  }

  public resetHand(): void {
    this.heroSlots.forEach(s => s.reset());
    this.boardSlots.forEach(s => s.reset());
  }

  public getFieldConfidences(pot = 0, activePlayer = 'hero'): FieldConfidence {
    const hero_cards = this.heroSlots.map(s => {
      const conf = s.getConfirmed();
      return {
        value: conf?.label || null,
        confidence: conf?.confidence || 0
      };
    });

    const confirmedBoard = this.boardSlots
      .map(s => s.getConfirmed())
      .filter(c => c && c.status === 'CONFIRMED' && c.label !== null);

    const boardValues = confirmedBoard.map(c => c!.label as CardString);
    const avgBoardConf =
      confirmedBoard.length > 0
        ? confirmedBoard.reduce((sum, c) => sum + c!.confidence, 0) / confirmedBoard.length
        : 1.0;

    const allCardConfs = [
      ...hero_cards.map(c => c.confidence),
      ...confirmedBoard.map(c => c!.confidence)
    ];

    const overall =
      allCardConfs.length > 0
        ? allCardConfs.reduce((a, b) => a + b, 0) / allCardConfs.length
        : 0.98;

    // Dispersão (Standard Deviation)
    const variance =
      allCardConfs.length > 0
        ? allCardConfs.reduce((sum, c) => sum + Math.pow(c - overall, 2), 0) / allCardConfs.length
        : 0;
    const dispersion = Math.sqrt(variance);
    const temporal_consistency = Math.max(0, 1.0 - dispersion);

    return {
      hero_cards,
      board: {
        value: boardValues,
        confidence: Math.round(avgBoardConf * 1000) / 1000
      },
      pot: {
        value: pot,
        confidence: 0.98
      },
      active_player: {
        value: activePlayer,
        confidence: 0.99
      },
      temporal_consistency: Math.round(temporal_consistency * 1000) / 1000,
      overall_confidence: Math.round(overall * 1000) / 1000
    };
  }
}

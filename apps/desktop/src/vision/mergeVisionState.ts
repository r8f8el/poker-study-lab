import { GameState, TableStatus, normalizeHeroCards } from '../../../../packages/shared-types/src';
import { VisionDetectionResult } from './TableVisionAnalyzer';

/**
 * Folds one vision result into the previous table state.
 * An unread pot (potValue === null) must not become 0: the optical pot reader
 * does not parse digits, and writing 0 both displays a fake pot and closes
 * the recommendation gate.
 */
export function mergeVisionIntoGameState(
  prev: GameState,
  detection: VisionDetectionResult,
  nextStatus: TableStatus
): GameState {
  if (detection.isAnimationActive) {
    return {
      ...prev,
      isAnimationActive: true,
      status: 'TRANSITION_UNKNOWN',
      confidence: {
        ...prev.confidence,
        overall_confidence: 0
      },
      lastUpdated: new Date().toISOString()
    };
  }

  const potKnown = detection.potValue !== null && detection.potValue > 0 && detection.potConfidence >= 0.55;
  const pot = potKnown ? (detection.potValue as number) : prev.pot;
  const heroTurnKnown = detection.isHeroTurn === true && detection.availableActions.length > 0;

  return {
    ...prev,
    hero: {
      ...prev.hero,
      cards: normalizeHeroCards(detection.heroCards)
    },
    board: detection.boardCards,
    pot,
    street: detection.street,
    status: nextStatus,
    active_player: heroTurnKnown ? 'hero' : detection.isHeroTurn === false ? 'waiting' : prev.active_player,
    available_actions: heroTurnKnown ? detection.availableActions : detection.isHeroTurn === false ? [] : prev.available_actions,
    isAnimationActive: false,
    confidence: {
      ...prev.confidence,
      hero_cards: [
        { value: detection.heroCards[0] || '', confidence: detection.heroConfidences[0] },
        { value: detection.heroCards[1] || '', confidence: detection.heroConfidences[1] }
      ],
      board: {
        value: detection.boardCards,
        confidence: detection.boardConfidence
      },
      pot: potKnown
        ? { value: pot, confidence: detection.potConfidence }
        : prev.confidence.pot,
      temporal_consistency: detection.temporalConsistency,
      overall_confidence: detection.confidence
    },
    lastUpdated: new Date().toISOString()
  };
}

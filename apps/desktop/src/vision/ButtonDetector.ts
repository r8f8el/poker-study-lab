/**
 * Action button detector: identifies active player action buttons (Fold, Check, Call, Bet, Raise)
 * from the table's action_buttons ROI.
 */

export interface ButtonDetectionResult {
  isHeroTurn: boolean;
  hasFold: boolean;
  hasCheckOrCall: boolean;
  hasBetOrRaise: boolean;
  availableActions: ('fold' | 'check' | 'call' | 'bet' | 'raise')[];
  confidence: number;
}

export class ButtonDetector {
  /**
   * Analyzes the action_buttons ROI to detect active button clusters.
   */
  public static detectActionButtons(
    pixelData: Uint8ClampedArray,
    width: number,
    height: number
  ): ButtonDetectionResult {
    if (width < 20 || height < 10 || pixelData.length < width * height * 4) {
      return {
        isHeroTurn: false,
        hasFold: false,
        hasCheckOrCall: false,
        hasBetOrRaise: false,
        availableActions: [],
        confidence: 0
      };
    }

    const totalPixels = width * height;
    let redButtonPixels = 0;
    let greenButtonPixels = 0;
    let orangeButtonPixels = 0;

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];

      // Orange / Yellow / Gold button (Bet / Raise)
      if (r > 150 && g >= 95 && b < 100 && r >= g * 1.05) {
        orangeButtonPixels++;
      }
      // Pure Red button (Fold)
      else if (r > 130 && g < 95 && r > g * 1.5 && r > b * 1.5) {
        redButtonPixels++;
      }
      // Green button (Check / Call)
      else if (g > 110 && g > r * 1.2 && g > b * 1.1) {
        greenButtonPixels++;
      }
    }

    const minButtonPixels = Math.max(15, Math.floor(totalPixels * 0.015));

    const hasFold = redButtonPixels >= minButtonPixels;
    const hasCheckOrCall = greenButtonPixels >= minButtonPixels;
    const hasBetOrRaise = orangeButtonPixels >= minButtonPixels;

    const availableActions: ('fold' | 'check' | 'call' | 'bet' | 'raise')[] = [];
    if (hasFold) availableActions.push('fold');
    if (hasCheckOrCall) availableActions.push('check', 'call');
    if (hasBetOrRaise) availableActions.push('bet', 'raise');

    // If at least one active action button is found, it is Hero's turn
    const isHeroTurn = availableActions.length > 0;
    const buttonPixelCoverage = (redButtonPixels + greenButtonPixels + orangeButtonPixels) / totalPixels;
    const confidence = isHeroTurn
      ? Math.min(0.99, Math.round((0.80 + Math.min(0.18, buttonPixelCoverage * 2)) * 100) / 100)
      : 0;

    return {
      isHeroTurn,
      hasFold,
      hasCheckOrCall,
      hasBetOrRaise,
      availableActions,
      confidence
    };
  }
}

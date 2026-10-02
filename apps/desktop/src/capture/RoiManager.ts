import { RectRegion, TableLayoutProfile } from '../../../../packages/shared-types/src';
import { DEFAULT_LAYOUT_PROFILE } from '../../../../packages/test-fixtures/src';

export interface CardRegions {
  hero_card_1: RectRegion;
  hero_card_2: RectRegion;
  board_flop_1: RectRegion;
  board_flop_2: RectRegion;
  board_flop_3: RectRegion;
  board_turn: RectRegion;
  board_river: RectRegion;
  pot: RectRegion;
  action_buttons: RectRegion;
}

export class RoiManager {
  private activeProfile: TableLayoutProfile;

  constructor(profile: TableLayoutProfile = DEFAULT_LAYOUT_PROFILE) {
    this.activeProfile = profile;
  }

  public getProfile(): TableLayoutProfile {
    return this.activeProfile;
  }

  public setProfile(profile: TableLayoutProfile): void {
    this.activeProfile = profile;
  }

  public updateRegion(regionKey: keyof TableLayoutProfile['regions'], newBounds: RectRegion): void {
    if (regionKey === 'players') return;
    this.activeProfile.regions[regionKey] = newBounds;
  }

  /**
   * Computes scaled pixel bounding boxes based on the actual captured frame resolution.
   */
  public getComputedCardRegions(frameWidth: number, frameHeight: number): CardRegions {
    const scaleX = frameWidth / this.activeProfile.referenceResolution.width;
    const scaleY = frameHeight / this.activeProfile.referenceResolution.height;

    const scaleRect = (r: RectRegion): RectRegion => ({
      x: Math.round(r.x * scaleX),
      y: Math.round(r.y * scaleY),
      width: Math.round(r.width * scaleX),
      height: Math.round(r.height * scaleY)
    });

    const heroRoi = scaleRect(this.activeProfile.regions.hero_cards);
    const boardRoi = scaleRect(this.activeProfile.regions.board);
    const potRoi = scaleRect(this.activeProfile.regions.pot);
    const buttonsRoi = scaleRect(this.activeProfile.regions.action_buttons);

    // Hero cards split (card 1 on left, card 2 on right)
    const heroCardWidth = Math.round(heroRoi.width / 2);
    const hero_card_1: RectRegion = {
      x: heroRoi.x,
      y: heroRoi.y,
      width: heroCardWidth,
      height: heroRoi.height
    };
    const hero_card_2: RectRegion = {
      x: heroRoi.x + heroCardWidth,
      y: heroRoi.y,
      width: heroCardWidth,
      height: heroRoi.height
    };

    // Board split into 5 equal card slots
    const boardSlotWidth = Math.round(boardRoi.width / 5);
    const board_flop_1: RectRegion = {
      x: boardRoi.x,
      y: boardRoi.y,
      width: boardSlotWidth,
      height: boardRoi.height
    };
    const board_flop_2: RectRegion = {
      x: boardRoi.x + boardSlotWidth,
      y: boardRoi.y,
      width: boardSlotWidth,
      height: boardRoi.height
    };
    const board_flop_3: RectRegion = {
      x: boardRoi.x + boardSlotWidth * 2,
      y: boardRoi.y,
      width: boardSlotWidth,
      height: boardRoi.height
    };
    const board_turn: RectRegion = {
      x: boardRoi.x + boardSlotWidth * 3,
      y: boardRoi.y,
      width: boardSlotWidth,
      height: boardRoi.height
    };
    const board_river: RectRegion = {
      x: boardRoi.x + boardSlotWidth * 4,
      y: boardRoi.y,
      width: boardSlotWidth,
      height: boardRoi.height
    };

    return {
      hero_card_1,
      hero_card_2,
      board_flop_1,
      board_flop_2,
      board_flop_3,
      board_turn,
      board_river,
      pot: potRoi,
      action_buttons: buttonsRoi
    };
  }
}

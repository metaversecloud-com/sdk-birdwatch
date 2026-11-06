import type { Bird, GameStateResponse } from "@shared/types/index.js";

export const SET_HAS_INTERACTIVE_PARAMS = "SET_HAS_INTERACTIVE_PARAMS";
export const SET_GAME_STATE = "SET_GAME_STATE";
export const SET_ERROR = "SET_ERROR";
export const SET_PROFILE = "SET_PROFILE";

export type InteractiveParams = {
  assetId: string;
  displayName: string;
  identityId: string;
  interactiveNonce: string;
  interactivePublicKey: string;
  profileId: string;
  sceneDropId: string;
  uniqueName: string;
  urlSlug: string;
  username: string;
  visitorId: string;
};

export type VisitorBadge = { id: string; name: string; icon: string };
export type VisitorBirdItem = { id: string; name: string; birdId?: string; icon: string };
export type EcosystemBadge = { id: string; name: string; icon: string; description: string };

export interface InitialState {
  isAdmin?: boolean;
  error: string;
  hasInteractiveParams?: boolean;
  gameState?: GameStateResponse;
  visitorInventory?: Record<string, VisitorBadge>;
  visitorBirdItems?: Record<string, VisitorBirdItem>;
  badgeCatalog?: Record<string, EcosystemBadge>;
  profileId?: string;
  displayName?: string;
}

export type ActionType = {
  type: string;
  payload: Partial<InitialState>;
};

export type ErrorType =
  | string
  | {
      message?: string;
      response?: { data?: { error?: { message?: string }; message?: string } };
    };

export interface ResultDataType {
  outcome: "new_species" | "repeat" | "wrong";
  rightBird: Bird;
  pickedBird: Bird;
  timesSpotted?: number;
  newTotalSightings?: number;
  yourSpeciesCount?: number;
}

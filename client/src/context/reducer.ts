import { ActionType, InitialState, SET_ERROR, SET_GAME_STATE, SET_HAS_INTERACTIVE_PARAMS, SET_MYSTERY_BIRD } from "./types";

const globalReducer = (state: InitialState, action: ActionType) => {
  const { type, payload } = action;
  switch (type) {
    case SET_HAS_INTERACTIVE_PARAMS:
      return {
        ...state,
        hasInteractiveParams: true,
      };
    case SET_GAME_STATE:
      return {
        ...state,
        isAdmin: payload.isAdmin,
        gameState: payload.gameState,
        visitorInventory: payload.visitorInventory,
        visitorBirdItems: payload.visitorBirdItems,
        badgeCatalog: payload.badgeCatalog,
        profileId: payload.profileId,
        displayName: payload.displayName,
        error: "",
      };
    case SET_MYSTERY_BIRD:
      // Apply a /mystery/guess result without refetching the whole game state.
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: { ...state.gameState, mysteryBird: payload.mysteryBird },
      };
    case SET_ERROR:
      return {
        ...state,
        error: payload.error || "",
      };
    default: {
      throw new Error(`Unhandled action type: ${type}`);
    }
  }
};

export { globalReducer };

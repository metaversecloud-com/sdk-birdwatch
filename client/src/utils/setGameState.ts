import { ActionType, SET_GAME_STATE } from "@/context/types";
import { Dispatch } from "react";

/** Expects a server response: { success, data, visitorInventory, visitorBirdItems, profileId, displayName } */
export const setGameState = (dispatch: Dispatch<ActionType> | null, response: any) => {
  if (!dispatch) return;
  dispatch({
    type: SET_GAME_STATE,
    payload: {
      gameState: response?.data,
      isAdmin: response?.data?.isAdmin,
      visitorInventory: response?.visitorInventory,
      visitorBirdItems: response?.visitorBirdItems,
      badgeCatalog: response?.badgeCatalog,
      profileId: response?.profileId,
      displayName: response?.displayName,
    },
  });
};

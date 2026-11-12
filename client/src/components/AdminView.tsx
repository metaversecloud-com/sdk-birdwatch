import { useContext } from "react";
import { AdminSettingsPanel } from "./AdminSettingsPanel";
import { GlobalDispatchContext } from "@/context/GlobalContext";
import { backendAPI, setGameState, setErrorMessage } from "@/utils";
import type { ErrorType } from "@/context/types";

/**
 * Rendered by PageContainer when `showSettings === true`. The user closes the
 * admin view via the gear icon in AdminIconButton (standard pattern).
 */
export const AdminView = () => {
  const dispatch = useContext(GlobalDispatchContext);

  const refresh = async () => {
    try {
      const r = await backendAPI.get("/game-state", { params: { refresh: true } });
      setGameState(dispatch, r.data);
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    }
  };

  return <AdminSettingsPanel onRefresh={refresh} />;
};
export default AdminView;

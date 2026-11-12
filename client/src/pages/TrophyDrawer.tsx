import { useContext, useState } from "react";

// components
import { PageContainer } from "@/components";
import { LeaderboardTab, BadgesTab } from "@/components";

// context
import { GlobalDispatchContext } from "@/context/GlobalContext";
import { ErrorType } from "@/context/types";

// utils
import { backendAPI, setGameState, setErrorMessage } from "@/utils";

type Tab = "lb" | "badges";

export const TrophyDrawer = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const [tab, setTab] = useState<Tab>("lb");
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = async () => {
    try {
      const r = await backendAPI.get("/game-state", { params: { refresh: true } });
      setGameState(dispatch, r.data);
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    }
  };

  const reset = async () => {
    try {
      await backendAPI.post("/admin/reset-leaderboard");
      await refresh();
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    } finally {
      setConfirmReset(false);
    }
  };

  return (
    <PageContainer isLoading={false} headerText="Trophy">
      <div className="bw-tabs mb-3">
        <button className={`bw-tab${tab === "lb" ? " bw-tab--active" : ""}`} onClick={() => setTab("lb")}>
          Leaderboard
        </button>
        <button className={`bw-tab${tab === "badges" ? " bw-tab--active" : ""}`} onClick={() => setTab("badges")}>
          Badges
        </button>
      </div>
      {tab === "lb" && <LeaderboardTab onReset={() => setConfirmReset(true)} />}
      {tab === "badges" && <BadgesTab />}
      {confirmReset && (
        <div className="bw-card mt-3">
          <strong>Reset Leaderboard?</strong>
          <p className="bw-subtitle">
            Everyone's species count for this leaderboard will start over from zero. Field Guides, badges and the Bird
            Count are not affected.
          </p>
          <div className="flex gap-2">
            <button className="bw-btn-outline" onClick={() => setConfirmReset(false)}>
              Keep Leaderboard
            </button>
            <button className="bw-btn-danger" onClick={reset}>
              Reset Leaderboard
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
export default TrophyDrawer;

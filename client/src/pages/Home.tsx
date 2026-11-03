import { useContext, useState } from "react";
import { useSearchParams } from "react-router-dom";

// components
import { PageContainer } from "@/components";
import { WorldBirdCountTab, FieldGuideTab, BirdPage, AdminSettingsPanel } from "@/components";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType } from "@/context/types";

// utils
import { backendAPI, setGameState, setErrorMessage } from "@/utils";

import type { Bird } from "@shared/types";

type Tab = "wbc" | "fg";
type Panel = "tabs" | "admin";

/**
 * Home — the Key Asset drawer (World Bird Count + Field Guide tabs, admin gear).
 * Routing: `/` maps here. `/spot` and `/trophy` are separate routes mounted in App.tsx.
 */
export const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);
  console.log("🚀 ~ Home.tsx:27 ~ gameState:", gameState);
  const [searchParams] = useSearchParams();
  // Initial tab honors `?tab=fg` so SpotDrawer's "Open Field Guide" button lands on the right tab.
  const initialTab: Tab = searchParams.get("tab") === "fg" ? "fg" : "wbc";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [panel, setPanel] = useState<Panel>("tabs");
  const [openBird, setOpenBird] = useState<Bird | null>(null);

  const refresh = async () => {
    try {
      const r = await backendAPI.get("/game-state");
      setGameState(dispatch, r.data);
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    }
  };

  if (panel === "admin") {
    return (
      <PageContainer isLoading={false} headerText="Birdwatch · Settings">
        <AdminSettingsPanel onBack={() => setPanel("tabs")} onRefresh={refresh} />
      </PageContainer>
    );
  }

  return (
    <PageContainer isLoading={!gameState} headerText="Birdwatch">
      <div className="bw-tabs mb-3">
        <button className={`bw-tab${tab === "wbc" ? " bw-tab--active" : ""}`} onClick={() => setTab("wbc")}>
          World Bird Count
        </button>
        <button className={`bw-tab${tab === "fg" ? " bw-tab--active" : ""}`} onClick={() => setTab("fg")}>
          Field Guide
        </button>
      </div>
      {tab === "wbc" && <WorldBirdCountTab onOpenFieldGuide={() => setTab("fg")} />}
      {tab === "fg" && <FieldGuideTab onOpenBird={(bird) => setOpenBird(bird)} />}
      {openBird && <BirdPage bird={openBird} onClose={() => setOpenBird(null)} />}
    </PageContainer>
  );
};

export default Home;

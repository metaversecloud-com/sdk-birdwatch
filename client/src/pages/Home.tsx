import { useContext, useState } from "react";
import { useSearchParams } from "react-router-dom";

// components
import { PageContainer } from "@/components";
import { WorldBirdCountTab, FieldGuideTab, BirdPage, AdminSettingsPanel, MysteryBirdTab } from "@/components";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType } from "@/context/types";

// utils
import { backendAPI, setGameState, setErrorMessage, trackEvent } from "@/utils";

import type { Bird } from "@shared/types";

type Tab = "wbc" | "fg" | "mb";
type Panel = "tabs" | "admin";

/**
 * Home — the Key Asset drawer (World Bird Count, Field Guide and Mystery Bird tabs, admin gear).
 * Routing: `/` maps here. `/spot` and `/trophy` are separate routes mounted in App.tsx.
 */
export const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);
  const [searchParams] = useSearchParams();
  // Initial tab honors `?tab=fg` / `?tab=mb` so SpotDrawer's "Open Field Guide" button lands on the right tab.
  const tabParam = searchParams.get("tab");
  const initialTab: Tab = tabParam === "fg" || tabParam === "mb" ? tabParam : "wbc";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [panel, setPanel] = useState<Panel>("tabs");
  const [openBird, setOpenBird] = useState<Bird | null>(null);

  const openFieldGuide = () => {
    if (tab !== "fg") trackEvent("fieldGuideOpens");
    setTab("fg");
  };
  const openBirdPage = (bird: Bird) => {
    trackEvent("fieldGuidePageViews");
    setOpenBird(bird);
  };

  const refresh = async () => {
    try {
      const r = await backendAPI.get("/game-state", { params: { refresh: true } });
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

  const mystery = gameState?.mysteryBird;
  // Shown on the other tabs until the player is done with today's Mystery Bird.
  const mysteryCta = mystery?.status === "playing" && (
    <button className="bw-btn-mystery mb-3" onClick={() => setTab("mb")}>
      Guess Today's Mystery Bird
    </button>
  );

  return (
    <PageContainer isLoading={!gameState} headerText="Birdwatch">
      <div className="bw-tabs mb-3">
        <button className={`bw-tab${tab === "wbc" ? " bw-tab--active" : ""}`} onClick={() => setTab("wbc")}>
          World Bird Count
        </button>
        <button className={`bw-tab${tab === "fg" ? " bw-tab--active" : ""}`} onClick={openFieldGuide}>
          Field Guide
        </button>
        {mystery && (
          <button className={`bw-tab${tab === "mb" ? " bw-tab--active" : ""}`} onClick={() => setTab("mb")}>
            Mystery Bird
          </button>
        )}
      </div>
      {tab !== "mb" && mysteryCta}
      {tab === "wbc" && <WorldBirdCountTab onOpenFieldGuide={openFieldGuide} />}
      {tab === "fg" && <FieldGuideTab onOpenBird={openBirdPage} />}
      {tab === "mb" && <MysteryBirdTab />}
      {openBird && <BirdPage bird={openBird} onClose={() => setOpenBird(null)} />}
    </PageContainer>
  );
};

export default Home;

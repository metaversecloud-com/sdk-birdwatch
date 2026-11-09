import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// components
import { PageContainer } from "@/components";
import { BirdSightingCard, BirdPage, CooldownScreen } from "@/components";
import { ResultView } from "@/components/sightingResult";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType, ResultDataType } from "@/context/types";

// utils
import { backendAPI, setErrorMessage } from "@/utils";

import { SPOT_LABELS } from "@shared/types";
import type { Bird, SpotKey, VisitorInFlightSighting } from "@shared/types";

type Phase = "idle" | "sighting" | "result";

export const SpotDrawer = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const openFieldGuide = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "fg");
    navigate({ pathname: "/", search: next.toString() });
  };

  const [phase, setPhase] = useState<Phase>("idle");
  const [sighting, setSighting] = useState<VisitorInFlightSighting | null>(null);
  const [result, setResult] = useState<ResultDataType | null>(null);
  const [openBird, setOpenBird] = useState<Bird | null>(null);
  const [spot, setSpot] = useState<SpotKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Also re-run when the cooldown countdown reaches 0, to bring up the next bird.
  const startSighting = useCallback(async () => {
    try {
      const r = await backendAPI.post("/sightings/start");
      setSpot(r.data?.data?.spot ?? null);
      const next = r.data?.data?.sighting;
      // No sighting means the spot is still resting: show the cooldown screen.
      if (next) {
        setSighting(next);
        setPhase("sighting");
      } else setPhase("idle");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.response?.status === 400) {
        // Cooldown without an in-flight sighting
        setPhase("idle");
      } else setErrorMessage(dispatch, e as ErrorType);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    // Wait for App.tsx to finish setupBackendAPI AND its bootstrap /game-state fetch.
    if (!gameState) return;
    startSighting();
  }, [gameState, startSighting]);

  const pick = async (pickedBirdId: string) => {
    setSubmitting(true);
    try {
      const r = await backendAPI.post("/sightings/resolve", { pickedBirdId });
      setResult(r.data?.data);
      setPhase("result");
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    } finally {
      setSubmitting(false);
    }
  };

  const mode = gameState?.adminSettings?.identificationMode || "description";

  return (
    <PageContainer isLoading={loading} headerText={spot ? SPOT_LABELS[spot] : "Bird spot"}>
      {phase === "sighting" && sighting && (
        <BirdSightingCard sighting={sighting} mode={mode} onPick={pick} disabled={submitting} />
      )}
      {phase === "result" && result && (
        <ResultView
          result={result}
          onDone={() => setPhase("idle")}
          onCooldownReady={startSighting}
          onOpenFieldGuide={openFieldGuide}
          onSeeFieldGuidePage={() => setOpenBird(result.rightBird)}
        />
      )}
      {phase === "idle" && !loading && <CooldownScreen onOpenFieldGuide={openFieldGuide} onReady={startSighting} />}
      {openBird && <BirdPage bird={openBird} onClose={() => setOpenBird(null)} />}
    </PageContainer>
  );
};

export default SpotDrawer;

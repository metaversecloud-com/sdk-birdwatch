import { useContext, useEffect, useState } from "react";
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

import type { Bird, VisitorInFlightSighting } from "@shared/types";

type Phase = "idle" | "sighting" | "result";

export const SpotDrawer = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const assetId = searchParams.get("assetId") || "";

  // Navigate to Home with the Field Guide tab pre-selected, preserving the session
  // credentials carried on the URL.
  const openFieldGuide = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "fg");
    navigate({ pathname: "/", search: next.toString() });
  };

  const [phase, setPhase] = useState<Phase>("idle");
  const [sighting, setSighting] = useState<VisitorInFlightSighting | null>(null);
  const [result, setResult] = useState<ResultDataType | null>(null);
  const [openBird, setOpenBird] = useState<Bird | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Wait for App.tsx to finish setupBackendAPI AND its bootstrap /game-state fetch.
    // Without this, the first POST goes out through bare axios (no `/api` baseURL),
    // Vite's dev server returns 404, and no server log appears.
    if (!gameState) return;
    const bootstrap = async () => {
      try {
        const r = await backendAPI.post("/sightings/start");
        setSighting(r.data?.data?.sighting);
        setPhase("sighting");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (e?.response?.status === 400) {
          // Cooldown without an in-flight sighting
          setPhase("idle");
        } else setErrorMessage(dispatch, e as ErrorType);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [dispatch, gameState]);

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
    <PageContainer isLoading={loading} headerText="Bird spot">
      {phase === "sighting" && sighting && (
        <BirdSightingCard sighting={sighting} mode={mode} onPick={pick} disabled={submitting} />
      )}
      {phase === "result" && result && (
        <ResultView
          result={result}
          onDone={() => setPhase("idle")}
          assetId={assetId}
          onOpenFieldGuide={openFieldGuide}
          onSeeFieldGuidePage={() => setOpenBird(result.rightBird)}
        />
      )}
      {phase === "idle" && !loading && <CooldownScreen assetId={assetId} onOpenFieldGuide={openFieldGuide} />}
      {openBird && <BirdPage bird={openBird} onClose={() => setOpenBird(null)} />}
    </PageContainer>
  );
};

export default SpotDrawer;

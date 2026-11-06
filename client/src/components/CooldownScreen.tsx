import { useEffect, useState } from "react";
import { backendAPI } from "@/utils";
import { Spinner } from "./Spinner";

interface SpotStatus {
  assetId: string;
  spot: string;
  label: string;
  foundInCollection: number;
  totalInCollection: number;
  cooldownRemainingSeconds: number;
  isReady: boolean;
}

const mmss = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

export const CooldownScreen = ({ assetId, onOpenFieldGuide }: { assetId: string; onOpenFieldGuide: () => void }) => {
  const [remaining, setRemaining] = useState<number>(0);
  const [spotsToTry, setSpotsToTry] = useState<SpotStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    backendAPI
      .get(`/cooldown/${assetId}`)
      .then((r) => {
        setRemaining(r.data?.data?.remainingSeconds ?? 0);
        setSpotsToTry(r.data?.data?.spotsToTry ?? []);
      })
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  if (loading) return <Spinner label="Checking..." />;

  return (
    <div className="bw-card flex flex-col gap-3">
      <h3 className="m-0 text-center">The birds are resting.</h3>
      {remaining > 0 && (
        <p className="bw-count__total bw-count__total--primary text-center" role="timer">
          {mmss(remaining)}
        </p>
      )}
      {spotsToTry.length > 0 && (
        <>
          <p className="bw-caption text-center">Spots to try meanwhile</p>
          <div className="grid gap-2">
            {spotsToTry.map((s) => (
              <div key={s.assetId} className="bw-card flex items-center gap-2 p-2">
                <div className="" aria-hidden="true">
                  🌲
                </div>
                <div className="flex-1">
                  <strong>{s.label}</strong>
                </div>
                <div className="grid gap-1 text-right">
                  {!s.isReady && (
                    <span className="bw-status--resting">Resting · {mmss(s.cooldownRemainingSeconds)}</span>
                  )}
                  <span className="bw-caption">
                    {s.foundInCollection}/{s.totalInCollection} found
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm">or</p>
        </>
      )}
      <button className="bw-btn-outline" onClick={onOpenFieldGuide}>
        Open Field Guide
      </button>
    </div>
  );
};
export default CooldownScreen;

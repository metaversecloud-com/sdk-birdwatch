import { useContext, useState } from "react";
import { backendAPI, setErrorMessage } from "@/utils";
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType } from "@/context/types";
import type { CooldownOption, IdentificationMode } from "@shared/types";
import { COOLDOWN_OPTIONS } from "@shared/types";

const COOLDOWN_LABELS: Record<CooldownOption, string> = {
  60: "1 min",
  120: "2 min",
  300: "5 min",
  3600: "1 hour",
};

export const AdminSettingsPanel = ({ onBack, onRefresh }: { onBack?: () => void; onRefresh: () => void }) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);
  const s = gameState?.adminSettings;
  const [mode, setMode] = useState<IdentificationMode>(s?.identificationMode || "description");
  const [cd, setCd] = useState<CooldownOption>((s?.cooldownSeconds as CooldownOption) || 60);
  const [links, setLinks] = useState<boolean>(s?.allAboutBirdsLinksEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await backendAPI.post("/admin/settings", {
        identificationMode: mode,
        cooldownSeconds: cd,
        allAboutBirdsLinksEnabled: links,
      });
      onRefresh();
      onBack?.();
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    } finally {
      setSaving(false);
    }
  };

  const resetCount = async () => {
    try {
      await backendAPI.post("/admin/reset-bird-count");
      onRefresh();
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    } finally {
      setConfirmReset(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {onBack && (
        <button className="bw-btn-ghost" onClick={onBack}>
          ‹ Back
        </button>
      )}
      <div className="bw-card">
        <strong>Identification mode</strong>
        <div className="flex flex-col gap-2 mt-2">
          {(["description", "picture_match"] as IdentificationMode[]).map((v) => (
            <label key={v} className="flex items-start gap-2">
              <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} />
              <span>
                <strong>{v === "description" ? "Description" : "Picture Match"}</strong>
                <br />
                <span className="bw-subtitle">
                  {v === "description"
                    ? "Default. Names and descriptions; grades 3+."
                    : "Adds a picture to each choice; younger kids."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="bw-card">
        <strong>Bird spot cooldown</strong>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {COOLDOWN_OPTIONS.map((opt) => (
            <label key={opt} className={`bw-pill-radio${cd === opt ? " bw-pill-radio--active" : ""}`}>
              <input type="radio" name="cd" checked={cd === opt} onChange={() => setCd(opt)} />
              {COOLDOWN_LABELS[opt]}
            </label>
          ))}
        </div>
      </div>

      <div className="bw-card">
        <strong>Links to All About Birds</strong>
        <label className="flex items-center gap-2 mt-2">
          <input type="checkbox" checked={links} onChange={(e) => setLinks(e.target.checked)} />
          Show "Learn more" links on bird pages
        </label>
      </div>

      <button className="bw-btn-primary" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>

      <div className="bw-card grid gap-2">
        <strong>Reset World Bird Count</strong>
        <p className="bw-subtitle">
          Clears every Collection's counts, milestones, most-spotted and rarest sighting in this world. Field Guides,
          badges and the leaderboard are not affected.
        </p>
        {!confirmReset ? (
          <button className="bw-btn-outline bw-btn-outline--danger" onClick={() => setConfirmReset(true)}>
            Reset World Bird Count
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="bw-btn-outline" onClick={() => setConfirmReset(false)}>
              Keep Count
            </button>
            <button className="bw-btn-danger" onClick={resetCount}>
              Reset Count
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default AdminSettingsPanel;

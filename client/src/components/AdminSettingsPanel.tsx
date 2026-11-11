import { useContext, useState } from "react";
import { backendAPI, setErrorMessage } from "@/utils";
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType } from "@/context/types";
import type { CooldownOption, IdentificationMode, MilestoneConfig, MilestoneDifficulty } from "@shared/types";
import {
  COOLDOWN_OPTIONS,
  DEFAULT_MILESTONES,
  MILESTONE_DIFFICULTIES,
  milestonesForDifficulty,
  milestonesSkippedBySwitch,
} from "@shared/types";

const COOLDOWN_LABELS: Record<CooldownOption, string> = {
  60: "1 min",
  120: "2 min",
  300: "5 min",
  3600: "1 hour",
};

const DIFFICULTY_TEXT: Record<MilestoneDifficulty, { label: string; hint: string }> = {
  easy: { label: "Easy", hint: "Half the goals. Good for small groups or short events." },
  default: { label: "Default", hint: "The standard goals." },
  hard: { label: "Hard", hint: "Double the goals. For big or long-running worlds." },
};

const formatGoals = (c: MilestoneConfig) => [c.m1, c.m2, c.m3].map((g) => g.toLocaleString()).join(" / ");

export const AdminSettingsPanel = ({ onBack, onRefresh }: { onBack?: () => void; onRefresh: () => void }) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);
  const s = gameState?.adminSettings;
  const [mode, setMode] = useState<IdentificationMode>(s?.identificationMode || "description");
  const [cd, setCd] = useState<CooldownOption>((s?.cooldownSeconds as CooldownOption) || 60);
  const [links, setLinks] = useState<boolean>(s?.allAboutBirdsLinksEnabled !== false);
  const currentMilestones = gameState?.milestones;
  const currentDifficulty = currentMilestones?.difficulty || "default";
  const [difficulty, setDifficulty] = useState<MilestoneDifficulty | "custom">(currentDifficulty);
  const totalSightings = gameState?.worldState?.totalSightings || 0;
  const difficultyChanged = difficulty !== "custom" && difficulty !== currentDifficulty;
  // A switch can't make a milestone that isn't reached yet count as reached, since it would
  // never fire (no toast, no Champion Birder badge).
  const skipped = difficultyChanged
    ? milestonesSkippedBySwitch(
        currentMilestones?.config || DEFAULT_MILESTONES,
        milestonesForDifficulty(difficulty),
        totalSightings,
      )
    : [];
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await backendAPI.post("/admin/settings", {
        identificationMode: mode,
        cooldownSeconds: cd,
        allAboutBirdsLinksEnabled: links,
        ...(difficultyChanged ? { milestoneDifficulty: difficulty } : {}),
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

      <div className="bw-card">
        <strong>Milestone difficulty</strong>
        <p className="bw-subtitle">World Bird Count goals for the three milestones.</p>
        <div className="flex flex-col gap-2 mt-2">
          {MILESTONE_DIFFICULTIES.map((v) => (
            <label key={v} className="flex items-start gap-2">
              <input type="radio" name="difficulty" checked={difficulty === v} onChange={() => setDifficulty(v)} />
              <span>
                <strong>{DIFFICULTY_TEXT[v].label}</strong> · {formatGoals(milestonesForDifficulty(v))}
                <br />
                <span className="bw-subtitle">{DIFFICULTY_TEXT[v].hint}</span>
              </span>
            </label>
          ))}
          {currentDifficulty === "custom" && currentMilestones && (
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="difficulty"
                checked={difficulty === "custom"}
                onChange={() => setDifficulty("custom")}
              />
              <span>
                <strong>Custom</strong> · {formatGoals(currentMilestones.config)}
                <br />
                <span className="bw-subtitle">Set for this world. Pick another option to replace it.</span>
              </span>
            </label>
          )}
        </div>
        {skipped.length > 0 && difficulty !== "custom" && (
          <p className="bw-settings-error" role="alert">
            The World Bird Count is already {totalSightings.toLocaleString()}, so{" "}
            {DIFFICULTY_TEXT[difficulty].label} would unlock{" "}
            {skipped.length === 1 ? "a milestone" : `${skipped.length} milestones`} without celebrating{" "}
            {skipped.length === 1 ? "it" : "them"}. Pick a harder option.
          </p>
        )}
      </div>

      <button className="bw-btn-primary" onClick={save} disabled={saving || skipped.length > 0}>
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

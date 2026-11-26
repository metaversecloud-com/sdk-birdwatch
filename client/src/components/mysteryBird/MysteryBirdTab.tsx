import { useContext, useState } from "react";

// components
import { BirdFact, BirdToken } from "@/components";
import { MysteryCandidateCard } from "./MysteryCandidateCard";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType, SET_MYSTERY_BIRD } from "@/context/types";

// utils
import { backendAPI, discoveredBirdImage, setErrorMessage } from "@/utils";
import { nawbById, nawbCollection } from "@/data/nawb";
import { clueFactKind } from "@/data/factIcons";

import { MAX_MYSTERY_GUESSES, SPOT_LABELS } from "@shared/types";
import type { MysteryBirdView } from "@shared/types";

const NEXT_PUZZLE_TEXT = "A new Mystery Bird starts at 12:00 AM ET.";

/**
 * Mystery Bird tab: three clues, four candidates (the answer + 3 decoys that each match
 * some clues), two guesses a day. The answer is only sent by the server once the player
 * is done (solved or out of guesses).
 */
export const MysteryBirdTab = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState, visitorBirdItems } = useContext(GlobalStateContext);
  const mystery = gameState?.mysteryBird;
  const [openClue, setOpenClue] = useState<number | null>(null);
  const [openBirdId, setOpenBirdId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!mystery) return null;

  const isPlaying = mystery.status === "playing";
  const answer = mystery.answerId ? nawbById[mystery.answerId] : undefined;
  const answerFound = Boolean(answer && visitorBirdItems?.[answer.id]);

  const guess = async (pickedBirdId: string) => {
    setSubmitting(true);
    try {
      const r = await backendAPI.post("/mystery/guess", { collectionId: mystery.collectionId, pickedBirdId });
      const next = r.data?.data?.mysteryBird as MysteryBirdView | undefined;
      if (next) dispatch!({ type: SET_MYSTERY_BIRD, payload: { mysteryBird: next } });
      setOpenBirdId(null);
    } catch (e) {
      setErrorMessage(dispatch, e as ErrorType);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="bw-mystery-banner">
          <div className="grid flex-col gap-1 min-w-[180px] text-left">
            <strong>Today's Mystery Bird</strong>
            <p className="text-xs m-0">{nawbCollection.name}</p>
          </div>
          {isPlaying ? (
            <div className="grid items-center gap-1 text-sm text-center">
              <span className="flex gap-1 mx-auto" aria-hidden="true">
                {Array.from({ length: MAX_MYSTERY_GUESSES }, (_, i) => (
                  <span key={i} className={`bw-guess-dot${i < mystery.guessesLeft ? "" : " bw-guess-dot--used"}`} />
                ))}
              </span>
              <strong>
                {mystery.guessesLeft} {mystery.guessesLeft === 1 ? "guess" : "guesses"} left
              </strong>
            </div>
          ) : (
            <strong className="text-sm text-center">Done for today</strong>
          )}
        </div>
        <p className="bw-subtitle text-right py-1">
          Mystery Birds solved: <strong className="bw-mystery-text">{mystery.solvedTotal}</strong>
        </p>

        <div className="bw-grid-3">
          {mystery.clues.map((clue, i) => (
            <button
              key={clue.type}
              type="button"
              className={`bw-clue${openClue === i ? " bw-clue--open" : ""}`}
              onClick={() => setOpenClue(openClue === i ? null : i)}
              aria-expanded={openClue === i}
            >
              <span className="bw-clue__info" aria-hidden="true">
                i
              </span>
              <BirdFact kind={clueFactKind(clue.type)} label={clue.type} value={clue.short} size="sm" />
            </button>
          ))}
        </div>
        {openClue !== null && (
          <p className="bw-clue-text">
            Clue {openClue + 1}: {mystery.clues[openClue].text}
          </p>
        )}
      </div>

      {mystery.status === "solved" && answer && (
        <div className="bw-mystery-result bw-mystery-result--solved">
          <h3>You solved it!</h3>
          <BirdToken birdId={answer.id} rarity={answer.rarity} src={discoveredBirdImage(answer.id)} size="lg" />
          <strong>{answer.name}</strong>
          <span className="bw-stamp">Mystery solved</span>
          <strong className="bw-mystery-text">+1 Mystery Birds solved ({mystery.solvedTotal} total)</strong>
          <p className="bw-caption">
            {!answerFound && `Spot it in the ${SPOT_LABELS[answer.spot]} to add it to your Field Guide. `}
            {NEXT_PUZZLE_TEXT}
          </p>
        </div>
      )}

      {mystery.status === "out" && answer && (
        <div className="bw-mystery-result bw-mystery-result--out">
          <h3 className="m-0">Out of guesses for today</h3>
          <p className="bw-caption m-0">Today's Mystery Bird was the</p>
          <BirdToken birdId={answer.id} rarity={answer.rarity} src={discoveredBirdImage(answer.id)} size="lg" />
          <strong>{answer.name}</strong>
          <p className="bw-caption m-0">Try again tomorrow. {NEXT_PUZZLE_TEXT}</p>
        </div>
      )}

      <p className="bw-subtitle m-0">
        {isPlaying ? (
          <>
            Tap a bird to compare it with the clues.
            <br />
            Which one matches all 3?
          </>
        ) : (
          "Today's candidates"
        )}
      </p>

      {mystery.candidateIds.map((id) => {
        const bird = nawbById[id];
        if (!bird) return null;
        const isGuessed = mystery.guessedIds.includes(id);
        const isAnswer = id === mystery.answerId;
        return (
          <MysteryCandidateCard
            key={id}
            bird={bird}
            found={Boolean(visitorBirdItems?.[id])}
            isOpen={openBirdId === id}
            isWrong={isGuessed && !isAnswer}
            isAnswer={isAnswer}
            canGuess={isPlaying && !isGuessed}
            submitting={submitting}
            onToggle={() => setOpenBirdId(openBirdId === id ? null : id)}
            onGuess={() => guess(id)}
          />
        );
      })}
    </div>
  );
};

export default MysteryBirdTab;

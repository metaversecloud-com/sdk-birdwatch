// Mystery Bird: a daily puzzle with three clues, four candidates and two guesses.
import { Page } from "@playwright/test";
import { BIRDS, COLLECTION_ID, PUZZLES, PUZZLE_1, TopiaWorld, etDayKey, expect, test } from "../../fixtures";

/** Today's puzzle is NAWB-001 (answer: Black-capped Chickadee) with the given guesses already made. */
const today = (guessedIds: string[] = [], totals = { solvedTotal: 0, firstTryTotal: 0 }) => ({
  todayKey: etDayKey(),
  puzzleId: PUZZLE_1.id,
  guessedIds,
  seenPuzzleIds: [PUZZLE_1.id],
  ...totals,
});

const mysteryData = (world: TopiaWorld, state = today()) => ({ [world.sceneKey]: { spotCooldowns: {}, mysteryBird: { [COLLECTION_ID]: state } } });

const guess = (page: Page, world: TopiaWorld, pickedBirdId: string, overrides: Record<string, string> = {}) =>
  page.request.post(world.api("/mystery/guess", overrides), { data: { collectionId: COLLECTION_ID, pickedBirdId } });

const [WRONG_1, WRONG_2] = PUZZLE_1.decoyIds;

/** Open the key asset on a player's first Mystery Bird day and return today's puzzle. */
const openMysteryTab = async (page: Page, world: TopiaWorld) => {
  const gameState = page.waitForResponse((r) => r.url().includes("/api/game-state")).then((r) => r.json());
  await world.open(page, "key");
  await page.getByRole("button", { name: "Mystery Bird", exact: true }).click();
  return PUZZLES[(await gameState).data.mysteryBird.puzzleId];
};

const guessInUi = async (page: Page, birdId: string) => {
  await page.locator(".bw-candidate__head", { hasText: BIRDS[birdId].name }).click();
  await page.getByRole("button", { name: `Guess: ${BIRDS[birdId].name}` }).click();
};

test("today's Mystery Bird shows three clues and four candidates but not the answer", async ({ page, world }) => {
  await world.seed();
  const responseBody = page.waitForResponse((r) => r.url().includes("/api/game-state")).then((r) => r.json());
  await world.open(page, "key");

  await page.getByRole("button", { name: "Guess Today's Mystery Bird" }).click();

  await expect(page.getByText("2 guesses left")).toBeVisible();
  await expect(page.locator(".bw-clue")).toHaveCount(3);
  await expect(page.locator(".bw-candidate")).toHaveCount(4);
  const { mysteryBird } = (await responseBody).data;
  expect(mysteryBird).toMatchObject({ status: "playing", guessesLeft: 2, guessedIds: [] });
  expect(mysteryBird.candidateIds).toHaveLength(4);
  expect(mysteryBird).not.toHaveProperty("answerId");
  // Nothing is saved until the first guess.
  expect((await world.sceneData())?.mysteryBird).toBeUndefined();
});

test("solving on the first guess earns Mystery Solved and First Try", async ({ page, world }) => {
  await world.seed();
  const puzzle = await openMysteryTab(page, world);

  await guessInUi(page, puzzle.answerId);

  await expect(page.getByRole("heading", { name: "You solved it!" })).toBeVisible();
  await expect(page.getByText("+1 Mystery Birds solved (1 total)")).toBeVisible();
  await expect(page.getByText("Done for today")).toBeVisible();
  expect((await world.sceneData()).mysteryBird[COLLECTION_ID]).toMatchObject({
    todayKey: etDayKey(),
    puzzleId: puzzle.id,
    guessedIds: [puzzle.answerId],
    solvedTotal: 1,
    firstTryTotal: 1,
  });
  await expect.poll(async () => (await world.inventory()).badges.sort()).toEqual(["First Try", "Mystery Solved"]);
  expect(await world.events("analytics")).toContainEqual(expect.objectContaining({ analyticName: "mysteryBirdSolves", uniqueKey: `${puzzle.id}:${world.profileId}` }));
});

test("a wrong guess costs one of the two guesses", async ({ page, world }) => {
  await world.seed();
  const puzzle = await openMysteryTab(page, world);

  await guessInUi(page, puzzle.decoyIds[0]);

  await expect(page.getByText("1 guess left")).toBeVisible();
  await expect(page.locator(".bw-candidate--wrong")).toContainText("✕ Not this bird");
  expect((await world.sceneData()).mysteryBird[COLLECTION_ID]).toMatchObject({ guessedIds: [puzzle.decoyIds[0]], solvedTotal: 0 });
  expect((await world.inventory()).badges).toEqual([]);

  await guessInUi(page, puzzle.decoyIds[1]);

  await expect(page.getByRole("heading", { name: "Out of guesses for today" })).toBeVisible();
  await expect(page.locator(".bw-candidate--answer")).toContainText(BIRDS[puzzle.answerId].name);
});

test("a second wrong guess ends the day and only then reveals the answer", async ({ page, world }) => {
  await world.seed({ visitorData: mysteryData(world, today([WRONG_1])) });

  const response = await guess(page, world, WRONG_2);

  const { outcome, mysteryBird } = (await response.json()).data;
  expect(outcome).toBe("out");
  expect(mysteryBird).toMatchObject({ status: "out", guessesLeft: 0, answerId: PUZZLE_1.answerId });
});

test("reopening Birdwatch after solving shows today's Mystery Bird as solved", async ({ page, world }) => {
  test.fail(true, "EXP-436: /game-state reads the visitor data object after updateDataObject replaced it, so saved Mystery Bird state is ignored");
  await world.seed({ visitorData: mysteryData(world, today([PUZZLE_1.answerId], { solvedTotal: 3, firstTryTotal: 1 })) });
  await world.open(page, "key");

  await expect(page.getByRole("button", { name: "Guess Today's Mystery Bird" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mystery Bird", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You solved it!" })).toBeVisible();
  await expect(page.getByText("Mystery Birds solved: 3")).toBeVisible();
});

test("solving on the second guess doesn't count as First Try", async ({ page, world }) => {
  await world.seed({ badges: ["Mystery Solved"], visitorData: mysteryData(world, today([WRONG_1], { solvedTotal: 1, firstTryTotal: 0 })) });

  const response = await guess(page, world, PUZZLE_1.answerId);

  expect((await response.json()).data.outcome).toBe("solved");
  expect((await world.sceneData()).mysteryBird[COLLECTION_ID]).toMatchObject({ solvedTotal: 2, firstTryTotal: 0 });
  // Mystery Solved is owned and First Try wasn't earned: nothing to grant.
  await page.waitForTimeout(300);
  expect(await world.events("grant-item")).toEqual([]);
});

test.describe("guesses the server rejects", () => {
  const cases = [
    { name: "a guess after the day is done", guessed: [PUZZLE_1.answerId], pick: WRONG_1, message: "Today's Mystery Bird is already resolved" },
    { name: "the same wrong bird twice", guessed: [WRONG_1], pick: WRONG_1, message: "That bird was already guessed" },
    { name: "a bird that isn't a candidate", guessed: [], pick: "snowy_owl", message: "Picked bird is not a candidate" },
  ];
  for (const c of cases) {
    test(c.name, async ({ page, world }) => {
      await world.seed({ visitorData: mysteryData(world, today(c.guessed)) });
      const before = await world.visitorData();

      const response = await guess(page, world, c.pick);

      expect(response.status()).toBe(400);
      expect((await response.json()).message).toBe(c.message);
      expect(await world.visitorData()).toEqual(before);
    });
  }
});

test("Mystery Bird solves in other Birdwatch scenes count toward Sharp Eye", async ({ page, world }) => {
  test.fail(true, "EXP-436: handleMysteryGuess sums totals from visitor.dataObject after updateDataObject replaced it");
  // Four solves in another scene, none yet in this one: the fifth solve earns Sharp Eye.
  const otherScene = { ...today([PUZZLE_1.answerId], { solvedTotal: 4, firstTryTotal: 4 }) };
  await world.seed({
    badges: ["Mystery Solved", "First Try"],
    visitorData: { ...mysteryData(world, today([WRONG_1])), [`${world.urlSlug}-scene-2`]: { spotCooldowns: {}, mysteryBird: { [COLLECTION_ID]: otherScene } } },
  });

  const response = await guess(page, world, PUZZLE_1.answerId);

  expect((await response.json()).data.mysteryBird.solvedTotal).toBe(5);
  await expect.poll(async () => (await world.inventory()).badges).toContain("Sharp Eye");
});

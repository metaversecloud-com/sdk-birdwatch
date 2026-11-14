# End-to-end tests

Playwright tests that drive the real app (production build of `client/` + `server/`) in a browser.
The server's `@rtsdk/topia` calls go to `mock-topia/server.mjs`, an in-memory fake of the Topia public
API, so no Topia credentials, world or network access are needed. The PR check (`E2E`) runs them on
every push; see `.github/workflows/e2e.yml` (managed by Terraform in config_texts).

## Run

```bash
npm install                      # app deps, repo root
cd e2e
npm install
npx playwright install chromium
npm test                         # builds the app, starts the mock + app, runs all specs
npm run test:ui                  # interactive mode
```

Against the Docker image instead of local Node (what ships; needs Docker):

```bash
e2e/scripts/test-image.sh        # image exactly as the Dockerfile builds it
e2e/scripts/test-image.sh 24     # --build-arg NODE_VERSION=24, fails unless the image runs Node 24
```

Ports: app `3100`, mock `3101` (override with `APP_PORT` / `MOCK_TOPIA_PORT`).

## Layout

| Path | What it is | When forking into a new app |
|---|---|---|
| `tests/platform/` | Checks every SDK app must pass: health endpoint contract, app shell fallback, credential checks, the interactive secret never reaching the browser | Keep identical; only edit `app.config.ts` |
| `app.config.ts` | Lists the app's credentialed API routes and entry page for the platform tests | List every route that calls `getCredentials` |
| `tests/app/` | Birdwatch tests: setup and admin, sightings, rewards, Mystery Bird, security | Replace with tests for the app's own pages and rules |
| `fixtures.ts` | `world.seed({...})` builds one isolated Topia world per test; `world.url()` / `world.api()` add the session credentials Topia appends | Extend `seed` for the app's data objects |
| `mock-topia/server.mjs` | Fake Topia public API | Add routes for any endpoint the app calls that isn't there |

Every test gets its own world, so the suite runs fully in parallel. Each test also fails if the app
calls a public-API endpoint the mock doesn't implement, so an `@rtsdk/topia` upgrade that starts using
new endpoints can't pass silently. A full app example lives in sdk-quiz (`e2e/tests`).

## Known bugs

Tests for bugs that still exist are marked `test.fail(true, "...")`: they pass while the bug is
there and fail with "Expected to fail, but passed" once it's fixed, so the marker is removed in the
same change as the fix. An app that doesn't have the bug deletes the marker straight away.

| Test | Bug | Tracked in |
|---|---|---|
| `platform/credentials.spec.ts` "names the credential problem" | `getCredentials` returns `{ error }` instead of throwing, so requests with bad credentials carry on and fail later on a Topia call. | EXP-428 |
| `app/security.spec.ts` (made-up scene, concurrent answers) | The client-sent `sceneDropId` keys cooldowns and Mystery Bird state, so a made-up one skips them; parallel copies of an answer all count and simultaneous sightings overwrite each other's totals. | EXP-436 |
| `app/mystery.spec.ts`, `app/admin.spec.ts` (first open, reopening) | Data read after `updateDataObject`, which replaces the SDK's local copy with the patch: saved Mystery Bird state and world totals are ignored. | EXP-436 |
| `app/rewards.spec.ts` "next time they open" | Queued badge toasts are written to the user data object but read from the visitor's. | EXP-436 |
| `app/admin.spec.ts` leaderboard reset, setup error | Leaderboard counts are rebuilt from `perPlayerContribution`; the setup error is hidden behind the spinner. | EXP-436 |

Birdwatch doesn't return the interactive secret, so `platform/secrets.spec.ts` has no EXP-429 markers.

## Conventions

- New tests are mutation-checked: break the behavior in the app and confirm the test goes red.
- Before merging, `npx playwright test --repeat-each=3` must pass every time.

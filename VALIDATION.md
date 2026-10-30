# Wheel Raid implementation and validation

Worker-side evidence, October 30, 2026. These checks are not an independent service certification.

## Scope and implementation choices

Reviewed the complete static React/TypeScript game: entry/create/join, same-browser rooms, manually signaled direct WebRTC rooms, lobby, immutable Attack/Defend/Heal, shared combat, archive reveal, live waiting and outage recovery, roster, result/replay, battle log/proof links, room leaderboard, native help/invite/leave dialogs and saved-host recovery.

The preview is `dist/index.html` plus its local assets. Replay is the default so the delivered preview is playable immediately without pretending ten-minute live rounds happen faster. It uses twelve original official safe settlement records, rounds 486–497 across October 29–30; their known historical outcomes are explicitly disclosed. Gameplay constants are identified as game rules. No fake public players, global leaderboard, randomized wheel outcomes, wallets, fees, transfers or keys are present.

Public API verification preceded implementation. Sources and the documented deployment/API discrepancy are recorded in README. The live adapter pins the current official API installation/core/implementation/stream, verifies consumed schema versions, confirmation boundaries and the observed 878 mm/work calibration, and pauses on unavailable or changed evidence. Exact single-round and all-zero spans are supported. Ambiguous nonzero batches and missing history are paused instead of divided or filled in.

## Acceptance coverage

| Requirement | Result / evidence |
| --- | --- |
| A playable multiplayer game | Met: create/join, real two-player tab and direct-channel tests; original boss combat |
| Official API and lifecycle first | Met: official documentation plus direct API reads, original archived event objects; one-based round boundaries regression-tested |
| Choices locked before outcomes | Met in live mode: future round, five-second pre-start deadline, immutable moves; replay openly describes public historical outcomes |
| Process confirmed rounds once | Met: identity includes installation/core/round; processed IDs and HP persist together; duplicate/restart tests |
| Pause when live data unavailable | Met: HTTP-200 unavailable, network failure, freshness/schema/identity/calibration guards; accelerated browser outage/recovery |
| Team/boss HP, log, result, replay, leaderboard | Met and exercised; leaderboard accurately labeled as room storage |
| Responsive phone and desktop | Met in Chromium at 320/390/760/1000/1440, including longest names and large HP; Safari remains unverified |
| Static export and source/lockfile | Met: repository-root `dist/`, relative runtime assets, local share PNG/favicon, source and npm lockfile |
| Build/typecheck/useful interactions | Met: actual commands and outcomes below |
| Pinned Better Interface and six domains | Met: consolidated review below; fixes rechecked |
| Product and primary action at 390 | Met: screenshots and bounding-box checks for entry Create, lobby Start, battle moves and result Replay |
| Metadata | Met: title, favicon, description, og:title and 1200 × 630 local PNG og:image |
| DESIGN and install/preview instructions | Met: root DESIGN.md and README.md |
| Under 8 MiB | Met: measured file bundle, with excluded generated dependencies and scratch data; final totals recorded in validation-summary.json |

## Actual commands and outcomes

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, TypeScript noEmit |
| `npm test` | Passed: **25 tests in 3 files**, real deterministic combat and source adapter tests |
| `npm run build` | Passed: production Vite export; also runs typecheck |
| `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:browser` | Passed Chromium flows; WebKit marked unavailable rather than counted as passing |
| `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:visual` | Passed keyboard flow, primary phone actions, longest-value reflow, 200% root text enlargement and reduced motion |
| Pinned `taste.mjs --out test/scratch/taste` with supplied Playwright/browser paths | **16/16 passed** at 320/390/1440; no local resource errors, horizontal scroll, overlapping text, clipping, insufficient measured text contrast or repeated-style failures |
| `npm audit --omit=dev` | Zero vulnerabilities reported; full audit also reported zero after updating the test runner |

Build output includes two harmless Rollup warnings about third-party Zod pure-annotation comments; the production build succeeds. The warnings do not imply an application exception. Required dependencies are normally installed through npm and locked; they are not vendored.

### Behavioral evidence

- **Two players:** separate real tabs create/join through the visible form, lock different moves, damage the same boss and receive identical HP/log revisions. A locked move disables subsequent choices.
- **Direct multiplayer:** two isolated browser storage contexts complete the visible offer/reply exchange, open an actual WebRTC data channel and resolve a turn to identical logs. This proves a direct local-network connection, not every Internet NAT configuration.
- **Duplicate rounds:** unit tests re-deliver the same round before/after scheduling; accelerated live browser polling repeats the same official evidence without a second HP change.
- **Source outage:** HTTP-200 unavailable and a network exception preserve the previous good snapshot; live moves/HP pause. The accelerated browser test restores the source and applies the official archived target once. Replay remains available during the live outage.
- **Restart:** host reload preserves roster, locked choices, HP, processed receipts and logs. A new browser session using only the persisted site storage resumes the original host identity and both completed raid records. Inconsistent receipt/log saves are rejected.
- **Clock changes:** live status timestamps must agree within two seconds; a monotonic-versus-wall-clock guard prevents reopening a choice window after a device clock rollback. The accelerated browser test rejects a move after that rollback without changing HP.
- **Lifecycle:** exact genesis, the first boundary and near-boundary scheduling are tested against the official one-based definition. Every archive settlement timestamp follows its actual round closure. Live tests use an accelerated clock and test-only source availability/timestamps, with unchanged original round evidence; no new ten-minute production settlement was waited through.
- **Win/loss/replay:** a deliberate heal/attack strategy wins in eight historical turns, while all attacks lose. Replay creates a fresh lobby while retaining both room score records.
- **Real official API:** the final production page's browser read reported **Live source connected**. This is an actual API/CORS check, separate from the controlled outage test.
- **Keyboard and semantics:** native labeled form, radio arrows, Create, Start, help Enter/Escape and focus return were exercised. A screenshot confirms the visible help focus ring. Progress bars have labels and numeric values; a stable polite region announces battle changes.

## Better Interface consolidated review

| Domain | Coverage | Evidence / limits |
| --- | --- | --- |
| Accessibility | Checked | Native controls, labels, named phone help, keyboard/radio/dialog paths, visible focus, 44 px primary targets, status/error semantics, reduced motion; no screen-reader session or forced-colors certification |
| Layout | Checked | Entry, lobby, active raid, outage, result and leaderboard; 320/390/760/1000/1440; four maximum 20-character names and four-digit boss HP; root text enlarged 200%; native browser zoom and RTL mirror unperformed |
| Writing | Checked | Plain action labels, neighboring directions/errors, explicit archive/live difference, room-only scores, source/proof language; no misleading fabricated activity |
| Typography | Checked | Five size roles, two weights, system sans and data-only monospace; 16 px phone inputs; numeric alignment; full wrapping names; no ellipsized critical data |
| Colors | Checked | Final taste text contrast passed; measured ink/paper 11.40:1, muted/paper 4.69:1 and ink/accent 9.94:1; rendered team/track 3.28:1; art colors not exhaustively audited |
| UI | Checked | Flat surfaces, control selection/disabled/pending states, clear empty state, static result pose, finite health transition, no endless motion; browser animation-panel slow playback not performed |

### Findings, corrections and recheck

| Severity / source | Finding and correction | Recheck |
| --- | --- | --- |
| High · `src/styles.css:365` | Initial disabled move names measured 3.42:1 and descriptions 4.44:1. Changed disabled text to the existing darker muted token. | Final taste: all measured text passes. |
| High · `src/App.tsx:198` | Phone CSS hides the help text, leaving the original button unnamed. Added explicit “How to play” accessible name. | Keyboard/browser flow, dialog Escape/focus return, screenshot focus ring passed. |
| High · `src/styles.css:1286`, `src/App.tsx:318` | Initial phone lobby Start and final Replay appeared below the battle/party stack. Lobby puts room controls first; results put Replay inside the battle. | 390 px bounding boxes, maximum-name lobby and result screenshots confirm primary actions on first screen. |
| High · `src/schedule.ts:4` | Initial scheduler treated genesis as round 0. Official lifecycle states round 1 begins at genesis. Replaced with shared one-based timing and a twenty-second future-round margin. | Three lifecycle tests, actual archive timestamp comparisons and accelerated live browser target check passed. |
| High · `src/source.ts:173` | Browser exposed `Illegal invocation` when default fetch was invoked as an adapter method. Default wrapper now calls `globalThis.fetch` with the correct receiver. | Regression test, accelerated live flow and actual production API browser read passed. |
| Medium · `src/styles.css:291` | Original team health fill/track contrast was 2.12:1. Darkened team fill to `#6d8848`. | Rendered style capture and computed solid-color ratio 3.28:1. |
| Medium · `src/client.ts:192` | A new browser session retained room data but lost the session-only host identity. Resume now acquires the host lock and restores that identity from the durable room. | Fresh-session persistent-storage browser test passed. |
| High · `src/source.ts:232`, `src/client.ts:359` | The original clock tolerance exceeded the five-second choice cutoff. Tightened source-time agreement to two seconds and added a monotonic clock guard, so a wall-clock rollback cannot reopen choices. | Source skew regression and accelerated browser clock rollback check passed. |
| Medium · `src/styles.css:335` | Fixed three-column actions risked cramped labels under large text. Changed to auto-fit columns with a rem-based minimum. | 200% root text enlargement at 390 px passed without horizontal overflow. |
| Medium · `src/App.tsx:431` | Pending join/error text was originally detached below the game. Entry feedback now appears immediately below its submit control. | Source review plus final entry/build/browser checks. |

No confirmed applicable high or medium finding remains open. These source locations refer to the final corrected implementation.

## Screenshots and preserved evidence

Preserved screenshots are `artifacts/preview-desktop.png` and `artifacts/preview-mobile.png`, from the final entry/real two-player preview. The final measured summaries are in `artifacts/validation-summary.json`.

Disposable browser evidence was generated in `test/scratch/browser/` (entry, real two-player battle, victory/room scores, outage, actual source), `test/scratch/visual/` (keyboard focus, help, lobby, longest names, enlarged text), and `test/scratch/taste/shots/` (390 and 1440). Screenshots were opened and visually inspected, including the 390 first screen, longest-name lobby, visible focus, paused source and victory/leaderboard. Scratch paths are intentionally excluded from the submitted bundle; the screenshot copies above and this result record are retained.

## Limitations and completion

Complete for the implemented static game scope, with the following explicitly unverified or bounded behavior:

- Safari/WebKit executable was unavailable in the supplied runtime. Responsive Chromium emulation is not a physical iPhone or Safari test. Screen readers, native 200% browser zoom, RTL mirroring and slow-motion animation-panel review were not performed.
- Direct WebRTC has no TURN relay; restrictive networks may fail. The UI explains same-browser/same-Wi-Fi alternatives. Remote players need fresh direct signaling after a reload. The original browser profile hosts and stores the room; there is no remote host migration, hosted room directory or global leaderboard.
- The source is the official read API, trusted according to its declared safe frontier. Independent onchain signature/proof verification is not implemented. The docs/current-API deployment discrepancy is disclosed and current API identity is pinned, not guessed from the older docs.
- A missing target or nonzero aggregate spanning multiple rounds remains paused. This build does not reconstruct arbitrary old history. A quiet source may produce legitimate zero-work rounds; an unavailable source never produces a fabricated zero.
- Clearing site storage removes recovery/room scores. Modern browser secure-context APIs require HTTPS or localhost. No account-based backup is claimed.

The preserved validation is a worker report; the structural verifier does not independently certify these behavioral results.

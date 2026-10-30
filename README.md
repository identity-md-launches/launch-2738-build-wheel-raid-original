# Wheel Raid

A playable cooperative browser game for Squeekchain. One to four raiders share a health pool and fight the original Chrome Gnawer boss with Attack, Defend and Heal. No wallets, wagering, custody, transfers, or private keys.

The static preview is **[dist/index.html](dist/index.html)**. Serve it over HTTPS (or HTTP on localhost for development); opening it as a `file:` URL is not supported. The publisher can serve the committed `dist/` at any subpath without rewrites. Source, lockfile, all runtime assets, and the finished export are included.

## Install, preview and rebuild

Use Node 22.12 or later and npm:

```sh
npm ci
npm run dev
```

For the production preview:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Open the address printed by Vite. For another physical device, use an HTTPS preview: browser room coordination and direct connections need a secure context. `npm run build` includes a typecheck and writes the static export to `dist/`. Vite uses `base: './'`; runtime files, favicon and share art are local and relative. The app uses a single page, without history routes. Rebuilding needs installed npm dependencies, but no API calls. Logic tests use the captured official evidence and do not require a network.

## Play

1. Enter a name, leave **Replay raid** selected, and create a room.
2. Invite a friend, or play solo. Start the raid.
3. Select Attack, Defend or Heal. Selecting a move locks it immediately for that turn.
4. In replay, the next recorded round reveals after everyone locks, or the 60-second choice window ends. Missing choices use Defend.
5. Beat the boss before shared HP reaches zero or twelve turns pass. A finished raid records room scores and offers another raid.

Replay is **historical practice**, using twelve consecutive official confirmed rounds, **486–497 across October 29–30, 2026**. Those outcomes are already public and shipped in the source; this mode makes no claim that its results are unpredictable. They are not simulated hamster results. The archive remains playable if the live service is offline.

### Two players

**Same browser:** the host opens Invite, then **Open another player tab**. The other tab chooses Join and enters the six-character room code and a different name. Both tabs must use the same site origin and browser profile. Room state crosses tabs through `BroadcastChannel`.

**Another device or separate browser:** the host generates a direct invite in Invite. The joining player opens Join → Join from another device, pastes that full invite, and sends the generated reply code back to the host. The host pastes the reply and connects. This is a real WebRTC data channel, with manual signaling and Cloudflare's [documented public STUN service](https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/). No signaling account, project ID, media permission, TURN credential, or backend is required. The two long codes are connection descriptions, not room names. Keep both pages open during the exchange.

Direct connections can fail across restrictive NATs, firewalls, or VPNs: **there is no TURN relay**. Same-Wi-Fi or same-browser play is the fallback. Cross-network connectivity is not guaranteed. The host is authoritative and must stay open; this is friendly co-op with a trusted host, not a competitive anti-cheat service.

### Live raids and honest waiting

Select **Live raid** when creating a room. Starting requires a successful read of the official source. A live turn targets a **future measurement round**, with at least twenty seconds before its start. All moves close **five seconds before that round begins**, rather than waiting until work has already been observed. A move is immutable once selected. To protect that deadline, live play requires the device clock to agree with the official status timestamp within two seconds. A wall-clock jump after loading pauses live choices until reload; historical practice remains available. Unselected players use the Defend rule fixed when the turn was scheduled; after the deadline they cannot select another move.

The hamster's measurement rounds last ten minutes. Closure, Oracle acceptance, submission and chain confirmation are separate stages. This app uses only safe `system.settlement_completed` events after the API's twelve-confirmation frontier. It ignores projected blocks, queued work and unconfirmed submissions. The next choice window is scheduled after resolving the previous target; intervening real rounds are intentionally skipped, never used as extra attacks.

Unavailable HTTP-200 responses, HTTP errors, timeouts, stale observations, stale safe blocks, paused settlement, unsupported response versions, changed identities and changed distance calibration pause live combat. Last good data and locked choices remain saved. Retry uses the official source; there is no random, zero, or replay fallback in live mode. A successfully confirmed **zero-work** round is distinct from unavailable data and may legitimately resolve combat. Zero work does not prove the hamster was asleep.

The public feed gives aggregate settlement spans. This build accepts exact single-round work and exact all-zero spans of at most sixteen rounds. It **does not divide a nonzero aggregate among multiple rounds**. If a target is ambiguous or missing beyond the latest 100 feed events, that turn stays paused with an explicit message. There is no unsupported historical RPC endpoint or guessed recovery total.

## Source verification and provenance

Checked on October 30, 2026, before building:

| Official source | Verified use |
| --- | --- |
| [API reference](https://docs.squeekchain.com/developers/api/) | Public read-only JSON; CORS enabled; HTTP 200 may mean unavailable; endpoint versions, units, caching and confirmation rules |
| [Round lifecycle](https://docs.squeekchain.com/system/rounds-and-blocks/) and [how work reaches Ethereum](https://docs.squeekchain.com/start/how-it-works/) | Ten-minute measurement rounds; settlement then delayed confirmed public view; rounds differ from Squeek and Ethereum blocks |
| [Measurement rules](https://docs.squeekchain.com/system/measurement/) | One accepted passage is one work unit; distance is an estimate; zero-work and interrupted measurement caveats |
| [Core API](https://api.squeekchain.com/v1/core) | Current installation, core identity, implementation, stream, genesis timestamp, round duration, paused state and settled frontier |
| [Protocol event feed](https://api.squeekchain.com/v1/events?category=protocol&limit=100) | Safe settlement records, exact work, round range, transaction/block hashes and confirmation status |
| [Measurement statistics](https://api.squeekchain.com/v1/measurement/stats?range=7d) | Official lifetime work and estimated distance, used to verify the conversion |
| [Pipeline status](https://api.squeekchain.com/v1/status) | Measurement freshness, source timestamp and settlement incident state; never combat outcomes |

Important discrepancy: the [deployment documentation](https://docs.squeekchain.com/developers/) and [published deployment file](https://docs.squeekchain.com/assets/deployments/sepolia.json) list the older core `0x74665daeca35a2303e767e76a2ff1fb6f93e119f`, whereas the official live API identifies **`0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44`**. This game pins the latter to the direct API observation captured with the archive, plus its installation, implementation and stream identity. It does not pretend these sources agree or silently accept a subsequent deployment change. API records are trusted, not independent cryptographic chain verification. This is read-only gameplay with no onchain transactions.

`src/data/archive.json` retains the twelve original settlement event objects, captured safe-block metadata, source URLs, release/installation identity, round schedule and calibration evidence. Each log links to its real Sepolia transaction. The archive was selected from the documented paginated protocol feed; no result or distance was generated randomly.

Distance is derived, not a separate onchain field. The official lifetime statistics reported **45,957 accepted work units** and **40,350,246 mm** estimated distance, an exact ratio of **878 mm per accepted work unit**. The game uses this integer conversion for each confirmed round and calls it estimated wheel distance. It checks the official lifetime ratio at live startup and hourly; a mismatch pauses combat. It does not claim animal travel, price data, or independent measurement certification.

`src/source.ts` validates consumed response fields and versions with Zod, preserves decimal strings and uses BigInt for IDs/work/distance. Small display and bounded combat values use numbers. Unknown unused fields are ignored. Public reads poll every twenty seconds, with a twelve-second timeout and `Retry-After` support. No secret configuration is needed.

## Rules and room scores

For `m = floor(distanceMm / 1000)`:

| Move | Power |
| --- | --- |
| Attack | `18 + min(30, floor(m / 15))` damage |
| Defend | `20 + min(16, floor(m / 30))` shared shield |
| Heal | `14 + min(20, floor(m / 30))` shared HP |

Team maximum is 120 HP per player; boss maximum is 260 HP per player. Every turn applies attacks, then healing up to maximum HP, then retaliation unless the boss was defeated. Retaliation before shielding is `(22 + 3 × (roundId mod 3) + (m < 10 ? 6 : 0)) × playerCount`. Shields last one turn. A boss kill wins before retaliation. Surviving a twelfth turn without a kill is defeat. These are original **game balance constants**, not Squeekchain measurements.

Scores add the listed power of each selected/default move, including unused healing and shields. They measure contribution power, not money or effective healing. The **room leaderboard** stores the last twenty completed raids, displays up to twenty score rows, labels replay/live and is shared with connected teammates. There are no fabricated players or global rankings. Its records live in browser storage; clearing storage erases them.

## Recovery model

`src/game.ts` is a pure reducer. The controller saves the entire validated room record atomically through `localStorage.setItem` **before** publishing a state change. HP, round identity, locked choices, score, log and processed-round IDs are in that same record. A repeated event or poll cannot cause a second hit. Failure to persist freezes host combat rather than publishing unsaved progress.

Reloading the host tab restores its session and room, including its pending target and processed rounds. Reopening the site in a new session of the same browser profile exposes Resume saved room and restores the host identity from the durable room record. Same-browser guests reconnect automatically. Remote guests exchange fresh direct invite/reply codes after a reload. The original host must return: there is no host migration. Only one host tab can own a room through Web Locks. Leaving preserves the save and exposes Resume saved room in the original browser profile. A guest can rejoin after the roster locks only if it was already in that roster; new players wait for a new lobby.

## Tests and validation

```sh
npm run typecheck
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:browser
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:visual
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs \
  PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright \
  node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The browser runner uses the assignment's provided Playwright module. On another development machine, change that import in `test/browser.mjs` to your installed Playwright module and use its browsers. It starts and closes its own bounded HTTP server, serves the **production export under `/preview/`**, and tests real UI flows. The pinned taste script is an assignment input and is not distributed as product code. All browser outputs go to disposable `test/scratch/`.

Actual results: production build and typecheck passed; **25 logic tests passed**; Chromium interaction and visual checks passed; the pinned interface probe passed **16/16** checks. The production browser successfully read the real official API. Two-player, duplicate-round, outage, host-reload and fresh-session recovery paths were exercised. No horizontal scroll was found at 320/390/760/1000/1440, including maximum names and 200% root text enlargement. npm reported zero dependency vulnerabilities after the test-runner update.

Safari/WebKit was unavailable, so Safari and physical iPhone behavior remain unverified. Direct peer connections were tested locally and may fail on restricted networks. The live lifecycle test used an accelerated clock with real archived evidence; it does not claim a fresh ten-minute production settlement was waited through.

The detailed results, limitations and six-domain interface review are recorded in [VALIDATION.md](VALIDATION.md), with an artifact copy at [artifacts/validation.md](artifacts/validation.md). [DESIGN.md](DESIGN.md) documents the final implemented design. Logic tests cover two players, immutable and late moves, duplicate/out-of-order rounds, outage/recovery, HP bounds, victory/defeat, replay and atomic restart recovery.

## Submission size and exclusions

The total added bundle budget is **8,388,608 bytes**. Explicit path budgets: `dist/` ≤ 2 MiB, `src/` ≤ 1 MiB, manifests/lockfile/configuration ≤ 512 KiB, tests ≤ 512 KiB, documentation/artifacts/licenses ≤ 1 MiB; the remainder is headroom. The ignore rules allocate **zero submitted bytes** to `**/node_modules/`, `**/.vite/`, `**/coverage/`, `test/scratch/`, and `*.tsbuildinfo`. npm caches stay outside the repository. `dist/` is deliberately not ignored. No registry mirror, dependency archive, remote runtime assets, or git submodule is part of the deliverable.

Design guidance attribution: Jakub Krehel's Better Interface (MIT) and Paul Bakaus's Impeccable documentation method (Apache-2.0), as pinned for this assignment. Their notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses/design-guidance.txt](licenses/design-guidance.txt).

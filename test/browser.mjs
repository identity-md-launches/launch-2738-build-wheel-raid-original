import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";

const { chromium, webkit } = await import(
  "/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs"
);
const root = resolve("dist");
const output = resolve("test/scratch/browser");
await mkdir(output, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, path.slice("/preview/".length) || "index.html");
    if (!file.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
function record(message) {
  results.push(message);
  console.log(message);
}
let browser;
const archive = JSON.parse(await readFile("src/data/archive.json", "utf8"));
const wait = async (fn, message, timeout = 12_000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(message);
};
const saved = (page) =>
  page.evaluate(() => {
    const session = JSON.parse(
      sessionStorage.getItem("wheel-raid:session") || "null",
    );
    return session
      ? JSON.parse(
          localStorage.getItem(`wheel-raid:room:${session.room}`) || "null",
        )
      : null;
  });
async function offline(context) {
  await context.route("https://api.squeekchain.com/**", (r) =>
    r.fulfill({
      json: { status: "unavailable", reason: "test_source_outage" },
    }),
  );
}
async function noOverflow(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "horizontal overflow",
  );
}
async function create(page, name = "Nibbles", mode = "replay") {
  await page.goto(url);
  await page.getByLabel("Your raider name").fill(name);
  if (mode === "live")
    await page
      .locator(".mode-picker label")
      .filter({ hasText: "Live raid" })
      .click();
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByRole("button", { name: "Start raid", exact: true }).waitFor();
  return (await saved(page)).id;
}
async function step(page, action) {
  await page
    .getByRole("button", { name: `Lock ${action}`, exact: true })
    .waitFor();
  await wait(
    () =>
      page
        .getByRole("button", { name: `Lock ${action}`, exact: true })
        .isEnabled(),
    "move never enabled",
  );
  const before = (await saved(page)).logs.length;
  await page
    .getByRole("button", { name: `Lock ${action}`, exact: true })
    .click();
  await wait(
    async () => (await saved(page)).logs.length === before + 1,
    "round did not resolve",
  );
}
try {
  browser = await chromium.launch({ headless: true });
  if (!process.argv.includes("--only-live")) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await offline(context);
    const host = await context.newPage();
    const errors = [];
    context.on("weberror", (e) => errors.push(e.error().message));
    await host.goto(url);
    await host.screenshot({
      path: `${output}/desktop-entry.png`,
      fullPage: true,
    });
    const room = await create(host);
    const guest = await context.newPage();
    await guest.goto(url);
    await guest
      .getByRole("button", { name: "Have a room code? Join a room" })
      .click();
    await guest.getByLabel("Your raider name").fill("Crumb");
    await guest.getByLabel("Room code", { exact: false }).fill(room);
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await host.getByText("Crumb", { exact: true }).waitFor();
    await host.getByRole("button", { name: "Start raid", exact: true }).click();
    await guest
      .getByRole("button", { name: "Lock Attack", exact: true })
      .waitFor();
    await host
      .getByRole("button", { name: "Lock Attack", exact: true })
      .click();
    assert(
      await host
        .getByRole("button", { name: "Lock Heal", exact: true })
        .isDisabled(),
    );
    await guest
      .getByRole("button", { name: "Lock Defend", exact: true })
      .click();
    await wait(
      async () => (await saved(host)).logs.length === 1,
      "two-player combat did not resolve",
    );
    await wait(
      async () =>
        (await saved(guest)).revision === (await saved(host)).revision,
      "guest did not sync",
    );
    let state = await saved(host);
    assert.equal(state.logs[0].moves[1].action, "defend");
    assert.equal(state.logs[0].damage, 43);
    const hp = state.bossHp;
    await host.reload();
    await host.getByText("Saved raid restored.", { exact: false }).waitFor();
    await new Promise((r) => setTimeout(r, 2000));
    state = await saved(host);
    assert.equal(state.logs.length, 1);
    assert.equal(state.bossHp, hp);
    assert.equal(state.players.length, 2);
    await host.setViewportSize({ width: 390, height: 844 });
    await noOverflow(host);
    await host.screenshot({
      path: `${output}/phone-battle.png`,
      fullPage: true,
    });
    await host
      .getByRole("button", { name: "How to play", exact: true })
      .click();
    assert(await host.getByRole("dialog").isVisible());
    await host.keyboard.press("Escape");
    assert.equal(await host.getByRole("dialog").count(), 0);
    assert(
      await host
        .getByRole("button", { name: "How to play", exact: true })
        .evaluate((e) => e === document.activeElement),
    );
    for (const width of [320, 390, 760, 1000, 1440]) {
      await host.setViewportSize({ width, height: 1000 });
      await noOverflow(host);
    }
    assert.deepEqual(errors, []);
    record(
      "Chromium: two real player tabs, immutable moves, shared combat, synchronized HP/log, host restart without duplicate damage, dialog Escape/focus return, 320/390/760/1000/1440 reflow: passed",
    );
    await context.close();

    const soloContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await offline(soloContext);
    const solo = await soloContext.newPage();
    await create(solo, "Pip");
    await solo.getByRole("button", { name: "Start raid", exact: true }).click();
    for (const action of [
      "Attack",
      "Attack",
      "Heal",
      "Attack",
      "Attack",
      "Heal",
      "Attack",
      "Attack",
    ])
      await step(solo, action);
    assert.equal((await saved(solo)).phase, "victory");
    await solo
      .getByRole("button", { name: "Leaderboard", exact: true })
      .click();
    await solo.getByText("Victory", { exact: true }).waitFor();
    await solo.screenshot({
      path: `${output}/phone-victory.png`,
      fullPage: true,
    });
    await solo
      .getByRole("button", { name: "Play another raid", exact: true })
      .click();
    await solo.getByRole("button", { name: "Start raid", exact: true }).click();
    for (let i = 0; i < 6 && (await saved(solo)).phase === "battle"; i++)
      await step(solo, "Attack");
    assert.equal((await saved(solo)).phase, "defeat");
    assert.equal((await saved(solo)).history.length, 2);
    await solo.getByRole("button", { name: "Leave room", exact: true }).click();
    await solo
      .getByRole("dialog")
      .getByRole("button", { name: "Leave room", exact: true })
      .click();
    await solo
      .getByRole("button", { name: "Resume saved room", exact: true })
      .click();
    await wait(async () => !!(await saved(solo)), "saved host did not resume");
    assert.equal((await saved(solo)).phase, "defeat");
    record(
      "Chromium: archived rounds playable during live source outage; strategy reaches victory, replay reaches defeat, room leaderboard records both, leave/resume restores result: passed",
    );
    const persistedProfile = await soloContext.storageState();
    const previousHost = (await saved(solo)).hostId;
    await soloContext.close();
    const restartedContext = await browser.newContext({
      storageState: persistedProfile,
    });
    await offline(restartedContext);
    const restarted = await restartedContext.newPage();
    await restarted.goto(url);
    await restarted
      .getByRole("button", { name: "Resume saved room", exact: true })
      .click();
    await wait(
      async () => !!(await saved(restarted)),
      "fresh browser session did not restore the saved host",
    );
    assert.equal((await saved(restarted)).hostId, previousHost);
    assert.equal((await saved(restarted)).phase, "defeat");
    assert.equal((await saved(restarted)).history.length, 2);
    record(
      "Chromium: new browser session with persistent site storage restores original host identity, completed result and both leaderboard records: passed",
    );
    await restartedContext.close();

    // Real RTC data channels between isolated browser storage contexts, using the visible offer/reply flow.
    const a = await browser.newContext(),
      b = await browser.newContext();
    await offline(a);
    await offline(b);
    const p1 = await a.newPage(),
      p2 = await b.newPage();
    await create(p1, "Host");
    await p2.goto(url);
    await p1
      .getByRole("button", { name: "Invite a player", exact: true })
      .click();
    await p1
      .getByRole("button", { name: "Generate direct invite", exact: true })
      .click();
    await p1.getByLabel("1. Send this invite code").waitFor();
    const offer = await p1.getByLabel("1. Send this invite code").inputValue();
    await p2
      .getByRole("button", { name: "Have a room code? Join a room" })
      .click();
    await p2
      .getByRole("button", { name: "Join from another device", exact: true })
      .click();
    await p2.getByLabel("Your raider name").last().fill("Remote Crumb");
    await p2.getByLabel("Host’s invite code").fill(offer);
    await p2.getByRole("button", { name: "Create reply", exact: true }).click();
    await p2.getByLabel("Send this reply to the host").waitFor();
    const answer = await p2
      .getByLabel("Send this reply to the host")
      .inputValue();
    await p1.getByLabel("2. Paste your friend’s reply").fill(answer);
    await p1
      .getByRole("button", { name: "Connect teammate", exact: true })
      .click();
    await wait(
      async () =>
        !!(await saved(p2))?.players.some((p) => p.name === "Remote Crumb"),
      "direct peer failed to join",
      20_000,
    );
    for (const p of [p1, p2])
      await p
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    await p1.getByRole("button", { name: "Start raid", exact: true }).click();
    await p1.getByRole("button", { name: "Lock Attack", exact: true }).click();
    await p2.getByRole("button", { name: "Lock Heal", exact: true }).click();
    await wait(
      async () => (await saved(p2)).logs.length === 1,
      "RTC round failed",
    );
    assert.deepEqual((await saved(p1)).logs, (await saved(p2)).logs);
    record(
      "Chromium: direct WebRTC invite/reply connection between isolated contexts, two-player combat and identical confirmed log: passed (local network only; no cross-NAT certification)",
    );
    await a.close();
    await b.close();
  }

  // Exercise actual live waiting logic with official historical round evidence and an accelerated test clock.
  const liveContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const lp = await liveContext.newPage();
  const genesis = Number(archive.genesisTimestamp) * 1000;
  const time = genesis + 484 * 600_000 + 300_000;
  await lp.clock.install({ time });
  let outage = false,
    confirmed = false;
  await liveContext.route("https://api.squeekchain.com/**", async (route) => {
    if (outage) {
      await route.fulfill({
        json: { status: "unavailable", reason: "test_outage" },
      });
      return;
    }
    const current = await lp.evaluate(() => Date.now());
    const iso = new Date(current).toISOString();
    const path = new URL(route.request().url()).pathname;
    let json;
    if (path === "/v1/core")
      json = {
        schemaVersion: 1,
        status: "available",
        installationId: archive.installationId,
        chain: archive.chain,
        identities: { core: archive.core },
        implementation: {
          codeAddress: archive.implementation,
          codeVersion: "3",
        },
        configuration: {
          streamId: archive.streamId,
          genesisTimestamp: archive.genesisTimestamp,
          roundDuration: "600",
        },
        core: { settledThroughRound: confirmed ? "486" : "485", paused: false },
      };
    else if (path === "/v1/status")
      json = {
        schemaVersion: 1,
        installationId: archive.installationId,
        generatedAt: iso,
        measurement: {
          freshness: "online",
          observedAt: iso,
          staleAfterSeconds: 120,
        },
        settlementQueue: { status: "available", incidentOpen: false },
      };
    else if (path.includes("/stats"))
      json = {
        schemaVersion: 1,
        installationId: archive.installationId,
        lifetime: archive.calibration,
      };
    else
      json = {
        schemaVersion: 3,
        status: "available",
        installationId: archive.installationId,
        generatedAt: iso,
        chain: { ...archive.chain, safeBlockTimestamp: iso },
        identities: { core: archive.core },
        nextCursor: null,
        events: confirmed ? [archive.events[0]] : [],
      };
    await route.fulfill({ json });
  });
  await create(lp, "Live Pip", "live");
  await wait(
    () => lp.getByText("Live source connected", { exact: true }).isVisible(),
    "live source not connected",
  ).catch(async (e) => {
    await lp.screenshot({ path: `${output}/live-error.png`, fullPage: true });
    throw new Error(
      `${e.message}: ${await lp.locator(".messages").innerText()}; mode=${(await saved(lp))?.mode}`,
    );
  });
  await lp.getByRole("button", { name: "Start raid", exact: true }).click();
  assert.equal((await saved(lp)).turn.roundId, "486");
  await lp.getByRole("button", { name: "Lock Attack", exact: true }).click();
  outage = true;
  await lp.clock.runFor(21_000);
  await wait(
    () =>
      lp
        .getByRole("heading", {
          name: "Raid paused. Progress is safe.",
          exact: true,
        })
        .isVisible(),
    "outage not surfaced",
  );
  assert.equal((await saved(lp)).logs.length, 0);
  await lp.screenshot({
    path: `${output}/phone-source-outage.png`,
    fullPage: true,
  });
  await lp.clock.fastForward(1_080_000);
  assert.equal((await saved(lp)).logs.length, 0);
  outage = false;
  confirmed = true;
  await lp.getByRole("button", { name: "Retry source", exact: true }).click();
  await wait(
    () => lp.getByText("Live source connected", { exact: true }).isVisible(),
    "live recovery failed",
  );
  await lp.clock.runFor(1000);
  await wait(
    async () => (await saved(lp)).logs.length === 1,
    "confirmed round not processed",
  );
  const once = (await saved(lp)).bossHp;
  await lp.clock.runFor(21_000);
  assert.equal((await saved(lp)).logs.length, 1);
  assert.equal((await saved(lp)).bossHp, once);
  const beforeClockJump = await lp.evaluate(() => Date.now());
  await lp.clock.setSystemTime(beforeClockJump - 60_000);
  await lp.getByRole("button", { name: "Lock Attack", exact: true }).click();
  await wait(
    () =>
      lp
        .getByRole("heading", {
          name: "Raid paused. Progress is safe.",
          exact: true,
        })
        .isVisible(),
    "changed device clock did not pause live choices",
  );
  assert.deepEqual((await saved(lp)).turn.choices, {});
  assert.equal((await saved(lp)).bossHp, once);
  record(
    "Chromium accelerated live clock: future target, choice locked before start, source outage freezes HP, recovery applies official archived evidence once, duplicate polls preserve HP, device clock rollback pauses choices: passed",
  );
  await liveContext.close();

  const realContext = await browser.newContext();
  const real = await realContext.newPage();
  await real.goto(url);
  await wait(
    () =>
      real
        .getByRole("button", { name: "How to play", exact: true })
        .isVisible(),
    "real page not rendered",
  );
  await real.getByLabel("Your raider name").fill("Source check");
  await real
    .locator(".mode-picker label")
    .filter({ hasText: "Live raid" })
    .click();
  await real.getByRole("button", { name: "Create room", exact: true }).click();
  await wait(
    async () =>
      (await real
        .getByText("Live source connected", { exact: true })
        .isVisible()) ||
      (await real.getByText("Live source paused", { exact: true }).isVisible()),
    "source status absent",
  );
  await new Promise((r) => setTimeout(r, 2500));
  const realStatus = await real.locator(".source-status").innerText();
  record(
    `Actual production API browser read: ${realStatus}. No round was fabricated or fast-forwarded in this check.`,
  );
  await real.screenshot({
    path: `${output}/actual-source.png`,
    fullPage: true,
  });
  await realContext.close();

  try {
    const safari = await webkit.launch({ headless: true });
    const sc = await safari.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await offline(sc);
    const sp = await sc.newPage();
    await create(sp, "Safari Pip");
    await sp.getByRole("button", { name: "Start raid", exact: true }).click();
    await step(sp, "Attack");
    await noOverflow(sp);
    await sp.screenshot({ path: `${output}/webkit-phone.png`, fullPage: true });
    await safari.close();
    record(
      "WebKit 390: create room, start raid, lock Attack, resolve actual archive round, no horizontal overflow: passed",
    );
  } catch (e) {
    if (e.message.includes("Executable doesn't exist")) {
      record(
        "WebKit unavailable: its browser executable is not supplied. Safari rendering and physical iPhone behavior remain unverified.",
      );
    } else {
      record(`WebKit interaction failed: ${e.message}`);
      throw e;
    }
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ results }, null, 2),
  );
} catch (e) {
  console.error(e);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ results, error: e.message }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

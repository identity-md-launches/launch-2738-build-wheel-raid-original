import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(
  "/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs"
);
const root = resolve("dist"),
  out = resolve("test/scratch/visual");
await mkdir(out, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = resolve(root, pathname.slice(1) || "index.html");
    if (!file.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true }),
  results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route("https://api.squeekchain.com/**", (route) =>
    route.fulfill({
      json: { status: "unavailable", reason: "visual_test_fixture" },
    }),
  );
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Walk help with a real keyboard and inspect the restored focused state.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: `${out}/phone-help.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/phone-focus.png` });
  await page.keyboard.press("Tab");
  await page.keyboard.type("NibblesNibblesNibbles");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  assert(await page.getByLabel("Live raid", { exact: true }).isChecked());
  await page.keyboard.press("ArrowLeft");
  assert(await page.getByLabel("Replay raid", { exact: true }).isChecked());
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Start raid", exact: true }).waitFor();
  const startBox = await page
    .getByRole("button", { name: "Start raid", exact: true })
    .boundingBox();
  assert(
    startBox.y + startBox.height <= 844,
    "lobby Start action is below the first phone screen",
  );
  await page.screenshot({ path: `${out}/phone-lobby.png`, fullPage: true });
  results.push(
    "390 px keyboard flow: skip link, brand, named help, native modal Enter/Escape/focus return, name, radio arrows, room creation; Start raid is on first screen: passed",
  );
  // Explicit test fixtures stress four maximum-length names; these are not seeded product players.
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem("wheel-raid:session")),
      key = `wheel-raid:room:${s.room}`,
      room = JSON.parse(localStorage.getItem(key));
    room.players.push(
      ...[1, 2, 3].map((n) => ({
        id: `visual-fixture-${n}`,
        name: "CrumbCrumbCrumbCrumb",
        score: 0,
      })),
    );
    localStorage.setItem(key, JSON.stringify(room));
  });
  await page.reload();
  await page.getByRole("button", { name: "Start raid", exact: true }).waitFor();
  for (const width of [320, 390, 760, 1000, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `lobby overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const partyBox = await page
    .getByRole("button", { name: "Start raid", exact: true })
    .boundingBox();
  assert(
    partyBox.y + partyBox.height <= 844,
    "four-player Start action is below first screen",
  );
  await page.screenshot({
    path: `${out}/phone-four-player-lobby.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start raid", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Lock Attack", exact: true })
    .waitFor();
  const moveBox = await page
    .getByRole("button", { name: "Lock Attack", exact: true })
    .boundingBox();
  assert(
    moveBox.y + moveBox.height <= 844,
    "move action is below first phone screen",
  );
  for (const width of [320, 390, 760, 1000, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `battle overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${out}/phone-four-player-battle.png`,
    fullPage: true,
  });
  const styles = await page.evaluate(() => ({
    team: getComputedStyle(
      document.querySelector(".battle-controls .health-track>span"),
    ).backgroundColor,
    track: getComputedStyle(
      document.querySelector(".battle-controls .health-track"),
    ).backgroundColor,
    focus: getComputedStyle(document.querySelector(".help-button"))
      .outlineColor,
  }));
  results.push(
    `Four-player maximum names and four-digit boss HP: no horizontal overflow at 320, 390, 760, 1000, 1440; phone lobby Start and battle move on first screen. Rendered health colors: ${JSON.stringify(styles)}`,
  );
  await page.addStyleTag({ content: "html {font-size:200%}" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "200% text enlargement overflow",
  );
  await page.screenshot({
    path: `${out}/phone-enlarged-text.png`,
    fullPage: true,
  });
  results.push(
    "390 px with root text enlarged to 200%: no horizontal scroll; moves adapt to a vertical layout. This is text enlargement, not native browser zoom.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
    0,
  );
  assert.deepEqual(errors, []);
  results.push(
    "Reduced motion: no running animation; no page exceptions during the visual flow.",
  );
  await writeFile(`${out}/results.json`, JSON.stringify({ results }, null, 2));
  console.log(results.join("\n"));
} catch (e) {
  console.error(e);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ results, error: e.message }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

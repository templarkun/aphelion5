// Browser check of the loss outros (designer 2026-11-24): a lost or conceded game plays Signal Lost or Withdrawal
// (one of the two at random), four acts in order, then the Debrief ("Campaign conceded" / "Campaign lost") with
// the game's own score; "Return to Command Deck" goes back to the briefing. Both are previewed from System options
// at 1400 and 390 px (two taps skip on the phone), and with reduced motion only the still picture and the card.
// Called by ui-smoke.mjs (group "outro"); can also run alone: node scripts/ui-loss.mjs [url] [outDir].
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function open(browser, url, w, h, reduced = false) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
  await pg.addInitScript(() => {
    try {
      localStorage.setItem("aphelion5.intro", "off");
      localStorage.setItem("aphelion5.intro.intro2", "seen");
    } catch {}
  });
  await pg.goto(url);
  await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 15000 });
  return pg;
}
const attr = (pg, k) => pg.locator("[data-outro]").getAttribute(k).catch(() => null);

export async function lossCheck(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));

  // 1. The previews: each film plays its four acts in order and ends on the Debrief of a lost game.
  for (const id of ["signal", "withdrawal"]) {
    for (const [w, h] of [[1400, 900], [390, 844]]) {
      const pg = await open(browser, url, w, h);
      watch(pg);
      await pg.getByRole("button", { name: "System options" }).click();
      await pg.locator(`[data-action=outro-preview][data-outro-id=${id}]`).click();
      const shown = await pg.waitForSelector(`[data-outro=${id}]`, { timeout: 5000 }).then(() => true, () => false);
      if (!shown) {
        fails.push(`${id} ${w}: not shown`);
        await pg.close();
        continue;
      }
      if (w < 600) {
        // Two taps skip straight to the card.
        await pg.waitForTimeout(1500);
        await pg.mouse.click(200, 400);
        await pg.waitForTimeout(150);
        await pg.mouse.click(200, 400);
      }
      await pg.waitForSelector("[data-outro][data-phase=debrief]", { timeout: 14000 }).catch(() => {});
      await pg.waitForTimeout(1300);
      const acts = await attr(pg, "data-acts");
      const result = await attr(pg, "data-loss");
      const note = await pg.locator(".ou-note").innerText().catch(() => "");
      const card = await pg.locator(".ou-card.in").count();
      await pg.screenshot({ path: `${out}/ui-loss-${id}${w < 600 ? "-phone" : ""}.png` });
      if (w >= 600 && acts !== "1234") fails.push(`${id} ${w}: acts ${acts}`);
      if (result !== "lost" || !/Campaign lost/i.test(note) || card !== 1) fails.push(`${id} ${w}: card ${card} result ${result} note "${note}"`);
      await pg.locator("[data-action=outro-return]").click();
      const gone = await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 6000 }).then(() => true, () => false);
      if (!gone) fails.push(`${id} ${w}: did not close`);
      await pg.close();
    }
  }

  // 2. Reduced motion: no film, the card at once.
  {
    const pg = await open(browser, url, 1400, 900, true);
    watch(pg);
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator("[data-action=outro-preview][data-outro-id=withdrawal]").click();
    await pg.waitForTimeout(900);
    const phase = await attr(pg, "data-phase");
    const act = await attr(pg, "data-act");
    if (phase !== "debrief" || act !== "4") fails.push(`reduced motion: phase ${phase} act ${act}`);
    await pg.screenshot({ path: `${out}/ui-loss-still.png` });
    await pg.close();
  }

  // 3. A real game conceded from the Menu: one of the two plays, "Campaign conceded", the game's own score.
  if (existsSync(`${out}/drag-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.getByRole("button", { name: "Paste a save…" }).click();
    await pg.locator("#textbox-text").fill(readFileSync(`${out}/drag-save.json`, "utf8"));
    await pg.getByRole("button", { name: "Load" }).click();
    await pg.waitForSelector(".game[data-prompt]", { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    await pg.getByRole("button", { name: "Menu" }).click();
    await pg.locator(".menu-wrap button.danger", { hasText: "Concede" }).click();
    await pg.getByRole("button", { name: "Concede" }).last().click();
    const id = await pg.waitForSelector("[data-outro]", { timeout: 8000 }).then(() => attr(pg, "data-outro"), () => null);
    if (id !== "signal" && id !== "withdrawal") fails.push(`concede: outro ${id}`);
    else {
      const plain = await pg.locator(".q-card h3", { hasText: "Game over" }).count();
      await pg.waitForSelector("[data-outro][data-phase=debrief]", { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(1300);
      const result = await attr(pg, "data-loss");
      const note = await pg.locator(".ou-note").innerText().catch(() => "");
      const score = await pg.locator(".ou-score-n").getAttribute("data-score").catch(() => null);
      await pg.screenshot({ path: `${out}/ui-loss-concede.png` });
      if (plain || result !== "conceded" || !/Campaign conceded/i.test(note) || score === null) fails.push(`concede: plain card ${plain}, result ${result}, note "${note}", score ${score}`);
      await pg.locator("[data-action=outro-return]").click();
      const back = await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 8000 }).then(() => true, () => false);
      if (!back) fails.push("concede: not back on the Command Deck");
    }
    await pg.close();
  } else fails.push("no drag-save.json for the concede");

  if (errors.length) fails.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  console.log(await lossCheck(browser, process.argv[2] ?? "http://localhost:4174/", process.argv[3] ?? "dist/ui-check"));
  await browser.close();
}

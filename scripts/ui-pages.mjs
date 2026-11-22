// Browser check of the statistics page and the Campaign editor (designer 2026-11-18), called by
// ui-smoke.mjs; can also run alone: node scripts/ui-pages.mjs [url] [outDir].
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const rec = (p) => ({
  date: "2026-11-18",
  campaign: "C1",
  company: "V1",
  freshness: "fresh",
  result: "won",
  score: 24,
  missions: [
    { mission: "C1_M1", threat: ["A", "B"] },
    { mission: "C1_M2X", threat: ["A"] },
  ],
  heatModule: false,
  developer: false,
  stats: { overloads: 41, moduleRuns: { 1: 12, 26: 7, 40: 3 }, destroyed: { Bot: 77, Sentinel: 24, Omega: 9, Gyro: 6, Sleeper: 4 }, triggered: { Sentinel: 30, Flare: 21, Sleeper: 5, Omega: 3 }, drained: 11 },
  ...p,
});
/** A save with three finished games (one in Developer mode) and no game in progress. */
const SAVE = JSON.stringify({
  formatVersion: 8,
  profile: { sheets: {}, highScores: {}, history: [rec({}), rec({ date: "2026-11-19", result: "lost", score: 6, company: "V2", freshness: "veteran" }), rec({ date: "2026-11-20", developer: true, score: 40 })] },
  settings: { autoAnswer: true },
});

export async function pagesCheck(browser, url, out) {
  const fails = [];
  const errors = [];
  for (const [w, h] of [
    [1400, 900],
    [390, 844],
  ]) {
    const name = w < 600 ? "-phone" : "";
    const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    pg.on("dialog", (d) => d.accept());
    await pg.addInitScript(() => {
      try {
        localStorage.setItem("aphelion5.intro", "off");
        localStorage.removeItem("aphelion5.editor");
      } catch {}
    });
    await pg.goto(url);
    await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 10000 });
    // A save with finished games, pasted in.
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.getByRole("button", { name: "Paste a save…" }).click();
    await pg.locator("#textbox-text").fill(SAVE);
    await pg.getByRole("button", { name: "Load" }).click();
    await pg.waitForTimeout(400);

    // Statistics: the counted games' totals (the Developer-mode game left out), achievements, the games list.
    await pg.locator("[data-action=open-stats]").click();
    await pg.waitForSelector("[data-page=stats]", { timeout: 4000 });
    const total = async (k) => ((await pg.locator(`[data-total=${k}] div`).first().innerText().catch(() => "")) ?? "").trim();
    const games = await total("games");
    const best = await total("best");
    // Round 29: Best score first, Lost and Conceded one box, no Overloads under "Triggered and drained";
    // a box opens into one row per Campaign; a Vessel opens into its wins per Campaign.
    const order = await pg.locator("[data-total]").evaluateAll((els) => els.map((e) => e.getAttribute("data-total")).join());
    const lostBox = await total("lost");
    await pg.locator("[data-total=games]").click();
    const perGames = await pg.locator("[data-breakdown=games] [data-campaign]").count();
    await pg.locator("[data-total=won]").click();
    const perWon = await pg.locator("[data-breakdown=won] [data-campaign]").count();
    const oneOpen = await pg.locator("[data-breakdown-of]").count();
    await pg.locator("[data-vessel] button").first().click();
    const perVessel = await pg.locator("[data-vessel] [data-breakdown] [data-campaign]").count();
    await pg.locator("[data-count='Bots'] button").click();
    const perBots = await pg.locator("[data-count='Bots'] [data-campaign]").count();
    const triggeredOverloads = await pg.locator("section", { hasText: "Triggered and drained" }).getByText("Overloads", { exact: true }).count();
    await pg.screenshot({ path: `${out}/ui-stats-open${name}.png`, fullPage: true });
    const stats29 = order === "best,games,won,lost,missions,threat,overloads" && lostBox === "1" && perGames >= 1 && perWon >= 1 && oneOpen === 1 && perVessel >= 1 && perBots >= 1 && triggeredOverloads === 0;
    if (!stats29) fails.push(`stats round 29 at ${w} px: order ${order}, lost ${lostBox}, per Campaign games ${perGames} won ${perWon}, open ${oneOpen}, vessel ${perVessel}, bots ${perBots}, Overloads in triggered ${triggeredOverloads}`);
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${out}/ui-stats${name}.png`, fullPage: false });
    await pg.locator("[data-tab=achievements]").click();
    const earned = await pg.locator("[data-earned='1']").count();
    const allAch = await pg.locator("[data-achievement]").count();
    await pg.screenshot({ path: `${out}/ui-stats-achievements${name}.png` });
    await pg.locator("[data-tab=games]").click();
    const listed = await pg.locator("[data-game]").count();
    await pg.locator("[data-game] > button").first().click();
    const opened = await pg.locator("[data-game] [data-module]").count();
    await pg.screenshot({ path: `${out}/ui-stats-games${name}.png` });
    const sw1 = await pg.evaluate(() => document.documentElement.scrollWidth);
    await pg.locator("[data-action=page-back]").click();
    const backStats = (await pg.locator("[data-page=stats]").count()) === 0 && (await pg.locator(".brief[data-step=campaign]").count()) === 1;
    if (!(games === "2" && best === "24" && earned >= 2 && allAch >= 10 && listed === 3 && opened > 0 && backStats && sw1 <= w + 2))
      fails.push(`stats at ${w} px: games ${games}, best ${best}, earned ${earned}/${allAch}, listed ${listed}, opened ${opened}, back ${backStats}, width ${sw1}`);

    // The Features page (designer 2026-11-22): a card per Feature with previews; a choice is kept and the Menu shows it too.
    {
      await pg.locator("[data-action=open-features]").click();
      await pg.waitForSelector("[data-page=features]", { timeout: 4000 });
      const cards = await pg.locator("[data-feature-card]").count();
      const picks = await pg.locator("[data-feature-pick]").count();
      const svgs = await pg.locator("[data-feature-pick] svg").count();
      await pg.locator('[data-feature-pick="corners:round"]').click();
      const pressed = await pg.locator('[data-feature-pick="corners:round"]').getAttribute("aria-pressed");
      const kept = await pg.evaluate(() => JSON.parse(localStorage.getItem("aphelion5.features") ?? "{}").corners);
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
      await pg.screenshot({ path: `${out}/ui-features${name}.png` });
      await pg.locator('[data-feature-pick="corners:pebble"]').click();
      await pg.locator("[data-action=page-back]").click();
      const back = (await pg.locator("[data-page=features]").count()) === 0;
      if (!(cards === 10 && picks === 76 && svgs === 76 && pressed === "true" && kept === "round" && back && sw <= w + 2))
        fails.push(`features at ${w} px: cards ${cards}, picks ${picks}, previews ${svgs}, pressed ${pressed}, kept ${kept}, back ${back}, width ${sw}`);
    }

    // The Campaign editor: only with Developer mode ticked.
    await pg.getByRole("button", { name: "System options" }).click();
    const hidden = (await pg.locator("[data-action=open-editor]").count()) === 0;
    await pg.getByLabel(/Developer mode/).check();
    await pg.locator("[data-action=open-editor]").click();
    await pg.waitForSelector("[data-page=editor]", { timeout: 4000 });
    // Start from Campaign 1 (a copy as C2).
    await pg.locator("[data-action=editor-file]").click();
    await pg.locator("[data-action=editor-from][data-from=C1]").click();
    const note = (await pg.locator("[data-file-note]").innerText().catch(() => "")) ?? "";
    await pg.getByRole("button", { name: "Close" }).click();
    const paneTab = async (id) => w < 1280 && (await pg.locator(`[data-pane-tab=${id}]`).click());
    await paneTab("mission");
    const missionSum = await pg.locator("[data-price=mission]").getAttribute("data-sum");
    const deckRows = await pg.locator("[data-deck]").count();
    const prices = await pg.locator("[data-pane=mission] [data-dev-price]").count();
    await pg.screenshot({ path: `${out}/ui-editor-deck${name}.png` });
    // The deck stepper stops at the copies that exist.
    const o1 = pg.locator("[data-deck=O_01]");
    const plusO1 = o1.getByRole("button", { name: /one more/ });
    let n = 0;
    while (n < 20 && (await plusO1.isEnabled())) {
      await plusO1.click();
      n++;
    }
    const o1n = Number(await o1.locator("b").first().innerText());
    await pg.locator("[data-mtab=threats]").click();
    const threatSums = await pg.locator("[data-price^=threat-]").count();
    await pg.screenshot({ path: `${out}/ui-editor-threats${name}.png` });
    await pg.locator("[data-mtab=map]").click();
    const sectorsBefore = await pg.locator("[data-hex][data-on='1']").count();
    await pg.locator("[data-hex='2,2']").dispatchEvent("pointerdown");
    const sectorsAfter = await pg.locator("[data-hex][data-on='1']").count();
    await pg.screenshot({ path: `${out}/ui-editor-map${name}.png` });
    await pg.locator("[data-mtab=goal]").click();
    await pg.getByLabel("Mission event").selectOption("gain_energy");
    await pg.locator("[data-energy=Red]").getByRole("button", { name: /one more/ }).click();
    const eventText = await pg.locator("[data-event-text]").innerText();
    await pg.locator("[data-mtab=check]").click();
    const problems = await pg.locator("[data-problem]").count();
    await pg.screenshot({ path: `${out}/ui-editor-check${name}.png` });
    // Campaign pane: the Campaign's sum, an Omega effect made from blocks.
    await paneTab("campaign");
    const campaignSum = await pg.locator("[data-price=campaign]").getAttribute("data-sum");
    const omega = pg.locator("[data-omega=O_01] [data-effect='At Overload']");
    await omega.locator("[data-action=add-step]").click();
    const blockText = await omega.locator("[data-effect-text]").innerText();
    await pg.screenshot({ path: `${out}/ui-editor-campaign${name}.png` });
    await paneTab("palette");
    const palette = await pg.locator("[data-pane=palette] [data-tile]").count();
    await pg.screenshot({ path: `${out}/ui-editor-palette${name}.png` });
    // Export: the Campaign file text.
    await pg.locator("[data-action=editor-export]").click();
    const file = await pg.locator("[data-export=campaign]").inputValue();
    await pg.getByRole("button", { name: "Close" }).click();
    const sw2 = await pg.evaluate(() => document.documentElement.scrollWidth);
    // The draft is kept: reopen the page.
    await pg.locator("[data-action=page-back]").click();
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator("[data-action=open-editor]").click();
    const kept = (await pg.locator("[data-page=editor]").getAttribute("data-page")) === "editor" && /C2/.test((await pg.locator("[data-page=editor] h1 + div").innerText().catch(() => "")) ?? "");
    await pg.close();
    const ok =
      hidden && /C2/.test(note) && Number(missionSum) !== 0 && deckRows > 10 && prices > 10 && o1n === 10 && threatSums === 4 && sectorsAfter === sectorsBefore + 1 && /Red/.test(eventText) && problems > 0 &&
      Number(campaignSum) !== 0 && /^Boost/.test(blockText) && palette > 10 && /=== SECTION: MISSIONS ===/.test(file) && /id: C2_M1/.test(file) && /event_energy: 1 Red/.test(file) && sw2 <= w + 2 && (w < 600 || kept);
    if (!ok)
      fails.push(
        `editor at ${w} px: hidden ${hidden}, note "${note}", mission sum ${missionSum}, deck rows ${deckRows}, prices ${prices}, O_01 max ${o1n}, threat sums ${threatSums}, sectors ${sectorsBefore}->${sectorsAfter}, event "${eventText}", problems ${problems}, campaign sum ${campaignSum}, block "${blockText}", palette ${palette}, file ${file.length}, width ${sw2}, kept ${kept}`,
      );
  }
  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ pagesCheck: await pagesCheck(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

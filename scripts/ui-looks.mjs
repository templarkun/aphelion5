// Browser check of the round of 2026-11-20 (designer): the big PC screen sizes, the Allied Drop look,
// no Ally line, and the trial looks in the Menu. Called by ui-smoke.mjs; can also run alone:
// node scripts/ui-looks.mjs [url] [outDir]  (needs dist/ui-check/allieddrop-save.json and alert-save.json).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function open(browser, url, w, h, init) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pg.addInitScript((t) => {
    try {
      localStorage.setItem("aphelion5.intro", "off");
      localStorage.setItem("aphelion5.intro.intro2", "seen");
      if (t) localStorage.setItem("aphelion5.trialLooks", t);
      else localStorage.removeItem("aphelion5.trialLooks");
    } catch {}
  }, init ?? "");
  await pg.goto(url);
  await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 10000 });
  return pg;
}
async function paste(pg, file) {
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(file, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForSelector(".game[data-prompt]", { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
}
const zoomOf = (pg, sel) => pg.locator(sel).first().evaluate((el) => getComputedStyle(el).zoom).catch(() => "?");

export async function looksCheck(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));

  // 1. Setup screens: 1.35 times bigger at 1920 px, unchanged at 1366 px (an iPad Pro sideways).
  for (const [w, want] of [
    [1920, "1.35"],
    [1366, "1"],
  ]) {
    const pg = await open(browser, url, w, 1000);
    watch(pg);
    const z = await zoomOf(pg, ".brief header.z-10");
    const allTile = await pg.locator("[data-compact='1'] svg.bf-tile").first().getAttribute("width").catch(() => "?");
    await pg.locator("[data-filter=Sentinel]").click().catch(() => {});
    await pg.waitForTimeout(300);
    const typeTile = await pg.locator("[data-compact='0'] svg.bf-tile").first().getAttribute("width").catch(() => "?");
    if (w === 1920) await pg.screenshot({ path: `${out}/ui-big-briefing.png` });
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    await pg.close();
    const typeWant = w === 1920 ? "96" : "60";
    if (z !== want || typeTile !== typeWant || sw > w) fails.push(`briefing at ${w} px: zoom ${z} (want ${want}), All tile ${allTile}, type tile ${typeTile} (want ${typeWant}), page width ${sw}`);
  }

  // 2. The game at 1920 px: panels zoomed, Field not; the Anomaly bubbles keep their height; no "Ally" line.
  if (existsSync(`${out}/alert-save.json`)) {
    for (const w of [1920, 1366]) {
      const pg = await open(browser, url, w, 1000);
      watch(pg);
      await paste(pg, `${out}/alert-save.json`);
      const panel = await zoomOf(pg, ".game > .left.panel");
      const field = await zoomOf(pg, ".field");
      const anomalyH = await pg.locator(".anomaly").first().evaluate((el) => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
      const ally = await pg.locator(".left.panel").innerText().then((t) => /\bAlly\b/.test(t));
      if (w === 1920) await pg.screenshot({ path: `${out}/ui-big-game.png` });
      await pg.close();
      const want = w === 1920 ? "1.25" : "1";
      if (panel !== want || field !== "1" || anomalyH < 55 || anomalyH > 66 || ally) fails.push(`game at ${w} px: panel zoom ${panel} (want ${want}), field zoom ${field}, Anomaly height ${anomalyH}, Ally line ${ally}`);
    }
  } else fails.push("no alert save");

  // 3. Allied Drop: the Mecha shown in a free corner of the Field; after "Put here" it is gone and the unit is on the sector.
  if (existsSync(`${out}/allieddrop-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/allieddrop-save.json`);
    const shown = await pg.locator("[data-ally-drop]").getAttribute("data-ally-drop").catch(() => null);
    // The card must not cover a sector centre.
    const clear = await pg.evaluate(() => {
      const card = document.querySelector("[data-ally-drop]")?.getBoundingClientRect();
      const f = document.querySelector(".field");
      if (!card || !f) return false;
      const r = f.getBoundingClientRect();
      const s = JSON.parse(f.dataset.sectors ?? "{}");
      return Object.values(s).every(([x, y]) => !(r.left + x > card.left && r.left + x < card.right && r.top + y > card.top && r.top + y < card.bottom));
    });
    await pg.screenshot({ path: `${out}/ui-allied-drop.png` });
    const prompt0 = await pg.locator(".game").getAttribute("data-prompt");
    const pt = await pg.evaluate(() => {
      const f = document.querySelector(".field");
      const r = f.getBoundingClientRect();
      const [k, [x, y]] = Object.entries(JSON.parse(f.dataset.sectors))[0];
      return { k, x: r.left + x, y: r.top + y };
    });
    await pg.mouse.click(pt.x, pt.y);
    await pg.waitForTimeout(450);
    await pg.screenshot({ path: `${out}/ui-allied-drop-fall.png` });
    await pg.waitForTimeout(1500);
    const gone = (await pg.locator("[data-ally-drop]").count()) === 0;
    const prompt1 = await pg.locator(".game").getAttribute("data-prompt");
    await pg.close();
    if (!(shown && /^M_/.test(shown) && clear && gone && prompt1 !== prompt0)) fails.push(`Allied Drop: shown ${shown}, clear of sectors ${clear}, gone after ${gone}, prompt "${prompt0}" -> "${prompt1}"`);
  } else fails.push("no allied drop save");

  // 4. Trial looks in the Menu: every choice is offered, kept in this browser, and the Field is drawn again.
  if (existsSync(`${out}/alert-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/alert-save.json`);
    await pg.getByRole("button", { name: /Menu/ }).click();
    await pg.locator(".trial-looks summary").click();
    const offered = await pg.locator("[data-trial]").count();
    const shot = async () => (await pg.locator(".field canvas").screenshot()).toString("base64");
    await pg.waitForTimeout(300);
    const before = await shot();
    for (const id of ["corners:pebble", "depth:slab", "ready:runner"]) {
      await pg.locator(`[data-trial="${id}"]`).click();
      await pg.waitForTimeout(150);
    }
    const pressed = await pg.locator("[data-trial][aria-pressed=true]").evaluateAll((els) => els.map((e) => e.getAttribute("data-trial")).join());
    await pg.waitForTimeout(400);
    const after = await shot();
    const kept = await pg.evaluate(() => localStorage.getItem("aphelion5.trialLooks"));
    await pg.screenshot({ path: `${out}/ui-trial-looks.png` });
    await pg.close();
    const okKept = /pebble/.test(kept ?? "") && /slab/.test(kept ?? "") && /runner/.test(kept ?? "");
    if (!(offered === 18 && pressed === "corners:pebble,depth:slab,ready:runner" && before !== after && okKept)) fails.push(`trial looks: offered ${offered}, pressed ${pressed}, redrawn ${before !== after}, kept ${kept}`);
  }

  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ looksCheck: await looksCheck(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

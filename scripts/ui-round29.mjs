// Browser check of round 29 (designer 2026-11-22): the End the Overload button's seven looks, the six new
// Overload edges, Strike and Drain played as a long stream, the new Energy Gyro rewards and ready looks.
// Called by ui-smoke.mjs (group "round29"); can also run alone: node scripts/ui-round29.mjs [url] [outDir].
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function open(browser, url, w, h) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pg.addInitScript(() => {
    try {
      localStorage.setItem("aphelion5.intro", "off");
      localStorage.setItem("aphelion5.intro.intro2", "seen");
      localStorage.removeItem("aphelion5.features");
    } catch {}
  });
  await pg.goto(url);
  await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 10000 });
  return pg;
}
async function paste(pg, file, wait = ".game[data-prompt]") {
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(file, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForSelector(wait, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
}
/** Choose Features in the game's Menu, then close it. */
async function choose(pg, ids) {
  await pg.getByRole("button", { name: "Menu" }).click();
  if (!(await pg.locator(".features-menu[open]").count())) await pg.locator(".features-menu summary").click();
  for (const id of ids) await pg.locator(`[data-feature="${id}"]`).click();
  await pg.locator(".menu-wrap > button").click();
  await pg.waitForTimeout(500);
}
/** How many lit pixels the End the Overload button's canvas has (0: nothing drawn). */
const litPixels = (pg) =>
  pg.evaluate(() => {
    const cv = document.querySelector(".end-overload canvas");
    if (!cv || !cv.width) return 0;
    const c = document.createElement("canvas");
    c.width = 60;
    c.height = 60;
    const g = c.getContext("2d");
    g.drawImage(cv, 0, 0, 60, 60);
    const d = g.getImageData(0, 0, 60, 60).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n;
  });

export async function round29Check(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));

  // 1. End the Overload: every look drawn on its canvas; the six new Overload edges; Strike and Drain long.
  if (existsSync(`${out}/exposure-save.json`)) {
    for (const [w, h] of [[1400, 900], [390, 844]]) {
      const pg = await open(browser, url, w, h);
      watch(pg);
      await paste(pg, `${out}/exposure-save.json`);
      const looks = ["sun", "reactor", "singularity", "orb", "hazard", "forge", "gate"];
      const bad = [];
      for (const look of w < 600 ? ["reactor", "gate"] : looks) {
        await choose(pg, [`endButton:${look}`]);
        const on = await pg.locator(`.end-overload[data-eo-look=${look}]`).count();
        const lit = await litPixels(pg);
        await pg.locator(".end-overload").screenshot({ path: `${out}/ui-eo-${look}${w < 600 ? "-phone" : ""}.png` }).catch(() => {});
        if (!(on === 1 && lit > 40)) bad.push(`${look} (shown ${on}, lit ${lit})`);
      }
      if (w >= 600) {
        for (const edge of ["loops", "tempest", "torrent", "breath", "embers", "rift"]) {
          await choose(pg, [`overload:${edge}`]);
          await pg.waitForTimeout(700);
          await pg.screenshot({ path: `${out}/ui-edge-${edge}.png` });
        }
        // Strike: still pouring 1.4 s after the press (it was a 0.95 s burst before round 29).
        await choose(pg, ["overload:original", "endButton:sun", "exposure:strike"]);
        await pg.locator(".end-overload").click();
        // CHANGED round 30: the Sun's own end (1.25 s) plays first; the stream (now 1.8 s) after it.
        await pg.waitForTimeout(2200);
        const streaming = await pg.locator("canvas.exposure-fx").count();
        await pg.screenshot({ path: `${out}/ui-exposure-strike-stream.png` });
        if (streaming !== 1) bad.push(`strike not streaming at 2.2 s (${streaming})`);
      }
      await pg.close();
      if (bad.length) fails.push(`end button at ${w} px: ${bad.join(", ")}`);
    }
  } else fails.push("no exposure save");

  // 2. Energy Gyro rewards (the new set) and the new ready looks for units, each drawn without an error.
  if (existsSync(`${out}/gyro-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/gyro-save.json`);
    for (const look of ["tokens", "orbit", "pips", "honeycomb", "chain", "string"]) {
      await choose(pg, [`gyroEnergy:${look}`]);
      await pg.locator(".field").screenshot({ path: `${out}/ui-gyro-${look}.png` });
    }
    for (const look of ["gyroscope"]) { // CHANGED round 30: Comet and Fountain removed
      await choose(pg, [`readyUnit:${look}`]);
      await pg.waitForTimeout(600);
      await pg.locator(".field").screenshot({ path: `${out}/ui-ready-${look}.png` });
    }
    const gone = await pg.locator('[data-feature="gyroEnergy:bar"], [data-feature="readyUnit:corona"], [data-feature="readyUnit:chase"], [data-feature="overload:storm"]').count();
    await pg.close();
    if (gone) fails.push(`removed Features still offered (${gone})`);
  } else fails.push("no gyro save");

  if (errors.length) fails.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  return fails.length ? `failed (${fails.join("; ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const r = await round29Check(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check");
  console.log(JSON.stringify({ round29Check: r }));
  await browser.close();
}

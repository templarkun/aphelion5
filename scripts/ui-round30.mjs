// Browser check of round 30 (designer 2026-11-22): each End the Overload look plays its own end on the page
// before Exposure; the Overload edge looks' new second parts and the two new looks draw without an error;
// the new ready looks. Called by ui-smoke.mjs (group "round30"); can also run alone:
// node scripts/ui-round30.mjs [url] [outDir].
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
async function choose(pg, ids) {
  await pg.getByRole("button", { name: "Menu" }).click();
  if (!(await pg.locator(".features-menu[open]").count())) await pg.locator(".features-menu summary").click();
  for (const id of ids) await pg.locator(`[data-feature="${id}"]`).click();
  await pg.locator(".menu-wrap > button").click();
  await pg.waitForTimeout(400);
}
/** Lit pixels on the end's page canvas (sampled small). */
const burstLit = (pg) =>
  pg.evaluate(() => {
    const cv = document.querySelector("canvas.end-burst-fx");
    if (!cv) return -1;
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 100;
    const g = c.getContext("2d");
    g.drawImage(cv, 0, 0, 160, 100);
    const d = g.getImageData(0, 0, 160, 100).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n;
  });

export async function round30Check(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));

  if (existsSync(`${out}/exposure-save.json`)) {
    // 1. Every button look plays its own end on the page, then the Overload ends and Exposure follows.
    const bad = [];
    const looks = ["sun", "reactor", "singularity", "orb", "hazard", "forge", "gate"];
    for (const look of looks) {
      const pg = await open(browser, url, 1400, 900);
      watch(pg);
      await paste(pg, `${out}/exposure-save.json`);
      await choose(pg, [`endButton:${look}`, "exposure:strike"]);
      await pg.locator(".end-overload").click();
      await pg.waitForTimeout(250);
      const tag = await pg.locator("canvas.end-burst-fx").getAttribute("data-look").catch(() => null);
      // The brightest of a few samples: one sample on a slow machine can land on a thin frame.
      let lit = await burstLit(pg);
      for (let i = 0; i < 4 && lit <= 60; i++) { await pg.waitForTimeout(80); lit = Math.max(lit, await burstLit(pg)); }
      await pg.screenshot({ path: `${out}/ui-end-${look}.png` });
      // Gone after its time; Exposure's canvas comes after it; the Overload over.
      await pg.waitForFunction(() => !document.querySelector("canvas.end-burst-fx"), null, { timeout: 4000 }).catch(() => {});
      const left = await pg.locator("canvas.end-burst-fx").count();
      const exp = await pg.waitForSelector("canvas.exposure-fx", { timeout: 2500 }).then(() => 1).catch(() => 0);
      await pg.waitForTimeout(2200);
      const btn = await pg.locator(".end-overload").count();
      await pg.close();
      if (!(tag === look && lit > 60 && left === 0 && exp === 1 && btn === 0)) bad.push(`${look} (look ${tag}, lit ${lit}, left ${left}, exposure ${exp}, button ${btn})`);
    }
    if (bad.length) fails.push(`end animations: ${bad.join(", ")}`);

    // 2. The Overload edges: Inflow by default; every other one with its partner; the two new ones.
    const pg2 = await open(browser, url, 1400, 900);
    watch(pg2);
    await paste(pg2, `${out}/exposure-save.json`);
    const def = await pg2.evaluate(() => document.querySelector('[data-feature="overload:inflow"]') ? 1 : 0);
    await pg2.getByRole("button", { name: "Menu" }).click();
    if (!(await pg2.locator(".features-menu[open]").count())) await pg2.locator(".features-menu summary").click();
    const inflowOn = await pg2.locator('[data-feature="overload:inflow"]').getAttribute("aria-pressed");
    await pg2.locator(".menu-wrap > button").click();
    const shots = new Set();
    for (const edge of ["original", "loops", "tempest", "torrent", "breath", "embers", "rift", "pulsar", "swarm"]) {
      await choose(pg2, [`overload:${edge}`]);
      await pg2.waitForTimeout(900);
      const buf = await pg2.locator(".field").screenshot({ path: `${out}/ui-edge30-${edge}.png` });
      shots.add(buf.toString("base64").slice(-4000));
    }
    await pg2.close();
    if (inflowOn !== "true" || shots.size < 9) fails.push(`edges: Inflow default ${inflowOn} (${def}), different pictures ${shots.size} of 9`);
  } else fails.push("no exposure save");

  // 3. The new ready looks for units (and the sectors' list).
  if (existsSync(`${out}/gyro-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/gyro-save.json`);
    for (const look of ["helix", "radar", "fieldlines", "constellation"]) {
      await choose(pg, [`readyUnit:${look}`]);
      await pg.waitForTimeout(500);
      await pg.locator(".field").screenshot({ path: `${out}/ui-ready-${look}.png` });
    }
    for (const look of ["warp", "nebula"]) {
      await choose(pg, [`readySector:${look}`]);
      await pg.waitForTimeout(500);
      await pg.locator(".field").screenshot({ path: `${out}/ui-ready-${look}.png` });
    }
    const gone = await pg.locator('[data-feature="readyUnit:comet"], [data-feature="readyUnit:fountain"], [data-feature="readyUnit:sparkle"], [data-feature="readyUnit:motes"], [data-feature="readySector:embers"], [data-feature="readySector:rain"]').count();
    await pg.close();
    if (gone) fails.push(`removed ready looks still offered (${gone})`);
  } else fails.push("no gyro save");

  if (errors.length) fails.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  return fails.length ? `failed (${fails.join("; ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const r = await round30Check(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check");
  console.log(JSON.stringify({ round30Check: r }));
  await browser.close();
}

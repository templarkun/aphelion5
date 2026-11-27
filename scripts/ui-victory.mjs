// Browser check of Homecoming and Star Chart (designer 2026-11-27), two more victory outros, previewed
// from System options with sample numbers (7 missions won): four acts in order, what each act shows
// (14 escorts in formation, one salute burst per mission, the clamps locked; one star per mission, the
// links, the star chart, the new star, the flight back, the wave across the galaxy; 2026-11-27 longer), then the Debrief of a won game and back to the Command Deck. At 1400 px the film
// runs untouched (pictures on the way, for looking at); at 390 px two taps skip; reduced motion shows only
// the still picture and the card. Called by ui-smoke.mjs (group "outro"); alone: node scripts/ui-victory.mjs [url] [outDir].
import { createRequire } from "node:module";
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

/** What each film must have shown by the end (sample numbers: 7 missions won). */
const DONE = {
  homecoming: { "data-escorts": "14", "data-bursts": "7", "data-ring": "24", "data-docked": "1" },
  starchart: { "data-stars": "7", "data-links": "6", "data-chart": "1", "data-nova": "1", "data-ascended": "1", "data-wave": "1" },
};
/** Pictures on the way at 1400 px (seconds of film). */
const SHOTS = { homecoming: [1.0, 4.6, 7.4, 10.4], starchart: [2.6, 6.4, 8.9, 10.6, 12.6, 15.4, 16.8] };

export async function victoryCheck(browser, url, out) {
  const fails = [];
  const errors = [];
  for (const id of Object.keys(DONE)) {
    for (const [w, h] of [[1400, 900], [390, 844]]) {
      const pg = await open(browser, url, w, h);
      pg.on("pageerror", (e) => errors.push(`${id} ${w}: ${e.message}`));
      await pg.getByRole("button", { name: "System options" }).click();
      await pg.locator(`[data-action=outro-preview][data-outro-id=${id}]`).click();
      const shown = await pg.waitForSelector(`[data-outro=${id}]`, { timeout: 5000 }).then(() => true, () => false);
      if (!shown) {
        fails.push(`${id} ${w}: not shown`);
        await pg.close();
        continue;
      }
      const t0 = Date.now();
      if (w < 600) {
        await pg.waitForTimeout(1500);
        await pg.mouse.click(200, 400);
        await pg.waitForTimeout(150);
        await pg.mouse.click(200, 400);
      } else {
        for (const [i, sec] of SHOTS[id].entries()) {
          await pg.waitForTimeout(Math.max(0, sec * 1000 - (Date.now() - t0)));
          await pg.screenshot({ path: `${out}/ui-${id}-${i + 1}.png` });
        }
      }
      await pg.waitForSelector("[data-outro][data-phase=debrief]", { timeout: 14000 }).catch(() => {});
      await pg.waitForTimeout(1300);
      const acts = await attr(pg, "data-acts");
      const card = await pg.locator(".ou-card.in").count();
      const score = await pg.locator(".ou-score-n").getAttribute("data-score").catch(() => null);
      await pg.screenshot({ path: `${out}/ui-${id}-end${w < 600 ? "-phone" : ""}.png` });
      if (w >= 600) {
        if (acts !== "1234") fails.push(`${id} ${w}: acts ${acts}`);
        for (const [k, v] of Object.entries(DONE[id])) {
          const got = await attr(pg, k);
          if (got !== v) fails.push(`${id} ${w}: ${k} ${got} (want ${v})`);
        }
      }
      if (card !== 1 || score === null) fails.push(`${id} ${w}: card ${card} score ${score}`);
      await pg.locator("[data-action=outro-return]").click();
      const gone = await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 6000 }).then(() => true, () => false);
      if (!gone) fails.push(`${id} ${w}: did not close`);
      await pg.close();
    }
  }
  for (const id of Object.keys(DONE)) {
    const pg = await open(browser, url, 1400, 900, true);
    pg.on("pageerror", (e) => errors.push(`${id} still: ${e.message}`));
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator(`[data-action=outro-preview][data-outro-id=${id}]`).click();
    await pg.waitForTimeout(900);
    const phase = await attr(pg, "data-phase");
    const act = await attr(pg, "data-act");
    if (phase !== "debrief" || act !== "4") fails.push(`${id} reduced motion: phase ${phase} act ${act}`);
    await pg.screenshot({ path: `${out}/ui-${id}-still.png` });
    await pg.close();
  }
  if (errors.length) fails.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  console.log(await victoryCheck(browser, process.argv[2] ?? "http://localhost:4174/", process.argv[3] ?? "dist/ui-check"));
  await browser.close();
}

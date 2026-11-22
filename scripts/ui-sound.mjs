// Browser check of the sound (designer 2026-11-22): the three sliders in System options and in the game's
// Menu (kept after a reload, the Menu stays open while dragging), every packed file unpacks in the browser,
// and the game asks for the right sounds as things happen (End the Overload: its button, the Overload's end).
// Called by ui-smoke.mjs (group "sound"); can also run alone: node scripts/ui-sound.mjs [url] [outDir].
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function open(browser, url, w, h) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pg.addInitScript(() => {
    try {
      localStorage.setItem("aphelion5.intro", "off");
      localStorage.setItem("aphelion5.intro.intro2", "seen");
    } catch {}
  });
  await pg.goto(url);
  await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 10000 });
  return pg;
}
const setRange = (pg, sel, v) =>
  pg.locator(sel).first().evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);

export async function soundCheck(browser, url, out) {
  const fails = [];
  const errors = [];
  const pg = await open(browser, url, 1400, 900);
  pg.on("pageerror", (e) => errors.push(e.message));
  // 1. System options: three sliders; a change is kept after a reload.
  await pg.getByRole("button", { name: "System options" }).click();
  const n = await pg.locator('[role=dialog] input[type=range][data-volume]').count();
  await setRange(pg, '[role=dialog] [data-volume="music"]', 30);
  await pg.screenshot({ path: `${out}/ui-sound-options.png` });
  // The first tap made the player: every file unpacks.
  const known = await pg.evaluate(() => window.__sounds().length);
  const files = await pg.evaluate(() => window.__soundFiles());
  await pg.waitForFunction((k) => window.__soundDecoded() >= k, files, { timeout: 15000 }).catch(() => {});
  const decoded = await pg.evaluate(() => window.__soundDecoded());
  await pg.reload();
  await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 10000 });
  await pg.getByRole("button", { name: "System options" }).click();
  const kept = await pg.locator('[role=dialog] [data-volume="music"]').inputValue();
  if (n !== 3 || kept !== "30") fails.push(`options: sliders ${n}, music kept ${kept}`);
  if (known < 19 || files < 59 || decoded < files) fails.push(`files: ${known} sounds, ${decoded} of ${files} unpacked`);

  // 2. In the game: the Menu's sliders, the Menu stays open; End the Overload asks for its sounds.
  if (existsSync(`${out}/exposure-save.json`)) {
    await pg.getByRole("button", { name: "Paste a save…" }).click();
    await pg.locator("#textbox-text").fill(readFileSync(`${out}/exposure-save.json`, "utf8"));
    await pg.getByRole("button", { name: "Load" }).click();
    await pg.waitForSelector(".game[data-prompt]", { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    await pg.getByRole("button", { name: "Menu" }).click();
    const inMenu = await pg.locator('.menu input[type=range][data-volume]').count();
    await setRange(pg, '.menu [data-volume="sfx"]', 55);
    await pg.locator('.menu [data-volume="ambient"]').click();
    const stillOpen = await pg.locator(".menu").count();
    await pg.locator(".menu").screenshot({ path: `${out}/ui-sound-menu.png` });
    await pg.locator(".menu-wrap > button").click();
    if (inMenu !== 3 || !stillOpen) fails.push(`menu: sliders ${inMenu}, open after a slider tap ${stillOpen}`);
    await pg.evaluate(() => window.__soundLog.splice(0));
    await pg.locator(".end-overload").click();
    await pg.waitForTimeout(4500);
    const log = await pg.evaluate(() => [...window.__soundLog]);
    for (const want of ["tap", "end-button", "overload-end"]) if (!log.includes(want)) fails.push(`End the Overload: no "${want}" (${log.join(", ")})`);
  } else fails.push("no exposure save");
  await pg.close();
  if (errors.length) fails.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  return fails.length ? `failed (${fails.join("; ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const r = await soundCheck(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check");
  console.log(JSON.stringify({ soundCheck: r }));
  await browser.close();
}

// Browser check of the mission celebrations (designer 2026-11-20), called by ui-smoke.mjs; can also run
// alone: node scripts/ui-celebrate.mjs [url] [outDir]. The previews in System options (Alpha Down, Alpha
// Purge, Beta Breach, the three Gamma kills, the three wins, a kill and the win in one answer, Salvage) at 1400 and 390 px, one tap vs two taps,
// reduced motion, and a real game won with the Developer tool: the win plays first and the Upgrade sheet
// waits for it.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Notes every change of what the page shows (catcher, win phase and acts, preview) with its time, from the page itself. */
async function watch(pg) {
  await pg.evaluate(() => {
    window.__cb = [];
    const t0 = performance.now();
    let last = "";
    const tick = () => {
      const w = document.querySelector("[data-win]");
      const s = [document.querySelectorAll("[data-celebration]").length ? "catch" : "-", w ? `${w.getAttribute("data-phase")}${w.getAttribute("data-act")}` : "-", w?.getAttribute("data-acts") ?? "", document.querySelectorAll("[data-celebration-preview]").length ? "pv" : "-", document.documentElement.dataset.cbWon ? "gold" : "-"].join(" ");
      if (s !== last) window.__cb.push([Math.round(performance.now() - t0), s]);
      last = s;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const log = (pg) => pg.evaluate(() => window.__cb ?? []);
const until = async (pg, f, ms) => {
  for (let t = 0; t < ms; t += 100) {
    if (await f()) return true;
    await pg.waitForTimeout(100);
  }
  return false;
};

export async function celebrateCheck(browser, url, out) {
  const fails = [];
  const errors = [];
  const open = async (w, h, reduced = false) => {
    const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    if (reduced) await pg.emulateMedia({ reducedMotion: "reduce" });
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    return pg;
  };
  const preview = async (pg, kind, omega = "Alpha", piece = kind === "win" ? "" : "alphaDown", win = kind === "kill" ? "" : "missionComplete") => {
    await pg.goto(url);
    await pg.waitForSelector('.brief[data-step=campaign][data-busy="0"]', { timeout: 15000 });
    await pg.getByRole("button", { name: "System options" }).click();
    const listed = await pg.locator("[data-action=celebration-preview]").count();
    await watch(pg);
    await pg.locator(`[data-action=celebration-preview][data-kind=${kind}][data-omega=${omega}][data-piece="${piece}"][data-win-piece="${win}"]`).click();
    return listed;
  };
  /** How long the kill's catcher stayed (ms), from the page's own log. */
  const killMs = (l) => {
    const on = l.find(([, s]) => s.startsWith("catch"));
    const off = l.find(([t, s]) => on && t > on[0] && s.startsWith("-"));
    return on && off ? off[0] - on[0] : 0;
  };

  // 1. The kill (1400 px): one tap does not skip it; it plays about 4.5 s, with its label; then the preview closes.
  {
    const pg = await open(1400, 900);
    const listed = await preview(pg, "kill");
    const shown = await pg.waitForSelector("[data-celebration]", { timeout: 10000 }).then(() => true, () => false);
    await pg.waitForTimeout(500);
    await pg.mouse.click(700, 450);
    await pg.waitForTimeout(150);
    const armed = (await pg.locator("[data-action=outro-skip]").getAttribute("data-skip").catch(() => "")) ?? "";
    const goesOn = (await pg.locator("[data-celebration]").count()) === 1;
    await pg.waitForTimeout(1700);
    await pg.screenshot({ path: `${out}/ui-celebrate-kill.png` });
    const ended = await pg.waitForSelector("[data-celebration]", { state: "detached", timeout: 12000 }).then(() => true, () => false);
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 5000 }).then(() => true, () => false);
    const l = await log(pg);
    const ms = killMs(l);
    await pg.close();
    if (!(listed === 80 && shown && armed === "armed" && goesOn && ended && closed && ms > 3500 && ms < 9000)) fails.push(`kill: listed ${listed}, shown ${shown}, one tap ${armed}/${goesOn}, ended ${ended}, closed ${closed}, ${ms} ms`);
  }

  // 1b. Alpha Purge (1100 px), the second Alpha kill (I21), Rail Strike (1400 px) and Alpha Erased (390 px), the third and
  //     fourth, Burnout (1400 px) and Tether Rip (390 px), the fifth and sixth (designer 2026-11-28);
  //     fourth (designer 2026-11-27): about 4.5 s each, then the preview closes; Barrage (1400 px) and Cryo Shatter (390 px), the
  //     second and third Beta kills (designer 2026-11-27): about 6.7 s each; Fusion Ignition (1400 px) and Charge Cascade
  //     (390 px), the fifth Power Node's second and third (designer 2026-11-27): about 4.8 s each; Claim Markers (1100 px)
  //     and Terrain Survey (390 px), the third Cleared sector's second and third (designer 2026-11-27).
  for (const [w, h, piece, name, omega = "Alpha"] of [[1100, 760, "alphaPurge", "purge"], [1400, 900, "alphaRail", "rail"], [390, 844, "alphaErase", "erase"], [1400, 900, "alphaBurnout", "burnout"], [390, 844, "alphaTether", "tether"], [1400, 900, "betaBarrage", "barrage", "Beta"], [390, 844, "betaCryo", "cryo", "Beta"], [1400, 900, "salvageFusion", "fusion", "Salvage"], [390, 844, "salvageCascade", "cascade", "Salvage"], [1100, 760, "salvageClaim", "claim", "Salvage"], [390, 844, "salvageSurvey", "survey", "Salvage"]]) {
    const pg = await open(w, h);
    await preview(pg, "kill", omega, piece);
    const shown = await pg.waitForSelector("[data-celebration]", { timeout: 10000 }).then(() => true, () => false);
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: `${out}/ui-celebrate-${name}.png` });
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 14000 }).then(() => true, () => false);
    const ms = killMs(await log(pg));
    await pg.close();
    if (!(shown && closed && ms > (omega === "Beta" ? 5500 : 3500) && ms < (omega === "Beta" ? 11000 : 9000))) fails.push(`${piece}: shown ${shown}, closed ${closed}, ${ms} ms`);
  }

  // 1c. Beta Breach, then Mission Complete (1400 px): the longer kill (about 6.2 s), then the win for Beta (I22): "BETA ELIMINATED · 3 / 3", three badges.
  {
    const pg = await open(1400, 900);
    await preview(pg, "both", "Beta", "betaBreach");
    await pg.waitForSelector("[data-celebration]", { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(2900);
    await pg.screenshot({ path: `${out}/ui-celebrate-beta.png` });
    const played = await pg.waitForSelector("[data-win][data-phase=play]", { timeout: 20000 }).then(() => true, () => false);
    await pg.waitForSelector("[data-win][data-act='3']", { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const sub = ((await pg.locator(".cb-sub").innerText().catch(() => "")) ?? "").toLowerCase();
    const badges = await pg.locator(".cb-badges img").count();
    await pg.screenshot({ path: `${out}/ui-celebrate-beta-win.png` });
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 14000 }).then(() => true, () => false);
    const l = await log(pg);
    const first = l.find(([, s]) => s.startsWith("catch"));
    const play = l.find(([, s]) => / play/.test(s));
    const gap = first && play ? play[0] - first[0] : 0;
    const acts = l.map(([, s]) => s.split(" ")[2]).filter(Boolean).pop() ?? "";
    await pg.close();
    if (!(played && gap > 5000 && /beta eliminated · 3 \/ 3/.test(sub) && badges === 3 && acts === "1234" && closed)) fails.push(`Beta: played ${played}, kill then win ${gap} ms, sub "${sub}", badges ${badges}, acts "${acts}", closed ${closed}`);
  }

  // 1d. The Gamma kills (I26), each then Mission Complete for Gamma (I27): Event Horizon and Dimensional Shatter at 1400 px,
  // Field Array at 390 px; about 8 s each, "GAMMA ELIMINATED · 2 / 2", two badges.
  for (const [piece, w, h] of [
    ["gammaHorizon", 1400, 900],
    ["gammaArray", 390, 844],
    ["gammaShatter", 1400, 900],
  ]) {
    const pg = await open(w, h);
    await preview(pg, "both", "Gamma", piece);
    await pg.waitForSelector("[data-celebration]", { timeout: 10000 }).catch(() => {});
    // A picture in the middle of each: the singularity, the cut, the shards hanging in bullet time.
    await pg.waitForTimeout(piece === "gammaHorizon" ? 2600 : piece === "gammaShatter" ? 3300 : 4300);
    await pg.screenshot({ path: `${out}/ui-celebrate-${piece}.png` });
    const played = await pg.waitForSelector("[data-win][data-phase=play]", { timeout: 25000 }).then(() => true, () => false);
    await pg.waitForSelector("[data-win][data-act='3']", { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const sub = ((await pg.locator(".cb-sub").innerText().catch(() => "")) ?? "").toLowerCase();
    const badges = await pg.locator(".cb-badges img").count();
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 14000 }).then(() => true, () => false);
    const l = await log(pg);
    const first = l.find(([, s]) => s.startsWith("catch"));
    const play = l.find(([, s]) => / play/.test(s));
    const gap = first && play ? play[0] - first[0] : 0;
    await pg.close();
    if (!(played && gap > 6500 && /gamma eliminated · 2 \/ 2/.test(sub) && badges === 2 && closed)) fails.push(`${piece}: played ${played}, kill then win ${gap} ms, sub "${sub}", badges ${badges}, closed ${closed}`);
  }

  // 2. The win (1400 px): the Trophy flies in, four acts in order, the banner and six badges, the Mission bar gold; then it closes.
  {
    const pg = await open(1400, 900);
    await preview(pg, "win");
    const shown = await pg.waitForSelector("[data-win]", { timeout: 10000 }).then(() => true, () => false);
    // Read while it plays (a slow machine may be past it by the end of the pictures below).
    const from = await pg.locator("[data-win]").getAttribute("data-from", { timeout: 2000 }).catch(() => "");
    await pg.waitForSelector("[data-win][data-act='3']", { timeout: 12000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const title = ((await pg.locator(".cb-title").innerText().catch(() => "")) ?? "").toLowerCase();
    const sub = ((await pg.locator(".cb-sub").innerText().catch(() => "")) ?? "").toLowerCase();
    const badges = await pg.locator(".cb-badges img").count();
    await pg.screenshot({ path: `${out}/ui-celebrate-win.png` });
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 12000 }).then(() => true, () => false);
    const l = (await log(pg)).map(([, s]) => s);
    const flew = l.some((s) => / fly0 /.test(s));
    const acts = l.map((s) => s.split(" ")[2]).filter(Boolean).pop() ?? "";
    const gold = l.some((s) => s.endsWith("gold"));
    await pg.close();
    if (!(shown && flew && acts === "1234" && title === "mission complete" && /alpha eliminated · 6 \/ 6/.test(sub) && badges === 6 && gold && from === "0,1" && closed)) fails.push(`win: shown ${shown}, flew ${flew}, acts "${acts}", title "${title}", sub "${sub}", badges ${badges}, gold ${gold}, from "${from}", closed ${closed}`);
  }

  // 3. Both in one answer (390 px): the kill, then the win goes on from it; two taps skip the rest.
  {
    const pg = await open(390, 844);
    await preview(pg, "both");
    await pg.waitForSelector("[data-celebration]", { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(2600);
    await pg.screenshot({ path: `${out}/ui-celebrate-kill-phone.png` });
    const played = await pg.waitForSelector("[data-win][data-phase=play]", { timeout: 15000 }).then(() => true, () => false);
    await pg.waitForSelector("[data-win][data-act='3']", { timeout: 6000 }).catch(() => {});
    await pg.waitForTimeout(700);
    await pg.screenshot({ path: `${out}/ui-celebrate-win-phone.png` });
    const box = await pg.locator(".cb-band").boundingBox({ timeout: 8000 }).catch(() => null);
    await pg.mouse.click(195, 300);
    await pg.mouse.click(195, 300);
    const skipped = await pg.waitForSelector("[data-win]", { state: "detached", timeout: 3000 }).then(() => true, () => false);
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 4000 }).then(() => true, () => false);
    const l = await log(pg);
    // The kill's catcher came with the answer; the win's play only after the kill (at least its 3.6 s).
    const first = l.find(([, s]) => s.startsWith("catch"));
    const play = l.find(([, s]) => / play/.test(s));
    const gap = first && play ? play[0] - first[0] : 0;
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth).catch(() => 390);
    await pg.close();
    if (!(played && gap > 3500 && box && box.width <= 392 && skipped && closed && sw <= 392)) fails.push(`both: played ${played}, kill then win ${gap} ms, band ${JSON.stringify(box)}, skipped ${skipped}, closed ${closed}, width ${sw}`);
  }

  // 4. Reduced motion: a still close-up, then the still banner, about 1.5 s each.
  {
    const pg = await open(1100, 760, true);
    await preview(pg, "both");
    const still = await pg.waitForSelector("[data-win][data-still='1']", { timeout: 10000 }).then(() => true, () => false);
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 12000 }).then(() => true, () => false);
    const l = await log(pg);
    const first = l.find(([, s]) => s.startsWith("catch"));
    const last = l.findLast(([, s]) => s.startsWith("catch"));
    const end = l.find(([t, s]) => last && t > last[0] && s.startsWith("-"));
    const ms = first && end ? end[0] - first[0] : 0;
    await pg.close();
    if (!(still && closed && ms > 2000 && ms < 8000)) fails.push(`reduced motion: still ${still}, closed ${closed}, ${ms} ms`);
  }

  // 4b. Reduced motion, Dimensional Shatter alone: 2 s of light (the core's flash, the hexes lit ring by ring), then it closes.
  {
    const pg = await open(1100, 760, true);
    await preview(pg, "kill", "Gamma", "gammaShatter");
    const on = await pg.waitForSelector("[data-celebration]", { timeout: 10000 }).then(() => true, () => false);
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${out}/ui-celebrate-shatter-still.png` });
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 12000 }).then(() => true, () => false);
    const ms = killMs(await log(pg));
    await pg.close();
    if (!(on && closed && ms > 1500 && ms < 4000)) fails.push(`reduced motion, Dimensional Shatter: on ${on}, closed ${closed}, ${ms} ms`);
  }

  // 4c. The other wins (designer 2026-11-21, 2026-11-27): Perimeter Sweep for Gamma (1400 px), Sector Flip for Salvage (390 px),
  //     Chain Surge for Alpha (1400 px), Beacon Spiral for Beta (390 px),
  //     Resonance for Gamma (1400 px), Murmuration for Salvage (390 px), Singularity for Alpha (1400 px), Armillary for Beta (390 px),
  //     Aurora for Gamma (1400 px), Circuit Trace for Salvage (390 px):
  //     four acts, the banner, the line under it, the badges (Salvage: five Power Nodes and three Cleared sectors), the bar gold.
  for (const [w, h, omega, win, want, imgs, all] of [
    [1400, 900, "Gamma", "perimeterSweep", /gamma eliminated · 2 \/ 2/, 2, 2],
    [390, 844, "Salvage", "sectorFlip", /power nodes 5 \/ 5 · cleared 3 \/ 3/, 5, 8],
    [1400, 900, "Alpha", "chainSurge", /alpha eliminated · 6 \/ 6/, 6, 6],
    [390, 844, "Beta", "beaconSpiral", /beta eliminated · 3 \/ 3/, 3, 3],
    [1400, 900, "Gamma", "resonance", /gamma eliminated · 2 \/ 2/, 2, 2],
    [390, 844, "Salvage", "murmuration", /power nodes 5 \/ 5 · cleared 3 \/ 3/, 5, 8],
    [1400, 900, "Alpha", "singularity", /alpha eliminated · 6 \/ 6/, 6, 6],
    [390, 844, "Beta", "armillary", /beta eliminated · 3 \/ 3/, 3, 3],
    [1400, 900, "Gamma", "aurora", /gamma eliminated · 2 \/ 2/, 2, 2],
    [390, 844, "Salvage", "circuitTrace", /power nodes 5 \/ 5 · cleared 3 \/ 3/, 5, 8],
  ]) {
    const pg = await open(w, h);
    await preview(pg, "win", omega, "", win);
    const shown = await pg.waitForSelector(`[data-win="${win}"]`, { timeout: 12000 }).then(() => true, () => false);
    await pg.waitForSelector("[data-win][data-act='2']", { timeout: 12000 }).catch(() => {});
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: `${out}/ui-celebrate-${win}-2.png` });
    await pg.waitForSelector("[data-win][data-act='3']", { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const title = ((await pg.locator(".cb-title").innerText().catch(() => "")) ?? "").toLowerCase();
    const sub = ((await pg.locator(".cb-sub").innerText().catch(() => "")) ?? "").toLowerCase();
    const badges = await pg.locator(".cb-badges img").count();
    const places = await pg.locator(".cb-badges > .cb-badge").count();
    await pg.screenshot({ path: `${out}/ui-celebrate-${win}-3.png` });
    const closed = await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 12000 }).then(() => true, () => false);
    const l = (await log(pg)).map(([, s]) => s);
    const acts = l.map((s) => s.split(" ")[2]).filter(Boolean).pop() ?? "";
    const gold = l.some((s) => s.endsWith("gold"));
    await pg.close();
    if (!(shown && acts === "1234" && title === "mission complete" && want.test(sub) && badges === imgs && places === all && gold && closed)) fails.push(`${win} (${omega}, ${w} px): shown ${shown}, acts "${acts}", title "${title}", sub "${sub}", badges ${badges}/${places}, gold ${gold}, closed ${closed}`);
  }

  // 5. A real game, won with the Developer tool (Mission 1, Eliminate Alpha): the win plays from the middle of the
  //    Field, the Upgrade sheet waits for it; at 390 px two taps skip straight to the sheet.
  if (existsSync(`${out}/devwin-save.json`)) {
    for (const [w, h] of [[1400, 900], [390, 844]]) {
      const pg = await open(w, h);
      await pg.goto(url);
      await pg.getByRole("button", { name: "System options" }).click();
      await pg.getByRole("button", { name: "Paste a save…" }).click();
      await pg.locator("#textbox-text").fill(readFileSync(`${out}/devwin-save.json`, "utf8"));
      await pg.getByRole("button", { name: "Load" }).click();
      await pg.waitForSelector(".game[data-prompt]", { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(600);
      await watch(pg);
      await pg.getByRole("button", { name: "Menu" }).click();
      await pg.getByRole("button", { name: /Developer: win this mission/ }).click();
      const shown = await pg.waitForSelector("[data-win]", { timeout: 8000 }).then(() => true, () => false);
      const from = await pg.locator("[data-win]").getAttribute("data-from", { timeout: 2000 }).catch(() => "x");
      await pg.waitForTimeout(800);
      const sheetEarly = await pg.locator(".upsheet").count();
      if (w >= 600) {
        await pg.waitForSelector("[data-win][data-act='3']", { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await pg.screenshot({ path: `${out}/ui-celebrate-devwin.png` });
      }
      if (w < 600) {
        await pg.waitForSelector("[data-win][data-phase=play]", { timeout: 6000 }).catch(() => {});
        await pg.mouse.click(w / 2, h / 2);
        await pg.mouse.click(w / 2, h / 2);
      }
      const gone = await pg.waitForSelector("[data-win]", { state: "detached", timeout: 12000 }).then(() => true, () => false);
      const sheet = await until(pg, async () => (await pg.locator(".upsheet").count()) > 0, 5000);
      const l = (await log(pg)).map(([, s]) => s);
      const acts = l.map((s) => s.split(" ")[2]).filter(Boolean).pop() ?? "";
      const caught = (await pg.locator("[data-celebration]").count()) === 0;
      await pg.close();
      if (!(shown && from === "" && sheetEarly === 0 && gone && sheet && caught && (w < 600 || acts === "1234"))) fails.push(`Developer win at ${w} px: shown ${shown}, from "${from}", sheet while playing ${sheetEarly}, gone ${gone}, sheet after ${sheet}, acts "${acts}", catcher left ${!caught}`);
    }
  } else fails.push("no devwin save");

  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ celebrateCheck: await celebrateCheck(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

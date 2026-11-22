// Browser check of round 25 (designer 2026-11-21): the route screen before the Threat, no Field picture
// between the last preparation screen and the mission intro, the Upgrade sheet right after the win
// (no question bubbles in between), the Reserve colour card with its Modules lit, the Overhaul wrench
// beside the Flagship heading, the mouse showing no card over a plain Dark sector, the hover card gone
// while tiles are in the hand, the Anomaly notice.
// Called by ui-smoke.mjs; can also run alone: node scripts/ui-round25.mjs [url] [outDir].
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
async function at(pg, k) {
  const box = await pg.locator(".field").boundingBox();
  const s = JSON.parse((await pg.locator(".field").getAttribute("data-sectors")) ?? "{}");
  return { x: box.x + s[k][0], y: box.y + s[k][1] };
}
/** Every frame from now: what is on the page (read back with frames()). */
const record = (pg, what) =>
  pg.evaluate((src) => {
    const f = new Function(`return (${src})`)();
    window.__frames = [];
    const tick = () => {
      window.__frames.push(f());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, what.toString());
const frames = (pg) => pg.evaluate(() => window.__frames);

export async function round25Check(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));

  // 1. The route of Mission 2 on its own screen, then Threat and Module, then the intro with no Field picture before it.
  if (existsSync(`${out}/route-save.json`)) {
    for (const [w, h] of [[1400, 900], [390, 844]]) {
      const pg = await open(browser, url, w, h);
      watch(pg);
      await paste(pg, `${out}/route-save.json`, "[data-prep]");
      const kind = await pg.locator("[data-prep]").getAttribute("data-prep").catch(() => null);
      const picks = await pg.locator("[data-route-pick] [data-prep-pick]").count();
      const done = await pg.locator("[data-mission][data-status=done]").count();
      const openN = await pg.locator("[data-mission][data-status=open]").count();
      const locked = await pg.locator("[data-action=prep]").isDisabled();
      const pickId = await pg.locator("[data-prep-pick]").nth(1).getAttribute("data-prep-pick");
      await pg.locator("[data-prep-pick]").nth(1).click();
      // Round 29: the route picked is selected in the road of missions at once, its file open there (not twice).
      const file = (await pg.locator(`[data-mission-detail="${pickId}"]`).count()) + (await pg.locator(`[data-route-file="${pickId}"]`).count());
      const inRoad = await pg.locator(`[data-mission="${pickId}"][aria-pressed=true]`).count();
      // Any mission's file opens from the road.
      await pg.locator("[data-mission][data-status=later]").first().click();
      const roadFile = await pg.locator("[data-mission-detail]").count();
      await pg.screenshot({ path: `${out}/ui-route-${w}.png`, fullPage: false });
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth);
      await pg.locator("[data-action=prep]").click();
      await pg.waitForSelector("[data-threat-screen]", { timeout: 8000 }).catch(() => {});
      await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
      const mission = await pg.locator(".bar-title .long-name").textContent().catch(() => "");
      await pg.locator("[data-col-btn=A]").click();
      await pg.locator("[data-action=threat]").click();
      await pg.waitForSelector("[data-prep=module]", { timeout: 8000 }).catch(() => {});
      await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
      await pg.locator("[data-prep-pick]").first().click({ position: { x: 24, y: 16 } });
      await record(pg, () => {
        const mi = document.querySelector("[data-mission-intro]");
        return [!!document.querySelector("[data-prep]"), !!mi, mi ? getComputedStyle(mi).opacity : "", mi ? getComputedStyle(mi).backgroundColor : ""];
      });
      await pg.locator("[data-action=prep]").click();
      await pg.waitForSelector("[data-mission-intro]", { timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(600);
      const fr = await frames(pg);
      const first = fr.findIndex((x) => !x[0]);
      const intro = first >= 0 && fr[first][1];
      const solid = fr.filter((x) => x[1]).every((x) => x[2] === "1" && x[3] === "rgb(2, 4, 12)");
      await pg.close();
      if (!(kind === "route" && picks === 2 && done === 1 && openN === 2 && locked && file === 1 && inRoad === 1 && roadFile >= 1 && wide <= w && /2[XY]/.test(mission ?? "") && intro && solid))
        fails.push(`route at ${w} px: screen ${kind}, routes ${picks}, won ${done}, open ${openN}, locked first ${locked}, file ${file}, in road ${inRoad}, road file ${roadFile}, width ${wide}, then "${mission}", intro at once ${intro}, intro solid ${solid}`);
    }
  } else fails.push("no route save");

  // 2. The win, then the Upgrade sheet in the same picture: no question bubbles on the Field in between.
  if (existsSync(`${out}/devwin-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/devwin-save.json`);
    await record(pg, () => [!!document.querySelector("[data-win]"), !!document.querySelector(".upsheet"), document.querySelectorAll(".ask-bubble, .unit-picks, .q-card, .q-banner").length]);
    await pg.getByRole("button", { name: "Menu" }).click();
    await pg.getByRole("button", { name: /Developer: win this mission/ }).click();
    await pg.waitForSelector("[data-win]", { timeout: 8000 }).catch(() => {});
    await pg.waitForSelector("[data-win]", { state: "detached", timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(400);
    const fr = await frames(pg);
    const after = fr.slice(fr.findIndex((x) => x[0]));
    const end = after.findIndex((x) => !x[0]);
    const between = end >= 0 ? after.slice(end).filter((x) => !x[1] || x[2] > 0).length : -1;
    await pg.close();
    if (!(end > 0 && between === 0)) fails.push(`win to Upgrade sheet: win seen ${end > 0}, frames with bubbles or no sheet after it ${between}`);
  } else fails.push("no devwin save");

  // 3. Reserve colour card, Modules lit; the Overhaul wrench beside the Flagship heading.
  if (existsSync(`${out}/overclock-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/overclock-save.json`);
    const wrench = await pg.locator(".flagship-head [data-overhaul]").count();
    const bigGone = (await pg.locator(".overhaul-thing").count()) === 0;
    const results = [];
    for (const col of ["Yellow", "Red", "Blue"]) {
      await pg.locator(`[data-reserve=${col}]`).click();
      await pg.waitForTimeout(400);
      const card = await pg.locator(".res-card").isVisible().catch(() => false);
      const rows = await pg.locator(".res-card .res-counts li").count();
      const heat = await pg.locator(".res-card", { hasText: "Overclock" }).count();
      const lit = await pg.locator(`.module.pay-lit.${col.toLowerCase()}`).count();
      const said = await pg.locator(".res-card .small").first().textContent().catch(() => "");
      const wrongColour = await pg.locator(`.module.pay-lit:not(.rim-${col.toLowerCase()})`).count();
      if (col === "Red") await pg.screenshot({ path: `${out}/ui-reserve-card.png` });
      results.push({ col, card, rows, heat, lit, said, wrongColour });
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(200);
    }
    const litAfter = await pg.locator(".module.pay-lit").count();
    await pg.close();
    const ok = results.every((r) => r.card && r.rows === 3 && r.heat === 1 && r.wrongColour === 0 && (r.lit ? new RegExp(`Lit`).test(r.said) : /No /.test(r.said)));
    if (!(ok && wrench === 1 && bigGone && litAfter === 0)) fails.push(`Reserve / Overhaul: ${JSON.stringify(results)}, wrench ${wrench}, big button gone ${bigGone}, lit after closing ${litAfter}`);
  } else fails.push("no overclock save");

  // 4. The mouse over a plain Dark sector shows nothing; over the sector with tiles looked at, both bubbles.
  if (existsSync(`${out}/seen-save.json.plan.json`)) {
    const plan = JSON.parse(readFileSync(`${out}/seen-save.json.plan.json`, "utf8"));
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/seen-save.json`);
    let plainShown = 0;
    for (const k of plan.plain.slice(0, 3)) {
      const p = await at(pg, k);
      await pg.mouse.move(p.x - 3, p.y);
      await pg.mouse.move(p.x, p.y);
      await pg.waitForTimeout(300);
      plainShown += await pg.locator(".info-pair").count();
    }
    const p = await at(pg, plan.sector);
    await pg.mouse.move(p.x - 3, p.y);
    await pg.mouse.move(p.x, p.y);
    await pg.waitForTimeout(400);
    const seenShown = await pg.locator(".info-pair .seen-bubble").count();
    await pg.close();
    if (!(plan.plain.length > 0 && plainShown === 0 && seenShown === 1)) fails.push(`hover: plain sectors ${plan.plain.length}, card shown on them ${plainShown}, looked-at sector card ${seenShown}`);
  } else fails.push("no seen plan");

  // 5. The Anomaly notice when a met card can be claimed.
  if (existsSync(`${out}/anomaly-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/anomaly-save.json`);
    const notice = await pg.locator(".ask-bubble", { hasText: /ready to claim/ }).count();
    const claim = await pg.locator(".anomaly .claim").first().isVisible().catch(() => false);
    await pg.screenshot({ path: `${out}/ui-anomaly-notice.png` });
    await pg.close();
    if (!(notice === 1 && claim)) fails.push(`Anomaly notice ${notice}, claim button ${claim}`);
  } else fails.push("no anomaly save");

  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ round25Check: await round25Check(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

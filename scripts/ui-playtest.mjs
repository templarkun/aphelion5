// Browser check of the Campaign editor round of 2026-11-27 (designer): the map at 3 rings, no Bots in
// the palette, the middle column's order, the unit card on hover, and "Play this mission" (the Upgrade
// sheet first with Upgrade points, the Threat screen, a Developer win, the playtest card, back to the
// editor). Called by ui-smoke.mjs in group "pages"; can also run alone: node scripts/ui-playtest.mjs [url] [outDir].
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

async function openEditor(browser, url, w, h, errors) {
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
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByLabel(/Developer mode/).check();
  await pg.locator("[data-action=open-editor]").click();
  await pg.waitForSelector("[data-page=editor]", { timeout: 4000 });
  return pg;
}

export async function playtestCheck(browser, url, out) {
  const fails = [];
  const errors = [];

  // 1. A new draft: the map is 3 rings round (0, 0) plus the edge ring (3+1), no Bots to add, the column's order.
  {
    const pg = await openEditor(browser, url, 1400, 900, errors);
    await pg.locator("[data-mtab=map]").click();
    const hexes = await pg.locator("[data-hex]").count();
    await pg.locator("[data-action=palette-add]").click();
    const types = await pg.locator("[data-picker] > div:first-child button").allInnerTexts();
    const order = await pg.locator("[data-pane=campaign] .bf-label").allInnerTexts();
    await pg.close();
    // 3 rings round the middle: 1 + 6 + 12 + 18 = 37 hexes.
    const labels = order.map((x) => x.split(" ")[0]).join(",");
    if (!(hexes === 37 && !types.includes("Bot") && types.length > 3 && /^Missions,Campaign,Omega/i.test(labels)))
      fails.push(`new draft: hexes ${hexes}, picker types ${types.join("/")}, column "${labels}"`);
  }

  // 2. Start from Campaign 1: the unit card on hover; "Play this mission" with 2 Upgrade points opens the Upgrade sheet;
  //    Leave goes back to the editor on the same mission.
  {
    const pg = await openEditor(browser, url, 1400, 900, errors);
    await pg.locator("[data-action=editor-file]").click();
    await pg.locator("[data-action=editor-from][data-from=C1]").click();
    await pg.getByRole("button", { name: "Close" }).click();
    await pg.locator("[data-pane=palette] [data-tile-info]").first().hover();
    const card = await pg.waitForSelector("[data-editor-card]", { timeout: 2000 }).then(() => true, () => false);
    const cardText = card ? await pg.locator("[data-editor-card]").innerText() : "";
    await pg.mouse.move(5, 5);
    const g00 = await pg.locator("[data-pane=mission] [data-tile=G_00] [data-dev-price]").first().innerText().catch(() => "");
    await pg.locator("[data-mission=M3]").click();
    await pg.locator("[data-action=playtest]").click();
    await pg.waitForSelector("[data-playtest-panel]", { timeout: 3000 });
    const skipped = await pg.locator("[data-playtest-skipped]").count();
    await pg.locator("[data-playtest-company=V2]").click();
    const plus = pg.getByRole("button", { name: "Upgrade points: one more" });
    await plus.click();
    await plus.click();
    await pg.screenshot({ path: `${out}/ui-playtest-panel.png` });
    await pg.locator("[data-action=playtest-start]").click();
    const sheet = await pg.waitForSelector(".upsheet", { timeout: 10000 }).then(() => true, () => false);
    await pg.screenshot({ path: `${out}/ui-playtest-upgrade.png` });
    await pg.getByRole("button", { name: "Menu" }).click();
    await pg.getByRole("button", { name: "Leave to the start screen" }).click();
    const back = await pg.waitForSelector("[data-page=editor] [data-open-mission=M3]", { timeout: 5000 }).then(() => true, () => false);
    await pg.close();
    if (!(card && /Level/.test(cardText) && g00 === "0.7" && skipped === 0 && sheet && back)) fails.push(`C1 draft: card ${card} "${cardText.slice(0, 40)}", G_00 price "${g00}", skipped ${skipped}, Upgrade sheet ${sheet}, back on M3 ${back}`);
  }

  // 3. Play M2Y with no points at 390 px: the Threat screen, a Module, the Field; a Developer win; the playtest card; back.
  {
    const pg = await openEditor(browser, url, 390, 844, errors);
    await pg.locator("[data-action=editor-file]").click();
    await pg.locator("[data-action=editor-from][data-from=C1]").click();
    await pg.getByRole("button", { name: "Close" }).click();
    // M2Y: one of a route pair (no route screen in a playtest), no mission event.
    await pg.locator("[data-pane-tab=campaign]").click();
    await pg.locator("[data-mission=M2Y]").click();
    await pg.locator("[data-action=playtest]").click();
    await pg.locator("[data-action=playtest-start]").click();
    const threat = await pg.waitForSelector("[data-threat-screen]", { timeout: 10000 }).then(() => true, () => false);
    await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
    await pg.locator("[data-col-btn=A]").click();
    await pg.locator("[data-action=threat]").click();
    await pg.waitForSelector("[data-prep=module]", { timeout: 8000 }).catch(() => {});
    await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
    await pg.locator("[data-prep-pick]").first().click({ position: { x: 24, y: 16 } });
    await pg.locator("[data-action=prep]").click();
    await pg.waitForSelector("[data-mission-intro]", { timeout: 8000 }).catch(() => {});
    await pg.waitForSelector("[data-mission-intro]", { state: "detached", timeout: 12000 }).catch(() => {});
    await pg.screenshot({ path: `${out}/ui-playtest-field-phone.png` });
    const field = await pg.waitForSelector(".game[data-prompt]", { timeout: 10000 }).then(() => true, () => false);
    await pg.getByRole("button", { name: "Menu" }).click();
    await pg.getByRole("button", { name: /Developer: win this mission/ }).click();
    await pg.waitForSelector("[data-win]", { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(800);
    await pg.mouse.click(195, 420);
    await pg.mouse.click(195, 420);
    const end = await pg.waitForSelector("[data-playtest-end=won]", { timeout: 15000 }).then(() => true, () => false);
    const sheet = await pg.locator(".upsheet").count();
    const outro = await pg.locator("[data-outro]").count();
    await pg.screenshot({ path: `${out}/ui-playtest-end-phone.png` });
    if (end) await pg.getByRole("button", { name: "Back to the editor" }).click();
    const back = await pg.waitForSelector("[data-page=editor]", { timeout: 5000 }).then(() => true, () => false);
    // Nothing saved: no game to continue on the Command Deck, no history.
    const saved = await pg.evaluate(() => localStorage.getItem("aphelion5.save") ?? "");
    await pg.close();
    if (!(threat && field && end && sheet === 0 && outro === 0 && back && !/C2_M2Y/.test(saved))) fails.push(`M2Y at 390 px: Threat screen ${threat}, Field ${field}, playtest card ${end}, Upgrade sheet ${sheet}, outro ${outro}, back ${back}`);
  }

  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ playtestCheck: await playtestCheck(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

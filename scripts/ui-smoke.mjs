// Browser smoke test of the web app (stage 8): start a campaign, play into Mission 1,
// take a few actions, screenshot. Usage: node scripts/ui-smoke.mjs [url] [outDir]
import { createRequire } from "node:module";
import { pagesCheck as runPagesCheck } from "./ui-pages.mjs";
import { celebrateCheck as runCelebrateCheck } from "./ui-celebrate.mjs";
import { looksCheck as runLooksCheck } from "./ui-looks.mjs";
import { round23Check as runRound23Check } from "./ui-round23.mjs";
import { round24Check as runRound24Check } from "./ui-round24.mjs";
import { round25Check as runRound25Check } from "./ui-round25.mjs";
import { round26Check as runRound26Check } from "./ui-round26.mjs";
import { round29Check as runRound29Check } from "./ui-round29.mjs";
import { round30Check as runRound30Check } from "./ui-round30.mjs";
import { soundCheck as runSoundCheck } from "./ui-sound.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const url = process.argv[2] ?? "http://localhost:4173";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch();
// Groups of checks (designer 2026-11-22: each round runs only the groups it touched, the full set now and then):
// UI_ONLY=game,intro,outro,pages,celebrate,looks,round23,round24,round25,round26,round29,round30,sound (any of them, comma-separated).
// Not set: every group runs. A group not run counts as passed.
const GROUPS = ["game", "intro", "outro", "pages", "celebrate", "looks", "round23", "round24", "round25", "round26", "round29", "round30", "sound"];
const ONLY = (process.env.UI_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const unknown = ONLY.filter((g) => !GROUPS.includes(g));
if (unknown.length) { console.error(`UI_ONLY: unknown group(s) ${unknown.join(", ")}; known: ${GROUPS.join(", ")}`); process.exit(2); }
const runs = (group) => !ONLY.length || ONLY.includes(group);
if (ONLY.length) console.log(`Browser check groups: ${ONLY.join(", ")}`);
// The intro (command briefing, 2026-11-13) is switched off for these checks; it has its own check below.
const plainPage = browser.newPage.bind(browser);
browser.newPage = async (o) => {
  const pg = await plainPage(o);
  await pg.addInitScript(() => localStorage.getItem("aphelion5.intro") ?? localStorage.setItem("aphelion5.intro", "off"));
  return pg;
};
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
// Questions sit inside the Field (designer 2026-11-08): a banner, or a card; the action menu shows none.
// Questions in a card (setup) or, during a mission, in the big bubble inside the Field (designer 2026-11-10).
const Q = ".q-card, .q-banner, .ask-bubble";
const panel = page.locator(Q);
const clickIn = async (pg, name) => pg.locator(Q).getByRole("button", { name }).first().click();
/** The Log is in the Menu (designer 2026-11-08). */
const toggleLog = async (pg) => {
  await pg.locator(".menu-wrap > button").click();
  await pg.locator(".menu button", { hasText: /^(Log|Hide the log)$/ }).click();
};
const promptOf = async (pg) => (await pg.locator(".game").getAttribute("data-prompt")) ?? "";

/** Click the n-th highlighted sector on the Field (positions come from the Field's data-choosable). */
async function clickField(pg, n = 0) {
  const field = pg.locator(".field");
  const hits = JSON.parse((await field.getAttribute("data-choosable")) ?? "[]");
  if (!hits.length) return false;
  const box = await field.boundingBox();
  const h = hits[Math.min(n, hits.length - 1)];
  await pg.mouse.click(box.x + h.x, box.y + h.y);
  await pg.waitForTimeout(150);
  return true;
}

/** A step of the command briefing is on screen and ready for a tap. */
const briefAt = (pg, step) => pg.waitForSelector(`.brief[data-step=${step}][data-busy="0"]`);
/** The logo gate between setup screens has opened again; a mission intro (before the Field) is tapped away. */
async function settle(pg) {
  await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
  if (await pg.waitForSelector("[data-mission-intro]", { timeout: 400 }).then(() => true, () => false)) {
    // It may be fading out by itself at that moment (then it is gone before the tap: nothing to do).
    await pg.locator("[data-mission-intro]").click({ force: true, timeout: 3000 }).catch(() => {});
    await pg.waitForSelector("[data-mission-intro]", { state: "detached", timeout: 4000 }).catch(() => {});
  }
}
/** The Threat screen of a Mission Preparation (7.2 step 3): add the given columns, confirm. */
async function threat(pg, cols = ["A"]) {
  await pg.waitForSelector("[data-threat-screen]");
  for (const c of cols) await pg.locator(`[data-col-btn=${c}]`).click();
  await pg.locator("[data-action=threat]").click();
  await pg.waitForSelector("[data-threat-screen]", { state: "detached" });
  await settle(pg);
}
/** A Mission Preparation screen (Module draw, Ally, Allied Drop Mecha): take the first option, confirm. */
async function prep(pg) {
  if (!(await pg.locator("[data-prep]").count())) return false;
  const kind = await pg.locator("[data-prep]").getAttribute("data-prep");
  if (!kind || kind === "threat") return false;
  await pg.locator("[data-prep-pick]").first().click({ position: { x: 24, y: 16 } });
  await pg.locator("[data-action=prep]").click();
  await pg.waitForFunction((k) => document.querySelector("[data-prep]")?.getAttribute("data-prep") !== k || !document.querySelector("[data-prep]"), kind);
  await settle(pg);
  await pg.waitForTimeout(100);
  return true;
}
/** The command briefing: Campaign 1, Company V1, no expansion module, launch; then Mission 1 at Threat Level 1 (column A). */
async function start(pg, seed) {
  await briefAt(pg, "campaign");
  if (seed !== undefined) {
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator("input[placeholder=random]").fill(String(seed));
    await pg.getByRole("button", { name: "Close" }).click();
  }
  await pg.locator("[data-action=campaign]").click();
  await briefAt(pg, "vessel");
  await pg.locator("[data-action=vessel]").click();
  await briefAt(pg, "modules");
  await pg.locator("[data-action=modules]").click();
  await pg.waitForSelector(".game");
  await threat(pg);
}

/** Answer whatever else comes (Module, Ally, Allied Drop) until it is the player's action. */
async function untilAction(pg) {
  const q = pg.locator(Q);
  for (let i = 0; i < 30; i++) {
    const prompt = await promptOf(pg);
    if (/^Choose an action/.test(prompt)) return prompt;
    if (await prep(pg)) continue;
    const buttons = q.locator(".choices button, .ask-choices button:not(:disabled)");
    if (await buttons.count()) {
      await buttons.first().click();
      continue;
    }
    if (await pg.locator(".point-bubble:not(:disabled), .module.can, .bay-btn.can, .bay-hit-bubble:not(:disabled)").count()) {
      await pg.locator(".point-bubble:not(:disabled), .module.can, .bay-btn.can, .bay-hit-bubble:not(:disabled)").first().click();
      continue;
    }
    if (await clickField(pg)) {
      const confirm = q.getByRole("button", { name: /^Confirm/ });
      if ((await confirm.count()) && (await confirm.isEnabled())) await confirm.click();
      continue;
    }
    throw new Error(`stuck at: ${prompt}`);
  }
  throw new Error("never reached the Command phase");
}

// The opening checks of the game screen (group "game").
let noMenu = true, greyAtStart = 0, popupTitle = "Dark sector (not run)", bubbles = true, raised = true, closedByOutside = true, breathing = true, afterReveal = "not run", canModules = 0, tapThrough = "ok", overhaulConfirm = true, rotateShown = true, facingKept = "not run";
if (runs("game")) {
  await page.goto(url);
  await start(page);
  await untilAction(page);
  noMenu = (await panel.locator(".choices button, .ask-choices button").count()) === 0;
  await page.screenshot({ path: `${out}/ui-command.png` });
  // The Allied Drop's Mecha is on the Field: no Bay greyed out for want of a unit (C1_ORDER_1, "one Gyro or one Sleeper", rightly is: round 23).
  greyAtStart = await page.locator(".no-units:not(.order-thing)").count();
  // A Dark sector opens a pop-up with Reveal; clicking outside closes it.
  const dark = JSON.parse((await page.locator(".field").getAttribute("data-choosable")) ?? "[]");
  await clickField(page, dark.length - 1);
  popupTitle = await page.locator(".popup-title").textContent();
  // Bubbles (designer 2026-11-07): one standard width, the row centred on the sector clicked.
  await page.waitForTimeout(700);
  const target = dark[dark.length - 1];
  const fieldBox = await page.locator(".field").boundingBox();
  const bubbleBoxes = await page.locator(".popup .bubble").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, y: r.y, h: r.height }; }));
  const rowLeft = Math.min(...bubbleBoxes.map((b) => b.x));
  const rowRight = Math.max(...bubbleBoxes.map((b) => b.x + b.w));
  bubbles = bubbleBoxes.length > 0 && bubbleBoxes.every((b) => Math.abs(b.w - bubbleBoxes[0].w) < 1) && Math.abs((rowLeft + rowRight) / 2 - (fieldBox.x + target.x)) < 12;
  // Raised: centred on the top point of the tile (designer 2026-11-08).
  const tileH = Number(await page.locator(".field").getAttribute("data-tile"));
  const popBox = await page.locator(".popup").boundingBox();
  // Centred on the pointy top end of the hexagon (designer 2026-11-08).
  raised = Math.abs(popBox.y + popBox.height / 2 - (fieldBox.y + target.y - tileH / 2)) < 12 || popBox.y <= 9;
  // One tap on another Dark sector closes this pop-up and opens that one (designer 2026-11-08).
  tapThrough = "only one Dark sector";
  if (dark.length > 1) {
    const other = dark[0];
    await page.mouse.click(fieldBox.x + other.x, fieldBox.y + other.y);
    await page.waitForTimeout(400);
    const t = await page.locator(".popup-title").allTextContents();
    tapThrough = t.length === 1 && t[0].includes(`(${other.k})`) ? "ok" : `titles after tap: ${JSON.stringify(t)}`;
  }
  await page.mouse.click(5, 300);
  await page.waitForTimeout(350);
  closedByOutside = (await page.locator(".popup").count()) === 0;
  // Ready things breathe instead of a thick border.
  breathing = await page.evaluate(() => [...document.querySelectorAll(".can")].every((e) => getComputedStyle(e).animationName === "can-breathe"));
  await clickField(page, dark.length - 1);
  await page.screenshot({ path: `${out}/ui-popup.png` });
  await page.waitForTimeout(700);
  await page.locator(".popup").getByRole("menuitem", { name: "Reveal" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/ui-after-reveal.png` });
  // Run a Module by clicking it, if one can run (it may then ask for targets).
  afterReveal = await promptOf(page);
  canModules = await page.locator(".module.can").count();
  // Overhaul asks to confirm while the Flagship is not Crippled.
  overhaulConfirm = false;
  if (/^Choose an action/.test(afterReveal)) {
    await page.locator("[data-overhaul]").first().click();
    overhaulConfirm = (await page.getByRole("dialog", { name: "Overhaul now?" }).count()) === 1;
    await page.getByRole("button", { name: "Cancel" }).click();
  }
  async function revealSomething(pg) {
    const hits = JSON.parse((await pg.locator(".field").getAttribute("data-choosable")) ?? "[]");
    for (let n = hits.length - 1; n >= 0; n--) {
      await clickField(pg, n);
      const rev = pg.locator(".popup [role=menuitem]", { hasText: "Reveal" });
      if (await rev.count()) return rev.click();
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(250);
    }
  }
  // Facing (3.7): reveal on fresh games until a unit with arrows shows the rotate buttons.
  rotateShown = false;
  facingKept = "";
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
    if (rotateShown) break;
    const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(url);
    await start(pg, seed);
    await untilAction(pg);
    for (let i = 0; i < 4 && !rotateShown; i++) {
      if (!/^Choose an action/.test(await promptOf(pg))) break;
      await revealSomething(pg);
      // Wait for the answer to land (the pop-up closes in 0.17 s first), not a fixed time.
      await pg.waitForFunction(() => (document.querySelector(".field")?.getAttribute("data-rotate") ?? "[]") !== "[]" || !document.querySelector(".popup"), null, { timeout: 2000 }).catch(() => {});
      await pg.waitForTimeout(250);
      const rot = JSON.parse((await pg.locator(".field").getAttribute("data-rotate")) ?? "[]");
      if (!rot.length) continue;
      rotateShown = true;
      const box = await pg.locator(".field").boundingBox();
      await pg.mouse.click(box.x + rot[1].x, box.y + rot[1].y); // turn clockwise once
      await pg.waitForTimeout(150);
      await pg.screenshot({ path: `${out}/ui-facing.png` });
      if (await pg.getByRole("button", { name: "Done" }).count()) await pg.getByRole("button", { name: "Done" }).click();
      else await revealSomething(pg); // the next action keeps the facing
      await pg.waitForFunction(() => !document.querySelector(".popup") && (document.querySelector(".field")?.getAttribute("data-rotate") ?? "[]") === "[]", null, { timeout: 2000 }).catch(() => {});
      await pg.waitForTimeout(200);
      await toggleLog(pg);
      facingKept = (await pg.locator(".log li").allTextContents()).find((l) => / facing 1 /.test(l)) ?? "";
    }
    await pg.close();
  }
}
// Rows (designer 2026-11-09): press a row's bubble to select it, press it again to confirm.
let rowCheck = "skipped (no row save)";
const rowSave = `${out}/row-save.json`;
const { existsSync, readFileSync } = await import("node:fs");
/** A game-screen check (group "game") runs when its save exists and the group is asked for. */
const has = (file) => runs("game") && existsSync(file);
if (has(rowSave)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(rowSave, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForTimeout(400);
  const q = pg.locator(Q);
  const listed = await q.locator(".choices button").count();
  const before = await promptOf(pg);
  // Designer 2026-11-09: a bubble over each row, no card, no pop-up: a press selects, a second confirms.
  const bubble = pg.locator(".row-bubble").first();
  await bubble.waitFor({ timeout: 3000 }).catch(() => {});
  const nBubbles = await pg.locator(".row-bubble").count();
  const noCard = (await pg.locator(Q).count()) === 0;
  // Rows cross: press the bubble where no other lies over it (its end).
  const pressRow = async (b) => {
    const pt = await b.evaluate((e) => {
      const r = e.getBoundingClientRect();
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const x = r.left + r.width * t;
        const y = r.top + r.height * t;
        if (document.elementFromPoint(x, y)?.closest(".row-bubble") === e) return { x, y };
      }
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await pg.mouse.click(pt.x, pt.y);
  };
  if (nBubbles) await pressRow(bubble);
  await pg.waitForTimeout(200);
  const popupOk = nBubbles > 0 && noCard && (await pg.locator(".row-bubble.selected").count()) === 1 && (await promptOf(pg)) === before;
  await pg.screenshot({ path: `${out}/ui-row.png` });
  if (popupOk) await pressRow(pg.locator(".row-bubble.selected"));
  await pg.waitForTimeout(300);
  const after = await promptOf(pg);
  // A long list of choices (like the Upgrade list) must not slide under the Field (play-test 2026-11-07).
  await pg.evaluate(() => {
    const c = document.querySelector(".q-card, .q-banner");
    if (!c) return;
    for (let i = 0; i < 22; i++) { const b = document.createElement("button"); b.className = "probe"; b.textContent = "A long choice like an Upgrade: Improves M_03's Passive: it may move through any number of adjacent Dark sectors before an Attack."; c.appendChild(b); }
  });
  await pg.waitForTimeout(200);
  const covered = await pg.evaluate(() => [...document.querySelectorAll(".probe")].filter((e) => { const r = e.getBoundingClientRect(); const box = document.querySelector(".q-card, .q-banner"); if (!box) return false; const p = box.getBoundingClientRect(); if (r.top < p.top || r.bottom > p.bottom) return false; return document.elementFromPoint(r.x + 10, r.y + r.height / 2) !== e; }).length);
  await pg.evaluate(() => document.querySelectorAll(".probe").forEach((e) => e.remove()));
  if (covered) rowCheck = `failed (${covered} long choices covered by the Field)`;
  else rowCheck = listed === 0 && popupOk && after !== before ? "ok" : `failed (list ${listed}, bubbles ${popupOk}, prompt still "${before}")`;
  await pg.close();
}
// Energy pop-ups (designer 2026-11-07): one beside each Module that can take the energy; a tap places one.
let energyCheck = "skipped (no energy save)";
const energySave = `${out}/energy-save.json`;
if (has(energySave)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(energySave, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForTimeout(600);
  const pops = await pg.locator(".energy-pop").count();
  // Modules scrolled out of the panel show their pop-up once scrolled into view.
  const targets = await pg.evaluate(() => [...document.querySelectorAll(".module.energy-target")].filter((m) => { const r = m.getBoundingClientRect(); const p = m.closest(".panel").getBoundingClientRect(); const y = r.top + r.height / 2; return y >= p.top && y <= p.bottom; }).length);
  const before = await promptOf(pg);
  await pg.screenshot({ path: `${out}/ui-energy.png` });
  const box = await pg.locator(".energy-pop").first().boundingBox();
  const mod = await pg.locator(".module.energy-target").first().boundingBox();
  const leftOf = box && mod ? box.x + box.width <= mod.x + 2 : false;
  if (pops) await pg.locator(".energy-pop").first().click();
  await pg.waitForTimeout(400);
  const after = await promptOf(pg);
  energyCheck = pops >= 1 && pops === targets && leftOf && after !== before ? "ok" : `failed (pop-ups ${pops}, targets ${targets}, left of Module ${leftOf}, prompt still "${before}")`;
  await pg.close();
}
// Dragging Mecha (Program Spec "Interaction and animation", build step 2).
async function pasteSave(pg, file) {
  await pg.goto(url);
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(file, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForSelector(".game[data-prompt]", { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(600);
}
async function sectorPoint(pg, k) {
  const box = await pg.locator(".field").boundingBox();
  const s = JSON.parse((await pg.locator(".field").getAttribute("data-sectors")) ?? "{}");
  return { x: box.x + s[k][0], y: box.y + s[k][1] };
}
async function dragMouse(pg, a, b) {
  await pg.mouse.move(a.x, a.y);
  await pg.mouse.down();
  for (let i = 1; i <= 12; i++) await pg.mouse.move(a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12);
  await pg.waitForTimeout(300);
}
const logText = async (pg) => {
  await toggleLog(pg);
  const t = (await pg.locator(".log li").allTextContents()).join("\n");
  await toggleLog(pg);
  return t;
};
let dragCheck = "skipped (no drag save)";
if (has(`${out}/drag-save.json`)) {
  const plan = JSON.parse(readFileSync(`${out}/drag-save.json.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/drag-save.json`);
  const prompt = async () => promptOf(pg);
  const before = await prompt();
  const from = await sectorPoint(pg, plan.from);
  const box = await pg.locator(".field").boundingBox();
  // Lifted and put back where it was taken from: it goes home with no message (designer 2026-11-21).
  await dragMouse(pg, from, { x: from.x + 70, y: from.y + 20 });
  for (let i = 1; i <= 8; i++) await pg.mouse.move(from.x + 70 - i * 8.75, from.y + 20 - i * 2.5);
  await pg.mouse.up();
  await pg.waitForTimeout(700);
  const homeNote = (await pg.locator(".field-toast").textContent().catch(() => "")) ?? "";
  const homeQuiet = !/cannot go there/.test(homeNote) && (await prompt()) === before;
  await pg.waitForTimeout(400);
  // Dropped on a place that is not lit: it goes back, nothing happens, the strip says why.
  await dragMouse(pg, from, { x: box.x + 12, y: box.y + 12 });
  await pg.screenshot({ path: `${out}/ui-drag-lifted.png` });
  await pg.mouse.up();
  await pg.waitForTimeout(900);
  const note = (await pg.locator(".field-toast").textContent().catch(() => "")) ?? "";
  const stayed = (await prompt()) === before && (await pg.locator(".popup").count()) === 0;
  // Dropped on a blue sector: it moves there.
  const target = plan.targets.find((t) => t.kind === "move" && !t.next);
  const red = plan.targets.find((t) => t.kind === "attack");
  await dragMouse(pg, from, await sectorPoint(pg, red.sector));
  await pg.screenshot({ path: `${out}/ui-drag-attack-aim.png` });
  // Still holding: carry on to the blue target and let go there.
  const tp = await sectorPoint(pg, target.sector);
  for (let i = 1; i <= 8; i++) await pg.mouse.move(tp.x, tp.y);
  await pg.mouse.up();
  const anim = await pg.waitForFunction(() => document.querySelector(".field")?.getAttribute("data-anim") === "1", null, { timeout: 1500 }).then(() => "1").catch(() => "0");
  await pg.waitForTimeout(900);
  const log = await logText(pg);
  const moved = log.includes(`${plan.unitId} moves from (${plan.from}) to (${target.sector})`) || log.includes(`from (${plan.from})`);
  dragCheck = /cannot go there/.test(note) && stayed && moved && homeQuiet ? "ok" : `failed (note "${note}", stayed ${stayed}, moved ${moved}, anim ${anim}, home drop quiet ${homeQuiet} "${homeNote}")`;
  await pg.close();
}
let drag2Check = "skipped (no M_03/M_06 save)";
if (has(`${out}/drag2-save.json`)) {
  const plan = JSON.parse(readFileSync(`${out}/drag2-save.json.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/drag2-save.json`);
  const blue = plan.targets.find((t) => !t.via && t.next && t.next.length); // the Passive's sector, not a "where to move first" target
  await dragMouse(pg, await sectorPoint(pg, plan.from), await sectorPoint(pg, blue.sector));
  await pg.mouse.up();
  await pg.waitForTimeout(300);
  const lifted = ((await pg.locator(".field-toast").textContent().catch(() => "")) ?? "").includes("red unit");
  await pg.screenshot({ path: `${out}/ui-drag2-carry.png` });
  const p2 = await sectorPoint(pg, blue.next[0]);
  await pg.mouse.click(p2.x, p2.y);
  const anim = await pg.waitForFunction(() => document.querySelector(".field")?.getAttribute("data-anim") === "1", null, { timeout: 1500 }).then(() => "1").catch(() => "0");
  await pg.screenshot({ path: `${out}/ui-drag2-hit.png` });
  await pg.waitForTimeout(1500);
  const log = await logText(pg);
  const attacked = new RegExp(`${plan.unitId}.*Attacks`).test(log) && /(swap|moves)/.test(log);
  drag2Check = lifted && attacked && anim === "1" ? "ok" : `failed (lifted ${lifted}, attacked ${attacked}, anim ${anim})`;
  await pg.close();
}
// M_03 (designer 2026-11-08): dropped on a unit it reaches only by moving: it moves, then Attacks.
let m03Check = "skipped (no M_03 save)";
if (has(`${out}/m03-save.json`)) {
  const plan = JSON.parse(readFileSync(`${out}/m03-save.json.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/m03-save.json`);
  const far = plan.targets.find((t) => t.via && !t.next) ?? plan.targets.find((t) => t.via);
  await dragMouse(pg, await sectorPoint(pg, plan.from), await sectorPoint(pg, far.sector));
  await pg.mouse.up();
  await pg.waitForTimeout(400);
  if (far.next) {
    const way = await sectorPoint(pg, far.next[0]);
    await pg.mouse.click(way.x, way.y);
  }
  await pg.waitForTimeout(2500);
  const log = await logText(pg);
  m03Check = /M_03 moves from/.test(log) && /M_03.*Attacks/.test(log) ? "ok" : `failed (log: ${log.split("\n").slice(0, 4).join(" | ")})`;
  await pg.close();
}
// Play-test round 2 (2026-11-08): Bay 3 shows what you looked at; Bays drag onto a target;
// energy taken off Modules by pop-ups; Anomaly cards claimed on their bubbles.
let bay3Check = "skipped (no save)";
let bayDragCheck = "skipped (no save)";
if (has(`${out}/bay3-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/bay3-save.json`);
  const btn = pg.locator(".bay-btn", { has: pg.locator("text=Bay 3") });
  await btn.click();
  const popped = await pg.locator(".thing-pop").count();
  const fire = await btn.evaluate((e) => e.classList.contains("selected"));
  await btn.click(); // pressed again: fires
  await pg.waitForFunction(() => /choose a (Dark sector|sector with no tokens)/.test(document.querySelector(".game")?.getAttribute("data-prompt") ?? ""), null, { timeout: 3000 }).catch(() => {});
  const lit = JSON.parse((await pg.locator(".field").getAttribute("data-choosable")) ?? "[]");
  const box = await pg.locator(".field").boundingBox();
  if (lit[0]) await pg.mouse.click(box.x + lit[0].x, box.y + lit[0].y);
  // The scanning aura travels from Bay 3 to the sector (weapon looks, build step 3).
  const scan = await pg.waitForSelector(".weapon-fx.look-scan", { timeout: 2500 }).then(() => true).catch(() => false);
  await pg.waitForTimeout(900);
  // Tiles looked at from the top of one sector are lifted out and shown as units (designer 2026-11-16), else the look card.
  const shown = (await pg.locator(".look-card .look-tile").count()) + (await pg.locator("[data-stack-picker=look] .sp-tile").count());
  bay3Check = popped && fire && shown >= 1 && scan ? "ok" : `failed (pop-up ${popped}, fire ${fire}, tiles shown ${shown}, scan look ${scan})`;
  await pg.screenshot({ path: `${out}/ui-bay3.png` });
  await pg.close();
  // Drag a Bay with a target onto it (a fresh copy of the same save).
  const pg2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg2.on("pageerror", (e) => errors.push(e.message));
  await bayDrag(pg2);
  await pg2.close();
}
// V1 Bay 3 (designer 2026-11-16): the three tiles rise out of the sector, a tap puts each back on top,
// the last one goes by itself and is revealed; only then the engine's order question is answered.
let stackCheck = "skipped (no save)";
if (has(`${out}/bay3-V1-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/bay3-V1-save.json`);
  const btn = pg.locator(".bay-btn", { has: pg.locator("text=Bay 3") });
  await btn.click();
  await btn.click();
  await pg.locator(".unit-pick").first().waitFor({ timeout: 4000 }).catch(() => {});
  await pg.locator(".unit-pick").first().click();
  await pg.locator("[data-stack-picker=bay3] .sp-tile.wait").nth(2).waitFor({ timeout: 6000 }).catch(() => {});
  const tiles = await pg.locator("[data-stack-picker=bay3] .sp-tile").count();
  const asked = /put them back in which order/.test(await promptOf(pg));
  await pg.locator(".sp-tile.wait").nth(1).hover();
  await pg.waitForTimeout(300);
  const info = await pg.locator(".sp-info").count();
  await pg.screenshot({ path: `${out}/ui-bay3-v1.png` });
  await pg.locator(".sp-tile.wait").nth(1).click();
  await pg.waitForTimeout(900);
  const still = /put them back in which order/.test(await promptOf(pg));
  await pg.locator(".sp-tile.wait").first().click();
  await pg.waitForFunction(() => !document.querySelector("[data-stack-picker]"), null, { timeout: 6000 }).catch(() => {});
  const done = (await pg.locator("[data-stack-picker]").count()) === 0 && !/put them back/.test(await promptOf(pg));
  stackCheck = tiles === 3 && asked && info === 1 && still && done ? "ok" : `failed (tiles ${tiles}, asked ${asked}, info ${info}, still asking after one ${still}, answered ${done})`;
  await pg.close();
}
async function bayDrag(pg) {
  await pasteSave(pg, `${out}/bay3-save.json`);
  const box = await pg.locator(".field").boundingBox();
  const before = await logText(pg);
  let done = false;
  for (let i = 0; i < 5 && !done; i++) {
    const b = await pg.locator(".bay-btn").nth(i).boundingBox();
    await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await pg.mouse.down();
    for (let k = 1; k <= 6; k++) await pg.mouse.move(b.x + b.width / 2 + k * 12, b.y + b.height / 2);
    const targets = JSON.parse((await pg.locator(".field").getAttribute("data-choosable")) ?? "[]");
    const all = await pg.locator(".thing-ghost").count();
    if (all && targets.length) {
      const t = targets[0];
      await dragMouse(pg, { x: b.x + b.width / 2 + 72, y: b.y + b.height / 2 }, { x: box.x + t.x, y: box.y + t.y });
      await pg.mouse.up();
      await pg.waitForTimeout(800);
      done = (await logText(pg)) !== before;
    } else await pg.mouse.up();
  }
  bayDragCheck = done ? "ok" : "failed (no Bay drag was used)";
}
let takeCheck = "skipped (no save)";
if (has(`${out}/take-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/take-save.json`);
  const before = await promptOf(pg);
  const pops = await pg.locator(".energy-pop.take").count();
  if (pops) await pg.locator(".energy-pop.take").first().click();
  await pg.waitForTimeout(400);
  const after = await promptOf(pg);
  takeCheck = pops >= 1 && after !== before ? "ok" : `failed (pop-ups ${pops}, prompt "${after}")`;
  await pg.close();
}
let anomalyCheck = "skipped (no save)";
if (has(`${out}/anomaly-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/anomaly-save.json`);
  // Pressing a bubble shows the full card (designer 2026-11-08).
  await pg.locator(".anomaly .anomaly-text").first().click();
  await pg.waitForTimeout(500);
  const card = await pg.locator(".anomaly-card").evaluate((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }).catch(() => false);
  // Designer 2026-11-08: the text once (no second plain copy) and no close button.
  const once = (await pg.locator(".anomaly-card p:not(.status)").count()) === 1 && (await pg.locator(".anomaly-card button").count()) === 0;
  await pg.screenshot({ path: `${out}/ui-anomaly-card.png` });
  await pg.keyboard.press("Escape");
  const claims = await pg.locator(".anomaly .claim").count();
  const decline = await pg.locator(".anomaly-strip .decline").isVisible();
  const dock = await pg.locator(".field-dock .bay-btn").count();
  if (claims) await pg.locator(".anomaly .claim").first().click();
  await pg.waitForTimeout(400);
  const after = await promptOf(pg);
  anomalyCheck = claims >= 1 && card && once && decline && dock >= 1 && /choose your reward/.test(after) ? "ok" : `failed (claims ${claims}, card ${card}, text once ${once}, decline ${decline}, dock Bays ${dock}, prompt "${after}")`;
  await pg.screenshot({ path: `${out}/ui-anomaly-phone.png` });
  await pg.close();
}
// Modules (designer 2026-11-08): tap selects (fire outline, bar filled from the Reserve, Overclock pop-up),
// tap again runs it with the Overclock chosen. Checked at Galaxy S24 width, with the Heat bar in the top bar.
let moduleCheck = "skipped (no save)";
if (has(`${out}/overclock-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/overclock-save.json`);
  const fits = await pg.evaluate(() => { const b = document.querySelector(".bar"); return b.scrollWidth <= b.clientWidth + 1 && document.documentElement.scrollWidth <= 360; });
  const heat = await pg.locator("[data-heat]").count();
  // The Heat bar explains Heat; the Mission bar sits at the right end and shows the objective and the Trophy pile.
  await pg.locator("[data-heat]").click();
  await pg.waitForTimeout(450);
  const heatCard = await pg.locator(".heat-card").isVisible();
  await pg.screenshot({ path: `${out}/ui-heat-card.png` });
  await pg.keyboard.press("Escape");
  const mbar = await pg.evaluate(() => { const b = document.querySelector("[data-mission-bar]"); const s = document.querySelector(".top-strip"); if (!b || !s) return false; const r = b.getBoundingClientRect(), t = s.getBoundingClientRect(); return t.right - r.right <= 12 && r.right <= window.innerWidth; });
  await pg.locator("[data-mission-bar]").click();
  await pg.waitForTimeout(450);
  const mcard = /Trophy pile/.test((await pg.locator(".mission-card").textContent().catch(() => "")) ?? "");
  await pg.screenshot({ path: `${out}/ui-mission-card.png` });
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(200);
  const before = await logText(pg);
  let found = -1;
  const n = await pg.locator(".module.can").count();
  for (let i = 0; i < n && found < 0; i++) {
    await pg.locator(".module.can").nth(i).click();
    await pg.waitForTimeout(250);
    if (await pg.locator(".mod-pops .energy-pop", { hasText: "+1 Heat" }).count()) found = i;
    else await pg.keyboard.press("Escape");
  }
  const mod = found >= 0 ? pg.locator(".module.selected") : undefined;
  const sel = mod ? await mod.count() : 0;
  const fromReserve = mod ? await mod.locator(".slot.reserve").count() : 0;
  await pg.screenshot({ path: `${out}/ui-module-selected.png` });
  if (found >= 0) await pg.locator(".mod-pops .energy-pop", { hasText: "+1 Heat" }).click();
  await pg.waitForTimeout(250);
  const ocSlots = mod ? await mod.locator(".slot.part-overclock").count() : 0;
  await pg.screenshot({ path: `${out}/ui-module-overclock.png` });
  if (mod) await mod.click();
  await pg.waitForTimeout(700);
  const log = await logText(pg);
  const ran = log !== before && /Overclock: pay 2/.test(log);
  moduleCheck = fits && heat === 1 && heatCard && mbar && mcard && sel === 1 && fromReserve >= 1 && ocSlots === 2 && ran ? "ok" : `failed (bar fits ${fits}, heat ${heat}, heat card ${heatCard}, mission bar ${mbar}, mission card ${mcard}, selected ${sel}, reserve slots ${fromReserve}, overclock slots ${ocSlots}, ran ${ran})`;
  await pg.screenshot({ path: `${out}/ui-module-ran.png` });
  await pg.close();
}
// M_01 (designer 2026-11-08): tap = its pop-up; Attack lights units it can walk to; a tap on one walks, then Attacks.
let m01Check = "skipped (no save)";
if (has(`${out}/m01-save.json`)) {
  const plan = JSON.parse(readFileSync(`${out}/m01-save.json.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/m01-save.json`);
  const box = await pg.locator(".field").boundingBox();
  const centres = JSON.parse((await pg.locator(".field").getAttribute("data-sectors")) ?? "{}");
  const at = (k) => ({ x: box.x + centres[k][0], y: box.y + centres[k][1] });
  const before = await logText(pg);
  await pg.mouse.click(at(plan.from).x, at(plan.from).y);
  await pg.waitForTimeout(400);
  // Its normal pop-up first (designer 2026-11-08), then Attack lights every unit it can walk to.
  const attackBubble = pg.locator(".popup .bubble", { hasText: "Attack" });
  const hasAttack = (await attackBubble.count()) > 0;
  if (hasAttack) await attackBubble.first().click();
  await pg.waitForTimeout(400);
  const lit = JSON.parse((await pg.locator(".field").getAttribute("data-choosable")) ?? "[]").map((h) => h.k);
  const want = plan.targets.map((t) => t.sector);
  const allLit = want.every((k) => lit.includes(k));
  await pg.screenshot({ path: `${out}/ui-m01.png` });
  await pg.mouse.click(at(want[0]).x, at(want[0]).y);
  await pg.waitForTimeout(800);
  await pg.waitForTimeout(1500);
  const after = await logText(pg);
  const moves = (t) => (t.match(/M_01 moves from/g) ?? []).length;
  const acted = moves(after) > moves(before) && after.length > before.length;
  m01Check = hasAttack && allLit && acted ? "ok" : `failed (Attack bubble ${hasAttack}, targets lit ${allLit}: ${lit.join(" ")} / ${want.join(" ")}, walked and Attacked ${acted})`;
  await pg.close();
}
let scrollW = 390;
if (runs("game")) {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(url);
  await start(mobile);
  await mobile.waitForTimeout(400);
  scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.screenshot({ path: `${out}/ui-phone.png` });
}
// Trial rule (designer 2026-11-08): a Power Node's Alert: two pop-ups on it, energy glyphs or 3 Heat.
let nodeCheck = "skipped (no save)";
if (has(`${out}/node-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/node-save.json`);
  const before = await logText(pg);
  const hits = JSON.parse((await pg.locator(".field").getAttribute("data-choosable")) ?? "[]");
  const box = await pg.locator(".field").boundingBox();
  let shown = false;
  for (const h of hits) {
    await pg.mouse.click(box.x + h.x, box.y + h.y);
    await pg.waitForTimeout(500);
    const n = await pg.locator(".popup .bubble .chip-label").count();
    if (n === 2) { shown = true; break; }
    await pg.keyboard.press("Escape");
    await pg.mouse.click(box.x + 4, box.y + 4);
    await pg.waitForTimeout(300);
  }
  const glyphs = shown ? await pg.locator(".popup .bubble .chip-label .glyph").count() : 0;
  await pg.screenshot({ path: `${out}/ui-power-node.png` });
  if (shown) await pg.locator(".popup .bubble", { hasText: "Heat" }).first().click();
  await pg.waitForTimeout(600);
  const log = await logText(pg);
  nodeCheck = shown && glyphs >= 1 && log !== before && /gain 3 Heat|gain 0 Heat|gain [0-9]+ Heat/.test(log) ? "ok" : `failed (pop-ups ${shown}, glyphs ${glyphs}, log ${log.split("\n")[0]})`;
  await pg.close();
}
// A Module choosing where energy goes (Salvage Siphon, Harvest Beacon...): energy pop-ups, not the Module itself.
let fillCheck = "skipped (no save)";
if (has(`${out}/fill-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/fill-save.json`);
  const pops = await pg.locator(".energy-pop:not(.take)").count();
  const asButton = await pg.locator("button.module.can").count();
  await pg.screenshot({ path: `${out}/ui-fill-pops.png` });
  const before = await promptOf(pg);
  if (pops) await pg.locator(".energy-pop:not(.take)").first().click();
  await pg.waitForTimeout(500);
  const after = await promptOf(pg);
  fillCheck = pops >= 2 && asButton === 0 && after !== before ? "ok" : `failed (pop-ups ${pops}, Modules as buttons ${asButton}, prompt "${after}")`;
  await pg.close();
}
// No unit on the Field (designer 2026-11-08): Bays and Orders that target units are greyed out and cannot be
// used (V1 Bays 1-2, V2 Bays 1, 2, 4); Bay 3 (a sector) is not; the pop-up says why.
let greyCheck = "skipped (no save)";
if (has(`${out}/nounits-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/nounits-save.json`);
  const greyBays = (await pg.locator(".bay-thing.no-units .bay-btn").evaluateAll((els) => els.map((e) => e.getAttribute("data-bay")))).join(",");
  const greyCan = await pg.locator(".no-units .can").count();
  const greyOrders = await pg.locator(".order-thing.no-units").count();
  await pg.locator(".bay-btn").first().click();
  await pg.waitForTimeout(400);
  const why = (await pg.locator(".thing-pop .bubble.info small").allTextContents()).join("|");
  await pg.screenshot({ path: `${out}/ui-no-units.png` });
  greyCheck = greyAtStart === 0 && ["1,2", "1,2,4"].includes(greyBays) && greyCan === 0 && greyOrders >= 1 && why.includes("No unit to target") ? "ok" : `failed (at start ${greyAtStart}, grey Bays ${greyBays}, lit ${greyCan}, grey Orders ${greyOrders}, pop-up "${why}")`;
  await pg.close();
}
// Build step 3 (designer 2026-11-08): a Module, and an Order, dragged onto their one target: the
// targets light up while dragging, the drop uses it there (no tap, no confirm).
async function dragThing(file, handle, name) {
  if (!has(file)) return "skipped (no save)";
  const plan = JSON.parse(readFileSync(`${file}.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, file);
  const before = await logText(pg);
  await pg.locator(handle(plan)).first().scrollIntoViewIfNeeded();
  const box = await pg.locator(handle(plan)).first().boundingBox();
  await dragMouse(pg, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, await sectorPoint(pg, plan.targets[0]));
  const lit = await pg.locator(".thing-ghost").count();
  await pg.screenshot({ path: `${out}/ui-${name}-drag.png` });
  await pg.mouse.up();
  await pg.waitForTimeout(1800);
  const log = await logText(pg);
  const used = log !== before && log.split("\n").length > before.split("\n").length;
  await pg.close();
  return lit === 1 && used ? "ok" : `failed (ghost ${lit}, used ${used})`;
}
const modDragCheck = await dragThing(`${out}/moddrag-save.json`, (p) => `[data-module="${p.id}"]`, "module");
const orderDragCheck = await dragThing(`${out}/orderdrag-save.json`, (p) => `[data-order="${p.id}"]`, "order");
// A Flare's energy token dragged onto a Module of its colour (build step 3); a wrong drop floats it back.
let flareChipCheck = "skipped (no save)";
if (has(`${out}/flarechip-save.json`)) {
  const plan = JSON.parse(readFileSync(`${out}/flarechip-save.json.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/flarechip-save.json`);
  await pg.waitForTimeout(1200);
  const chip = pg.locator(`.flare-chip.${plan.colour.toLowerCase()}`).first();
  await chip.waitFor({ timeout: 5000 }).catch(() => {});
  const chips = await pg.locator(".flare-chip").count();
  const before = await promptOf(pg);
  const placedIn = (t) => (t.match(new RegExp(`1 ${plan.colour} energy placed on`, "g")) ?? []).length;
  const n0 = placedIn(await logText(pg));
  const c0 = await chip.boundingBox();
  const from = { x: c0.x + c0.width / 2, y: c0.y + c0.height / 2 };
  // A wrong drop (an empty spot of the Field's corner): it floats back, nothing answered.
  const fb = await pg.locator(".field").boundingBox();
  await dragMouse(pg, from, { x: fb.x + 12, y: fb.y + fb.height - 12 });
  await pg.mouse.up();
  await pg.waitForTimeout(500);
  const stayed = (await promptOf(pg)) === before;
  const m = await pg.locator(`[data-module="${plan.module}"]`).boundingBox();
  await dragMouse(pg, from, { x: m.x + m.width / 2, y: m.y + m.height / 2 });
  await pg.screenshot({ path: `${out}/ui-flare-chip.png` });
  await pg.mouse.up();
  await pg.waitForTimeout(900);
  const log = await logText(pg);
  const placed = placedIn(log) === n0 + 1;
  flareChipCheck = chips >= 1 && stayed && placed ? "ok" : `failed (chips ${chips}, stayed ${stayed}, placed ${placed})`;
  await pg.close();
}
// Effects (designer 2026-11-09): an Omega reveal flashes over the Field; an Order on "all" units bombs them all at once.
let fxCheck = "skipped (no save)";
if (has(`${out}/reveal-Omega-save.json`) && has(`${out}/area-save.json`)) {
  let pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  const plan = (f) => JSON.parse(readFileSync(`${out}/${f}.plan.json`, "utf8")).shortcut;
  await pasteSave(pg, `${out}/reveal-Omega-save.json`);
  const p = await sectorPoint(pg, plan("reveal-Omega-save.json").slice(7));
  await pg.mouse.click(p.x, p.y);
  await pg.waitForTimeout(400);
  await pg.locator(".popup [role=menuitem]", { hasText: "Reveal" }).click();
  let flash = false;
  for (let i = 0; i < 40 && !flash; i++) {
    flash = (await pg.locator(".reveal-flash.omega").count()) > 0;
    await pg.waitForTimeout(50);
  }
  await pg.close();
  pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/area-save.json`);
  const order = pg.locator(`[data-order="${plan("area-save.json").slice(6)}"]`);
  await order.click();
  await pg.waitForTimeout(300);
  const act = pg.locator(".popup [role=menuitem], .popup button", { hasText: /Activate/ });
  if (await act.count()) await act.first().click();
  else await order.click();
  let bombs = 0;
  for (let i = 0; i < 80; i++) {
    bombs = Math.max(bombs, await pg.locator("svg.look-bomb").count());
    await pg.waitForTimeout(25);
  }
  fxCheck = flash && bombs >= 2 ? "ok" : `failed (Omega flash ${flash}, bombs at once ${bombs})`;
  await pg.close();
}
// Build step 5: a Reveal that starts an Overload plays its ripple; the Menu's animation settings
// (Instant: nothing plays; Reduced motion On: the page goes still) are kept in this browser.
let motionCheck = "skipped (no save)";
if (has(`${out}/overloadstart-save.json`)) {
  const k = JSON.parse(readFileSync(`${out}/overloadstart-save.json.plan.json`, "utf8")).shortcut.slice(7);
  const reveal = async (pg) => {
    const p = await sectorPoint(pg, k);
    await pg.mouse.click(p.x, p.y);
    await pg.waitForTimeout(400);
    await pg.locator(".popup [role=menuitem]", { hasText: "Reveal" }).click();
  };
  let pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/overloadstart-save.json`);
  await reveal(pg);
  const played = await pg.waitForFunction(() => document.querySelector(".field")?.getAttribute("data-anim") === "1", null, { timeout: 1500 }).then(() => true).catch(() => false);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/ui-overload-start.png` });
  const settled = await pg.waitForFunction(() => document.querySelector(".field")?.getAttribute("data-anim") === "0", null, { timeout: 8000 }).then(() => true).catch(() => false);
  // Menu: Instant, then a fresh load of the same save: the Reveal plays nothing.
  await pg.getByRole("button", { name: "Menu" }).click();
  await pg.locator('.motion-set [data-speed="instant"]').click();
  const menuOpen = (await pg.locator(".motion-set").count()) > 0;
  await pg.screenshot({ path: `${out}/ui-motion-settings.png` });
  const stored = await pg.evaluate(() => localStorage.getItem("aphelion5.motion") ?? "");
  await pg.close();
  pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await pg.evaluate((v) => localStorage.setItem("aphelion5.motion", v), stored);
  await pasteSave(pg, `${out}/overloadstart-save.json`);
  await reveal(pg);
  let anim = false;
  for (let i = 0; i < 20; i++) {
    anim ||= (await pg.locator(".field").getAttribute("data-anim")) === "1";
    await pg.waitForTimeout(50);
  }
  await pg.getByRole("button", { name: "Menu" }).click();
  await pg.locator('.motion-set [data-reduced="on"]').click();
  const still = await pg.evaluate(() => document.documentElement.classList.contains("still"));
  await pg.locator('.motion-set [data-reduced="auto"]').click();
  await pg.locator('.motion-set [data-speed="normal"]').click();
  await pg.close();
  motionCheck = played && settled && menuOpen && stored.includes("instant") && !anim && still ? "ok" : `failed (played ${played}, settled ${settled}, menu kept open ${menuOpen}, stored ${stored}, instant still animated ${anim}, still class ${still})`;
}
// Damage to the Flagship (designer 2026-11-09): a bubble in the Field, bubbles by the Bays; no card.
let damageCheck = "skipped (no save)";
if (has(`${out}/flagship-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/flagship-save.json`);
  const tile = JSON.parse(readFileSync(`${out}/flagship-save.json.plan.json`, "utf8")).shortcut.slice("alert:".length);
  const field = pg.locator(".field");
  const box = await field.boundingBox();
  const h = JSON.parse((await field.getAttribute("data-choosable")) ?? "[]").find((x) => x.id === tile);
  await pg.mouse.click(box.x + h.x, box.y + h.y);
  await pg.waitForTimeout(400);
  await pg.locator(".popup [role=menuitem]").first().click();
  await pg.locator(".damage-bubble").waitFor({ timeout: 4000 }).catch(() => {});
  const big = await pg.locator(".damage-bubble").count();
  const card = await pg.locator(Q).count();
  const pointers = await pg.locator(".bay-hit-bubble").count();
  const before = await promptOf(pg);
  for (let i = 0; i < 12 && (await pg.locator(".bay-hit-bubble:not(:disabled)").count()); i++) {
    await pg.locator(".bay-hit-bubble:not(:disabled)").first().click();
    await pg.waitForTimeout(150);
  }
  await pg.screenshot({ path: `${out}/ui-damage.png` });
  const after = await promptOf(pg);
  damageCheck = big === 1 && card === 0 && pointers >= 1 && after !== before ? "ok" : `failed (bubble ${big}, card ${card}, Bay bubbles ${pointers}, prompt still "${after}")`;
  await pg.close();
}
// Units chosen on bubbles on the units (designer 2026-11-09): no banner; several units: select, then Confirm.
let pickCheck = "skipped (no save)";
if (has(`${out}/pickmany-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/pickmany-save.json`);
  await pg.locator(".unit-pick").first().waitFor({ timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(400);
  const bubblesN = await pg.locator(".unit-pick").count();
  const card = await pg.locator(Q).count();
  const before = await promptOf(pg);
  const want = Number(/which (two|three)/.exec(before)?.[1] === "three" ? 3 : 2);
  for (let i = 0; i < want; i++) {
    await pg.locator(".unit-pick").nth(i).click();
    await pg.waitForTimeout(150);
  }
  const sel = await pg.locator(".unit-pick.selected").count();
  await pg.screenshot({ path: `${out}/ui-pick.png` });
  await pg.locator(".pick-foot .bubble.primary").click();
  await pg.waitForTimeout(800);
  const after = await promptOf(pg);
  pickCheck = bubblesN >= 3 && card === 0 && sel === want && after !== before ? "ok" : `failed (bubbles ${bubblesN}, card ${card}, selected ${sel}, prompt still "${after}")`;
  await pg.close();
}
// P_15 (designer 2026-11-16): pressing a "1 damage" bubble crashed the screen when the next question asked about other units.
let damagePickCheck = "skipped (no save)";
if (has(`${out}/pickdamage-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const before = errors.length;
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/pickdamage-save.json`);
  await pg.locator(".unit-pick").first().waitFor({ timeout: 6000 }).catch(() => {});
  const asked = await promptOf(pg);
  await pg.locator(".unit-pick").first().click();
  await pg.waitForTimeout(1500);
  const alive = (await pg.locator(".game").count()) === 1 && (await pg.locator(".crash-card").count()) === 0;
  const after = alive ? await promptOf(pg) : "";
  damagePickCheck = alive && errors.length === before && after !== asked ? "ok" : `failed (screen alive ${alive}, errors ${errors.length - before}, prompt "${after}")`;
  await pg.close();
}
// Removing Flagship damage (designer 2026-11-09): green bubbles by the Bays, no card; and the FPS counter.
let repairCheck = "skipped (no save)";
if (has(`${out}/repair-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/repair-save.json`);
  await pg.locator(".bay-hit-bubble.repair").first().waitFor({ timeout: 4000 }).catch(() => {});
  const n = await pg.locator(".bay-hit-bubble.repair").count();
  const big = await pg.locator(".damage-bubble.repair").count();
  const card = await pg.locator(Q).count();
  const fps = Number((await pg.locator(".fps").getAttribute("data-fps").catch(() => "0")) ?? 0);
  const before = await promptOf(pg);
  await pg.screenshot({ path: `${out}/ui-repair.png` });
  await pg.locator(".bay-hit-bubble.repair:not([disabled])").first().click();
  await pg.waitForTimeout(800);
  const after = await promptOf(pg);
  repairCheck = n >= 2 && big === 1 && card === 0 && fps > 0 && after !== before ? "ok" : `failed (bubbles ${n}, big ${big}, card ${card}, fps ${fps}, prompt still "${after}")`;
  await pg.close();
}
// The Upgrade sheet (designer 2026-11-09, step 4): fills the screen; tap and drag mark slots; a full
// upgrade says "Upgrade online"; Undo takes back one point; Done asks, then the sheet closes. Phone: tabs.
let upgradeCheck = "skipped (no save)";
if (has(`${out}/upgrade-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/upgrade-save.json`);
  await pg.locator(".upsheet").waitFor({ timeout: 4000 }).catch(() => {});
  const pts = async () => Number((await pg.locator(".upsheet").getAttribute("data-points")) ?? -1);
  const sheet = await pg.locator(".upsheet").count();
  const fieldHidden = await pg.locator(".center").evaluate((el) => getComputedStyle(el).visibility === "hidden").catch(() => false);
  const open = await pg.locator(".up-card.st-open").count();
  const p0 = await pts();
  await pg.locator('[data-upgrade="V1_M02_U1"]').click();
  await pg.waitForTimeout(700);
  await pg.locator('[data-upgrade="V1_M02_U1"]').click();
  const online = await pg.locator(".up-online").waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/ui-upgrade.png` });
  const gained = await pg.locator('[data-upgrade="V1_M02_U1"].st-gained').count();
  const p2 = await pts();
  await pg.getByRole("button", { name: "Undo" }).click();
  await pg.waitForTimeout(500);
  const pU = await pts();
  // Drag a point onto a Requisition.
  const tok = await pg.locator(".up-token").last().boundingBox();
  const tgt = await pg.locator('[data-upgrade="V1_T1"]').boundingBox();
  await dragMouse(pg, { x: tok.x + tok.width / 2, y: tok.y + tok.height / 2 }, { x: tgt.x + tgt.width / 2, y: tgt.y + tgt.height / 2 });
  await pg.mouse.up();
  await pg.waitForTimeout(800);
  const pD = await pts();
  await pg.locator('[data-upgrade="V1_T1"] .up-slot.on').first().waitFor({ timeout: 2500 }).catch(() => {});
  const t1 = await pg.locator('[data-upgrade="V1_T1"] .up-slot.on').count();
  await pg.locator(".up-done").click();
  await pg.waitForTimeout(300);
  const ask = await pg.locator(".up-confirm").count();
  await pg.getByRole("button", { name: /Finish and lose/ }).click();
  await pg.waitForTimeout(800);
  const closed = (await pg.locator(".upsheet").count()) === 0;
  const prompt = await promptOf(pg);
  await pg.close();
  // A phone: tabs, short cards, open one and mark a slot.
  const ph = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
  ph.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(ph, `${out}/upgrade-save.json`);
  await ph.locator(".upsheet").waitFor({ timeout: 4000 }).catch(() => {});
  const tabs = await ph.locator(".up-tabs button").count();
  const sw = await ph.evaluate(() => document.documentElement.scrollWidth);
  const q0 = Number((await ph.locator(".upsheet").getAttribute("data-points")) ?? -1);
  await ph.locator(".up-card.st-open").first().click();
  await ph.locator(".up-mark").click();
  await ph.waitForTimeout(800);
  const q1 = Number((await ph.locator(".upsheet").getAttribute("data-points")) ?? -1);
  await ph.screenshot({ path: `${out}/ui-upgrade-phone.png` });
  await ph.close();
  const ok = sheet === 1 && fieldHidden && open >= 3 && p2 === p0 - 2 && online && gained === 1 && pU === p2 + 1 && pD === pU - 1 && t1 === 1 && ask === 1 && closed && !/^Upgrade/.test(prompt) && tabs === 3 && sw <= 362 && q1 === q0 - 1;
  upgradeCheck = ok ? "ok" : `failed (sheet ${sheet}, field hidden ${fieldHidden}, open ${open}, points ${p0}>${p2}, online ${online}, gained ${gained}, undo ${pU}, drag ${pD}, T1 slots ${t1}, confirm ${ask}, closed ${closed}, prompt "${prompt}", tabs ${tabs}, phone width ${sw}, phone ${q0}>${q1})`;
}
// Questions inside the Field (designer 2026-11-10): Crippled points at Overhaul; Overhaul's Module is chosen on bubbles beside the Modules.
let askCheck = "skipped (no save)";
if (has(`${out}/crippled-save.json`)) {
  const res = [];
  for (const [w, h] of [[1400, 900], [390, 844]]) {
    const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pasteSave(pg, `${out}/crippled-save.json`);
    await pg.waitForTimeout(600);
    const big = await pg.locator(".ask-bubble.alert").count();
    const must = await pg.locator(".overhaul-btn.must").count();
    const point = pg.locator('.point-bubble[data-point="overhaul"]');
    await point.waitFor({ timeout: 3000 }).catch(() => {});
    const pointed = await point.count();
    // The bubble sits beside the button and points at it.
    const near = await pg.evaluate(() => {
      const a = document.querySelector('.point-bubble[data-point="overhaul"]')?.getBoundingClientRect();
      const b = [...document.querySelectorAll("[data-overhaul]")].map((e) => e.getBoundingClientRect()).find((r) => r.width > 0);
      return a && b ? Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2)) < 160 : false;
    });
    await pg.screenshot({ path: `${out}/ui-crippled-${w}.png` });
    if (pointed) await point.click();
    await pg.waitForTimeout(700);
    const p1 = await promptOf(pg);
    // Overhaul's Module: no card or banner; a bubble beside each Module; a press answers.
    const cards = await pg.locator(".q-card, .q-banner").count();
    // Modules scrolled out of the panel get their bubble when scrolled in.
    const mods = await pg.evaluate(() => [...document.querySelectorAll(".module[data-module]")].filter((e) => { const r = e.getBoundingClientRect(); const p = e.closest(".panel")?.getBoundingClientRect(); const y = r.top + r.height / 2; return r.width > 0 && (!p || (y >= p.top && y <= p.bottom)); }).length);
    const pops = await pg.locator(".point-bubble").count();
    await pg.screenshot({ path: `${out}/ui-overhaul-module-${w}.png` });
    if (pops) await pg.locator(".point-bubble").first().click();
    await pg.waitForTimeout(600);
    const p2 = await promptOf(pg);
    await pg.close();
    const ok = big === 1 && must === 1 && pointed === 1 && near && /^Overhaul: put one/.test(p1) && cards === 0 && pops === mods && p2 !== p1;
    res.push(ok ? "ok" : `${w}px: big bubble ${big}, burning button ${must}, pointer ${pointed}, beside it ${near}, then "${p1}", cards ${cards}, Module bubbles ${pops} of ${mods}, then "${p2}"`);
  }
  askCheck = res.every((x) => x === "ok") ? "ok" : `failed (${res.filter((x) => x !== "ok").join("; ")})`;
}
// Resting (designer 2026-11-22, iPad heat): 20 s untouched with nothing playing, the Field stops
// drawing, the FPS counter stops, the CSS animations pause; a mouse move wakes it all.
let restCheck = "skipped (no save)";
if (runs("game") && has(`${out}/drag-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/drag-save.json`);
  await pg.mouse.move(5, 300);
  const state = () => pg.evaluate(() => ({ resting: document.documentElement.classList.contains("resting"), fps: document.querySelector(".fps")?.getAttribute("data-fps"), anim: getComputedStyle(document.querySelector(".can") ?? document.body).animationPlayState }));
  const early = await state();
  await pg.waitForFunction(() => document.documentElement.classList.contains("resting"), null, { timeout: 30000 }).catch(() => {});
  const rest = await state();
  await pg.mouse.move(400, 400, { steps: 4 });
  await pg.waitForTimeout(800);
  const back = await state();
  await pg.close();
  const ok = !early.resting && rest.resting && rest.fps === "rest" && /paused/.test(rest.anim) && !back.resting && back.fps !== "rest" && !/paused/.test(back.anim);
  restCheck = ok ? "ok" : `failed (at first ${JSON.stringify(early)}, after 20 s ${JSON.stringify(rest)}, after a move ${JSON.stringify(back)})`;
}
// Command briefing (2026-11-13): the long intro on a first visit, two taps skip it; then the short one.
let introCheck = "ok";
if (runs("intro")) {
  // First visit: the long approach; one tap arms the 1-second skip, a second tap inside it skips.
  const pg = await plainPage({ viewport: { width: 390, height: 800 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await pg.waitForSelector(".bf-intro[data-intro=full]");
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/ui-intro-phone.png` });
  await pg.mouse.click(120, 300);
  const armed = await pg.locator("[data-skip=armed]").count();
  await pg.waitForTimeout(1200);
  const lapsed = (await pg.locator("[data-skip=idle]").count()) === 1 && (await pg.locator(".bf-intro").count()) === 1;
  await pg.mouse.click(120, 300);
  await pg.waitForTimeout(300);
  await pg.mouse.click(120, 300);
  const skipped = await pg.waitForSelector(".bf-intro", { state: "detached", timeout: 1500 }).then(() => true, () => false);
  const noScroll = (await pg.evaluate(() => document.documentElement.scrollWidth)) <= 390;
  await pg.reload();
  const short = await pg.waitForSelector(".bf-intro[data-intro=short]", { timeout: 3000 }).then(() => true, () => false);
  const gone = await pg.waitForSelector(".bf-intro", { state: "detached", timeout: 3000 }).then(() => true, () => false);
  await start(pg).catch(() => {});
  const launched = (await pg.locator(".game").count()) === 1 && (await pg.locator("[data-prep=module] [data-prep-pick]").count()) === 3;
  await pg.close();
  if (!(armed === 1 && lapsed && skipped && noScroll && short && gone && launched)) introCheck = `failed (hint ${armed}, lapsed ${lapsed}, skipped ${skipped}, fits ${noScroll}, short intro ${short}, ends ${gone}, launched ${launched})`;
}
// Styles (designer 2026-11-14): "intro1" and "intro2", each with its own long intro; frames of both
// for the designer, and each ends by itself on the Campaign step in its own look.
let styleCheck = "ok";
if (runs("intro")) for (const style of ["intro2", "intro1"]) {
  const pg = await plainPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.addInitScript((s) => localStorage.setItem("aphelion5.style", s), style);
  await pg.goto(url);
  await pg.waitForSelector(`.bf-intro[data-intro=full][data-intro-style=${style}]`);
  for (const [i, wait] of [[1, 1200], [2, 2300], [3, 2500], [4, 2300], [5, 1200]]) {
    await pg.waitForTimeout(wait);
    await pg.screenshot({ path: `${out}/ui-intro-${style}-${i}.png` });
  }
  const ended = await pg.waitForSelector(".bf-intro", { state: "detached", timeout: 6000 }).then(() => true, () => false);
  const look = await pg.evaluate(() => [document.documentElement.dataset.bfStyle, document.querySelector(".brief")?.getAttribute("data-style")].join());
  await pg.close();
  if (!ended && introCheck === "ok") introCheck = `failed (the long intro of ${style} did not end)`;
  if (look !== `${style},${style}` && styleCheck === "ok") styleCheck = `failed (${style}: the page is marked ${look})`;
}
if (runs("intro")) {
  // The switch (System options > Style): the menu changes look at once and keeps its layout; the
  // choice is remembered; "Replay the full intro" plays the chosen style's film.
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await briefAt(pg, "campaign");
  const mark = () => pg.evaluate(() => document.documentElement.dataset.bfStyle);
  const boxes = () => pg.evaluate(() => [...document.querySelectorAll(".brief [data-campaign], .brief [data-mission], .brief [data-action]")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(); }).join(";"));
  const first = await mark();
  await pg.waitForTimeout(1600); // the cards have slid in (twice as slow since 2026-11-16): measure them at rest
  const lay2 = await boxes();
  await pg.locator("[aria-label='System options']").click();
  const picks = await pg.locator("[data-style-pick]").count();
  await pg.locator("[data-style-pick=intro1]").click();
  const second = await mark();
  await pg.screenshot({ path: `${out}/ui-style-options.png` });
  await pg.locator("[aria-label='Close']").click();
  await pg.waitForTimeout(1600);
  const lay1 = await boxes();
  await pg.screenshot({ path: `${out}/ui-style-intro1.png` });
  await pg.reload();
  await briefAt(pg, "campaign");
  const kept = await mark();
  await pg.locator("[aria-label='System options']").click();
  await pg.getByRole("button", { name: /Replay the full intro/ }).click();
  const replay = await pg.waitForSelector(".bf-intro[data-intro=full][data-intro-style=intro1]", { timeout: 3000 }).then(() => true, () => false);
  await pg.mouse.click(300, 300);
  await pg.waitForTimeout(200);
  await pg.mouse.click(300, 300);
  await pg.waitForSelector(".bf-intro", { state: "detached", timeout: 3000 }).catch(() => {});
  await pg.locator("[aria-label='System options']").click();
  await pg.locator("[data-style-pick=intro2]").click();
  const back = await mark();
  await pg.close();
  if (!(first === "intro2" && picks === 2 && second === "intro1" && kept === "intro1" && replay && back === "intro2" && lay1 === lay2) && styleCheck === "ok")
    styleCheck = `failed (starts ${first}, ${picks} styles offered, after the switch ${second}, after a reload ${kept}, replay plays intro1 ${replay}, back ${back}, same layout ${lay1 === lay2})`;
}
// The whole briefing walked in both styles (the layout is the same; only the look differs).
if (runs("intro")) for (const [name, width, height, style] of [["", 1400, 900, "intro2"], ["-phone", 390, 800, "intro2"], ["-intro1", 1400, 900, "intro1"], ["-intro1-phone", 390, 800, "intro1"]]) {
  const pg = await browser.newPage({ viewport: { width, height } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.addInitScript((s) => localStorage.setItem("aphelion5.style", s), style);
  await pg.goto(url);
  await briefAt(pg, "campaign");
  // The unit roster: Omega units in their own place, a filter per type, a card per unit.
  const vip = await pg.locator("[data-vip=omega] [data-unit]").count();
  // No mission open at first; a tap opens its file (map, unit roster), a second tap closes it.
  const noFile = (await pg.locator("[data-mission-detail]").count()) === 0;
  const maps = await pg.locator("[data-mission] svg[data-map]").count();
  const noF01 = (await pg.locator("[data-roster] [data-unit=F_01]").count()) === 0;
  await pg.screenshot({ path: `${out}/ui-brief-campaign${name}.png`, fullPage: false });
  await pg.locator("[data-mission=C1_M3]").click();
  const fileOpen = (await pg.locator("[data-mission-detail=C1_M3] svg[data-map]").count()) === 1 && (await pg.locator("[data-mission-roster=C1_M3] [data-unit]").count()) > 0;
  await pg.locator("[data-mission-detail=C1_M3]").scrollIntoViewIfNeeded();
  await pg.screenshot({ path: `${out}/ui-brief-mission${name}.png`, fullPage: false });
  await pg.locator("[data-mission=C1_M3]").click();
  const fileClosed = (await pg.locator("[data-mission-detail]").count()) === 0;
  // Threats never combined (designer 2026-11-16): one row of four Threats on a PC, four Threat buttons on a phone.
  await pg.locator("[data-mission=C1_M3]").click();
  await pg.waitForTimeout(700);
  let threatsOk;
  if (width >= 1280) threatsOk = (await pg.locator("[data-threat-row='1'] [data-threat-col]").count()) === 4 && (await pg.locator("[data-threat-row='1'] [data-threat-col] [data-unit]").count()) >= 12;
  else {
    await pg.locator("[data-threat-btn=A]").click();
    threatsOk = (await pg.locator("[data-threat-row='0'] [data-threat-col=A] [data-unit]").count()) >= 3;
  }
  // "All": one row per unit type.
  const typeRows = await pg.locator("[data-type-row]").count();
  await pg.locator("[data-mission=C1_M3]").click();
  const missionOk = noFile && maps > 3 && noF01 && fileOpen && fileClosed && threatsOk && typeRows === 4;
  if (!missionOk) console.log("mission roster", { noFile, maps, noF01, fileOpen, fileClosed, threatsOk, typeRows, width });
  await pg.locator("[data-filter=Sleeper]").click();
  const sleepers = await pg.locator("[data-roster] [data-compact] [data-unit]").evaluateAll((els) => els.every((e) => e.dataset.unit.startsWith("P_")) && els.length > 0);
  await pg.locator("[data-roster] [data-compact] [data-unit]").first().click();
  const card = await pg.locator("[data-unit-card] .bf-line").count();
  await pg.screenshot({ path: `${out}/ui-brief-unit${name}.png` });
  await pg.keyboard.press("Escape");
  const closed = (await pg.locator("[data-unit-card]").count()) === 0;
  const t0 = Date.now();
  await pg.locator("[data-action=campaign]").click();
  // The logo gate (designer 2026-11-16): doors shut, the mark on the join.
  const gateSeen = await pg.waitForSelector("[data-gate] .gt-core svg", { timeout: 1500 }).then(() => true, () => false);
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${out}/ui-gate${name}.png` });
  await briefAt(pg, "vessel");
  const confirmMs = Date.now() - t0;
  await pg.locator("[data-company=V2]").click();
  await pg.waitForTimeout(350);
  await pg.screenshot({ path: `${out}/ui-brief-vessel${name}.png` });
  const flagshipTab = await pg.locator("[data-flagship=V2]").count();
  await pg.locator("[data-vtab=mecha]").click();
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/ui-brief-vessel-mecha${name}.png` });
  await pg.locator("[data-mecha-bay=V2] [data-unit]").first().click();
  const mechaCard = await pg.locator("[data-unit-card] .bf-line").count();
  await pg.screenshot({ path: `${out}/ui-brief-mecha${name}.png` });
  await pg.locator(".bf-x").click();
  await pg.locator("[data-action=vessel]").click();
  await briefAt(pg, "modules");
  await pg.locator("[data-chip=heat]").click();
  const plugged = await pg.locator("[data-expansions=heat]").count();
  await pg.screenshot({ path: `${out}/ui-brief-modules${name}.png` });
  await pg.locator("[data-action=modules]").click();
  // After Launch the game asks Mission 1's Threat on its own screen: nothing chosen, Confirm locked.
  await pg.waitForSelector("[data-threat-screen=C1_M1]");
  const locked = await pg.locator("[data-action=threat]").isDisabled();
  const tiles = await pg.locator("[data-col=A] [data-unit]").count();
  for (const c of ["A", "B", "C"]) await pg.locator(`[data-col-btn=${c}]`).click();
  const level = await pg.locator("[data-threat-screen]").getAttribute("data-level");
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: `${out}/ui-threat-3${name}.png` });
  await pg.locator("[data-col-btn=D]").click();
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${out}/ui-threat-4${name}.png` });
  await pg.locator("[data-col-btn=D]").click();
  await pg.locator("[data-col=A] [data-unit]").first().click();
  const threatCard = await pg.locator("[data-unit-card]").count();
  await pg.keyboard.press("Escape");
  const fits = (await pg.evaluate(() => document.documentElement.scrollWidth)) <= width;
  await pg.locator("[data-action=threat]").click();
  await pg.waitForSelector("[data-threat-screen]", { state: "detached" });
  // Then the Module draw and the Ally, on the same kind of screen, before the Field.
  await pg.waitForSelector("[data-prep=module]");
  const modCards = await pg.locator("[data-prep-pick] .module").count();
  const keepLocked = await pg.locator("[data-action=prep]").isDisabled();
  await pg.locator("[data-prep-pick]").nth(1).click();
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${out}/ui-prep-module${name}.png` });
  await pg.locator("[data-action=prep]").click();
  await pg.waitForSelector("[data-prep=ally]");
  const allies = await pg.locator("[data-prep-pick]").count();
  const fieldHidden = await pg.locator(".game.upgrading").count();
  await pg.locator("[data-prep-pick]").first().click({ position: { x: 24, y: 16 } });
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${out}/ui-prep-ally${name}.png` });
  await pg.locator("[data-action=prep]").click();
  if (await pg.waitForSelector("[data-prep=allyMecha]", { timeout: 3500 }).then(() => true, () => false)) {
    await pg.screenshot({ path: `${out}/ui-prep-allymecha${name}.png` });
    await pg.locator("[data-prep-pick]").first().click({ position: { x: 24, y: 16 } });
    await pg.locator("[data-action=prep]").click();
  }
  await pg.waitForSelector("[data-prep]", { state: "detached" });
  // The mission intro before the Field (designer 2026-11-16), then a tap skips it.
  const missionIntro = await pg.waitForSelector("[data-mission-intro=C1_M1]", { timeout: 4000 }).then(() => true, () => false);
  await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
  await pg.waitForTimeout(1300);
  await pg.screenshot({ path: `${out}/ui-mission-intro${name}.png` });
  await settle(pg);
  await pg.waitForFunction(() => !document.querySelector("[data-mission-intro]") && !document.querySelector(".game.upgrading"), null, { timeout: 9000 }).catch(() => {});
  const fieldShown = (await pg.locator(".game.upgrading").count()) === 0 && (await pg.locator("[data-mission-intro]").count()) === 0;
  if (!fieldShown) console.log("field", { upgrading: await pg.locator(".game.upgrading").count(), intro: await pg.locator("[data-mission-intro]").count(), prep: await pg.locator("[data-prep]").getAttribute("data-prep").catch(() => "none"), gate: await pg.locator("[data-gate]").count() });
  await pg.waitForTimeout(300);
  // The loadout reached the game: V2, and Mission 1 plays the three columns chosen.
  await toggleLog(pg);
  const log = await pg.locator(".log").innerText().catch(() => "");
  await pg.close();
  const prepOk = gateSeen && missionIntro && flagshipTab === 1 && modCards === 3 && keepLocked && allies >= 1 && fieldHidden === 1 && fieldShown && /keep /.test(log) && /your Ally: /.test(log);
  const ok = prepOk && vip === 3 && sleepers && card > 0 && closed && confirmMs < 3400 && mechaCard > 0 && plugged === 1 && locked && tiles === 4 && missionOk && level === "3" && threatCard === 1 && fits && /Kew'n X2/.test(log) && /Threat Level Siege: columns A, B, C/.test(log);
  if (!ok && introCheck === "ok") introCheck = `failed at ${width} px in ${style} (missions: none open ${noFile}, maps ${maps}, no F_01 ${noF01}, opens ${fileOpen}, closes ${fileClosed}; prep: gate ${gateSeen}, mission intro ${missionIntro}, flagship tab ${flagshipTab}, modules ${modCards}, keep locked ${keepLocked}, allies ${allies}, field hidden ${fieldHidden}, field shown ${fieldShown}; omega ${vip}, filter ${sleepers}, card ${card}, closed ${closed}, confirm ${confirmMs} ms, mecha card ${mechaCard}, chip ${plugged}, confirm locked ${locked}, tiles ${tiles}, level ${level}, threat card ${threatCard}, fits ${fits}, company ${/Kew'n X2/.test(log)}, threat ${/Threat Level Siege/.test(log)})`;
}
// The outro (designer 2026-11-16; Terraformer 2.0 and the game's numbers 2026-11-17): the last mission won, the
// Upgrade sheet closed -> Terraformer 2.0 plays over the page (four acts in order, one anchor per mission won, "Tap twice to skip"
// button), then the Campaign Debrief slides in beside the cleared sector (at the side on a wide screen, along the foot
// on a phone) with the game's own score and numbers; "Return to Command Deck" plays the logo gate and lands on the
// briefing with no game left to resume. System options lists both versions (1.0 kept to compare), each with sample
// numbers; with reduced motion there is no film, only the Debrief.
let outroCheck = "skipped (no save)";
if (runs("outro") && existsSync(`${out}/won-save.json`)) {
  const fails = [];
  for (const [w, h] of [[1400, 900], [390, 844]]) {
    const name = w < 600 ? "-phone" : "";
    const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pasteSave(pg, `${out}/won-save.json`);
    await pg.locator(".upsheet").waitFor({ timeout: 6000 }).catch(() => {});
    if (w < 600) await pg.locator(".up-tabs button").first().waitFor({ timeout: 3000 }).catch(() => {});
    await pg.locator(".up-done").click();
    await pg.getByRole("button", { name: /Finish and lose/ }).click();
    const shown = await pg.waitForSelector("[data-outro=terraformer2]", { timeout: 6000 }).then(() => true, () => false);
    const t0 = Date.now();
    const at = async (k) => (await pg.locator("[data-outro]").getAttribute(k).catch(() => null)) ?? "";
    const plainCard = await pg.locator(".q-card").count();
    const skip = await pg.locator("[data-action=outro-skip]").count();
    let acts = "";
    let filmMs = 0;
    let armed = "armed";
    let oneTapFilm = true;
    if (w >= 600) {
      // The whole film, untouched (a screenshot would hold the page up): the Debrief comes by itself, at about 13.2 s.
      await pg.waitForSelector("[data-outro][data-phase=debrief]", { timeout: 32000 }).catch(() => {});
      filmMs = Date.now() - t0;
      // The page notes the acts it has shown: all four, in order.
      acts = await at("data-acts");
    } else {
      await pg.waitForTimeout(900);
      // One tap does not skip ("Tap again to skip"); a second within 1 s does.
      await pg.mouse.click(w / 2, h * 0.3);
      await pg.waitForTimeout(150);
      armed = (await pg.locator("[data-action=outro-skip]").getAttribute("data-skip").catch(() => "")) ?? "";
      oneTapFilm = (await at("data-phase")) === "film";
      // Let the second run out (a slow machine can take that long to read the page), then two taps in a row.
      await pg.waitForTimeout(1200);
      await pg.mouse.click(w / 2, h * 0.3);
      await pg.mouse.click(w / 2, h * 0.3);
    }
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 4000 }).then(() => true, () => false);
    await pg.waitForTimeout(2300);
    await pg.screenshot({ path: `${out}/ui-outro-debrief${name}.png` });
    const hits = await at("data-hits");
    const skipGone = (await pg.locator("[data-action=outro-skip]").count()) === 0;
    const card = await pg.locator(".ou-card").boundingBox();
    const text = ((await pg.locator(".ou-card").innerText().catch(() => "")) ?? "").toLowerCase();
    const scoreWant = await pg.locator(".ou-score-n").getAttribute("data-score");
    const scoreShown = (await pg.locator(".ou-score-n").innerText()).trim();
    const cells = await pg.locator(".ou-missions li").count();
    const rows = await pg.locator(".ou-row").count();
    const mods = await pg.locator(".ou-mod").count();
    const counts = await pg.locator(".ou-counts li").count();
    // The card leaves the glowing sector in view: beside it on a wide screen, above it on a phone.
    const room = card && (w >= 900 ? card.width <= w * 0.42 && card.x >= w * 0.55 : card.height <= h * 0.6 && card.y >= h * 0.38);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    await pg.locator("[data-action=outro-return]").click();
    const gate = await pg.waitForSelector("[data-gate]", { timeout: 2000 }).then(() => true, () => false);
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 6000 }).catch(() => {});
    await pg.waitForSelector("[data-gate]", { state: "detached", timeout: 6000 }).catch(() => {});
    const left = (await pg.locator("[data-outro]").count()) === 0 && (await pg.locator('.brief[data-step=campaign]').count()) === 1;
    await pg.getByRole("button", { name: "System options" }).click();
    const resume = await pg.getByRole("button", { name: "Resume game" }).count();
    await pg.close();
    const ok =
      shown && plainCard === 0 && skip === 1 && debrief && hits === "7" && skipGone && room && cells === 7 && rows === 7 && counts === 10 && mods > 0 && scoreShown === scoreWant && Number(scoreWant) >= 12 &&
      /campaign debrief/.test(text) && /campaign 1/.test(text) && /final score/.test(text) && /support vessel of ko and van/.test(text) && /expansion/.test(text) && /threat levels conquered/.test(text) && /modules/.test(text) && /overloads/.test(text) && !/total turns/.test(text) &&
      /units destroyed/.test(text) && /sleepers triggered/.test(text) && /flares triggered/.test(text) && /omega triggered/.test(text) && /sentinels triggered/.test(text) && /gyros drained/.test(text) && /return to command deck/.test(text) && /whole campaign completed/.test(text) &&
      armed === "armed" && oneTapFilm && (w < 600 || (acts === "1234" && filmMs > 12000 && filmMs < 26000)) && gate && left && resume === 0 && sw <= w + 2;
    if (!ok) fails.push(`${w} px: shown ${shown}, plain card ${plainCard}, skip ${skip}, acts ${acts}, film ${filmMs} ms, debrief ${debrief}, hits ${hits}, skip gone ${skipGone}, one tap ${armed}/${oneTapFilm}, room ${room} (${JSON.stringify(card)}), cells ${cells}, rows ${rows}, counts ${counts}, modules ${mods}, score ${scoreShown}/${scoreWant}, gate ${gate}, left ${left}, resume ${resume}, width ${sw}, text "${text.slice(0, 160)}"`);
  }
  // The preview from System options (sample numbers, the Company chosen in the briefing): 1.0 in one style, 2.0 in the other.
  for (const [style, version] of [["intro1", "terraformer"], ["intro2", "terraformer2"]]) {
    const pg = await plainPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript((st) => { try { localStorage.setItem("aphelion5.intro", "off"); localStorage.setItem("aphelion5.style", st); } catch {} }, style);
    await pg.goto(url);
    await briefAt(pg, "campaign");
    await pg.getByRole("button", { name: "System options" }).click();
    const listed = await pg.locator("[data-action=outro-preview]").count();
    await pg.locator(`[data-action=outro-preview][data-outro-id=${version}]`).click();
    const shown = await pg.waitForSelector(`[data-outro=${version}]`, { timeout: 4000 }).then(() => true, () => false);
    const badge = await pg.locator(".ou-preview").count();
    await pg.waitForTimeout(1500);
    const act = await pg.locator("[data-outro]").getAttribute("data-act").catch(() => "");
    if (version === "terraformer2") {
      // Pictures of the film on its way (the drift under the bay, the descent, the anchors and the clearing), for looking at; nothing here is timed.
      const p0 = Date.now() - 1500;
      for (const [i, sec] of [3.4, 6.4, 11.4].entries()) {
        await pg.waitForTimeout(Math.max(0, sec * 1000 - (Date.now() - p0)));
        await pg.screenshot({ path: `${out}/ui-outro-${i + 1}.png` });
      }
    }
    await pg.mouse.click(550, 230);
    await pg.mouse.click(550, 230);
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 3000 }).then(() => true, () => false);
    await pg.waitForTimeout(1900);
    await pg.screenshot({ path: `${out}/ui-outro-preview-${style}.png` });
    await pg.locator("[data-action=outro-return]").click();
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 6000 }).catch(() => {});
    const back = (await pg.locator("[data-outro]").count()) === 0 && (await pg.locator('.brief[data-step=campaign]').count()) === 1;
    await pg.close();
    if (!(shown && listed === 4 && badge === 1 && act === "1" && debrief && back)) fails.push(`preview of ${version} in ${style}: shown ${shown}, listed ${listed}, badge ${badge}, act ${act}, debrief ${debrief}, back ${back}`);
  }
  // Surface Terraform (designer 2026-11-19), from System options: at 1400 px the whole film untouched (four acts in order, three
  // spires firing, the Debrief by itself beside the valley at about 10.6 s); at 1100 px pictures of it on its way (nothing timed);
  // at 390 px two taps skip it and the card lies along the foot. 2.0 still plays after a won game (checked above).
  for (const [w, h] of [[1400, 900], [1100, 760], [390, 844]]) {
    const pg = await plainPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    await pg.goto(url);
    await briefAt(pg, "campaign");
    await pg.getByRole("button", { name: "System options" }).click();
    const button = pg.locator("[data-action=outro-preview][data-outro-id=surface]");
    const label = ((await button.innerText().catch(() => "")) ?? "").trim();
    await button.click();
    const shown = await pg.waitForSelector("[data-outro=surface]", { timeout: 4000 }).then(() => true, () => false);
    const t0 = Date.now();
    const at = async (k) => (await pg.locator("[data-outro]").getAttribute(k).catch(() => null)) ?? "";
    const skip = await pg.locator("[data-action=outro-skip]").count();
    let acts = "1234";
    let filmMs = 0;
    let spires = "3";
    let far = "4";
    if (w === 1400) {
      // The whole film, untouched (a screenshot would hold the page up).
      await pg.waitForSelector("[data-outro][data-phase=debrief]", { timeout: 30000 }).catch(() => {});
      filmMs = Date.now() - t0;
      acts = await at("data-acts");
      spires = await at("data-spires");
      far = await at("data-far");
    } else if (w === 1100) {
      for (const [i, sec] of [2.4, 4.9, 8.2].entries()) {
        await pg.waitForTimeout(Math.max(0, sec * 1000 - (Date.now() - t0)));
        await pg.screenshot({ path: `${out}/ui-outro-surface-${i + 1}.png` });
      }
      await pg.mouse.click(w / 2, h * 0.3);
      await pg.mouse.click(w / 2, h * 0.3);
    } else {
      await pg.waitForTimeout(1500);
      await pg.mouse.click(w / 2, h * 0.3);
      await pg.mouse.click(w / 2, h * 0.3);
    }
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 4000 }).then(() => true, () => false);
    await pg.waitForTimeout(2300);
    if (w !== 1100) await pg.screenshot({ path: `${out}/ui-outro-surface-debrief${w < 600 ? "-phone" : ""}.png` });
    const card = await pg.locator(".ou-card").boundingBox();
    const room = card && (w >= 900 ? card.width <= w * 0.42 && card.x >= w * 0.55 : card.height <= h * 0.6 && card.y >= h * 0.38);
    const text = ((await pg.locator(".ou-card").innerText().catch(() => "")) ?? "").toLowerCase();
    const badge = await pg.locator(".ou-preview").innerText().catch(() => "");
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    await pg.locator("[data-action=outro-return]").click();
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 6000 }).catch(() => {});
    const back = (await pg.locator("[data-outro]").count()) === 0 && (await pg.locator(".brief[data-step=campaign]").count()) === 1;
    await pg.close();
    const ok = shown && /^play surface terraform \(/i.test(label) && /surface terraform/i.test(badge) && skip === 1 && debrief && room && acts === "1234" && spires === "3" && far === "4" && (w !== 1400 || (filmMs > 9500 && filmMs < 24000)) &&
      /campaign debrief/.test(text) && /final score/.test(text) && /return to command deck/.test(text) && back && sw <= w + 2;
    if (!ok) fails.push(`Surface Terraform at ${w} px: shown ${shown}, label "${label}", badge "${badge}", skip ${skip}, acts ${acts}, spires ${spires}, far ${far}, film ${filmMs} ms, debrief ${debrief}, room ${room} (${JSON.stringify(card)}), back ${back}, width ${sw}`);
  }
  // Orbital Claim (designer 2026-11-19), from System options: at 1400 px the whole film untouched (four acts in order, the
  // clamps locked, twelve satellites in the lattice, ASSET SECURED, the Debrief by itself beside ship and planet at about
  // 10.1 s); at 1100 px pictures of it on its way (nothing timed); at 390 px two taps skip it and the card lies along the foot.
  for (const [w, h] of [[1400, 900], [1100, 760], [390, 844]]) {
    const pg = await plainPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    await pg.goto(url);
    await briefAt(pg, "campaign");
    await pg.getByRole("button", { name: "System options" }).click();
    const button = pg.locator("[data-action=outro-preview][data-outro-id=orbital]");
    const label = ((await button.innerText().catch(() => "")) ?? "").trim();
    await button.click();
    const shown = await pg.waitForSelector("[data-outro=orbital]", { timeout: 4000 }).then(() => true, () => false);
    const t0 = Date.now();
    const at = async (k) => (await pg.locator("[data-outro]").getAttribute(k).catch(() => null)) ?? "";
    const skip = await pg.locator("[data-action=outro-skip]").count();
    let acts = "1234";
    let filmMs = 0;
    let claimed = "1/12/1";
    if (w === 1400) {
      await pg.waitForSelector("[data-outro][data-phase=debrief]", { timeout: 30000 }).catch(() => {});
      filmMs = Date.now() - t0;
      acts = await at("data-acts");
      claimed = `${await at("data-locked")}/${await at("data-sats")}/${await at("data-secured")}`;
    } else if (w === 1100) {
      for (const [i, sec] of [1.8, 5.9, 8.6].entries()) {
        await pg.waitForTimeout(Math.max(0, sec * 1000 - (Date.now() - t0)));
        await pg.screenshot({ path: `${out}/ui-outro-orbital-${i + 1}.png` });
      }
      await pg.mouse.click(w / 2, h * 0.3);
      await pg.mouse.click(w / 2, h * 0.3);
    } else {
      await pg.waitForTimeout(1500);
      await pg.mouse.click(w / 2, h * 0.3);
      await pg.mouse.click(w / 2, h * 0.3);
    }
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 4000 }).then(() => true, () => false);
    await pg.waitForTimeout(2300);
    if (w !== 1100) await pg.screenshot({ path: `${out}/ui-outro-orbital-debrief${w < 600 ? "-phone" : ""}.png` });
    const card = await pg.locator(".ou-card").boundingBox();
    const room = card && (w >= 900 ? card.width <= w * 0.42 && card.x >= w * 0.55 : card.height <= h * 0.6 && card.y >= h * 0.38);
    const text = ((await pg.locator(".ou-card").innerText().catch(() => "")) ?? "").toLowerCase();
    const badge = await pg.locator(".ou-preview").innerText().catch(() => "");
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    await pg.locator("[data-action=outro-return]").click();
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 6000 }).catch(() => {});
    const back = (await pg.locator("[data-outro]").count()) === 0 && (await pg.locator(".brief[data-step=campaign]").count()) === 1;
    await pg.close();
    const ok = shown && /^play orbital claim \(/i.test(label) && /orbital claim/i.test(badge) && skip === 1 && debrief && room && acts === "1234" && claimed === "1/12/1" && (w !== 1400 || (filmMs > 9000 && filmMs < 24000)) &&
      /campaign debrief/.test(text) && /final score/.test(text) && /return to command deck/.test(text) && back && sw <= w + 2;
    if (!ok) fails.push(`Orbital Claim at ${w} px: shown ${shown}, label "${label}", badge "${badge}", skip ${skip}, acts ${acts}, locked/sats/secured ${claimed}, film ${filmMs} ms, debrief ${debrief}, room ${room} (${JSON.stringify(card)}), back ${back}, width ${sw}`);
  }
  // Reduced motion: no film, the still picture of its end and the Debrief at once.
  {
    const pg = await plainPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    await pg.goto(url);
    await briefAt(pg, "campaign");
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator("[data-action=outro-preview][data-outro-id=terraformer2]").click();
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 2500 }).then(() => true, () => false);
    const skip = await pg.locator("[data-action=outro-skip]").count();
    const hits = await pg.locator("[data-outro]").getAttribute("data-hits").catch(() => "");
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${out}/ui-outro-still.png` });
    await pg.locator("[data-action=outro-return]").click();
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 3000 }).catch(() => {});
    const back = (await pg.locator("[data-outro]").count()) === 0;
    await pg.close();
    if (!(debrief && skip === 0 && hits === "7" && back)) fails.push(`reduced motion: debrief ${debrief}, skip ${skip}, hits ${hits}, back ${back}`);
  }
  // Reduced motion, Surface Terraform: no film either, its still picture and the Debrief at once.
  {
    const pg = await plainPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    await pg.goto(url);
    await briefAt(pg, "campaign");
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator("[data-action=outro-preview][data-outro-id=surface]").click();
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 3000 }).then(() => true, () => false);
    const skip = await pg.locator("[data-action=outro-skip]").count();
    const spires = await pg.locator("[data-outro]").getAttribute("data-spires").catch(() => "");
    const far = await pg.locator("[data-outro]").getAttribute("data-far").catch(() => "");
    const act = await pg.locator("[data-outro]").getAttribute("data-act").catch(() => "");
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${out}/ui-outro-surface-still.png` });
    await pg.locator("[data-action=outro-return]").click();
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 3000 }).catch(() => {});
    const back = (await pg.locator("[data-outro]").count()) === 0;
    await pg.close();
    if (!(debrief && skip === 0 && spires === "3" && far === "4" && act === "4" && back)) fails.push(`Surface Terraform, reduced motion: debrief ${debrief}, skip ${skip}, spires ${spires}, far ${far}, act ${act}, back ${back}`);
  }
  // Reduced motion, Orbital Claim: its still picture (the region claimed) and the Debrief at once.
  {
    const pg = await plainPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    await pg.goto(url);
    await briefAt(pg, "campaign");
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.locator("[data-action=outro-preview][data-outro-id=orbital]").click();
    const debrief = await pg.waitForSelector("[data-debrief='1']", { timeout: 3000 }).then(() => true, () => false);
    const skip = await pg.locator("[data-action=outro-skip]").count();
    const at = async (k) => (await pg.locator("[data-outro]").getAttribute(k).catch(() => null)) ?? "";
    const [act, locked, sats, secured] = [await at("data-act"), await at("data-locked"), await at("data-sats"), await at("data-secured")];
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${out}/ui-outro-orbital-still.png` });
    await pg.locator("[data-action=outro-return]").click();
    await pg.waitForSelector("[data-outro]", { state: "detached", timeout: 3000 }).catch(() => {});
    const back = (await pg.locator("[data-outro]").count()) === 0;
    await pg.close();
    if (!(debrief && skip === 0 && act === "4" && locked === "1" && sats === "12" && secured === "1" && back)) fails.push(`Orbital Claim, reduced motion: debrief ${debrief}, skip ${skip}, act ${act}, locked ${locked}, sats ${sats}, secured ${secured}, back ${back}`);
  }
  outroCheck = fails.length ? `failed (${fails.join(" | ")})` : "ok";
}
// The statistics page and the Campaign editor (designer 2026-11-18): scripts/ui-pages.mjs.
const pagesCheck = runs("pages") ? await runPagesCheck(browser, url, out) : "skipped (not asked for)";
// The mission celebrations (designer 2026-11-20): scripts/ui-celebrate.mjs.
const celebrateCheck = runs("celebrate") ? await runCelebrateCheck(browser, url, out) : "skipped (not asked for)";
// Big PC screen, Allied Drop, features (were "trial looks") (designer 2026-11-20): scripts/ui-looks.mjs.
const looksCheck = runs("looks") ? await runLooksCheck(browser, url, out) : "skipped (not asked for)";
const round23Check = runs("round23") ? await runRound23Check(browser, url, out) : "skipped (not asked for)";
const round24Check = runs("round24") ? await runRound24Check(browser, url, out) : "skipped (not asked for)";
const round25Check = runs("round25") ? await runRound25Check(browser, url, out) : "skipped (not asked for)";
const round26Check = runs("round26") ? await runRound26Check(browser, url, out) : "skipped (not asked for)";
const round29Check = runs("round29") ? await runRound29Check(browser, url, out) : "skipped (not asked for)";
const round30Check = runs("round30") ? await runRound30Check(browser, url, out) : "skipped (not asked for)";
const soundCheck = runs("sound") ? await runSoundCheck(browser, url, out) : "skipped (not asked for)";
console.log(JSON.stringify({ introCheck, styleCheck, outroCheck, pagesCheck, celebrateCheck, looksCheck, round23Check, round24Check, round25Check, round26Check, round29Check, round30Check, soundCheck, phoneScrollWidth: scrollW, noMenu, popupTitle, closedByOutside, canModules, overhaulConfirm, afterReveal, rotateShown, facingKept, rowCheck, energyCheck, bubbles, raised, tapThrough, breathing, dragCheck, drag2Check, m03Check, bay3Check, stackCheck, damagePickCheck, bayDragCheck, takeCheck, anomalyCheck, moduleCheck, m01Check, nodeCheck, fillCheck, greyCheck, modDragCheck, orderDragCheck, flareChipCheck, fxCheck, damageCheck, pickCheck, repairCheck, upgradeCheck, motionCheck, askCheck, restCheck }));
console.log(JSON.stringify({ errors }));
await browser.close();
// A group not asked for passes; its checks keep their "skipped" value in the report above.
const game = runs("game");
const gameChecks = [rowCheck, energyCheck, dragCheck, drag2Check, m03Check, bay3Check, stackCheck, damagePickCheck, bayDragCheck, takeCheck, anomalyCheck, moduleCheck, m01Check, nodeCheck, fillCheck, greyCheck, modDragCheck, orderDragCheck, flareChipCheck, fxCheck, damageCheck, pickCheck, repairCheck, upgradeCheck, motionCheck, askCheck, restCheck];
const gameOk = !game || (gameChecks.every((x) => x === "ok") && noMenu && rotateShown && !!facingKept && closedByOutside && bubbles && raised && breathing && (tapThrough === "ok" || tapThrough === "only one Dark sector") && !!popupTitle?.startsWith("Dark sector") && scrollW <= 390);
const groupOk = [["intro", introCheck], ["intro", styleCheck], ["outro", outroCheck], ["pages", pagesCheck], ["celebrate", celebrateCheck], ["looks", looksCheck], ["round23", round23Check], ["round24", round24Check], ["round25", round25Check], ["round26", round26Check], ["round29", round29Check], ["round30", round30Check], ["sound", soundCheck]].every(([g, x]) => !runs(g) || x === "ok");
if (errors.length || !gameOk || !groupOk) process.exit(1);

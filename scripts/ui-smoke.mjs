// Browser smoke test of the web app (stage 8): start a campaign, play into Mission 1,
// take a few actions, screenshot. Usage: node scripts/ui-smoke.mjs [url] [outDir]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const url = process.argv[2] ?? "http://localhost:4173";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch();
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
/** The Threat screen of a Mission Preparation (7.2 step 3): add the given columns, confirm. */
async function threat(pg, cols = ["A"]) {
  await pg.waitForSelector("[data-threat-screen]");
  for (const c of cols) await pg.locator(`[data-col-btn=${c}]`).click();
  await pg.locator("[data-action=threat]").click();
  await pg.waitForSelector("[data-threat-screen]", { state: "detached" });
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

await page.goto(url);
await start(page);
await untilAction(page);
const noMenu = (await panel.locator(".choices button, .ask-choices button").count()) === 0;
await page.screenshot({ path: `${out}/ui-command.png` });
// The Allied Drop's Mecha is on the Field: nothing greyed out for want of a unit.
const greyAtStart = await page.locator(".no-units").count();
// A Dark sector opens a pop-up with Reveal; clicking outside closes it.
const dark = JSON.parse((await page.locator(".field").getAttribute("data-choosable")) ?? "[]");
await clickField(page, dark.length - 1);
const popupTitle = await page.locator(".popup-title").textContent();
// Bubbles (designer 2026-11-07): one standard width, the row centred on the sector clicked.
await page.waitForTimeout(700);
const target = dark[dark.length - 1];
const fieldBox = await page.locator(".field").boundingBox();
const bubbleBoxes = await page.locator(".popup .bubble").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, y: r.y, h: r.height }; }));
const rowLeft = Math.min(...bubbleBoxes.map((b) => b.x));
const rowRight = Math.max(...bubbleBoxes.map((b) => b.x + b.w));
const bubbles = bubbleBoxes.length > 0 && bubbleBoxes.every((b) => Math.abs(b.w - bubbleBoxes[0].w) < 1) && Math.abs((rowLeft + rowRight) / 2 - (fieldBox.x + target.x)) < 12;
// Raised: centred on the top point of the tile (designer 2026-11-08).
const tileH = Number(await page.locator(".field").getAttribute("data-tile"));
const popBox = await page.locator(".popup").boundingBox();
// Centred on the pointy top end of the hexagon (designer 2026-11-08).
const raised = Math.abs(popBox.y + popBox.height / 2 - (fieldBox.y + target.y - tileH / 2)) < 12 || popBox.y <= 9;
// One tap on another Dark sector closes this pop-up and opens that one (designer 2026-11-08).
let tapThrough = "only one Dark sector";
if (dark.length > 1) {
  const other = dark[0];
  await page.mouse.click(fieldBox.x + other.x, fieldBox.y + other.y);
  await page.waitForTimeout(400);
  const t = await page.locator(".popup-title").allTextContents();
  tapThrough = t.length === 1 && t[0].includes(`(${other.k})`) ? "ok" : `titles after tap: ${JSON.stringify(t)}`;
}
await page.mouse.click(5, 300);
await page.waitForTimeout(350);
const closedByOutside = (await page.locator(".popup").count()) === 0;
// Ready things breathe instead of a thick border.
const breathing = await page.evaluate(() => [...document.querySelectorAll(".can")].every((e) => getComputedStyle(e).animationName === "can-breathe"));
await clickField(page, dark.length - 1);
await page.screenshot({ path: `${out}/ui-popup.png` });
await page.waitForTimeout(700);
await page.locator(".popup").getByRole("menuitem", { name: "Reveal" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/ui-after-reveal.png` });
// Run a Module by clicking it, if one can run (it may then ask for targets).
const afterReveal = await promptOf(page);
const canModules = await page.locator(".module.can").count();
// Overhaul asks to confirm while the Flagship is not Crippled.
let overhaulConfirm = false;
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
let rotateShown = false;
let facingKept = "";
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
// Rows (designer 2026-11-09): press a row's bubble to select it, press it again to confirm.
let rowCheck = "skipped (no row save)";
const rowSave = `${out}/row-save.json`;
const { existsSync, readFileSync } = await import("node:fs");
if (existsSync(rowSave)) {
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
if (existsSync(energySave)) {
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
if (existsSync(`${out}/drag-save.json`)) {
  const plan = JSON.parse(readFileSync(`${out}/drag-save.json.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/drag-save.json`);
  const prompt = async () => promptOf(pg);
  const before = await prompt();
  const from = await sectorPoint(pg, plan.from);
  const box = await pg.locator(".field").boundingBox();
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
  dragCheck = /cannot go there/.test(note) && stayed && moved ? "ok" : `failed (note "${note}", stayed ${stayed}, moved ${moved}, anim ${anim})`;
  await pg.close();
}
let drag2Check = "skipped (no M_03/M_06 save)";
if (existsSync(`${out}/drag2-save.json`)) {
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
if (existsSync(`${out}/m03-save.json`)) {
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
if (existsSync(`${out}/bay3-save.json`)) {
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
  const shown = await pg.locator(".look-card .look-tile").count();
  bay3Check = popped && fire && shown >= 1 && scan ? "ok" : `failed (pop-up ${popped}, fire ${fire}, tiles shown ${shown}, scan look ${scan})`;
  await pg.screenshot({ path: `${out}/ui-bay3.png` });
  await pg.close();
  // Drag a Bay with a target onto it (a fresh copy of the same save).
  const pg2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg2.on("pageerror", (e) => errors.push(e.message));
  await bayDrag(pg2);
  await pg2.close();
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
if (existsSync(`${out}/take-save.json`)) {
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
if (existsSync(`${out}/anomaly-save.json`)) {
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
if (existsSync(`${out}/overclock-save.json`)) {
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
if (existsSync(`${out}/m01-save.json`)) {
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
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
mobile.on("pageerror", (e) => errors.push(e.message));
await mobile.goto(url);
await start(mobile);
await mobile.waitForTimeout(400);
const scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
await mobile.evaluate(() => window.scrollTo(0, 0));
await mobile.screenshot({ path: `${out}/ui-phone.png` });
// Trial rule (designer 2026-11-08): a Power Node's Alert: two pop-ups on it, energy glyphs or 3 Heat.
let nodeCheck = "skipped (no save)";
if (existsSync(`${out}/node-save.json`)) {
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
if (existsSync(`${out}/fill-save.json`)) {
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
if (existsSync(`${out}/nounits-save.json`)) {
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
  if (!existsSync(file)) return "skipped (no save)";
  const plan = JSON.parse(readFileSync(`${file}.plan.json`, "utf8"));
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, file);
  const before = await logText(pg);
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
if (existsSync(`${out}/flarechip-save.json`)) {
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
if (existsSync(`${out}/reveal-Omega-save.json`) && existsSync(`${out}/area-save.json`)) {
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
  for (let i = 0; i < 40; i++) {
    bombs = Math.max(bombs, await pg.locator("svg.look-bomb").count());
    await pg.waitForTimeout(25);
  }
  fxCheck = flash && bombs >= 2 ? "ok" : `failed (Omega flash ${flash}, bombs at once ${bombs})`;
  await pg.close();
}
// Build step 5: a Reveal that starts an Overload plays its ripple; the Menu's animation settings
// (Instant: nothing plays; Reduced motion On: the page goes still) are kept in this browser.
let motionCheck = "skipped (no save)";
if (existsSync(`${out}/overloadstart-save.json`)) {
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
if (existsSync(`${out}/flagship-save.json`)) {
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
if (existsSync(`${out}/pickmany-save.json`)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pasteSave(pg, `${out}/pickmany-save.json`);
  await pg.locator(".unit-pick").first().waitFor({ timeout: 4000 }).catch(() => {});
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
// Removing Flagship damage (designer 2026-11-09): green bubbles by the Bays, no card; and the FPS counter.
let repairCheck = "skipped (no save)";
if (existsSync(`${out}/repair-save.json`)) {
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
if (existsSync(`${out}/upgrade-save.json`)) {
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
if (existsSync(`${out}/crippled-save.json`)) {
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
// Command briefing (2026-11-13): the long intro on a first visit, two taps skip it; then the short one.
let introCheck = "ok";
{
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
  const launched = (await pg.locator(".game").count()) === 1 && (await promptOf(pg)) === "Draw a Module: keep one.";
  await pg.close();
  if (!(armed === 1 && lapsed && skipped && noScroll && short && gone && launched)) introCheck = `failed (hint ${armed}, lapsed ${lapsed}, skipped ${skipped}, fits ${noScroll}, short intro ${short}, ends ${gone}, launched ${launched})`;
}
{
  // The long intro, looked at: frames for the designer, and it ends by itself on the Campaign step.
  const pg = await plainPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await pg.waitForSelector(".bf-intro[data-intro=full]");
  for (const [i, wait] of [[1, 1200], [2, 2300], [3, 2500], [4, 2300], [5, 1200]]) {
    await pg.waitForTimeout(wait);
    await pg.screenshot({ path: `${out}/ui-intro-${i}.png` });
  }
  const ended = await pg.waitForSelector(".bf-intro", { state: "detached", timeout: 4000 }).then(() => true, () => false);
  await pg.close();
  if (!ended && introCheck === "ok") introCheck = "failed (the long intro did not end)";
}
for (const [name, width, height] of [["", 1400, 900], ["-phone", 390, 800]]) {
  const pg = await browser.newPage({ viewport: { width, height } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await briefAt(pg, "campaign");
  // The unit roster: Omega units in their own place, a filter per type, a card per unit.
  const vip = await pg.locator("[data-vip=omega] [data-unit]").count();
  await pg.screenshot({ path: `${out}/ui-brief-campaign${name}.png`, fullPage: false });
  await pg.locator("[data-filter=Sleeper]").click();
  const sleepers = await pg.locator("[data-roster] .grid [data-unit]").evaluateAll((els) => els.every((e) => e.dataset.unit.startsWith("P_")) && els.length > 0);
  await pg.locator("[data-roster] .grid [data-unit]").first().click();
  const card = await pg.locator("[data-unit-card] .bf-line").count();
  await pg.screenshot({ path: `${out}/ui-brief-unit${name}.png` });
  await pg.keyboard.press("Escape");
  const closed = (await pg.locator("[data-unit-card]").count()) === 0;
  const t0 = Date.now();
  await pg.locator("[data-action=campaign]").click();
  await briefAt(pg, "vessel");
  const confirmMs = Date.now() - t0;
  await pg.locator("[data-company=V2]").click();
  await pg.waitForTimeout(350);
  await pg.screenshot({ path: `${out}/ui-brief-vessel${name}.png` });
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
  await pg.waitForTimeout(300);
  // The loadout reached the game: V2, and Mission 1 plays the three columns chosen.
  await toggleLog(pg);
  const log = await pg.locator(".log").innerText().catch(() => "");
  await pg.close();
  const ok = vip === 3 && sleepers && card > 0 && closed && confirmMs < 1200 && mechaCard > 0 && plugged === 1 && locked && tiles === 4 && level === "3" && threatCard === 1 && fits && /Kew'n X2/.test(log) && /Threat Level Siege: columns A, B, C/.test(log);
  if (!ok && introCheck === "ok") introCheck = `failed at ${width} px (omega ${vip}, filter ${sleepers}, card ${card}, closed ${closed}, confirm ${confirmMs} ms, mecha card ${mechaCard}, chip ${plugged}, confirm locked ${locked}, tiles ${tiles}, level ${level}, threat card ${threatCard}, fits ${fits}, company ${/Kew'n X2/.test(log)}, threat ${/Threat Level Siege/.test(log)})`;
}
console.log(JSON.stringify({ introCheck, phoneScrollWidth: scrollW, noMenu, popupTitle, closedByOutside, canModules, overhaulConfirm, afterReveal, rotateShown, facingKept, rowCheck, energyCheck, bubbles, raised, tapThrough, breathing, dragCheck, drag2Check, m03Check, bay3Check, bayDragCheck, takeCheck, anomalyCheck, moduleCheck, m01Check, nodeCheck, fillCheck, greyCheck, modDragCheck, orderDragCheck, flareChipCheck, fxCheck, damageCheck, pickCheck, repairCheck, upgradeCheck, motionCheck, askCheck }));
console.log(JSON.stringify({ errors }));
await browser.close();
if (errors.length || rowCheck !== "ok" || energyCheck !== "ok" || !noMenu || !rotateShown || !facingKept || !closedByOutside || !bubbles || dragCheck !== "ok" || drag2Check !== "ok" || m03Check !== "ok" || [bay3Check, bayDragCheck, takeCheck, anomalyCheck, moduleCheck, m01Check, nodeCheck, fillCheck, greyCheck, modDragCheck, orderDragCheck, flareChipCheck, fxCheck, damageCheck, pickCheck, repairCheck, upgradeCheck, motionCheck, askCheck, introCheck].some((x) => x !== "ok") || !raised || !breathing || (tapThrough !== "ok" && tapThrough !== "only one Dark sector") || !popupTitle?.startsWith("Dark sector") || scrollW > 390) process.exit(1);

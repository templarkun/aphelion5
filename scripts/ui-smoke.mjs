// Browser smoke test of the web app (stage 8): start a campaign, play into Mission 1,
// take a few actions, screenshot. Usage: node scripts/ui-smoke.mjs [url] [outDir]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const url = process.argv[2] ?? "http://localhost:4173";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
// Questions sit inside the Field (designer 2026-11-08): a banner, or a card; the action menu shows none.
const Q = ".q-card, .q-banner";
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

/** Setup: Campaign 1, Company V1, no expansion module, Threat column A. */
async function setup(pg) {
  await clickIn(pg, /^Campaign 1/);
  await clickIn(pg, /^V1/);
  await clickIn(pg, /^Confirm/); // expansion modules: none selected
  await clickIn(pg, /^A:/);
  await clickIn(pg, /^Confirm/);
}

/** Answer whatever else comes (Module, Ally, Allied Drop) until it is the player's action. */
async function untilAction(pg) {
  const q = pg.locator(Q);
  for (let i = 0; i < 30; i++) {
    const prompt = await promptOf(pg);
    if (/^Choose an action/.test(prompt)) return prompt;
    const buttons = q.locator(".choices button");
    if (await buttons.count()) {
      await buttons.first().click();
      continue;
    }
    if (await pg.locator(".module.can, .bay-btn.can").count()) {
      await pg.locator(".module.can, .bay-btn.can").first().click();
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
await page.getByRole("button", { name: "Start" }).click();
await setup(page);
await untilAction(page);
const noMenu = (await panel.locator(".choices button").count()) === 0;
await page.screenshot({ path: `${out}/ui-command.png` });
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
  await page.locator(".overhaul button").click();
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
  await pg.locator("input[placeholder=random]").fill(String(seed));
  await pg.getByRole("button", { name: "Start" }).click();
  await setup(pg);
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
// Rows (designer 2026-11-07): click a row on the Field, confirm in the pop-up.
let rowCheck = "skipped (no row save)";
const rowSave = `${out}/row-save.json`;
const { existsSync, readFileSync } = await import("node:fs");
if (existsSync(rowSave)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(rowSave, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForTimeout(400);
  const q = pg.locator(Q);
  const listed = await q.locator(".choices button").count();
  const before = await promptOf(pg);
  await clickField(pg, 0);
  const commit = pg.locator(".popup [role=menuitem]", { hasText: "Choose this row" });
  const popupOk = (await commit.count()) === 1;
  await pg.screenshot({ path: `${out}/ui-row.png` });
  if (popupOk) await commit.click();
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
  else rowCheck = listed === 0 && popupOk && after !== before ? "ok" : `failed (list ${listed}, pop-up ${popupOk}, prompt still "${before}")`;
  await pg.close();
}
// Energy pop-ups (designer 2026-11-07): one beside each Module that can take the energy; a tap places one.
let energyCheck = "skipped (no energy save)";
const energySave = `${out}/energy-save.json`;
if (existsSync(energySave)) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(url);
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
  const blue = plan.targets.find((t) => t.next && t.next.length);
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
await mobile.getByRole("button", { name: "Start" }).click();
await setup(mobile);
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
console.log(JSON.stringify({ phoneScrollWidth: scrollW, noMenu, popupTitle, closedByOutside, canModules, overhaulConfirm, afterReveal, rotateShown, facingKept, rowCheck, energyCheck, bubbles, raised, tapThrough, breathing, dragCheck, drag2Check, m03Check, bay3Check, bayDragCheck, takeCheck, anomalyCheck, moduleCheck, m01Check, nodeCheck, fillCheck }));
console.log(JSON.stringify({ errors }));
await browser.close();
if (errors.length || rowCheck !== "ok" || energyCheck !== "ok" || !noMenu || !rotateShown || !facingKept || !closedByOutside || !bubbles || dragCheck !== "ok" || drag2Check !== "ok" || m03Check !== "ok" || [bay3Check, bayDragCheck, takeCheck, anomalyCheck, moduleCheck, m01Check, nodeCheck, fillCheck].some((x) => x !== "ok") || !raised || !breathing || (tapThrough !== "ok" && tapThrough !== "only one Dark sector") || !popupTitle?.startsWith("Dark sector") || scrollW > 390) process.exit(1);

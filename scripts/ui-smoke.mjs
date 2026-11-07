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
const panel = page.locator(".question");
const clickIn = async (pg, name) => pg.locator(".question").getByRole("button", { name }).first().click();

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
  const q = pg.locator(".question");
  for (let i = 0; i < 30; i++) {
    const prompt = (await q.locator(".prompt").last().textContent()) ?? "";
    if (/^Your action/.test(prompt)) return prompt;
    const buttons = q.locator(".choices button");
    if (await buttons.count()) {
      await buttons.first().click();
      continue;
    }
    if (await pg.locator(".module.can, .bay.can").count()) {
      await pg.locator(".module.can, .bay.can").first().click();
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
await page.mouse.click(5, 300);
await page.waitForTimeout(100);
const closedByOutside = (await page.locator(".popup").count()) === 0;
await clickField(page, dark.length - 1);
await page.screenshot({ path: `${out}/ui-popup.png` });
await page.locator(".popup").getByRole("menuitem", { name: "Reveal" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/ui-after-reveal.png` });
// Run a Module by clicking it, if one can run (it may then ask for targets).
const afterReveal = (await panel.locator(".prompt").last().textContent()) ?? "";
const canModules = await page.locator(".module.can").count();
// Overhaul asks to confirm while the Flagship is not Crippled.
let overhaulConfirm = false;
if (/^Your action/.test(afterReveal)) {
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
    if (!/^Your action/.test((await pg.locator(".question .prompt").last().textContent()) ?? "")) break;
    await revealSomething(pg);
    await pg.waitForTimeout(200);
    const rot = JSON.parse((await pg.locator(".field").getAttribute("data-rotate")) ?? "[]");
    if (!rot.length) continue;
    rotateShown = true;
    const box = await pg.locator(".field").boundingBox();
    await pg.mouse.click(box.x + rot[1].x, box.y + rot[1].y); // turn clockwise once
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: `${out}/ui-facing.png` });
    if (await pg.getByRole("button", { name: "Done" }).count()) await pg.getByRole("button", { name: "Done" }).click();
    else await revealSomething(pg); // the next action keeps the facing
    await pg.waitForTimeout(200);
    await pg.getByRole("button", { name: "Log", exact: true }).click();
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
  const q = pg.locator(".question");
  const listed = await q.locator(".choices button").count();
  const before = (await q.locator(".prompt").last().textContent()) ?? "";
  await clickField(pg, 0);
  const commit = pg.locator(".popup [role=menuitem]", { hasText: "Choose this row" });
  const popupOk = (await commit.count()) === 1;
  await pg.screenshot({ path: `${out}/ui-row.png` });
  if (popupOk) await commit.click();
  await pg.waitForTimeout(300);
  const after = (await q.locator(".prompt").last().textContent()) ?? "";
  // A long list of choices (like the Upgrade list) must not slide under the Field (play-test 2026-11-07).
  await pg.evaluate(() => {
    const c = document.querySelector(".question");
    for (let i = 0; i < 22; i++) { const b = document.createElement("button"); b.className = "probe"; b.textContent = "A long choice like an Upgrade: Improves M_03's Passive: it may move through any number of adjacent Dark sectors before an Attack."; c.appendChild(b); }
  });
  await pg.waitForTimeout(200);
  const covered = await pg.evaluate(() => [...document.querySelectorAll(".probe")].filter((e) => { const r = e.getBoundingClientRect(); const p = document.querySelector(".question").getBoundingClientRect(); if (r.top < p.top || r.bottom > p.bottom) return false; return document.elementFromPoint(r.x + 10, r.y + r.height / 2) !== e; }).length);
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
  const targets = await pg.locator(".module.energy-target").count();
  const before = (await pg.locator(".question .prompt").last().textContent()) ?? "";
  await pg.screenshot({ path: `${out}/ui-energy.png` });
  const box = await pg.locator(".energy-pop").first().boundingBox();
  const mod = await pg.locator(".module.energy-target").first().boundingBox();
  const leftOf = box && mod ? box.x + box.width <= mod.x + 2 : false;
  if (pops) await pg.locator(".energy-pop").first().click();
  await pg.waitForTimeout(400);
  const after = (await pg.locator(".question .prompt").last().textContent()) ?? "";
  energyCheck = pops >= 2 && pops === targets && leftOf && after !== before ? "ok" : `failed (pop-ups ${pops}, targets ${targets}, left of Module ${leftOf}, prompt still "${before}")`;
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
console.log(JSON.stringify({ phoneScrollWidth: scrollW, noMenu, popupTitle, closedByOutside, canModules, overhaulConfirm, afterReveal, rotateShown, facingKept, rowCheck, energyCheck }));
console.log(JSON.stringify({ errors }));
await browser.close();
if (errors.length || rowCheck !== "ok" || energyCheck !== "ok" || !noMenu || !rotateShown || !facingKept || !closedByOutside || !popupTitle?.startsWith("Dark sector") || scrollW > 390) process.exit(1);

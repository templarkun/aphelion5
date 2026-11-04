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
    const prompt = (await q.locator(".prompt").textContent()) ?? "";
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
const afterReveal = (await panel.locator(".prompt").textContent()) ?? "";
const canModules = await page.locator(".module.can").count();
// Overhaul asks to confirm while the Flagship is not Crippled.
let overhaulConfirm = false;
if (/^Your action/.test(afterReveal)) {
  await page.locator(".overhaul button").click();
  overhaulConfirm = (await page.getByRole("dialog", { name: "Overhaul now?" }).count()) === 1;
  await page.getByRole("button", { name: "Cancel" }).click();
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
console.log(JSON.stringify({ phoneScrollWidth: scrollW, noMenu, popupTitle, closedByOutside, canModules, overhaulConfirm, afterReveal }));
console.log(JSON.stringify({ errors }));
await browser.close();
if (errors.length || !noMenu || !closedByOutside || !popupTitle?.startsWith("Dark sector") || scrollW > 390) process.exit(1);

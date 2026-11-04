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
await page.goto(url);
await page.getByRole("button", { name: "Start" }).click();
const panel = page.locator(".question");
const clickIn = async (name) => panel.getByRole("button", { name }).first().click();
// Setup: Company V1, no Heat.
await clickIn(/^V1/);
await clickIn("No");
// Mission Preparation: Threat column A, confirm.
await clickIn(/^A:/);
await clickIn(/^Confirm/);
// Answer whatever else comes (extra sectors, Module, Allied Drop) with the first choices until the Command phase.
for (let i = 0; i < 20; i++) {
  const prompt = (await panel.locator(".prompt").textContent()) ?? "";
  if (/Choose an action/.test(prompt)) break;
  const confirm = panel.getByRole("button", { name: /^Confirm/ });
  const buttons = panel.locator(".choices button");
  if (await confirm.count()) {
    const n = await buttons.count();
    const need = Number(/Choose (\d+)/.exec((await panel.textContent()) ?? "")?.[1] ?? 1);
    for (let k = 0; k < Math.min(need, n); k++) await buttons.nth(k).click();
    await confirm.click();
  } else await buttons.first().click();
}
await page.screenshot({ path: `${out}/ui-command.png` });
// Reveal a sector by clicking on the Field.
await clickIn("Reveal");
await page.waitForTimeout(200);
const box = await page.locator(".field canvas").boundingBox();
await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.2); // an upper-left Dark sector
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/ui-after-reveal.png` });
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
await mobile.goto(url);
await mobile.getByRole("button", { name: "Start" }).click();
const mp = mobile.locator(".question");
await mp.getByRole("button", { name: /^V1/ }).first().click();
await mp.getByRole("button", { name: "No" }).first().click();
await mp.getByRole("button", { name: /^A:/ }).first().click();
await mp.getByRole("button", { name: /^Confirm/ }).click();
await mobile.waitForTimeout(400);
const scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
await mobile.evaluate(() => window.scrollTo(0, 0));
await mobile.screenshot({ path: `${out}/ui-phone.png` });
console.log(JSON.stringify({ phoneScrollWidth: scrollW }));
console.log(JSON.stringify({ errors, prompt: await panel.locator(".prompt").textContent() }));
await browser.close();

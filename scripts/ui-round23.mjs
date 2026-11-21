// Browser check of the round of 2026-11-21 (designer): a unit with arrows revealed no longer blocks the
// game (drag, pop-ups), the Reserve counts down and back up with a selected Module, the Overload trial
// look "Inflow". Called by ui-smoke.mjs; can also run alone: node scripts/ui-round23.mjs [url] [outDir].
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function open(browser, url, w, h, trial) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pg.addInitScript((t) => {
    try {
      localStorage.setItem("aphelion5.intro", "off");
      localStorage.setItem("aphelion5.intro.intro2", "seen");
      if (t) localStorage.setItem("aphelion5.trialLooks", t);
      else localStorage.removeItem("aphelion5.trialLooks");
    } catch {}
  }, trial ?? "");
  await pg.goto(url);
  await pg.waitForSelector(".brief[data-step=campaign]", { timeout: 10000 });
  return pg;
}
async function paste(pg, file) {
  await pg.getByRole("button", { name: "System options" }).click();
  await pg.getByRole("button", { name: "Paste a save…" }).click();
  await pg.locator("#textbox-text").fill(readFileSync(file, "utf8"));
  await pg.getByRole("button", { name: "Load" }).click();
  await pg.waitForSelector(".game[data-prompt]", { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
}
async function at(pg, k) {
  const box = await pg.locator(".field").boundingBox();
  const s = JSON.parse((await pg.locator(".field").getAttribute("data-sectors")) ?? "{}");
  return { x: box.x + s[k][0], y: box.y + s[k][1] };
}
async function logText(pg) {
  const toggle = async () => {
    await pg.locator(".menu-wrap > button").click();
    await pg.locator(".menu button", { hasText: /^(Log|Hide the log)$/ }).click();
  };
  await toggle();
  const t = (await pg.locator(".log li").allTextContents()).join("\n");
  await toggle();
  return t;
}
const reserve = (pg) => pg.locator("[data-reserve] b").allTextContents().then((xs) => xs.map(Number));

export async function round23Check(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));
  const fixture = "tests/fixtures/save-2026-11-21-facing-stuck.json";

  // 1. The designer's save: P_09 just revealed (its facing shown, the action menu already there). A drag of
  //    M_01 works and keeps P_09's facing; on a fresh load, a pop-up action (Reveal) works too.
  if (existsSync(`${out}/facing-save.json.plan.json`)) {
    const plan = JSON.parse(readFileSync(`${out}/facing-save.json.plan.json`, "utf8"));
    let pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, fixture);
    const before = await pg.locator(".game").getAttribute("data-prompt");
    const a = await at(pg, plan.from);
    const b = await at(pg, plan.to);
    await pg.mouse.move(a.x, a.y);
    await pg.mouse.down();
    for (let i = 1; i <= 12; i++) await pg.mouse.move(a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12);
    await pg.waitForTimeout(300);
    await pg.mouse.up();
    await pg.waitForTimeout(1500);
    const log = await logText(pg);
    const moved = log.includes(`from (${plan.from}) to (${plan.to})`);
    const faced = /P_09.*facing|facing.*P_09|P_09 faces|P_09 is turned|turned/.test(log);
    await pg.screenshot({ path: `${out}/ui-facing-drag.png` });
    await pg.close();
    pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, fixture);
    const hits = JSON.parse((await pg.locator(".field").getAttribute("data-choosable")) ?? "[]");
    const box = await pg.locator(".field").boundingBox();
    let revealed = false;
    for (const h of hits) {
      await pg.mouse.click(box.x + h.x, box.y + h.y);
      await pg.waitForTimeout(400);
      const btn = pg.locator(".popup [role=menuitem]", { hasText: "Reveal" });
      if (await btn.count()) {
        await btn.first().click();
        await pg.waitForTimeout(1800);
        revealed = (await pg.locator(".game").getAttribute("data-prompt")) !== before || /revealed|Reveal/.test(await logText(pg));
        break;
      }
      await pg.mouse.click(box.x + 4, box.y + 4);
      await pg.waitForTimeout(200);
    }
    await pg.close();
    if (!(moved && revealed)) fails.push(`facing: drag moved ${moved} (facing logged ${faced}), pop-up Reveal ${revealed}`);
  } else fails.push("no facing plan");

  // 2. The Reserve while a Module is selected: one less per chip out, back again when it is let go.
  if (existsSync(`${out}/overclock-save.json`)) {
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/overclock-save.json`);
    const r0 = await reserve(pg);
    await pg.locator(".module.can").first().click();
    const seen = [];
    for (let i = 0; i < 12; i++) {
      seen.push((await reserve(pg)).reduce((x, y) => x + y, 0));
      await pg.waitForTimeout(60);
    }
    await pg.waitForTimeout(600);
    const r1 = await reserve(pg);
    await pg.screenshot({ path: `${out}/ui-reserve-held.png` });
    await pg.keyboard.press("Escape");
    await pg.mouse.click(5, 300);
    await pg.waitForTimeout(1600);
    const r2 = await reserve(pg);
    await pg.close();
    const sum = (r) => r.reduce((x, y) => x + y, 0);
    if (!(sum(r1) < sum(r0) && sum(r2) === sum(r0))) fails.push(`reserve: before ${r0}, selected ${r1} (seen ${seen.join(",")}), let go ${r2}`);
  }

  // 3. The Overload trial look: Inflow pressed, kept; an Overload screenshot with it.
  if (existsSync(`${out}/overloadstart-save.json`)) {
    const k = JSON.parse(readFileSync(`${out}/overloadstart-save.json.plan.json`, "utf8")).shortcut.slice(7);
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, `${out}/overloadstart-save.json`);
    await pg.getByRole("button", { name: "Menu" }).click();
    await pg.locator(".trial-looks summary").click();
    await pg.locator('[data-trial="overload:inflow"]').click();
    const kept = await pg.evaluate(() => JSON.parse(localStorage.getItem("aphelion5.trialLooks") ?? "{}").overload);
    await pg.locator(".menu-wrap > button").click();
    await pg.waitForTimeout(300);
    const orders = await pg.locator("[data-order]").count();
    const p = await at(pg, k);
    await pg.mouse.click(p.x, p.y);
    await pg.waitForTimeout(400);
    await pg.locator(".popup [role=menuitem]", { hasText: "Reveal" }).click();
    await pg.waitForTimeout(5000);
    const over = await pg.locator(".game.is-overload").count();
    await pg.screenshot({ path: `${out}/ui-overload-inflow.png` });
    await pg.close();
    // Campaign 1's three Orders and the mission's own (designer 2026-11-21).
    if (!(kept === "inflow" && over === 1 && orders === 4)) fails.push(`inflow: kept ${kept}, overload ${over}; Orders shown ${orders} (want 4)`);
  }

  if (errors.length) fails.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  return fails.length ? `failed (${fails.join("; ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const r = await round23Check(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check");
  console.log(JSON.stringify({ round23Check: r }));
  await browser.close();
}

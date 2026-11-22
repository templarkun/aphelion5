// Browser check of round 24 (designer 2026-11-21): the second hover bubble (tiles looked at in a sector),
// the "next tile" features, M_03 dropped on a unit it reaches by several equal ways (no question).
// Called by ui-smoke.mjs; can also run alone: node scripts/ui-round24.mjs [url] [outDir].
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function open(browser, url, w, h, trial) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pg.addInitScript((t) => {
    try {
      localStorage.setItem("aphelion5.intro", "off");
      localStorage.setItem("aphelion5.intro.intro2", "seen");
      if (t) localStorage.setItem("aphelion5.features", t);
      else localStorage.removeItem("aphelion5.features");
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

export async function round24Check(browser, url, out) {
  const fails = [];
  const errors = [];
  const watch = (pg) => pg.on("pageerror", (e) => errors.push(e.message));

  // 1. Hover a sector holding tiles looked at: the card text and, beside it, "Looked at in this sector".
  if (existsSync(`${out}/seen-save.json.plan.json`)) {
    const plan = JSON.parse(readFileSync(`${out}/seen-save.json.plan.json`, "utf8"));
    const want = plan.rows.filter((r) => r.unitId).length;
    for (const [w, h] of [
      [1400, 900],
      [390, 844],
    ]) {
      const pg = await open(browser, url, w, h);
      watch(pg);
      await paste(pg, `${out}/seen-save.json`);
      const p = await at(pg, plan.sector);
      await pg.mouse.move(p.x - 3, p.y);
      await pg.mouse.move(p.x, p.y);
      await pg.waitForSelector(".seen-bubble", { timeout: 3000 }).catch(() => {});
      const seen = Number((await pg.locator(".seen-bubble").getAttribute("data-seen", { timeout: 1000 }).catch(() => "0")) ?? 0);
      const rows = await pg.locator(".seen-bubble .seen-row").count();
      const side = await pg.locator(".info-pair.side").count();
      await pg.screenshot({ path: `${out}/ui-seen-${w}.png` });
      // Inside the window, both bubbles.
      const boxes = await pg.locator(".info-pair .info-bubble").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]));
      // Designer 2026-11-22: a Dark sector shows only the second bubble; every second bubble ends with "N tiles total".
      const inside = boxes.length === (plan.dark ? 1 : 2) && boxes.every(([l, r]) => l >= 0 && r <= w);
      // Round 28: one small row under the card text (never side by side); the total is a number with a hexagon.
      const total = await pg.locator(".seen-bubble .seen-total").getAttribute("data-seen-total").catch(() => "");
      const sideOk = side === 0;
      // Under the card text: the second bubble's top below the first's bottom.
      const under = boxes.length < 2 || (await pg.locator(".info-pair .info-bubble").evaluateAll((els) => els[1].getBoundingClientRect().top >= els[0].getBoundingClientRect().bottom - 1));
      if (!(seen === want && rows === plan.rows.length && sideOk && under && inside && total === String(plan.total))) fails.push(`seen at ${w} px: looked at ${seen}/${want}, rows ${rows}/${plan.rows.length}, side by side ${side}, under ${under}, inside ${inside}, dark ${plan.dark}, total "${total}"`);
      await pg.close();
    }
    // 2. The "next tile" features (round 25: Corner, Ghost, Chip): each draws the Field differently.
    const shots = {};
    for (const look of ["corner", "ghost", "chip", "behind"]) {
      const pg = await open(browser, url, 1400, 900, JSON.stringify({ next: look }));
      watch(pg);
      await paste(pg, `${out}/seen-save.json`);
      await pg.mouse.move(5, 5);
      await pg.waitForTimeout(500);
      shots[look] = (await pg.locator(".field canvas").screenshot({ path: `${out}/ui-next-${look}.png` })).toString("base64");
      await pg.close();
    }
    // Pressed in the Menu and kept.
    {
      const pg = await open(browser, url, 1400, 900);
      watch(pg);
      await paste(pg, `${out}/seen-save.json`);
      await pg.locator(".menu-wrap > button").click();
      await pg.locator(".features-menu summary").click();
      await pg.locator('[data-feature="next:chip"]').click();
      const kept = await pg.evaluate(() => localStorage.getItem("aphelion5.features"));
      if (!/"next":"chip"/.test(kept ?? "")) fails.push(`next look not kept: ${kept}`);
      await pg.close();
    }
    const differ = [...new Set(Object.values(shots))];
    if (differ.length < 4) fails.push(`next-tile looks drawn: ${differ.length} of 4 different`);
  } else fails.push("no seen save");

  // 3. The designer's save: M_03 dropped on O_01, reached by two equal ways: it Attacks, nothing asked.
  if (existsSync(`${out}/m03ways-save.json.plan.json`)) {
    const plan = JSON.parse(readFileSync(`${out}/m03ways-save.json.plan.json`, "utf8"));
    const pg = await open(browser, url, 1400, 900);
    watch(pg);
    await paste(pg, "tests/fixtures/save-2026-11-21-m03-ways.json");
    const before = await logText(pg);
    const a = await at(pg, plan.from);
    const b = await at(pg, plan.to);
    await pg.mouse.move(a.x, a.y);
    await pg.mouse.down();
    for (let i = 1; i <= 14; i++) await pg.mouse.move(a.x + ((b.x - a.x) * i) / 14, a.y + ((b.y - a.y) * i) / 14);
    await pg.waitForTimeout(300);
    await pg.mouse.up();
    await pg.waitForTimeout(3500);
    await pg.mouse.click(5, 5);
    await pg.waitForTimeout(800);
    const log = await logText(pg);
    const old = new Set(before.split("\n"));
    const fresh = log.split("\n").filter((l) => !old.has(l)).join("\n");
    const attacked = /M_03/.test(fresh) && /O_01/.test(fresh);
    await pg.screenshot({ path: `${out}/ui-m03-ways.png` });
    if (!attacked) fails.push(`M_03 drop on O_01: attacked ${attacked} (new log: ${fresh.slice(0, 200).replace(/\n/g, " | ")})`);
    await pg.close();
  } else fails.push("no M_03 plan");

  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ round24Check: await round24Check(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

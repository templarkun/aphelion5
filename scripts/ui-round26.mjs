// Browser check of round 26 (designer 2026-11-22): the Salvage milestones Grid Online (the fifth Power Node)
// and Sector Lock (the third Cleared sector, five Power Nodes taken), from their System options previews:
// each plays about 4.6 s as a Field step with "Tap twice to skip"; with the win, the win waits for it.
// The hover change is checked by ui-round24.mjs. Called by ui-smoke.mjs; alone: node scripts/ui-round26.mjs [url] [outDir].
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export async function round26Check(browser, url, out) {
  const fails = [];
  const errors = [];
  for (const [w, h, kind, piece] of [
    [1400, 900, "kill", "salvageNodes"],
    [390, 844, "kill", "salvageCleared"],
    [1400, 900, "both", "salvageCleared"],
  ]) {
    const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem("aphelion5.intro", "off"); } catch {} });
    await pg.goto(url);
    await pg.waitForSelector('.brief[data-step=campaign][data-busy="0"]', { timeout: 15000 });
    await pg.getByRole("button", { name: "System options" }).click();
    await pg.evaluate(() => {
      window.__r = [];
      const t0 = performance.now();
      let last = "";
      const tick = () => {
        const s = `${document.querySelector("[data-celebration]") ? "catch" : "-"} ${document.querySelector("[data-win][data-phase=play]") ? "win" : "-"}`;
        if (s !== last) window.__r.push([Math.round(performance.now() - t0), s]);
        last = s;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const win = kind === "both" ? "missionComplete" : "";
    await pg.locator(`[data-action=celebration-preview][data-kind=${kind}][data-omega=Salvage][data-piece="${piece}"][data-win-piece="${win}"]`).click();
    await pg.waitForTimeout(3000);
    await pg.screenshot({ path: `${out}/ui-${piece}-${w}.png` });
    await pg.waitForSelector("[data-celebration-preview]", { state: "detached", timeout: 20000 }).catch(() => {});
    const r = await pg.evaluate(() => window.__r);
    await pg.close();
    const on = r.find(([, s]) => s.startsWith("catch -"));
    const off = r.find(([t, s]) => on && t > on[0] && !s.startsWith("catch -"));
    const ms = on && off ? off[0] - on[0] : 0;
    const winAfter = kind !== "both" || r.some(([t, s]) => off && t >= off[0] && s.endsWith("win"));
    const winDuring = r.some(([t, s]) => on && off && t > on[0] && t < off[0] && s.endsWith("win"));
    if (!(ms > 3000 && winAfter && !winDuring)) fails.push(`${piece} ${kind} at ${w} px: played ${ms} ms, win after ${winAfter}, win during ${winDuring} (${JSON.stringify(r)})`);
  }
  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  return fails.length ? `failed (${fails.join(" | ")})` : "ok";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  console.log(JSON.stringify({ round26Check: await round26Check(browser, process.argv[2] ?? "http://localhost:4174", process.argv[3] ?? "dist/ui-check") }));
  await browser.close();
}

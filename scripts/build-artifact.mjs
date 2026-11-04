// Builds the web app as ONE html file for publishing as a claude.ai Artifact,
// so the designer can play in a browser without installing anything.
// `npm run build:artifact` writes dist-artifact/aphelion5.html.
import { build } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const out = await build({
  configFile: "vite.config.ts",
  logLevel: "warn",
  build: { write: false, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
const files = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
const js = files.filter((f) => f.type === "chunk").map((f) => f.code);
const css = files.filter((f) => f.type === "asset" && f.fileName.endsWith(".css")).map((f) => String(f.source));
if (js.length !== 1) throw new Error(`expected one script, got ${js.length}`);
const safe = (s, tag) => s.replaceAll(`</${tag}`, `<\\/${tag}`);
// The Artifact host adds doctype, head and body itself.
const html = `<title>Aphelion 5</title>
<style>${safe(css.join("\n"), "style")}</style>
<div id="root"></div>
<script type="module">${safe(js[0], "script")}</script>
`;
mkdirSync("dist-artifact", { recursive: true });
writeFileSync("dist-artifact/aphelion5.html", html);
console.log(`dist-artifact/aphelion5.html ${(html.length / 1024).toFixed(0)} kB`);

/** Tailwind for the command briefing only. No preflight: the game's own styles stay as they are. */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;
export default {
  content: ["./src/web/briefing/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // The accent follows the CSS variable --acc (the style's accent; amber, orange, crimson as Threat rises).
        acc: "rgb(var(--acc) / <alpha-value>)",
        amberhud: "rgb(251 191 36 / <alpha-value>)",
        metal: { 950: "#06080b", 900: "#0a0d11", 800: "#10141a", 700: "#171c24", 600: "#212833", 500: "#2e3744" },
        // The briefing's two colour families come from the chosen style (styles/<id>/style.css):
        // "sky" = soft text and small highlights, "indigo" = the deep shade of bars and veils.
        sky: { 50: v("--bf-sky-50"), 100: v("--bf-sky-100"), 200: v("--bf-sky-200"), 300: v("--bf-sky-300") },
        indigo: { 800: v("--bf-indigo-800"), 900: v("--bf-indigo-900"), 950: v("--bf-indigo-950") },
      },
      fontFamily: {
        hud: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

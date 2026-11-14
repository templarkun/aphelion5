/** Tailwind for the command briefing only. No preflight: the game's own styles stay as they are. */
export default {
  content: ["./src/web/briefing/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // The accent follows the CSS variable --acc (sky blue; amber, orange, crimson as Threat rises).
        acc: "rgb(var(--acc) / <alpha-value>)",
        amberhud: "rgb(251 191 36 / <alpha-value>)",
        metal: { 950: "#06080b", 900: "#0a0d11", 800: "#10141a", 700: "#171c24", 600: "#212833", 500: "#2e3744" },
      },
      fontFamily: {
        hud: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

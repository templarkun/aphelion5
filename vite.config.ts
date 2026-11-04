import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web app (stage 8). `npm run dev` serves it; `npm run build` writes dist/.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", chunkSizeWarningLimit: 2000 },
});

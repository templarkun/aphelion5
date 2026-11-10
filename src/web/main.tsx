import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import { loadGlyphs } from "./glyphs.js";

// The art pictures are inside the page; load them before the first drawing.
void loadGlyphs().then(() =>
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
  ),
);

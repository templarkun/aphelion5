import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import "./briefing/briefing.css"; // after styles.css: the briefing resets the game's button look
import "./briefing/styles/intro1/style.css"; // the colours of each style, after the shared sheet
import "./briefing/styles/intro2/style.css";
import "./outro/outro.css"; // the outros and the Campaign Debrief (after the styles: it uses their --bf-* shapes)
import { loadGlyphs } from "./glyphs.js";

// The art pictures are inside the page; load them before the first drawing.
void loadGlyphs().then(() =>
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
  ),
);

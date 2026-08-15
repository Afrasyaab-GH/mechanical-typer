import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

/**
 * The machine needs its Courier Prime faces before any keycap, slug or
 * paper texture is drawn, so we wait briefly for the fonts first.
 */
function waitForFonts(timeoutMs = 1800): Promise<void> {
  return Promise.race([
    Promise.all([
      document.fonts.load('16px "Courier Prime"'),
      document.fonts.load('700 16px "Courier Prime"'),
    ]).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]).then(() => undefined);
}

void waitForFonts().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

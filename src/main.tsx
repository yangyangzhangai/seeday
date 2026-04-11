import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/material-symbols-outlined/400.css";
import "./i18n"; // ← init i18n before anything else
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/feedback/ErrorBoundary.tsx";
import { setupMobileAuthBridge } from "./lib/mobileAuthBridge";
import { setupKeyboardViewportFix } from "./services/native/keyboardService";

if (typeof document !== "undefined") {
  const root = document.documentElement;
  const markMaterialReady = () => root.classList.add("material-symbols-ready");

  if ("fonts" in document) {
    void document.fonts
      .load('24px "Material Symbols Outlined"')
      .then(markMaterialReady)
      .catch(() => {});
  } else {
    markMaterialReady();
  }
}

void setupMobileAuthBridge();
void setupKeyboardViewportFix();

import { preloadSounds } from './services/sound/soundService';
preloadSounds();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

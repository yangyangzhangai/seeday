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
import { getAppRuntimeContext, logDiagnostic } from "./lib/diagnostics";
import { setupKeyboardViewportFix } from "./services/native/keyboardService";

logDiagnostic('info', 'boot.main.loaded', {
  context: getAppRuntimeContext(),
});

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    logDiagnostic('error', 'boot.window.error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      context: getAppRuntimeContext(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logDiagnostic('error', 'boot.window.unhandled_rejection', {
      reason: event.reason,
      context: getAppRuntimeContext(),
    });
  });
}

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

void setupMobileAuthBridge()
  .then(() => logDiagnostic('info', 'boot.mobile_auth_bridge.ready'))
  .catch((error) => logDiagnostic('error', 'boot.mobile_auth_bridge.failed', { error }));
void setupKeyboardViewportFix()
  .then(() => logDiagnostic('info', 'boot.keyboard_viewport.ready'))
  .catch((error) => logDiagnostic('error', 'boot.keyboard_viewport.failed', { error }));

if (typeof document !== "undefined") {
  const preventDefault = (event: Event) => {
    event.preventDefault();
  };

  const blockedEvents: Array<keyof DocumentEventMap> = [
    "copy",
    "cut",
    "contextmenu",
    "selectstart",
    "dragstart",
  ];

  blockedEvents.forEach((eventName) => {
    document.addEventListener(eventName, preventDefault, { capture: true });
  });
}

import { preloadSounds } from './services/sound/soundService';
try {
  preloadSounds();
  logDiagnostic('info', 'boot.sounds.preloaded');
} catch (error) {
  logDiagnostic('warn', 'boot.sounds.preload_failed', { error });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

logDiagnostic('info', 'boot.react.render_called');

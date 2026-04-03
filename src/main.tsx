import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // ← init i18n before anything else
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/feedback/ErrorBoundary.tsx";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

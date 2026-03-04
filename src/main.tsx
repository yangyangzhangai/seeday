import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // ← init i18n before anything else
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/feedback/ErrorBoundary.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

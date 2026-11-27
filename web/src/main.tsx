import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/libre-franklin";
import "@fontsource-variable/playfair-display/wght-italic.css";
import App from "./App";
import "./styles.css";
import "./panels.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

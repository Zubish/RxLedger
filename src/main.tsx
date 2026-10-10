import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";
import Root from "./Root.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
    <SpeedInsights />
  </StrictMode>,
);

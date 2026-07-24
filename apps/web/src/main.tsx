import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import "@/shared/styles/tokens.css";
import "@/shared/styles/global.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Root element is missing.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


import "@fontsource-variable/inter";
import "./globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import Providers from "./Providers";
import AppErrorBoundary from "./routes/AppErrorBoundary";
import AppRouter from "./routes/AppRouter";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Providers>
          <AppRouter />
        </Providers>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);

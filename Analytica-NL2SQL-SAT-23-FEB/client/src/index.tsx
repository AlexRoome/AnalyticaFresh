import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient"; // Adjust path if needed
import App from "./App";
import "./ColourScheme.css"; // Global styles (optional)

const rootEl = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootEl);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* If you have <Toaster /> or other components, add them here if needed */}
    </QueryClientProvider>
  </React.StrictMode>
);

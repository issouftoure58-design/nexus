import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercepteur fetch pour ajouter l'URL de base API en production
const API_BASE_URL = import.meta.env.VITE_API_URL || "";
if (API_BASE_URL) {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (typeof input === 'string' && input.startsWith('/api')) {
      return originalFetch(API_BASE_URL + input, init);
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById("root")!).render(<App />);

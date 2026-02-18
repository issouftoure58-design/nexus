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

// SPA redirect handling - if redirected from 404.html, navigate to original path
const params = new URLSearchParams(window.location.search);
const redirectPath = params.get('redirect');
if (redirectPath) {
  window.history.replaceState(null, '', redirectPath);
}

createRoot(document.getElementById("root")!).render(<App />);

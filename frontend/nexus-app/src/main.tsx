import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercepteur fetch pour router les appels API vers le backend en production
// VITE_API_URL contient déjà /api (ex: https://backend.onrender.com/api)
// Les fetch internes utilisent /api/... donc on remplace le préfixe /api par VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "";
if (API_BASE_URL) {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      // /api/admin/auth/login → https://backend.onrender.com/api/admin/auth/login
      const path = input.slice(4); // strip "/api" prefix
      return originalFetch(API_BASE_URL + path, init);
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

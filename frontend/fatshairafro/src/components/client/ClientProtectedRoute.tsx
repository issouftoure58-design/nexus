import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface Props {
  children: React.ReactNode;
}

export default function ClientProtectedRoute({ children }: Props) {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("client_token");

    if (!token) {
      setLocation("/mon-compte/connexion");
      return;
    }

    // Vérifier la validité du token
    fetch("/api/client/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          // Token invalide, essayer de le rafraîchir
          const refreshToken = localStorage.getItem("client_refresh_token");
          if (refreshToken) {
            return fetch("/api/client/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
          }
          throw new Error("No refresh token");
        }
      })
      .then((res) => {
        if (res && !res.ok) {
          throw new Error("Refresh failed");
        }
        if (res) {
          return res.json();
        }
      })
      .then((data) => {
        if (data?.accessToken) {
          localStorage.setItem("client_token", data.accessToken);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        localStorage.removeItem("client_token");
        localStorage.removeItem("client_refresh_token");
        localStorage.removeItem("client_user");
        setLocation("/mon-compte/connexion");
      });
  }, [setLocation]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

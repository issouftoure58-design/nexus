import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  KeyRound,
} from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  // Extraire le token de l'URL
  const token = new URLSearchParams(search).get("token");

  useEffect(() => {
    if (!token) {
      setError("Lien invalide ou expiré");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/client/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la réinitialisation");
      }

      setSuccess(true);
      toast({
        title: "Mot de passe modifié",
        description: "Vous pouvez maintenant vous connecter",
      });

      // Rediriger après 3 secondes
      setTimeout(() => {
        setLocation("/mon-compte/connexion");
      }, 3000);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Letterbox bars */}
      <div className="fixed top-0 left-0 right-0 h-4 bg-black z-30" />
      <div className="fixed bottom-0 left-0 right-0 h-4 bg-black z-30" />

      {/* Corner frames */}
      <div className="fixed top-8 left-6 w-12 h-12 border-l-2 border-t-2 border-amber-500/30 z-20" />
      <div className="fixed top-8 right-6 w-12 h-12 border-r-2 border-t-2 border-amber-500/30 z-20" />
      <div className="fixed bottom-8 left-6 w-12 h-12 border-l-2 border-b-2 border-amber-500/30 z-20" />
      <div className="fixed bottom-8 right-6 w-12 h-12 border-r-2 border-b-2 border-amber-500/30 z-20" />

      <main className="relative z-10 flex items-center justify-center min-h-screen px-4 pt-20 pb-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <KeyRound className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">
                Réinitialisation
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="text-white">Nouveau </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                mot de passe
              </span>
            </h1>
            <p className="text-white/60">
              Choisissez un nouveau mot de passe sécurisé
            </p>
          </div>

          {/* Card */}
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 overflow-hidden">
            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-amber-500/50 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-amber-500/50 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-amber-500/50 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-amber-500/50 rounded-br-lg" />

            {error && !success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Lien invalide
                </h2>
                <p className="text-white/60 mb-6">{error}</p>
                <Link href="/mon-compte/mot-de-passe-oublie">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                    Demander un nouveau lien
                  </Button>
                </Link>
              </div>
            ) : success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Mot de passe modifié !
                </h2>
                <p className="text-white/60 mb-6">
                  Vous allez être redirigé vers la page de connexion...
                </p>
                <Link href="/mon-compte/connexion">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                    Se connecter maintenant
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/80">
                    Nouveau mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 caractères"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-white/40 text-xs">
                    Au moins 8 caractères avec 1 chiffre et 1 lettre
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white/80">
                    Confirmer le mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirmez votre mot de passe"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Modification...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Modifier le mot de passe
                    </div>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

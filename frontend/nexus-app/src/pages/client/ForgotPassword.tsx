import { useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  ArrowLeft,
  Send,
  CheckCircle2,
} from "lucide-react";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/client/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setEmailSent(true);
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre boîte de réception",
      });
    } catch (error: any) {
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
          {/* Back link */}
          <Link href="/mon-compte/connexion">
            <Button
              variant="ghost"
              className="mb-6 text-white/60 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Button>
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Mail className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">
                Récupération
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="text-white">Mot de passe </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                oublié ?
              </span>
            </h1>
            <p className="text-white/60">
              Entrez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>

          {/* Card */}
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 overflow-hidden">
            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-amber-500/50 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-amber-500/50 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-amber-500/50 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-amber-500/50 rounded-br-lg" />

            {emailSent ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Email envoyé !
                </h2>
                <p className="text-white/60 mb-6">
                  Si un compte existe avec l'adresse <strong className="text-white">{email}</strong>,
                  vous recevrez un lien de réinitialisation.
                </p>
                <p className="text-white/40 text-sm">
                  Pensez à vérifier vos spams si vous ne voyez pas l'email.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">
                    Adresse email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-amber-500/20"
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
                      Envoi en cours...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Envoyer le lien
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

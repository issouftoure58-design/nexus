import { useState } from "react";
import { useLocation } from "wouter";
import { Star, CheckCircle, AlertCircle } from "lucide-react";

export default function AvisPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full text-center border border-zinc-800">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Lien invalide</h1>
          <p className="text-zinc-400 mb-6">
            Ce lien d'avis n'est pas valide. Vérifiez le lien reçu par SMS ou email.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full text-center border border-zinc-800">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Merci pour votre avis !</h1>
          <p className="text-zinc-400 mb-6">
            Votre avis sera publié après modération. Merci de votre confiance !
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Veuillez sélectionner une note");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/reviews?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-zinc-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Votre avis compte !
          </h1>
          <p className="text-zinc-400">
            Comment s'est passée votre prestation chez Fat's Hair-Afro ?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Étoiles */}
          <div className="text-center">
            <p className="text-sm text-zinc-400 mb-3">Votre note</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-zinc-600"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-amber-400 text-sm mt-2">
                {rating === 5 && "Excellent !"}
                {rating === 4 && "Très bien !"}
                {rating === 3 && "Bien"}
                {rating === 2 && "Moyen"}
                {rating === 1 && "Décevant"}
              </p>
            )}
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Votre commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Partagez votre expérience..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1 text-right">
              {comment.length}/500
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || rating === 0}
            className="w-full py-3 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Envoi en cours..." : "Envoyer mon avis"}
          </button>
        </form>
      </div>
    </div>
  );
}

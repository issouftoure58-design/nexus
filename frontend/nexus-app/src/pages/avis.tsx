import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Star, CheckCircle, AlertCircle, Camera, X } from "lucide-react";
import { apiFetch } from "@/lib/api-config";

export default function AvisPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les infos de la réservation (service_name)
  useEffect(() => {
    if (!token) return;
    apiFetch(`/api/reviews/info?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.service_name) {
          setServiceName(data.service_name);
        }
      })
      .catch(() => {});
  }, [token]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo trop volumineuse (max 5MB)");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format accepté : JPG, PNG ou WebP");
      return;
    }

    setPhotoFile(file);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      const formData = new FormData();
      formData.append("rating", String(rating));
      formData.append("comment", comment);
      if (photoFile) formData.append("photo", photoFile);

      const res = await apiFetch(`/api/reviews?token=${token}`, {
        method: "POST",
        body: formData,
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
            Comment s'est passée votre prestation ?
          </p>
          {serviceName && (
            <p className="text-amber-400 text-sm font-medium mt-2">
              {serviceName}
            </p>
          )}
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

          {/* Upload photo */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Photo de votre prestation (optionnel)
            </label>
            {photoPreview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={photoPreview}
                  alt="Aperçu"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500/50 transition-colors"
              >
                <Camera className="w-8 h-8 text-zinc-500" />
                <span className="text-sm text-zinc-500">
                  Ajouter une photo
                </span>
                <span className="text-xs text-zinc-600">
                  JPG, PNG ou WebP — max 5MB
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
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

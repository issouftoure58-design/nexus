import { useState, useRef } from 'react';
import { Star, Camera, X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-config';

interface PublicReviewFormProps {
  onSuccess?: () => void;
}

export default function PublicReviewForm({ onSuccess }: PublicReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo trop volumineuse (max 5MB)');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Format accepté : JPEG, PNG ou WebP');
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const removePhoto = () => {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (rating < 1) { setError('Veuillez donner une note'); return; }
    if (!name.trim() || name.trim().length > 50) { setError('Nom requis (max 50 caractères)'); return; }
    if (!comment.trim() || comment.trim().length < 5 || comment.trim().length > 500) {
      setError('Commentaire requis (5-500 caractères)');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('rating', String(rating));
      formData.append('name', name.trim());
      formData.append('comment', comment.trim());
      if (photo) formData.append('photo', photo);

      const res = await apiFetch('/api/reviews/public', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'envoi');
        return;
      }

      setSuccess(true);
      setRating(0);
      setName('');
      setComment('');
      removePhoto();
      onSuccess?.();
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mt-16 max-w-2xl mx-auto">
        <div className="bg-white/5 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Merci pour votre avis !</h3>
          <p className="text-white/60">Il sera publié après modération.</p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-6 text-amber-400 hover:text-amber-300 text-sm underline underline-offset-2"
          >
            Laisser un autre avis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-2xl mx-auto">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">
          Partagez votre expérience
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Étoiles */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    i <= (hoverRating || rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-white/20'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Nom */}
          <div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Votre nom ou pseudo"
              maxLength={50}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>

          {/* Commentaire */}
          <div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Votre avis (5-500 caractères)"
              rows={4}
              maxLength={500}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition resize-none"
            />
            <p className="text-white/30 text-xs mt-1 text-right">{comment.length}/500</p>
          </div>

          {/* Photo */}
          <div>
            {photoPreview ? (
              <div className="relative inline-block">
                <img
                  src={photoPreview}
                  alt="Aperçu"
                  className="w-32 h-24 object-cover rounded-xl border border-white/10"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition"
              >
                <Camera className="w-4 h-4" />
                Ajouter une photo (optionnel)
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {/* 🍯 Honeypot */}
          <input
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
          />

          {/* Erreur */}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || rating < 1}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              'Envoyer mon avis'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

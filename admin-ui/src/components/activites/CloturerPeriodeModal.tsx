/**
 * CloturerPeriodeModal — Modal de clôture globale de période (batch)
 * 3 étapes : Choix période → Aperçu (dry_run) → Exécution
 */

import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';

interface CloturerPeriodeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface PreviewReservation {
  id: number;
  date: string;
  client: string;
  service_nom: string;
  montant: number;
  is_forfait: boolean;
  has_membre: boolean;
}

interface PreviewData {
  count: number;
  montant_total: number;
  reservations: PreviewReservation[];
  forfait_count: number;
}

interface ResultData {
  count: number;
  factures_generees: number;
  montant_total: number;
  skipped: number;
  skipped_details: { id: number; raison: string }[];
  errors: { id: number; error: string }[];
}

type Step = 'choose' | 'preview' | 'result';
type PeriodChoice = 'mois_en_cours' | 'mois_precedent' | 'personnalise';

function getMonthRange(offset: number): { debut: string; fin: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const d = new Date(y, m, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    debut: d.toISOString().slice(0, 10),
    fin: lastDay.toISOString().slice(0, 10),
  };
}

export default function CloturerPeriodeModal({ onClose, onSuccess }: CloturerPeriodeModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [periodChoice, setPeriodChoice] = useState<PeriodChoice>('mois_en_cours');
  const [customDebut, setCustomDebut] = useState('');
  const [customFin, setCustomFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');

  const getRange = () => {
    if (periodChoice === 'mois_en_cours') return getMonthRange(0);
    if (periodChoice === 'mois_precedent') return getMonthRange(-1);
    return { debut: customDebut, fin: customFin };
  };

  const handlePreview = async () => {
    const { debut, fin } = getRange();
    if (!debut || !fin) { setError('Dates invalides'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await api.post<PreviewData>('/admin/reservations/cloturer-periode', {
        date_debut: debut,
        date_fin: fin,
        dry_run: true,
      });
      setPreview(data);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Erreur chargement apercu');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    const { debut, fin } = getRange();
    setLoading(true);
    setError('');
    try {
      const data = await api.post<ResultData>('/admin/reservations/cloturer-periode', {
        date_debut: debut,
        date_fin: fin,
        dry_run: false,
      });
      setResult(data);
      setStep('result');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur cloture');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  const fmtDate = (d: string) => {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cloturer une periode
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Choose period */}
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selectionnez la periode a cloturer. Toutes les prestations non terminees de cette periode seront cloturees et les factures generees.
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input
                    type="radio"
                    name="period"
                    checked={periodChoice === 'mois_en_cours'}
                    onChange={() => setPeriodChoice('mois_en_cours')}
                    className="accent-cyan-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Mois en cours</span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input
                    type="radio"
                    name="period"
                    checked={periodChoice === 'mois_precedent'}
                    onChange={() => setPeriodChoice('mois_precedent')}
                    className="accent-cyan-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Mois precedent</span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input
                    type="radio"
                    name="period"
                    checked={periodChoice === 'personnalise'}
                    onChange={() => setPeriodChoice('personnalise')}
                    className="accent-cyan-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Personnalise</span>
                </label>

                {periodChoice === 'personnalise' && (
                  <div className="flex items-center gap-2 pl-8">
                    <input
                      type="date"
                      value={customDebut}
                      onChange={e => setCustomDebut(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                    />
                    <span className="text-gray-400">→</span>
                    <input
                      type="date"
                      value={customFin}
                      onChange={e => setCustomFin(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {preview.count} prestation{preview.count > 1 ? 's' : ''} a cloturer — Total : {fmt(preview.montant_total)} HT
                </p>
              </div>

              {preview.forfait_count > 0 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {preview.forfait_count} prestation{preview.forfait_count > 1 ? 's' : ''} forfait incluse{preview.forfait_count > 1 ? 's' : ''} (cloture forfait auto)
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Client</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Service</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.reservations.map(r => (
                      <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.client}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {r.service_nom}
                          {r.is_forfait && <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">Forfait</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">
                    {result.count} prestation{result.count > 1 ? 's' : ''} cloturee{result.count > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {result.factures_generees} facture{result.factures_generees > 1 ? 's' : ''} generee{result.factures_generees > 1 ? 's' : ''} — Total : {fmt(result.montant_total)} HT
                  </p>
                </div>
              </div>

              {result.skipped > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                  {result.skipped} prestation{result.skipped > 1 ? 's' : ''} ignoree{result.skipped > 1 ? 's' : ''}
                  {result.skipped_details.map(s => (
                    <div key={s.id} className="ml-2">- #{s.id} : {s.raison}</div>
                  ))}
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}
                  {result.errors.map(e => (
                    <div key={e.id} className="ml-2">- #{e.id} : {e.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          {step === 'choose' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handlePreview}
                disabled={loading || (periodChoice === 'personnalise' && (!customDebut || !customFin))}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Apercu
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('choose'); setPreview(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Retour
              </button>
              <button
                onClick={handleExecute}
                disabled={loading || !preview || preview.count === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Cloturer {preview?.count || 0} prestation{(preview?.count || 0) > 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { disponibilitesApi } from '@/lib/api';
import {
  Clock,
  Save,
  Loader2,
  Plus,
  Trash2,
  CalendarOff,
  AlertCircle,
  Check,
} from 'lucide-react';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Options horaires (de 06:00 a 22:00 par pas de 30min)
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m}`);
  }
}

interface HoraireRow {
  jour: number;
  nom: string;
  heure_debut: string | null;
  heure_fin: string | null;
  is_active: boolean;
}

export default function Disponibilites() {
  const queryClient = useQueryClient();
  const [horaires, setHoraires] = useState<HoraireRow[]>([]);
  const [horairesLoaded, setHorairesLoaded] = useState(false);
  const [congeForm, setCongeForm] = useState({ date_debut: '', date_fin: '', motif: '' });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Charger les horaires
  const { isLoading: loadingHoraires } = useQuery({
    queryKey: ['disponibilites-horaires'],
    queryFn: async () => {
      const data = await disponibilitesApi.getHoraires();
      if (!horairesLoaded) {
        setHoraires(data.horaires.map(h => ({
          jour: h.jour,
          nom: h.nom,
          heure_debut: h.heure_debut,
          heure_fin: h.heure_fin,
          is_active: h.is_active,
        })));
        setHorairesLoaded(true);
      }
      return data;
    },
  });

  // Charger les conges
  const { data: congesData, isLoading: loadingConges } = useQuery({
    queryKey: ['disponibilites-conges'],
    queryFn: () => disponibilitesApi.getConges(),
  });

  // Sauvegarder les horaires
  const saveMutation = useMutation({
    mutationFn: (data: HoraireRow[]) =>
      disponibilitesApi.updateHoraires(data.map(h => ({
        jour: h.jour,
        heure_debut: h.heure_debut,
        heure_fin: h.heure_fin,
        is_active: h.is_active,
      }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilites-horaires'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  // Ajouter un conge
  const addCongeMutation = useMutation({
    mutationFn: (data: { date_debut: string; date_fin: string; motif?: string }) =>
      disponibilitesApi.createConge(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilites-conges'] });
      setCongeForm({ date_debut: '', date_fin: '', motif: '' });
    },
  });

  // Supprimer un conge
  const deleteCongeMutation = useMutation({
    mutationFn: (id: number) => disponibilitesApi.deleteConge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilites-conges'] });
    },
  });

  const updateHoraire = (jour: number, field: keyof HoraireRow, value: string | boolean) => {
    setHoraires(prev => prev.map(h =>
      h.jour === jour ? { ...h, [field]: value } : h
    ));
  };

  const toggleDay = (jour: number, active: boolean) => {
    setHoraires(prev => prev.map(h => {
      if (h.jour !== jour) return h;
      return {
        ...h,
        is_active: active,
        heure_debut: active ? (h.heure_debut || '09:00') : null,
        heure_fin: active ? (h.heure_fin || '18:00') : null,
      };
    }));
  };

  const conges = congesData?.conges || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-7 h-7 text-cyan-500" />
          Disponibilites
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gerez vos horaires d'ouverture et periodes de fermeture
        </p>
      </div>

      {/* Section Horaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              Horaires hebdomadaires
            </span>
            <Button
              onClick={() => saveMutation.mutate(horaires)}
              disabled={saveMutation.isPending || loadingHoraires}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saveSuccess ? 'Enregistre !' : 'Enregistrer'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHoraires ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {horaires.map((h) => (
                <div
                  key={h.jour}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                    h.is_active
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                  }`}
                >
                  {/* Jour */}
                  <div className="w-28 font-medium text-gray-700 dark:text-gray-300">
                    {h.nom}
                  </div>

                  {/* Toggle */}
                  <Switch
                    checked={h.is_active}
                    onCheckedChange={(checked) => toggleDay(h.jour, checked)}
                  />

                  {h.is_active ? (
                    <>
                      {/* Heure debut */}
                      <select
                        value={h.heure_debut || '09:00'}
                        onChange={(e) => updateHoraire(h.jour, 'heure_debut', e.target.value)}
                        className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
                      >
                        {TIME_OPTIONS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>

                      <span className="text-gray-400">a</span>

                      {/* Heure fin */}
                      <select
                        value={h.heure_fin || '18:00'}
                        onChange={(e) => updateHoraire(h.jour, 'heure_fin', e.target.value)}
                        className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
                      >
                        {TIME_OPTIONS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-sm italic">
                      Ferme
                    </span>
                  )}
                </div>
              ))}

              {saveMutation.isError && (
                <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
                  <AlertCircle className="w-4 h-4" />
                  Erreur lors de la sauvegarde
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section Conges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-orange-500" />
            Conges et fermetures exceptionnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulaire ajout */}
          <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date debut</label>
              <Input
                type="date"
                value={congeForm.date_debut}
                onChange={(e) => setCongeForm(prev => ({ ...prev, date_debut: e.target.value }))}
                className="w-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date fin</label>
              <Input
                type="date"
                value={congeForm.date_fin}
                onChange={(e) => setCongeForm(prev => ({ ...prev, date_fin: e.target.value }))}
                className="w-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motif</label>
              <Input
                value={congeForm.motif}
                onChange={(e) => setCongeForm(prev => ({ ...prev, motif: e.target.value }))}
                placeholder="Ex: Vacances"
                className="w-48"
              />
            </div>
            <Button
              onClick={() => {
                if (congeForm.date_debut && congeForm.date_fin) {
                  addCongeMutation.mutate({
                    date_debut: congeForm.date_debut,
                    date_fin: congeForm.date_fin,
                    motif: congeForm.motif || undefined,
                  });
                }
              }}
              disabled={!congeForm.date_debut || !congeForm.date_fin || addCongeMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {addCongeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Ajouter
            </Button>
          </div>

          {/* Liste des conges */}
          {loadingConges ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : conges.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              Aucun conge programme
            </p>
          ) : (
            <div className="space-y-2">
              {conges.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {new Date(c.date_debut + 'T12:00:00').toLocaleDateString('fr-FR')}
                      {' '}&rarr;{' '}
                      {new Date(c.date_fin + 'T12:00:00').toLocaleDateString('fr-FR')}
                    </span>
                    {c.motif && (
                      <span className="ml-2 text-sm text-gray-500">
                        — {c.motif}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCongeMutation.mutate(c.id)}
                    disabled={deleteCongeMutation.isPending}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

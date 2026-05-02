import React, { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { comptaApi, type ImportEcriture, type ImportParseResult, type ImportValidationResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Upload, FileText, Table, AlertCircle, AlertTriangle,
  CheckCircle, Loader2, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ImportFormat = 'fec' | 'csv' | 'soldes';

const FORMAT_OPTIONS = [
  { key: 'fec' as ImportFormat, label: 'FEC (Sage, Cegid, etc.)', icon: FileText, desc: 'Import FEC 18 colonnes' },
  { key: 'csv' as ImportFormat, label: 'CSV libre', icon: Table, desc: 'Avec mapping colonnes' },
  { key: 'soldes' as ImportFormat, label: 'Soldes d\'ouverture', icon: Download, desc: 'Bilan initial' },
];

const CSV_FIELDS = ['date', 'compte', 'compte_libelle', 'libelle', 'debit', 'credit', 'journal', 'piece'];

export default function ComptaImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>('fec');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [creerComptes, setCreerComptes] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // CSV mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});

  // Soldes ouverture
  const [soldes, setSoldes] = useState<{ compte_numero: string; compte_libelle: string; solde: number }[]>([
    { compte_numero: '', compte_libelle: '', solde: 0 },
  ]);
  const [dateOuverture, setDateOuverture] = useState('');

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Parse FEC
  const parseFECMutation = useMutation({
    mutationFn: (file: File) => comptaApi.importFEC(file),
    onSuccess: (data) => {
      setParseResult(data);
      setStep('preview');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  // Parse CSV
  const parseCSVMutation = useMutation({
    mutationFn: (file: File) => comptaApi.importCSV(file, csvMapping),
    onSuccess: (data) => {
      setParseResult(data);
      setStep('preview');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  // Validation
  const validateMutation = useMutation({
    mutationFn: (ecritures: ImportEcriture[]) => comptaApi.previewImport(ecritures),
    onSuccess: (data) => setValidationResult(data),
    onError: (err: Error) => notify('error', err.message),
  });

  // Exécution import
  const executeMutation = useMutation({
    mutationFn: () => comptaApi.executeImport(parseResult!.ecritures, creerComptes, format),
    onSuccess: (data) => {
      notify('success', `Import réussi : ${data.nb_ecritures} écritures, ${data.nb_comptes_crees} comptes créés`);
      setStep('result');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  // Import soldes
  const soldesMutation = useMutation({
    mutationFn: () => comptaApi.importSoldesOuverture(
      soldes.filter(s => s.compte_numero && s.solde !== 0),
      dateOuverture
    ),
    onSuccess: (data) => {
      notify('success', `${data.nb_ecritures} écritures d'ouverture créées${data.equilibre ? '' : ' (écart régularisé en 471)'}`);
      setStep('result');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (format === 'fec') {
      parseFECMutation.mutate(file);
    } else if (format === 'csv') {
      // Lire les headers d'abord
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const firstLine = content.split('\n')[0] || '';
        const sep = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');
        const headers = firstLine.split(sep).map(h => h.trim().replace(/"/g, '').replace(/^\uFEFF/, ''));
        setCsvHeaders(headers);

        // Auto-mapping intelligent
        const autoMap: Record<string, string> = {};
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('date')) autoMap['date'] = h;
          if (lower.includes('compte') && !lower.includes('lib')) autoMap['compte'] = h;
          if (lower.includes('libelle') || lower.includes('lib')) {
            if (lower.includes('compte')) autoMap['compte_libelle'] = h;
            else autoMap['libelle'] = h;
          }
          if (lower.includes('debit') || lower === 'débit') autoMap['debit'] = h;
          if (lower.includes('credit') || lower === 'crédit') autoMap['credit'] = h;
          if (lower.includes('journal')) autoMap['journal'] = h;
          if (lower.includes('piece') || lower.includes('pièce')) autoMap['piece'] = h;
        });
        setCsvMapping(autoMap);
        setStep('mapping');
      };
      reader.readAsText(file);
    }
  };

  const handleCSVUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (file) parseCSVMutation.mutate(file);
  };

  const resetImport = () => {
    setStep('upload');
    setParseResult(null);
    setValidationResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Notification */}
      {notification && (
        <div className={cn(
          'p-3 rounded-lg flex items-center gap-2 text-sm',
          notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notification.message}
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Format d'import</h3>
          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFormat(opt.key)}
                className={cn(
                  'p-4 border-2 rounded-lg text-left transition-colors',
                  format === opt.key ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <opt.icon className={cn('h-6 w-6 mb-2', format === opt.key ? 'text-purple-600' : 'text-gray-400')} />
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {format !== 'soldes' ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-3">Glissez votre fichier ou cliquez pour sélectionner</p>
              <input
                ref={fileRef}
                type="file"
                accept={format === 'fec' ? '.txt,.csv,.fec' : '.csv,.txt'}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={parseFECMutation.isPending}>
                {parseFECMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Sélectionner un fichier
              </Button>
            </div>
          ) : (
            /* Soldes d'ouverture */
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date d'ouverture</label>
                <input type="date" value={dateOuverture} onChange={e => setDateOuverture(e.target.value)} className="px-3 py-2 border rounded text-sm" />
              </div>

              <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Compte</th>
                    <th className="px-3 py-2 text-left">Libellé</th>
                    <th className="px-3 py-2 text-right">Solde (€, + débit / - crédit)</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {soldes.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <input type="text" value={s.compte_numero} onChange={e => {
                          const upd = [...soldes]; upd[i].compte_numero = e.target.value; setSoldes(upd);
                        }} placeholder="512" className="w-full px-2 py-1.5 border rounded text-sm" />
                      </td>
                      <td className="px-2 py-1">
                        <input type="text" value={s.compte_libelle} onChange={e => {
                          const upd = [...soldes]; upd[i].compte_libelle = e.target.value; setSoldes(upd);
                        }} placeholder="Banque" className="w-full px-2 py-1.5 border rounded text-sm" />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="0.01" value={s.solde || ''} onChange={e => {
                          const upd = [...soldes]; upd[i].solde = parseFloat(e.target.value || '0'); setSoldes(upd);
                        }} className="w-full px-2 py-1.5 border rounded text-sm text-right" />
                      </td>
                      <td className="px-2 py-1">
                        <button onClick={() => setSoldes(soldes.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSoldes([...soldes, { compte_numero: '', compte_libelle: '', solde: 0 }])}>
                  + Ajouter ligne
                </Button>
                <Button size="sm" onClick={() => soldesMutation.mutate()} disabled={soldesMutation.isPending || !dateOuverture || soldes.filter(s => s.compte_numero).length === 0}>
                  {soldesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Importer soldes
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step: CSV Mapping */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Mapping colonnes CSV</h3>
          <p className="text-xs text-gray-500">Associez chaque champ à une colonne de votre fichier</p>

          <div className="grid grid-cols-2 gap-3">
            {CSV_FIELDS.map(field => (
              <div key={field}>
                <label className="block text-xs text-gray-500 mb-1 capitalize">
                  {field}{['date', 'compte', 'debit', 'credit'].includes(field) ? ' *' : ''}
                </label>
                <select
                  value={csvMapping[field] || ''}
                  onChange={e => setCsvMapping({ ...csvMapping, [field]: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">-- Non utilisé --</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCSVUpload} disabled={parseCSVMutation.isPending || !csvMapping.date || !csvMapping.compte}>
              {parseCSVMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Analyser
            </Button>
            <Button size="sm" variant="ghost" onClick={resetImport}>Retour</Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Résultat du parsing</h3>
            <Button size="sm" variant="ghost" onClick={resetImport}>Retour</Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{parseResult.stats.nb_ecritures}</p>
              <p className="text-xs text-blue-600">Écritures</p>
            </div>
            <div className="bg-gray-50 border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{parseResult.stats.nb_lignes}</p>
              <p className="text-xs text-gray-500">Lignes lues</p>
            </div>
            <div className="bg-gray-50 border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{parseResult.stats.comptes?.length || 0}</p>
              <p className="text-xs text-gray-500">Comptes</p>
            </div>
            <div className={cn('border rounded-lg p-3 text-center', parseResult.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
              <p className={cn('text-2xl font-bold', parseResult.errors.length > 0 ? 'text-red-700' : 'text-green-700')}>{parseResult.errors.length}</p>
              <p className="text-xs text-gray-500">Erreurs</p>
            </div>
          </div>

          {/* Erreurs parsing */}
          {parseResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {parseResult.errors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs text-red-600"><AlertCircle className="h-3 w-3 inline mr-1" />{e}</p>
              ))}
              {parseResult.errors.length > 20 && <p className="text-xs text-red-500 mt-1">...et {parseResult.errors.length - 20} autres</p>}
            </div>
          )}

          {/* Preview 20 premières écritures */}
          {parseResult.ecritures.length > 0 && (
            <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Journal</th>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Pièce</th>
                    <th className="px-2 py-1.5 text-left">Compte</th>
                    <th className="px-2 py-1.5 text-left">Libellé</th>
                    <th className="px-2 py-1.5 text-right">Débit</th>
                    <th className="px-2 py-1.5 text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.ecritures.slice(0, 50).map((e, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-2 py-1">{e.journal_code}</td>
                      <td className="px-2 py-1">{e.date_ecriture}</td>
                      <td className="px-2 py-1">{e.numero_piece}</td>
                      <td className="px-2 py-1 font-mono">{e.compte_numero}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate">{e.libelle}</td>
                      <td className="px-2 py-1 text-right">{e.debit ? (e.debit / 100).toFixed(2) : ''}</td>
                      <td className="px-2 py-1 text-right">{e.credit ? (e.credit / 100).toFixed(2) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.ecritures.length > 50 && (
                <p className="text-xs text-gray-500 p-2 text-center">...{parseResult.ecritures.length - 50} écritures supplémentaires</p>
              )}
            </div>
          )}

          {/* Validation */}
          {!validationResult && parseResult.ecritures.length > 0 && (
            <Button
              size="sm"
              onClick={() => validateMutation.mutate(parseResult.ecritures)}
              disabled={validateMutation.isPending}
            >
              {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Valider avant import
            </Button>
          )}

          {validationResult && (
            <div className={cn('border rounded-lg p-4', validationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
              <p className={cn('text-sm font-medium', validationResult.valid ? 'text-green-700' : 'text-red-700')}>
                {validationResult.valid ? '✓ Validation réussie' : '✗ Erreurs détectées'}
              </p>
              {validationResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 mt-1"><AlertCircle className="h-3 w-3 inline mr-1" />{e}</p>
              ))}
              {validationResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-600 mt-1"><AlertTriangle className="h-3 w-3 inline mr-1" />{w}</p>
              ))}
              {validationResult.comptes_manquants.length > 0 && (
                <label className="flex items-center gap-2 mt-2 text-xs">
                  <input type="checkbox" checked={creerComptes} onChange={e => setCreerComptes(e.target.checked)} />
                  Créer les {validationResult.comptes_manquants.length} comptes manquants automatiquement
                </label>
              )}

              {validationResult.valid && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                >
                  {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Exécuter l'import ({parseResult.ecritures.length} écritures)
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800">Import terminé</h3>
          <p className="text-sm text-green-600 mt-1">Les écritures ont été importées avec succès</p>
          <Button size="sm" className="mt-4" onClick={resetImport}>Nouvel import</Button>
        </div>
      )}
    </div>
  );
}

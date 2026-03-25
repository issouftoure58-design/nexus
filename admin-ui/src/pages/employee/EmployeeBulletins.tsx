import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Filter } from 'lucide-react';
import { employeePortalApi, type Bulletin } from '../../lib/employeeApi';

export default function EmployeeBulletins() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());

  const fetchBulletins = useCallback(async () => {
    setLoading(true);
    try {
      const result = await employeePortalApi.getBulletins(annee);
      setBulletins(result.bulletins);
    } catch (err) {
      console.error('Erreur bulletins:', err);
    } finally {
      setLoading(false);
    }
  }, [annee]);

  useEffect(() => {
    fetchBulletins();
  }, [fetchBulletins]);

  const handleDownload = async (id: number, periode: string) => {
    const url = employeePortalApi.getBulletinPdfUrl(id);
    const token = localStorage.getItem('nexus_employee_token');

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Erreur telechargement');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `bulletin_${periode}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Erreur download PDF:', err);
    }
  };

  const formatPeriode = (p: string) => {
    const [y, m] = p.split('-');
    const mois = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
    return `${mois[parseInt(m) - 1] || m} ${y}`;
  };

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

  // Annees disponibles (5 dernieres)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bulletins de paie</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={annee}
            onChange={(e) => setAnnee(parseInt(e.target.value))}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bulletins.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun bulletin disponible pour {annee}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bulletins.map((bulletin) => (
            <div
              key={bulletin.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{formatPeriode(bulletin.periode)}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  <span>Brut: {formatMoney(bulletin.salaire_brut)}</span>
                  <span className="hidden sm:inline">Net: {formatMoney(bulletin.salaire_net)}</span>
                  <span className="font-semibold text-emerald-700">
                    A payer: {formatMoney(bulletin.net_a_payer)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDownload(bulletin.id, bulletin.periode)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

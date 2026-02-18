/**
 * Exporte des données au format CSV
 * @param data - Tableau d'objets à exporter
 * @param filename - Nom du fichier (sans extension)
 */
export const exportToCSV = (data: any[], filename: string): void => {
  if (!data || !data.length) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Headers depuis les clés du premier objet
  const headers = Object.keys(data[0]);

  // Construire le CSV
  const csvContent = [
    headers.join(';'), // Header row
    ...data.map(row =>
      headers.map(header => {
        let cell = row[header] ?? '';
        // Escape quotes et point-virgules
        if (typeof cell === 'string' && (cell.includes(';') || cell.includes('"') || cell.includes('\n'))) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(';')
    )
  ].join('\n');

  // Télécharger avec BOM UTF-8 pour Excel
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  // Nettoyer
  URL.revokeObjectURL(link.href);
};

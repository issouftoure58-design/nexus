import { useQuery } from '@tanstack/react-query';
import { X, Loader2, User, Mail, Phone, Briefcase, Calendar, Euro } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { rhApi, type TeamMember } from '@/lib/api';

interface EmployeeDetailModalProps {
  employee: TeamMember | { id: number; prenom: string; nom: string; role?: string };
  onClose: () => void;
}

export function EmployeeDetailModal({ employee, onClose }: EmployeeDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-detail', employee.id],
    queryFn: () => rhApi.getEmployeeDetail(employee.id),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const employeeData = data?.employe;
  const conges = data?.compteur_conges;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {employee.prenom?.[0] || ''}{employee.nom?.[0] || ''}
            </div>
            <div>
              <CardTitle>{employee.prenom} {employee.nom}</CardTitle>
              <p className="text-sm text-gray-500">{employee.role || employeeData?.poste || 'Employé'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : employeeData ? (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium">{employeeData.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Téléphone</p>
                    <p className="text-sm font-medium">{employeeData.telephone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Work Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <Briefcase className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-indigo-700">{employeeData.poste || '-'}</p>
                  <p className="text-xs text-indigo-600">Poste</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <User className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-purple-700">{employeeData.departement || '-'}</p>
                  <p className="text-xs text-purple-600">Département</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <Euro className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-green-700">
                    {employeeData.salaire_mensuel ? formatCurrency(employeeData.salaire_mensuel / 100) : '-'}
                  </p>
                  <p className="text-xs text-green-600">Salaire mensuel</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <Calendar className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-blue-700">{formatDate(employeeData.date_embauche)}</p>
                  <p className="text-xs text-blue-600">Date d'embauche</p>
                </div>
              </div>

              {/* Contract Type */}
              <div className="flex items-center gap-4">
                <Badge variant="outline" className={employeeData.actif ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                  {employeeData.actif ? 'Actif' : 'Inactif'}
                </Badge>
                {employeeData.type_contrat && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {employeeData.type_contrat}
                  </Badge>
                )}
              </div>

              {/* Congés */}
              {conges && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Compteur de congés</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{conges.cp_acquis || 0}</p>
                      <p className="text-xs text-amber-600">CP Acquis</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{conges.cp_pris || 0}</p>
                      <p className="text-xs text-amber-600">CP Pris</p>
                    </div>
                    <div className="bg-cyan-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-cyan-700">{conges.rtt_acquis || 0}</p>
                      <p className="text-xs text-cyan-600">RTT Acquis</p>
                    </div>
                    <div className="bg-cyan-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-cyan-700">{conges.rtt_pris || 0}</p>
                      <p className="text-xs text-cyan-600">RTT Pris</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>Informations non disponibles</p>
              <p className="text-sm text-gray-400 mt-2">L'employé n'a pas de fiche détaillée dans le module RH</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeeDetailModal;

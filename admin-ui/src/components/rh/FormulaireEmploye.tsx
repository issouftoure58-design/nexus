/**
 * FormulaireEmploye.tsx
 * Formulaire complet pour création/modification d'un employé
 * Champs enrichis conformes aux obligations légales françaises
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  MapPin,
  FileText,
  Briefcase,
  GraduationCap,
  Euro,
  Phone,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface Diplome {
  id?: number;
  intitule: string;
  etablissement: string;
  date_obtention: string;
  niveau: string;
  domaine: string;
  document_url?: string;
}

interface EmployeFormData {
  // Identité
  nom: string;
  prenom: string;
  sexe: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  nir: string;
  email: string;
  telephone: string;

  // Adresse
  adresse_rue: string;
  adresse_cp: string;
  adresse_ville: string;
  adresse_pays: string;

  // Pièce d'identité
  piece_identite_type: string;
  piece_identite_numero: string;
  piece_identite_expiration: string;

  // Contrat
  role: string;
  poste: string;
  type_contrat: string;
  date_embauche: string;
  date_fin_contrat: string;
  temps_travail: string;
  heures_hebdo: string;
  heures_mensuelles: string;
  jours_travailles: string[];

  // Classification
  convention_collective: string;
  classification_niveau: string;
  classification_echelon: string;
  classification_coefficient: string;
  categorie_sociopro: string;

  // Rémunération
  salaire_mensuel: string;
  regime_ss: string;
  mutuelle_obligatoire: boolean;
  mutuelle_dispense: boolean;
  prevoyance: boolean;
  iban: string;
  bic: string;

  // Contact urgence
  contact_urgence_nom: string;
  contact_urgence_tel: string;
  contact_urgence_lien: string;

  // Autre
  notes: string;
}

interface FormulaireEmployeProps {
  editMembre?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const initialFormData: EmployeFormData = {
  // Identité
  nom: '',
  prenom: '',
  sexe: '',
  date_naissance: '',
  lieu_naissance: '',
  nationalite: 'Française',
  nir: '',
  email: '',
  telephone: '',

  // Adresse
  adresse_rue: '',
  adresse_cp: '',
  adresse_ville: '',
  adresse_pays: 'France',

  // Pièce d'identité
  piece_identite_type: '',
  piece_identite_numero: '',
  piece_identite_expiration: '',

  // Contrat
  role: 'autre',
  poste: '',
  type_contrat: 'cdi',
  date_embauche: '',
  date_fin_contrat: '',
  temps_travail: 'temps_plein',
  heures_hebdo: '35',
  heures_mensuelles: '151.67',
  jours_travailles: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],

  // Classification
  convention_collective: '',
  classification_niveau: '',
  classification_echelon: '',
  classification_coefficient: '',
  categorie_sociopro: '',

  // Rémunération
  salaire_mensuel: '',
  regime_ss: 'general',
  mutuelle_obligatoire: true,
  mutuelle_dispense: false,
  prevoyance: false,
  iban: '',
  bic: '',

  // Contact urgence
  contact_urgence_nom: '',
  contact_urgence_tel: '',
  contact_urgence_lien: '',

  // Autre
  notes: ''
};

export default function FormulaireEmploye({
  editMembre,
  onSubmit,
  onCancel,
  loading = false
}: FormulaireEmployeProps) {
  const [formData, setFormData] = useState<EmployeFormData>(initialFormData);
  const [diplomes, setDiplomes] = useState<Diplome[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identite: true,
    adresse: false,
    piece_identite: false,
    contrat: true,
    classification: false,
    remuneration: true,
    urgence: false,
    diplomes: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialiser avec les données existantes si modification
  useEffect(() => {
    if (editMembre) {
      setFormData({
        nom: editMembre.nom || '',
        prenom: editMembre.prenom || '',
        sexe: editMembre.sexe || '',
        date_naissance: editMembre.date_naissance || '',
        lieu_naissance: editMembre.lieu_naissance || '',
        nationalite: editMembre.nationalite || 'Française',
        nir: editMembre.nir || '',
        email: editMembre.email || '',
        telephone: editMembre.telephone || '',

        adresse_rue: editMembre.adresse_rue || '',
        adresse_cp: editMembre.adresse_cp || '',
        adresse_ville: editMembre.adresse_ville || '',
        adresse_pays: editMembre.adresse_pays || 'France',

        piece_identite_type: editMembre.piece_identite_type || '',
        piece_identite_numero: editMembre.piece_identite_numero || '',
        piece_identite_expiration: editMembre.piece_identite_expiration || '',

        role: editMembre.role || 'autre',
        poste: editMembre.poste || '',
        type_contrat: editMembre.type_contrat || 'cdi',
        date_embauche: editMembre.date_embauche || '',
        date_fin_contrat: editMembre.date_fin_contrat || '',
        temps_travail: editMembre.temps_travail || 'temps_plein',
        heures_hebdo: editMembre.heures_hebdo?.toString() || '35',
        heures_mensuelles: editMembre.heures_mensuelles?.toString() || '151.67',
        jours_travailles: editMembre.jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],

        convention_collective: editMembre.convention_collective || '',
        classification_niveau: editMembre.classification_niveau || '',
        classification_echelon: editMembre.classification_echelon || '',
        classification_coefficient: editMembre.classification_coefficient?.toString() || '',
        categorie_sociopro: editMembre.categorie_sociopro || '',

        salaire_mensuel: editMembre.salaire_mensuel ? (editMembre.salaire_mensuel / 100).toString() : '',
        regime_ss: editMembre.regime_ss || 'general',
        mutuelle_obligatoire: editMembre.mutuelle_obligatoire !== false,
        mutuelle_dispense: editMembre.mutuelle_dispense || false,
        prevoyance: editMembre.prevoyance || false,
        iban: editMembre.iban || '',
        bic: editMembre.bic || '',

        contact_urgence_nom: editMembre.contact_urgence_nom || '',
        contact_urgence_tel: editMembre.contact_urgence_tel || '',
        contact_urgence_lien: editMembre.contact_urgence_lien || '',

        notes: editMembre.notes || ''
      });
    }
  }, [editMembre]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateField = (field: keyof EmployeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nom.trim()) newErrors.nom = 'Nom requis';
    if (!formData.prenom.trim()) newErrors.prenom = 'Prénom requis';
    if (formData.nir && !/^\d{15}$/.test(formData.nir.replace(/\s/g, ''))) {
      newErrors.nir = 'NIR invalide (15 chiffres)';
    }
    if (formData.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(formData.iban.replace(/\s/g, '').toUpperCase())) {
      newErrors.iban = 'IBAN invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      // Expand sections with errors
      const sectionsWithErrors = Object.keys(errors).reduce((acc, field) => {
        if (['nom', 'prenom', 'sexe', 'date_naissance', 'lieu_naissance', 'nationalite', 'nir', 'email', 'telephone'].includes(field)) {
          acc.identite = true;
        }
        if (field.startsWith('adresse_')) acc.adresse = true;
        if (field.startsWith('piece_identite_')) acc.piece_identite = true;
        if (['role', 'poste', 'type_contrat', 'date_embauche'].includes(field)) acc.contrat = true;
        if (field.startsWith('classification_') || field === 'categorie_sociopro') acc.classification = true;
        if (['salaire_mensuel', 'iban', 'bic'].includes(field)) acc.remuneration = true;
        if (field.startsWith('contact_urgence_')) acc.urgence = true;
        return acc;
      }, {} as Record<string, boolean>);

      setExpandedSections(prev => ({ ...prev, ...sectionsWithErrors }));
      return;
    }

    // Préparer les données pour l'API
    const submitData = {
      ...formData,
      salaire_mensuel: formData.salaire_mensuel ? Math.round(parseFloat(formData.salaire_mensuel) * 100) : 0,
      heures_hebdo: parseFloat(formData.heures_hebdo) || 35,
      heures_mensuelles: parseFloat(formData.heures_mensuelles) || 151.67,
      classification_coefficient: formData.classification_coefficient ? parseInt(formData.classification_coefficient) : null,
      nir: formData.nir.replace(/\s/g, ''),
      iban: formData.iban.replace(/\s/g, '').toUpperCase(),
      diplomes
    };

    await onSubmit(submitData);
  };

  const addDiplome = () => {
    setDiplomes([...diplomes, {
      intitule: '',
      etablissement: '',
      date_obtention: '',
      niveau: '',
      domaine: ''
    }]);
  };

  const updateDiplome = (index: number, field: keyof Diplome, value: string) => {
    const newDiplomes = [...diplomes];
    newDiplomes[index] = { ...newDiplomes[index], [field]: value };
    setDiplomes(newDiplomes);
  };

  const removeDiplome = (index: number) => {
    setDiplomes(diplomes.filter((_, i) => i !== index));
  };

  const SectionHeader = ({ title, icon: Icon, section }: { title: string; icon: any; section: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2 font-medium">
        <Icon className="w-4 h-4 text-blue-600" />
        {title}
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4 text-gray-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-500" />
      )}
    </button>
  );

  const ErrorMessage = ({ field }: { field: string }) => (
    errors[field] ? (
      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {errors[field]}
      </p>
    ) : null
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Section Identité */}
      <Card className="overflow-hidden">
        <SectionHeader title="Identité" icon={User} section="identite" />
        {expandedSections.identite && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom *</label>
              <Input
                value={formData.nom}
                onChange={e => updateField('nom', e.target.value)}
                className={errors.nom ? 'border-red-500' : ''}
              />
              <ErrorMessage field="nom" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prénom *</label>
              <Input
                value={formData.prenom}
                onChange={e => updateField('prenom', e.target.value)}
                className={errors.prenom ? 'border-red-500' : ''}
              />
              <ErrorMessage field="prenom" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sexe</label>
              <select
                value={formData.sexe}
                onChange={e => updateField('sexe', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Non renseigné</option>
                <option value="M">Homme</option>
                <option value="F">Femme</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date de naissance</label>
              <Input
                type="date"
                value={formData.date_naissance}
                onChange={e => updateField('date_naissance', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lieu de naissance</label>
              <Input
                value={formData.lieu_naissance}
                onChange={e => updateField('lieu_naissance', e.target.value)}
                placeholder="Ville, Pays"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nationalité</label>
              <Input
                value={formData.nationalite}
                onChange={e => updateField('nationalite', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">NIR (Sécurité sociale)</label>
              <Input
                value={formData.nir}
                onChange={e => updateField('nir', e.target.value.replace(/[^\d]/g, '').slice(0, 15))}
                placeholder="15 chiffres"
                maxLength={15}
                className={errors.nir ? 'border-red-500' : ''}
              />
              <ErrorMessage field="nir" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={e => updateField('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Téléphone</label>
              <Input
                value={formData.telephone}
                onChange={e => updateField('telephone', e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Section Adresse */}
      <Card className="overflow-hidden">
        <SectionHeader title="Adresse" icon={MapPin} section="adresse" />
        {expandedSections.adresse && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium mb-1">Rue</label>
              <Input
                value={formData.adresse_rue}
                onChange={e => updateField('adresse_rue', e.target.value)}
                placeholder="123 rue de la Paix"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Code postal</label>
              <Input
                value={formData.adresse_cp}
                onChange={e => updateField('adresse_cp', e.target.value)}
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ville</label>
              <Input
                value={formData.adresse_ville}
                onChange={e => updateField('adresse_ville', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pays</label>
              <Input
                value={formData.adresse_pays}
                onChange={e => updateField('adresse_pays', e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Section Pièce d'identité */}
      <Card className="overflow-hidden">
        <SectionHeader title="Pièce d'identité" icon={FileText} section="piece_identite" />
        {expandedSections.piece_identite && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.piece_identite_type}
                onChange={e => updateField('piece_identite_type', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Non renseigné</option>
                <option value="cni">Carte d'identité</option>
                <option value="passeport">Passeport</option>
                <option value="titre_sejour">Titre de séjour</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Numéro</label>
              <Input
                value={formData.piece_identite_numero}
                onChange={e => updateField('piece_identite_numero', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date d'expiration</label>
              <Input
                type="date"
                value={formData.piece_identite_expiration}
                onChange={e => updateField('piece_identite_expiration', e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Section Contrat */}
      <Card className="overflow-hidden">
        <SectionHeader title="Contrat de travail" icon={Briefcase} section="contrat" />
        {expandedSections.contrat && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Rôle</label>
              <select
                value={formData.role}
                onChange={e => updateField('role', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="manager">Manager</option>
                <option value="commercial">Commercial</option>
                <option value="technicien">Technicien</option>
                <option value="admin">Administratif</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Intitulé du poste</label>
              <Input
                value={formData.poste}
                onChange={e => updateField('poste', e.target.value)}
                placeholder="Ex: Responsable commercial"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type de contrat</label>
              <select
                value={formData.type_contrat}
                onChange={e => updateField('type_contrat', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="cdi">CDI</option>
                <option value="cdd">CDD</option>
                <option value="alternance">Alternance</option>
                <option value="stage">Stage</option>
                <option value="interim">Intérim</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date d'embauche</label>
              <Input
                type="date"
                value={formData.date_embauche}
                onChange={e => updateField('date_embauche', e.target.value)}
              />
            </div>
            {formData.type_contrat !== 'cdi' && (
              <div>
                <label className="block text-sm font-medium mb-1">Date de fin</label>
                <Input
                  type="date"
                  value={formData.date_fin_contrat}
                  onChange={e => updateField('date_fin_contrat', e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Temps de travail</label>
              <select
                value={formData.temps_travail}
                onChange={e => updateField('temps_travail', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="temps_plein">Temps plein</option>
                <option value="temps_partiel">Temps partiel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Heures hebdomadaires</label>
              <Input
                type="number"
                step="0.5"
                value={formData.heures_hebdo}
                onChange={e => {
                  updateField('heures_hebdo', e.target.value);
                  // Auto-calculate monthly hours
                  const hebdo = parseFloat(e.target.value) || 35;
                  updateField('heures_mensuelles', (hebdo * 52 / 12).toFixed(2));
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Heures mensuelles</label>
              <Input
                type="number"
                step="0.01"
                value={formData.heures_mensuelles}
                onChange={e => updateField('heures_mensuelles', e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Section Classification */}
      <Card className="overflow-hidden">
        <SectionHeader title="Classification conventionnelle" icon={GraduationCap} section="classification" />
        {expandedSections.classification && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium mb-1">Convention collective</label>
              <Input
                value={formData.convention_collective}
                onChange={e => updateField('convention_collective', e.target.value)}
                placeholder="Ex: Commerce de détail et de gros"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Niveau</label>
              <Input
                value={formData.classification_niveau}
                onChange={e => updateField('classification_niveau', e.target.value)}
                placeholder="Ex: III"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Échelon</label>
              <Input
                value={formData.classification_echelon}
                onChange={e => updateField('classification_echelon', e.target.value)}
                placeholder="Ex: 2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Coefficient</label>
              <Input
                type="number"
                value={formData.classification_coefficient}
                onChange={e => updateField('classification_coefficient', e.target.value)}
                placeholder="Ex: 180"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Catégorie socioprofessionnelle</label>
              <select
                value={formData.categorie_sociopro}
                onChange={e => updateField('categorie_sociopro', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Non renseigné</option>
                <option value="ouvrier">Ouvrier</option>
                <option value="employe">Employé</option>
                <option value="technicien">Technicien</option>
                <option value="agent_maitrise">Agent de maîtrise</option>
                <option value="cadre">Cadre</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* Section Rémunération */}
      <Card className="overflow-hidden">
        <SectionHeader title="Rémunération et protection sociale" icon={Euro} section="remuneration" />
        {expandedSections.remuneration && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Salaire mensuel brut (€)</label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.salaire_mensuel}
                    onChange={e => updateField('salaire_mensuel', e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Régime sécurité sociale</label>
                <select
                  value={formData.regime_ss}
                  onChange={e => updateField('regime_ss', e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="general">Régime général</option>
                  <option value="alsace_moselle">Alsace-Moselle</option>
                  <option value="agricole">Régime agricole (MSA)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.mutuelle_obligatoire}
                  onChange={e => updateField('mutuelle_obligatoire', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Mutuelle obligatoire</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.mutuelle_dispense}
                  onChange={e => updateField('mutuelle_dispense', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Dispense mutuelle</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.prevoyance}
                  onChange={e => updateField('prevoyance', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Prévoyance</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">IBAN</label>
                <Input
                  value={formData.iban}
                  onChange={e => updateField('iban', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="FR76..."
                  className={errors.iban ? 'border-red-500' : ''}
                />
                <ErrorMessage field="iban" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">BIC</label>
                <Input
                  value={formData.bic}
                  onChange={e => updateField('bic', e.target.value.toUpperCase())}
                  placeholder="BNPAFRPP"
                  maxLength={11}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Section Contact d'urgence */}
      <Card className="overflow-hidden">
        <SectionHeader title="Contact d'urgence" icon={Phone} section="urgence" />
        {expandedSections.urgence && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom complet</label>
              <Input
                value={formData.contact_urgence_nom}
                onChange={e => updateField('contact_urgence_nom', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Téléphone</label>
              <Input
                value={formData.contact_urgence_tel}
                onChange={e => updateField('contact_urgence_tel', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lien</label>
              <select
                value={formData.contact_urgence_lien}
                onChange={e => updateField('contact_urgence_lien', e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Non renseigné</option>
                <option value="conjoint">Conjoint(e)</option>
                <option value="parent">Parent</option>
                <option value="enfant">Enfant</option>
                <option value="ami">Ami(e)</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* Section Diplômes */}
      <Card className="overflow-hidden">
        <SectionHeader title="Diplômes et formations" icon={GraduationCap} section="diplomes" />
        {expandedSections.diplomes && (
          <div className="p-4 space-y-4">
            {diplomes.map((diplome, index) => (
              <div key={index} className="border rounded-lg p-4 relative">
                <button
                  type="button"
                  onClick={() => removeDiplome(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Intitulé *</label>
                    <Input
                      value={diplome.intitule}
                      onChange={e => updateDiplome(index, 'intitule', e.target.value)}
                      placeholder="Ex: Master en Management"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Établissement</label>
                    <Input
                      value={diplome.etablissement}
                      onChange={e => updateDiplome(index, 'etablissement', e.target.value)}
                      placeholder="Ex: Université Paris-Dauphine"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date d'obtention</label>
                    <Input
                      type="date"
                      value={diplome.date_obtention}
                      onChange={e => updateDiplome(index, 'date_obtention', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Niveau</label>
                    <select
                      value={diplome.niveau}
                      onChange={e => updateDiplome(index, 'niveau', e.target.value)}
                      className="w-full border rounded-md px-3 py-2"
                    >
                      <option value="">Non renseigné</option>
                      <option value="sans_diplome">Sans diplôme</option>
                      <option value="cap_bep">CAP/BEP</option>
                      <option value="bac">Baccalauréat</option>
                      <option value="bac+2">Bac+2</option>
                      <option value="bac+3">Bac+3 (Licence)</option>
                      <option value="bac+5">Bac+5 (Master)</option>
                      <option value="doctorat">Doctorat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Domaine</label>
                    <Input
                      value={diplome.domaine}
                      onChange={e => updateDiplome(index, 'domaine', e.target.value)}
                      placeholder="Ex: Commerce, Informatique..."
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addDiplome}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un diplôme
            </Button>
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-4">
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={e => updateField('notes', e.target.value)}
          className="w-full border rounded-md px-3 py-2 min-h-[100px]"
          placeholder="Informations complémentaires..."
        />
      </Card>

      {/* Boutons d'action */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          <X className="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          <Check className="w-4 h-4 mr-2" />
          {loading ? 'Enregistrement...' : editMembre ? 'Modifier' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}

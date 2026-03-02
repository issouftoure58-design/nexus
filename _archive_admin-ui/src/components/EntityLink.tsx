import { useState } from 'react';
import { CategoryDetailModal } from '@/components/modals/CategoryDetailModal';
import { ClientDetailModal } from '@/components/modals/ClientDetailModal';
import { ServiceDetailModal } from '@/components/modals/ServiceDetailModal';
import { EmployeeDetailModal } from '@/components/modals/EmployeeDetailModal';
import { AuxiliaryLedgerModal } from '@/components/modals/AuxiliaryLedgerModal';
import type { Client, Service, TeamMember } from '@/lib/api';

// Entity types supported by EntityLink
type EntityType = 'client' | 'service' | 'categorie' | 'employee' | 'auxiliary';

// Entity data types
interface ClientEntity {
  id: number;
  nom: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  tags?: string[];
}

interface ServiceEntity {
  id: number;
  nom: string;
  prix: number;
  duree: number;
}

interface EmployeeEntity {
  id: number;
  nom: string;
  prenom: string;
  role?: string;
}

interface AuxiliaryEntity {
  type: 'client' | 'fournisseur' | 'personnel';
  compte: string;
  nom: string;
}

type EntityData = string | ClientEntity | ServiceEntity | EmployeeEntity | AuxiliaryEntity;

interface EntityLinkProps {
  type: EntityType;
  entity: EntityData;
  label: string;
  className?: string;
}

/**
 * Reusable component for clickable entity links that open detail modals
 *
 * Usage:
 * - Category: <EntityLink type="categorie" entity="fournitures" label="Fournitures" />
 * - Client: <EntityLink type="client" entity={{ id: 1, nom: 'Dupont', prenom: 'Jean' }} label="Jean Dupont" />
 * - Service: <EntityLink type="service" entity={{ id: 1, nom: 'Coupe', prix: 2500, duree: 30 }} label="Coupe" />
 * - Employee: <EntityLink type="employee" entity={{ id: 1, nom: 'Martin', prenom: 'Paul' }} label="Paul Martin" />
 * - Auxiliary: <EntityLink type="auxiliary" entity={{ type: 'client', id: 1, nom: 'Dupont' }} label="Dupont" />
 */
export function EntityLink({ type, entity, label, className = '' }: EntityLinkProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  const baseClassName = `text-cyan-600 hover:text-cyan-700 hover:underline cursor-pointer transition-colors ${className}`;

  // Category - string key
  if (type === 'categorie' && typeof entity === 'string') {
    return (
      <>
        <button onClick={handleClick} className={baseClassName}>
          {label}
        </button>
        {showModal && (
          <CategoryDetailModal
            categorie={entity}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // Client - requires client object
  if (type === 'client' && typeof entity === 'object' && 'id' in entity && 'nom' in entity) {
    const clientEntity = entity as ClientEntity;
    const clientObj: Client = {
      id: clientEntity.id,
      nom: clientEntity.nom,
      prenom: clientEntity.prenom || '',
      telephone: clientEntity.telephone || '',
      email: clientEntity.email || null,
      adresse: null,
      tags: clientEntity.tags || [],
      nb_rdv: 0,
      created_at: '',
    };

    return (
      <>
        <button onClick={handleClick} className={baseClassName}>
          {label}
        </button>
        {showModal && (
          <ClientDetailModal
            client={clientObj}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // Service - requires service object
  if (type === 'service' && typeof entity === 'object' && 'id' in entity && 'nom' in entity && 'prix' in entity) {
    const serviceEntity = entity as ServiceEntity;
    const serviceObj: Service = {
      id: serviceEntity.id,
      nom: serviceEntity.nom,
      description: null,
      prix: serviceEntity.prix,
      duree: serviceEntity.duree,
      actif: true,
    };

    return (
      <>
        <button onClick={handleClick} className={baseClassName}>
          {label}
        </button>
        {showModal && (
          <ServiceDetailModal
            service={serviceObj}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // Employee - requires employee object
  if (type === 'employee' && typeof entity === 'object' && 'id' in entity && 'nom' in entity && 'prenom' in entity) {
    const employeeEntity = entity as EmployeeEntity;

    return (
      <>
        <button onClick={handleClick} className={baseClassName}>
          {label}
        </button>
        {showModal && (
          <EmployeeDetailModal
            employee={{
              id: employeeEntity.id,
              nom: employeeEntity.nom,
              prenom: employeeEntity.prenom,
              role: employeeEntity.role,
            }}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // Auxiliary (accounting ledger) - requires type, compte, and name
  if (type === 'auxiliary' && typeof entity === 'object' && 'type' in entity && 'compte' in entity && 'nom' in entity) {
    const auxEntity = entity as AuxiliaryEntity;

    return (
      <>
        <button onClick={handleClick} className={baseClassName}>
          {label}
        </button>
        {showModal && (
          <AuxiliaryLedgerModal
            type={auxEntity.type}
            compte={auxEntity.compte}
            nom={auxEntity.nom}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // Fallback - just render the label as non-clickable text
  return <span className={className}>{label}</span>;
}

export default EntityLink;

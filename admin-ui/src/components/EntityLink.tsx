import { useState } from 'react';
import { CategoryDetailModal } from '@/components/modals/CategoryDetailModal';

// Types for different entities
interface ClientEntity {
  id: number;
  nom: string;
  prenom?: string;
}

interface EntityLinkProps {
  type: 'client' | 'service' | 'categorie';
  // For categories: string key
  // For clients: { id, nom, prenom? }
  entity: string | ClientEntity;
  label: string;
  className?: string;
}

/**
 * Reusable component for clickable entity links that open detail modals
 *
 * Usage:
 * - Category: <EntityLink type="categorie" entity="fournitures" label="Fournitures" />
 * - Client: <EntityLink type="client" entity={{ id: 1, nom: 'Dupont' }} label="Dupont" />
 */
export function EntityLink({ type, entity, label, className = '' }: EntityLinkProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  const baseClassName = `text-cyan-600 hover:text-cyan-700 hover:underline cursor-pointer transition-colors ${className}`;

  // For now, only category modals are fully implemented
  // Client and service modals require the full object from their respective pages
  if (type === 'categorie' && typeof entity === 'string') {
    return (
      <>
        <button
          onClick={handleClick}
          className={baseClassName}
        >
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

  // For clients and services, we just render the label for now
  // These would need dedicated modals that fetch by ID
  return <span className={className}>{label}</span>;
}

export default EntityLink;

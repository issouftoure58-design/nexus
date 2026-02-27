/**
 * Components Forms - Export centralisé
 *
 * Composants adaptatifs pour les formulaires multi-business
 */

// Champs conditionnels par feature
export { FeatureField, useFeatures } from './FeatureField';

// Champs conditionnels par type de business
export {
  BusinessTypeField,
  ServiceDomicileOnly,
  SalonOnly,
  RestaurantOnly,
  HotelOnly,
  ServiceBasedBusiness,
  BookingBasedBusiness,
} from './BusinessTypeField';

// Labels dynamiques avec terminologie
export {
  DynamicLabel,
  useTerminology,
  ReservationLabel,
  ServiceLabel,
  ClientLabel,
  EmployeeLabel,
} from './DynamicLabel';

// Champs de tarification adaptatifs
export { PricingFields, PriceDisplay } from './PricingFields';

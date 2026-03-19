/**
 * Service Factur-X (CII/EN 16931 BASIC)
 * Génère XML CII conforme embarqué dans PDF/A-3
 *
 * Obligatoire : sept 2026 (réception) / sept 2027 (émission)
 */

/**
 * Génère le XML CII (Cross Industry Invoice) profil BASIC
 */
export function generateCIIXml(facture, tenant) {
  if (!facture) throw new Error('facture requise');
  if (!tenant) throw new Error('tenant requis');

  const dateFormat = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  };

  const montantHT = ((facture.montant_ht || 0) / 100).toFixed(2);
  const montantTVA = ((facture.montant_tva || 0) / 100).toFixed(2);
  const montantTTC = ((facture.montant_ttc || facture.montant_ht || 0) / 100).toFixed(2);
  const tvaRate = facture.montant_ht > 0 ? ((facture.montant_tva || 0) / facture.montant_ht * 100).toFixed(2) : '20.00';

  const typeCode = facture.type === 'avoir' ? '381' : '380'; // 380=facture, 381=avoir

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(facture.numero || '')}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateFormat(facture.date_facture)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(tenant.name || '')}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(tenant.adresse || '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${tenant.siren ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">FR${tenant.siren.slice(0, 9)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(facture.client_nom || '')}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${facture.date_echeance ? `<ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dateFormat(facture.date_echeance)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${montantTVA}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${montantHT}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${tvaRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${montantHT}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${montantHT}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${montantTVA}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${montantTTC}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${montantTTC}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}

/**
 * Valide un XML CII
 */
export function validateCIIXml(xml) {
  const errors = [];

  if (!xml) {
    errors.push('XML vide');
    return { valid: false, errors };
  }

  // Vérifications basiques de structure
  const requiredElements = [
    'CrossIndustryInvoice',
    'ExchangedDocumentContext',
    'ExchangedDocument',
    'SupplyChainTradeTransaction',
    'SellerTradeParty',
    'BuyerTradeParty',
    'SpecifiedTradeSettlementHeaderMonetarySummation'
  ];

  requiredElements.forEach(elem => {
    if (!xml.includes(elem)) {
      errors.push(`Élément requis manquant : ${elem}`);
    }
  });

  // Vérifier profil
  if (!xml.includes('urn:factur-x.eu:1p0:basic')) {
    errors.push('Profil Factur-X non spécifié (expected: basic)');
  }

  // Vérifier TypeCode
  if (!xml.includes('<ram:TypeCode>380</ram:TypeCode>') && !xml.includes('<ram:TypeCode>381</ram:TypeCode>')) {
    errors.push('TypeCode manquant ou invalide (380=facture, 381=avoir)');
  }

  return {
    valid: errors.length === 0,
    errors,
    profile: 'BASIC'
  };
}

/**
 * Parse un XML Factur-X depuis une chaîne
 */
export function parseFacturXXml(xml) {
  if (!xml) return null;

  // Extraction basique sans dépendance xml2js
  const extract = (tag) => {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 's');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  };

  return {
    numero: extract('ram:ID'),
    typeCode: extract('ram:TypeCode'),
    sellerName: extractNested(xml, 'SellerTradeParty', 'ram:Name'),
    buyerName: extractNested(xml, 'BuyerTradeParty', 'ram:Name'),
    grandTotal: extract('ram:GrandTotalAmount'),
    taxTotal: extract('ram:TaxTotalAmount'),
    currency: extract('ram:InvoiceCurrencyCode'),
    profile: xml.includes('basic') ? 'BASIC' : xml.includes('minimum') ? 'MINIMUM' : 'UNKNOWN'
  };
}

// ─── Helpers ───

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractNested(xml, parent, child) {
  const parentRegex = new RegExp(`<ram:${parent}[^>]*>([\\s\\S]*?)</ram:${parent}>`, 's');
  const parentMatch = xml.match(parentRegex);
  if (!parentMatch) return null;

  const childRegex = new RegExp(`<${child}[^>]*>([^<]*)</${child}>`, 's');
  const childMatch = parentMatch[1].match(childRegex);
  return childMatch ? childMatch[1].trim() : null;
}

export default {
  generateCIIXml,
  validateCIIXml,
  parseFacturXXml
};

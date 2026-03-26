/**
 * Prospect Scraper Service
 * Scrape Google Places pour trouver des prospects par secteur/ville
 * Optionnel : scrape email depuis site web via Puppeteer
 */

import { Client } from '@googlemaps/google-maps-services-js';
import { upsertProspect } from './prospectionService.js';

const googleMapsClient = new Client({});
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Mapping secteur → queries Google Places
const SECTOR_QUERIES = {
  salon: ['salon de coiffure', 'coiffeur', 'barbier', 'salon de beaute', 'institut de beaute'],
  restaurant: ['restaurant', 'brasserie', 'bistrot', 'pizzeria', 'trattoria'],
  commerce: ['boutique', 'magasin', 'epicerie', 'boulangerie', 'patisserie'],
  hotel: ['hotel', 'chambre d\'hotes', 'auberge', 'residence hoteliere'],
  domicile: ['plombier', 'electricien', 'serrurier', 'aide a domicile', 'menage'],
  securite: ['societe de securite', 'gardiennage', 'surveillance', 'agent de securite'],
};

/**
 * Scrape Google Places pour un secteur et une ville
 * @returns {Object} { found, inserted, skipped, errors }
 */
export async function scrapeProspects(sector, city, { maxResults = 60 } = {}) {
  if (!API_KEY) throw new Error('GOOGLE_MAPS_API_KEY requis');
  if (!sector || !city) throw new Error('sector et city requis');

  const queries = SECTOR_QUERIES[sector];
  if (!queries) throw new Error(`Secteur inconnu: ${sector}. Valides: ${Object.keys(SECTOR_QUERIES).join(', ')}`);

  const results = { found: 0, inserted: 0, skipped: 0, errors: [] };

  for (const query of queries) {
    try {
      const places = await searchPlaces(`${query} ${city}`, maxResults);
      results.found += places.length;

      for (const place of places) {
        try {
          const details = await getPlaceDetails(place.place_id);
          const prospect = mapToProspect(details, sector);

          await upsertProspect(prospect);
          results.inserted++;
        } catch (err) {
          if (err.code === '23505') {
            // Duplicate place_id — already exists
            results.skipped++;
          } else {
            results.errors.push(`${place.name}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      results.errors.push(`Query "${query} ${city}": ${err.message}`);
    }
  }

  console.log(`[SCRAPER] ${sector}/${city}: found=${results.found} inserted=${results.inserted} skipped=${results.skipped}`);
  return results;
}

/**
 * Recherche Google Places Text Search
 */
async function searchPlaces(query, maxResults = 60) {
  const allPlaces = [];
  let pageToken = null;

  do {
    const params = {
      query,
      language: 'fr',
      region: 'fr',
      key: API_KEY,
    };
    if (pageToken) params.pagetoken = pageToken;

    const response = await googleMapsClient.textSearch({ params });
    const { results, next_page_token } = response.data;

    allPlaces.push(...results);
    pageToken = next_page_token;

    if (allPlaces.length >= maxResults) break;

    // Google requiert un delai avant d'utiliser next_page_token
    if (pageToken) await sleep(2000);
  } while (pageToken);

  return allPlaces.slice(0, maxResults);
}

/**
 * Details d'un lieu (phone, website, email)
 */
async function getPlaceDetails(placeId) {
  const response = await googleMapsClient.placeDetails({
    params: {
      place_id: placeId,
      fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'address_components', 'place_id'],
      language: 'fr',
      key: API_KEY,
    },
  });
  return response.data.result;
}

/**
 * Mapper Google Place → prospect DB
 */
function mapToProspect(place, sector) {
  const city = extractCity(place.address_components || []);
  const postalCode = extractPostalCode(place.address_components || []);

  return {
    place_id: place.place_id,
    name: place.name,
    sector,
    address: place.formatted_address,
    city: city || '',
    postal_code: postalCode || '',
    phone: place.formatted_phone_number || null,
    website: place.website || null,
    rating: place.rating || null,
    reviews_count: place.user_ratings_total || 0,
    source: 'google_places',
    status: 'new',
  };
}

function extractCity(components) {
  const comp = components.find(c => c.types.includes('locality'));
  return comp?.long_name || null;
}

function extractPostalCode(components) {
  const comp = components.find(c => c.types.includes('postal_code'));
  return comp?.long_name || null;
}

/**
 * Scrape email depuis le site web d'un prospect via HTTP fetch (pas de Puppeteer)
 */
export async function scrapeEmailFromWebsite(prospectId) {
  const { getProspectById, updateProspect } = await import('./prospectionService.js');
  const prospect = await getProspectById(prospectId);

  if (!prospect?.website) return { success: false, reason: 'no_website' };
  if (prospect.email) return { success: true, email: prospect.email, reason: 'already_has_email' };

  try {
    const baseUrl = prospect.website.replace(/\/$/, '');
    const urls = [
      baseUrl,
      `${baseUrl}/contact`,
      `${baseUrl}/mentions-legales`,
      `${baseUrl}/a-propos`,
      `${baseUrl}/about`,
    ];

    let foundEmail = null;

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NexusBot/1.0)',
            'Accept': 'text/html',
          },
          redirect: 'follow',
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const html = await response.text();
        const emails = extractEmails(html);
        if (emails.length > 0) {
          foundEmail = emails[0];
          break;
        }
      } catch {
        // Page inaccessible, continuer
      }
    }

    if (foundEmail) {
      await updateProspect(prospect.id, { email: foundEmail });
      return { success: true, email: foundEmail };
    }

    return { success: false, reason: 'no_email_found' };
  } catch (err) {
    console.error(`[SCRAPER] Email scrape error for ${prospect.name}:`, err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Scrape emails pour tous les prospects sans email d'une campagne
 */
export async function scrapeEmailsBatch({ sector, city, limit = 20 } = {}) {
  const { getProspects } = await import('./prospectionService.js');
  const { data: prospects } = await getProspects({ sector, city, hasEmail: false, limit });

  const results = { total: prospects.length, found: 0, failed: 0 };

  for (const prospect of prospects) {
    const result = await scrapeEmailFromWebsite(prospect.id);
    if (result.success && result.email) {
      results.found++;
    } else {
      results.failed++;
    }
    // Delai entre chaque visite
    await sleep(3000);
  }

  return results;
}

function extractEmails(html) {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(regex) || [];
  // Filtrer les faux positifs
  return [...new Set(matches)].filter(email =>
    !email.includes('example.com') &&
    !email.includes('wixpress') &&
    !email.includes('sentry') &&
    !email.endsWith('.png') &&
    !email.endsWith('.jpg')
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { scrapeProspects, scrapeEmailFromWebsite, scrapeEmailsBatch };

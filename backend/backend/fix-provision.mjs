import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
import { getBusinessTemplate } from './src/data/businessTemplates.js';

const tid = 'salon-style';
const template = getBusinessTemplate('salon_coiffure');

const servicesRows = template.defaultServices.map((s, i) => ({
  tenant_id: tid,
  nom: s.name,
  duree: s.duration,
  prix: Math.round(s.price * 100),
  categorie: s.category || 'general',
  actif: true,
  ordre: i,
}));

const { data, error } = await supabase.from('services').insert(servicesRows).select('id, nom');
if (error) console.log('ERROR:', error.message);
else console.log(data.length, 'services inseres');

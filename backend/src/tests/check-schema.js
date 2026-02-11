import '../config/env.js';
import { supabase } from '../config/supabase.js';

const { data: services } = await supabase.from('services').select('*').limit(1);
console.log('Services columns:', services?.[0] ? Object.keys(services[0]) : 'No data');

const { data: clients } = await supabase.from('clients').select('*').limit(1);
console.log('Clients columns:', clients?.[0] ? Object.keys(clients[0]) : 'No data');

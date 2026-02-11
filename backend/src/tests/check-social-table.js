import '../config/env.js';
import { supabase } from '../config/supabase.js';

// Check if social_posts table exists
const { data, error } = await supabase
  .from('social_posts')
  .select('*')
  .limit(1);

if (error) {
  console.log('Table status:', error.message);
  console.log('Need to create social_posts table');
} else {
  console.log('Table social_posts exists!');
  console.log('Sample data:', JSON.stringify(data, null, 2));
}

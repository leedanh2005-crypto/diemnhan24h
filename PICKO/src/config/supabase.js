const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://yzldtcwdqdyewvumozbr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_mdAUbJPsN0v5rcFEVGl4Wg_5xuk1_hE';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Thiếu biến môi trường Supabase URL hoặc Key');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

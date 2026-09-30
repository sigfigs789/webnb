import { createClient } from '@supabase/supabase-js'
import { createFixtureClient } from './fixtureClient'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// `npm run dev:fixtures` swaps Supabase for made-up data kept in the browser.
export const usingFixtures = import.meta.env.VITE_USE_FIXTURES === 'true'

export const supabase = usingFixtures ? createFixtureClient() : createClient(supabaseUrl, supabaseAnonKey)

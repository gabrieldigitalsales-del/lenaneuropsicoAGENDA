import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabase = Boolean(url && key && url.includes('supabase.co'))
export const supabase = hasSupabase ? createClient(url, key) : null

export type DataMode = 'demo' | 'supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Demo mode runs the full pipeline on built-in fixtures and needs no backend (used for GitHub Pages). */
export const dataMode: DataMode = import.meta.env.VITE_DATA_MODE ?? (url && anonKey ? 'supabase' : 'demo')

export const supabaseConfig = { url: url ?? '', anonKey: anonKey ?? '' }

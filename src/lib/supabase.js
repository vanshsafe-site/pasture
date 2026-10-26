import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()
let configError = ''
let client = null
try {
  if (!url || !key || url.includes('your-project') || key.includes('your-supabase')) throw new Error('Add your Supabase URL and publishable key to .env.local, then restart the development server. On Vercel, set them in Environment Variables and redeploy.')
  const parsed = new URL(url)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('The Supabase URL must start with https://.')
  if (key.startsWith('sb_secret_')) throw new Error('Use a publishable or anon key. A server secret must never be used in this app.')
  if (key.startsWith('eyJ')) {
    const payload = JSON.parse(atob(key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')))
    if (payload.role !== 'anon') throw new Error('Use the Supabase anon key, not a service role key.')
    if (payload.ref && !parsed.hostname.startsWith(`${payload.ref}.`)) throw new Error('The Supabase URL and API key belong to different projects.')
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: async (input, init = {}) => {
      const controller = new AbortController()
      const abort = () => controller.abort()
      if (init.signal?.aborted) controller.abort()
      init.signal?.addEventListener('abort', abort, { once: true })
      const timeout = setTimeout(abort, 20000)
      try { return await fetch(input, { ...init, signal: controller.signal }) }
      finally { clearTimeout(timeout); init.signal?.removeEventListener('abort', abort) }
    } },
  })
} catch (error) { configError = error.message }

export { client as supabase, configError }

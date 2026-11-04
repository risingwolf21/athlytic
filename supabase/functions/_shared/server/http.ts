export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Shared wrapper: CORS preflight, POST-only, JSON body parsing and uniform error responses. */
export function handle(fn: (req: Request, body: Record<string, unknown>) => Promise<unknown>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      return json(await fn(req, body ?? {}))
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error(error)
      return json({ error: 'Internal error' }, 500)
    }
  }
}

import { authenticate, createServiceClient } from '../_shared/server/context.ts'
import { handle } from '../_shared/server/http.ts'

/** Deletes the stored credentials and marks the connection as disconnected. Imported data is kept. */
Deno.serve(
  handle(async (req) => {
    const db = createServiceClient()
    const userId = await authenticate(req, db)
    const { data: connection } = await db.from('provider_connections').select('id').eq('user_id', userId).eq('provider', 'garmin').maybeSingle()
    if (!connection) return { ok: true }
    await db.from('provider_credentials').delete().eq('connection_id', connection.id)
    await db.from('provider_connections').update({ status: 'disconnected', sync_state: 'idle', cursor: {}, last_error: null }).eq('id', connection.id)
    return { ok: true }
  }),
)

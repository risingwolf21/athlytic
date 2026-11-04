import { authenticate, createServiceClient } from '../_shared/server/context.ts'
import { encryptSecret } from '../_shared/server/crypto.ts'
import { HttpError, handle } from '../_shared/server/http.ts'
import { createGarminClient } from '../_shared/server/provider-factory.ts'
import { GarminProvider } from '../_shared/garmin/provider.ts'

/** Stores a Garmin API token (encrypted) after verifying it against the Garmin API. The token never reaches the browser again. */
Deno.serve(
  handle(async (req, body) => {
    const db = createServiceClient()
    const userId = await authenticate(req, db)
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (token.length < 8 || token.length > 4096) throw new HttpError(400, 'Invalid token')

    let externalUserId: string
    try {
      ;({ externalUserId } = await new GarminProvider(createGarminClient(token)).verify())
    } catch {
      throw new HttpError(400, 'Garmin did not accept this token')
    }

    const { data: connection, error } = await db
      .from('provider_connections')
      .upsert(
        { user_id: userId, provider: 'garmin', status: 'connected', external_user_id: externalUserId, sync_state: 'idle', last_error: null },
        { onConflict: 'user_id,provider' },
      )
      .select('id')
      .single()
    if (error || !connection) throw new Error(error?.message ?? 'Could not save connection')

    const { ciphertext, iv } = await encryptSecret(token)
    const { error: credentialError } = await db
      .from('provider_credentials')
      .upsert({ connection_id: connection.id, user_id: userId, ciphertext, iv, key_version: 1 }, { onConflict: 'connection_id' })
    if (credentialError) throw new Error(credentialError.message)
    return { ok: true }
  }),
)

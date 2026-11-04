import { FixtureGarminClient } from '../garmin/fixtures.ts'
import { HttpGarminClient } from '../garmin/client.ts'
import { GarminProvider } from '../garmin/provider.ts'
import type { GarminClient } from '../garmin/types.ts'
import type { DataProvider } from '../provider.ts'
import { decryptSecret } from './crypto.ts'
import type { Db } from './context.ts'
import { HttpError } from './http.ts'

export const garminMode = (): 'fixture' | 'live' => (Deno.env.get('GARMIN_MODE') === 'live' ? 'live' : 'fixture')

export function createGarminClient(token: string): GarminClient {
  if (garminMode() === 'fixture') return new FixtureGarminClient()
  const baseUrl = Deno.env.get('GARMIN_API_BASE_URL')
  if (!baseUrl) throw new Error('GARMIN_API_BASE_URL is not configured')
  return new HttpGarminClient({ baseUrl, apiKey: token })
}

/** Builds the provider for a stored connection by decrypting its credentials. */
export async function providerForConnection(db: Db, connectionId: string): Promise<DataProvider> {
  const { data, error } = await db.from('provider_credentials').select('ciphertext, iv').eq('connection_id', connectionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new HttpError(409, 'Garmin is not connected')
  const token = await decryptSecret(data.ciphertext as string, data.iv as string)
  return new GarminProvider(createGarminClient(token))
}

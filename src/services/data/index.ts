import { createDemoRepository } from './demo.ts'
import { createSupabaseRepository } from '@/services/supabase/repository'
import { dataMode } from '@/lib/env'
import type { FitnessRepository } from './repository.ts'

export const repository: FitnessRepository = dataMode === 'supabase' ? createSupabaseRepository() : createDemoRepository()

export { queryKeys } from './repository.ts'

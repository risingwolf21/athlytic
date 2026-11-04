import { QueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@shared/domain.ts'
import { queryKeys } from './repository.ts'
import { repository } from './index.ts'

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // Must be at least as long as the persister's maxAge, otherwise restored entries are garbage collected.
      gcTime: WEEK_MS,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export const MUTATION_KEYS = {
  saveProfile: ['save-profile'] as const,
  saveNotes: ['save-activity-notes'] as const,
}

/**
 * Mutation functions are registered as defaults so that mutations queued while offline can be resumed after
 * the app was closed and reopened (a persisted mutation only stores its variables, not its function).
 */
queryClient.setMutationDefaults(MUTATION_KEYS.saveProfile, {
  mutationFn: (profile: UserProfile) => repository.saveProfile(profile),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
})

queryClient.setMutationDefaults(MUTATION_KEYS.saveNotes, {
  mutationFn: (vars: { activityId: string; notes: string }) => repository.saveActivityNotes(vars.activityId, vars.notes),
  onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: queryKeys.activityDetail(vars.activityId) }),
})

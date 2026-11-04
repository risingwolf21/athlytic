import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Activity, NormalizedBundle, SyncKind, UserProfile } from '@shared/domain.ts'
import { DEFAULT_PROFILE } from '@shared/domain.ts'
import { buildDailyRecords, generateInsights, latestDataDate, type DailyRecord, type Insight } from '@/analytics'
import { MUTATION_KEYS } from '@/services/data/query-client'
import { queryKeys, repository } from '@/services/data'

export function useBundle() {
  return useQuery({ queryKey: queryKeys.bundle, queryFn: () => repository.loadBundle() })
}

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => repository.loadProfile() })
}

export interface FitnessData {
  isLoading: boolean
  isError: boolean
  error: Error | null
  bundle: NormalizedBundle | null
  profile: UserProfile
  records: DailyRecord[]
  activities: Activity[]
  insights: Insight[]
  /** Latest day that has device data. */
  today: string | null
  /** The record for `today`. */
  latest: DailyRecord | null
}

const EMPTY: DailyRecord[] = []

/** All derived analytics for the signed-in user. Calculation happens in `src/analytics`; this only wires it to React. */
export function useFitnessData(): FitnessData {
  const bundleQuery = useBundle()
  const profileQuery = useProfile()
  const bundle = bundleQuery.data ?? null
  const profile = profileQuery.data ?? DEFAULT_PROFILE

  const records = useMemo(() => (bundle ? buildDailyRecords({ bundle, profile }) : EMPTY), [bundle, profile])
  const activities = useMemo(() => (bundle ? [...bundle.activities].sort((a, b) => b.startTime.localeCompare(a.startTime)) : []), [bundle])
  const insights = useMemo(() => (records.length ? generateInsights(records, activities) : []), [records, activities])
  const today = useMemo(() => latestDataDate(records), [records])
  const latest = useMemo(() => (today ? (records.find((r) => r.date === today) ?? null) : null), [records, today])

  return {
    isLoading: bundleQuery.isPending,
    isError: bundleQuery.isError,
    error: bundleQuery.error,
    bundle,
    profile,
    records,
    activities,
    insights,
    today,
    latest,
  }
}

export function useActivityDetail(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.activityDetail(activityId ?? ''),
    queryFn: () => repository.loadActivityDetail(activityId as string),
    enabled: !!activityId,
    staleTime: 60 * 60 * 1000,
  })
}

export function useSyncStatus() {
  return useQuery({ queryKey: queryKeys.syncStatus, queryFn: () => repository.loadSyncStatus() })
}

export function useSaveProfile() {
  return useMutation<void, Error, UserProfile>({ mutationKey: MUTATION_KEYS.saveProfile })
}

export function useSaveNotes() {
  return useMutation<void, Error, { activityId: string; notes: string }>({ mutationKey: MUTATION_KEYS.saveNotes })
}

export function useConnectGarmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => repository.connectGarmin(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus }),
  })
}

export function useDisconnectGarmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repository.disconnectGarmin(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus }),
  })
}

/** Runs sync slices until the backend reports it is done (the historical import is resumable and time-boxed). */
export function useSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (kind: SyncKind) => {
      for (let slice = 0; slice < 200; slice++) {
        const { done } = await repository.sync(kind)
        await queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus })
        if (done) return
      }
    },
    onSettled: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.bundle }), queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus })])
    },
  })
}

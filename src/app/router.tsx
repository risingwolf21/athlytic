import { lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { PageSkeleton } from '@/components/page'
import { useAuthStore } from '@/stores/auth'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const ActivitiesPage = lazy(() => import('@/features/activities/ActivitiesPage'))
const ActivityDetailPage = lazy(() => import('@/features/activities/ActivityDetailPage'))
const RecoveryPage = lazy(() => import('@/features/recovery/RecoveryPage'))
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'))
const MetricDetailPage = lazy(() => import('@/features/analytics/MetricDetailPage'))
const InsightsPage = lazy(() => import('@/features/insights/InsightsPage'))
const InsightDetailPage = lazy(() => import('@/features/insights/InsightDetailPage'))
const MethodsPage = lazy(() => import('@/features/insights/MethodsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))

function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'loading') return <PageSkeleton />
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <DashboardPage /> },
            { path: 'analytics', element: <AnalyticsPage /> },
            { path: 'analytics/:metric', element: <MetricDetailPage /> },
            { path: 'activities', element: <ActivitiesPage /> },
            { path: 'activities/:id', element: <ActivityDetailPage /> },
            { path: 'recovery', element: <RecoveryPage /> },
            { path: 'insights', element: <InsightsPage /> },
            { path: 'insights/methods', element: <MethodsPage /> },
            { path: 'insights/:id', element: <InsightDetailPage /> },
            { path: 'settings', element: <SettingsPage /> },
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)

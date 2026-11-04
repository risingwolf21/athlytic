import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import './i18n'
import { AppProviders } from '@/app/providers'
import { registerServiceWorker } from '@/app/pwa'
import { router } from '@/app/router'
import { PageSkeleton } from '@/components/page'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <Suspense fallback={<PageSkeleton />}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  </StrictMode>,
)

registerServiceWorker()

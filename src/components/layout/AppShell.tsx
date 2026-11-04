import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { PageSkeleton } from '@/components/page'
import { BottomNav, SideNav } from '@/components/layout/Navigation'
import { ConnectionBanner, UpdatePrompt } from '@/components/layout/Status'

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-dvh">
      <SideNav />
      <div className="lg:pl-60">
        <div className="sticky top-0 z-30 bg-background/85 pt-safe backdrop-blur-xl">
          <ConnectionBanner />
        </div>
        <main className="mx-auto w-full max-w-3xl pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] lg:max-w-5xl lg:px-8 lg:pb-12">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <BottomNav />
      <UpdatePrompt />
    </div>
  )
}

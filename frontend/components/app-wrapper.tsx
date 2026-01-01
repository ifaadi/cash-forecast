'use client'

import { SharedHeader } from '@/components/shared-header'
import { HeaderProvider } from '@/components/header-context'

export function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <HeaderProvider>
      <SharedHeader />
      <main className="min-h-screen bg-gray-50">
        {children}
      </main>
    </HeaderProvider>
  )
}

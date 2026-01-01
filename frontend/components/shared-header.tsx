'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { useHeader } from '@/components/header-context'

export function SharedHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { panicModeHandler } = useHeader()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Don't show header on login page
  if (pathname === '/' || !user) {
    return null
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/actuals-vs-forecast', label: 'Actuals vs Forecast' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/chat', label: 'Ask CFO' },
  ]

  return (
    <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💰 CFO Cash Command</h1>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
          <div className="flex gap-3">
            {pathname === '/dashboard' && panicModeHandler && (
              <Button
                onClick={panicModeHandler}
                className="bg-red-600 hover:bg-red-700 text-white font-bold animate-pulse"
                size="sm"
              >
                <AlertTriangle className="h-5 w-5 mr-2" />
                🚨 PANIC MODE
              </Button>
            )}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-2 border-t pt-4 flex-wrap">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} prefetch={true}>
                <Button
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                >
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

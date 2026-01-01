import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppWrapper } from '@/components/app-wrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CFO Cash Command Center',
  description: 'AI-Enabled 13-Week Cash Forecasting',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  )
}

'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface HeaderContextType {
  panicModeHandler: (() => void) | null
  setPanicModeHandler: (handler: (() => void) | null) => void
}

const HeaderContext = createContext<HeaderContextType>({
  panicModeHandler: null,
  setPanicModeHandler: () => {},
})

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [panicModeHandler, setPanicModeHandler] = useState<(() => void) | null>(null)

  return (
    <HeaderContext.Provider value={{ panicModeHandler, setPanicModeHandler }}>
      {children}
    </HeaderContext.Provider>
  )
}

export function useHeader() {
  return useContext(HeaderContext)
}

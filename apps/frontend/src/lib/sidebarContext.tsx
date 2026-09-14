import { createContext, useContext, useState } from 'react'

interface SidebarCtx {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, setCollapsed: () => {} })

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return <Ctx.Provider value={{ collapsed, setCollapsed }}>{children}</Ctx.Provider>
}

export function useSidebar() {
  return useContext(Ctx)
}

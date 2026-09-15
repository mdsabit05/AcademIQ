import { createContext, useContext, useState, useEffect } from 'react'

const TopBarContext = createContext<{
  hidden: boolean
  setHidden: (v: boolean) => void
}>({ hidden: false, setHidden: () => {} })

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)
  return (
    <TopBarContext.Provider value={{ hidden, setHidden }}>
      {children}
    </TopBarContext.Provider>
  )
}

export function useTopBar() {
  return useContext(TopBarContext)
}

/** Call this in a page to hide the mobile top bar while a condition is true */
export function useHideMobileTopBar(condition: boolean) {
  const { setHidden } = useTopBar()
  useEffect(() => {
    setHidden(condition)
    return () => setHidden(false)
  }, [condition, setHidden])
}

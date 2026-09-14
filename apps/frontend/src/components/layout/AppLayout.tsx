import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.tsx'
import TopBar from './TopBar.tsx'
import { SidebarProvider } from '../../lib/sidebarContext.tsx'

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { AdminProvider, useAdmin } from './auth'
import AdminLogin from './Login'
import ProvidersPage from '@/pages/providers'
import ListingsPage from './Listings'
import BookingsPage from './Bookings'
import DestinationCoversPage from './DestinationCovers'
import { Button } from '@/components/ui/button'

function Guard({ children }) {
  const { ready, user, isAdmin } = useAdmin()
  if (!ready) return <div className="p-6">Loading…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function SidebarLayout({ children }) {
  const { signOut } = useAdmin()
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r">
        <div className="p-4 font-extrabold text-teal-700">WadaTrip Admin</div>
        <nav className="p-2 space-y-1">
          <Link to="/admin/providers" className="block px-3 py-2 rounded hover:bg-gray-100">Providers</Link>
          <Link to="/admin/listings" className="block px-3 py-2 rounded hover:bg-gray-100">Listings</Link>
          <Link to="/admin/destination-covers" className="block px-3 py-2 rounded hover:bg-gray-100">Destination Covers</Link>
          <Link to="/admin/bookings" className="block px-3 py-2 rounded hover:bg-gray-100">Bookings</Link>
        </nav>
        <div className="p-4 mt-auto">
          <Button variant="outline" className="w-full" onClick={() => signOut()}>Sign out</Button>
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  )
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="providers" element={<Guard><SidebarLayout><ProvidersPage /></SidebarLayout></Guard>} />
        <Route path="listings" element={<Guard><SidebarLayout><ListingsPage /></SidebarLayout></Guard>} />
        <Route path="destination-covers" element={<Guard><SidebarLayout><DestinationCoversPage /></SidebarLayout></Guard>} />
        <Route path="bookings" element={<Guard><SidebarLayout><BookingsPage /></SidebarLayout></Guard>} />
        <Route path="" element={<Navigate to="/admin/providers" replace />} />
        <Route path="*" element={<Navigate to="/admin/providers" replace />} />
      </Routes>
    </AdminProvider>
  )
}

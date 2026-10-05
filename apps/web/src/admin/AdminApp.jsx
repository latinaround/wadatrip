import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { AdminProvider, useAdmin } from './auth'
import AdminLogin from './Login'
import ProvidersPage from '@/pages/providers'
import ListingsPage from './Listings'
import BookingsPage from './Bookings'
import DestinationCoversPage from './DestinationCovers'
import OperatorLeadsPage from './OperatorLeads'
import AdminRecords from './Records'
import { Button } from '@/components/ui/button'

function Guard({ children }) {
  const { ready, user, isAdmin, verified } = useAdmin()
  if (!ready) return <div className="p-6">Loading…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isAdmin || !verified) return <Navigate to="/admin/login" replace />
  return children
}

function SidebarLayout({ children }) {
  const { signOut } = useAdmin()
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-56 md:shrink-0 bg-white border-r">
        <div className="p-4 font-extrabold text-teal-700">WadaTrip Admin</div>
        <nav className="p-2 space-y-1">
          <Link to="/admin/users" className="block px-3 py-2 rounded hover:bg-gray-100">Usuarios</Link>
          <Link to="/admin/date-requests" className="block px-3 py-2 rounded hover:bg-gray-100">Solicitudes de fechas</Link>
          <Link to="/admin/payment-issues" className="block px-3 py-2 rounded hover:bg-gray-100">Incidencias de pagos</Link>
          <Link to="/admin/audit" className="block px-3 py-2 rounded hover:bg-gray-100">Bitácora administrativa</Link>
          <Link to="/admin/providers" className="block px-3 py-2 rounded hover:bg-gray-100">Providers</Link>
          <Link to="/admin/providers?status=pending" className="block px-3 py-2 rounded bg-amber-50 text-amber-900 hover:bg-amber-100">Pending Guide Approvals</Link>
          <Link to="/admin/listings" className="block px-3 py-2 rounded hover:bg-gray-100">Listings</Link>
          <Link to="/admin/listings?status=draft" className="block px-3 py-2 rounded bg-sky-50 text-sky-900 hover:bg-sky-100">Draft Tours</Link>
          <Link to="/admin/operator-leads" className="block px-3 py-2 rounded hover:bg-gray-100">Operator Leads</Link>
          <Link to="/admin/destination-covers" className="block px-3 py-2 rounded hover:bg-gray-100">Destination Covers</Link>
          <Link to="/admin/bookings" className="block px-3 py-2 rounded hover:bg-gray-100">Bookings</Link>
        </nav>
        <div className="p-4 mt-auto">
          <Button variant="outline" className="w-full" onClick={() => signOut()}>Sign out</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        {['users', 'date-requests', 'payment-issues', 'audit'].map(view => <Route key={view} path={view} element={<Guard><SidebarLayout><AdminRecords key={view} view={view} /></SidebarLayout></Guard>} />)}
        <Route path="providers" element={<Guard><SidebarLayout><ProvidersPage /></SidebarLayout></Guard>} />
        <Route path="listings" element={<Guard><SidebarLayout><ListingsPage /></SidebarLayout></Guard>} />
        <Route path="operator-leads" element={<Guard><SidebarLayout><OperatorLeadsPage /></SidebarLayout></Guard>} />
        <Route path="destination-covers" element={<Guard><SidebarLayout><DestinationCoversPage /></SidebarLayout></Guard>} />
        <Route path="bookings" element={<Guard><SidebarLayout><BookingsPage /></SidebarLayout></Guard>} />
        <Route path="" element={<Navigate to="/admin/users" replace />} />
        <Route path="*" element={<Navigate to="/admin/users" replace />} />
      </Routes>
    </AdminProvider>
  )
}

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL, authFetch } from '../utils/api'
import { Link } from 'react-router-dom'

/* ── SVG Icon Components ── */
const Icons = {
  rides: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
    </svg>
  ),
  wrench: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  dollar: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  ticket: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  utensils: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  ),
  gift: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  ),
  target: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  chart: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  alert: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  arrow: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
}

export default function Home() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    try {
      const ridesRes = await fetch(`${API_BASE_URL}/api/rides?all=true`)
      const rides = await ridesRes.json()

      const maintRes = await fetch(`${API_BASE_URL}/api/maintenance`)
      const maintenance = await maintRes.json()

      const empRes = await fetch(`${API_BASE_URL}/api/employees`)
      const employees = await empRes.json()

      const restRes = await fetch(`${API_BASE_URL}/api/park-ops/restaurants`)
      const restaurants = await restRes.json()

      const shopRes = await fetch(`${API_BASE_URL}/api/park-ops/gift-shops`)
      const shops = await shopRes.json()

      const gameRes = await fetch(`${API_BASE_URL}/api/park-ops/games`)
      const games = await gameRes.json()

      let ticketStats = null
      if (["manager", "admin"].includes(user?.role)) {
        try {
          const ticketRes = await authFetch(`${API_BASE_URL}/api/tickets/all-purchases`)
          if (ticketRes.ok) {
            const ticketData = await ticketRes.json()
            ticketStats = ticketData.totals
          }
        } catch (err) {
          console.error("Failed to fetch ticket stats:", err)
        }
      }

      setStats({
        rides: {
          total: rides.length,
          operational: rides.filter(r => r.status === "Operational").length,
          maintenance: rides.filter(r => r.status === "Maintenance").length,
          closed: rides.filter(r => r.status === "Closed" || r.status === "Decommissioned").length,
        },
        maintenance: {
          total: maintenance.length,
          pending: maintenance.filter(m => m.status === "Pending").length,
          inProgress: maintenance.filter(m => m.status === "In Progress").length,
          completed: maintenance.filter(m => m.status === "Completed").length,
          critical: maintenance.filter(m => m.priority === "Critical" && m.status !== "Completed").length,
        },
        employees: {
          total: employees.length,
          managers: employees.filter(e => e.role === "manager").length,
          staff: employees.filter(e => e.role === "staff").length,
        },
        venues: {
          restaurants: Array.isArray(restaurants) ? restaurants.length : 0,
          restaurantsOpen: Array.isArray(restaurants) ? restaurants.filter(r => r.operational_status === 1).length : 0,
          shops: Array.isArray(shops) ? shops.length : 0,
          games: Array.isArray(games) ? games.length : 0,
          gamesOpen: Array.isArray(games) ? games.filter(g => g.operational_status === 1).length : 0,
        },
        tickets: ticketStats,
      })
    } catch (err) {
      console.error("Error fetching stats:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Loading dashboard data...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  const isManager = ["manager", "admin"].includes(user?.role)

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, <span className="font-medium text-gray-700">{user?.full_name || user?.email?.split("@")[0]}</span>
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-md bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white uppercase tracking-wide">
          {user?.role}
        </span>
      </div>

      {/* ── Critical Alert Banner ── */}
      {stats?.maintenance?.critical > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="mt-0.5 text-red-600">{Icons.alert}</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">
              {stats.maintenance.critical} Critical Maintenance {stats.maintenance.critical === 1 ? "Request" : "Requests"}
            </h3>
            <p className="mt-0.5 text-sm text-red-700">
              Affected rides have been automatically closed for safety. Immediate attention required.
            </p>
          </div>
          <Link to="/dashboard/maintenance" className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
            View
          </Link>
        </div>
      )}

      {/* ── Primary KPIs ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Icons.rides}
            iconBg="bg-emerald-50 text-emerald-600"
            label="Rides Operational"
            value={`${stats?.rides?.operational || 0} / ${stats?.rides?.total || 0}`}
            sub={stats?.rides?.closed > 0 ? `${stats.rides.closed} closed` : "All systems operational"}
          />
          <StatCard
            icon={Icons.wrench}
            iconBg={stats?.maintenance?.critical > 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}
            label="Maintenance Queue"
            value={stats?.maintenance?.pending || 0}
            sub={`${stats?.maintenance?.inProgress || 0} in progress  ·  ${stats?.maintenance?.completed || 0} completed`}
            badge={stats?.maintenance?.critical > 0 ? `${stats.maintenance.critical} critical` : null}
          />
          {isManager && stats?.tickets && (
            <StatCard
              icon={Icons.dollar}
              iconBg="bg-blue-50 text-blue-600"
              label="Total Revenue"
              value={`$${Number(stats.tickets.total_revenue || 0).toLocaleString()}`}
              sub={`${stats.tickets.total_tickets || 0} tickets  ·  ${stats.tickets.total_transactions || 0} orders`}
            />
          )}
          {isManager && !stats?.tickets && (
            <StatCard
              icon={Icons.ticket}
              iconBg="bg-gray-50 text-gray-400"
              label="Ticket Sales"
              value="--"
              sub="No ticket data available"
            />
          )}
          <StatCard
            icon={Icons.users}
            iconBg="bg-violet-50 text-violet-600"
            label="Total Staff"
            value={stats?.employees?.total || 0}
            sub={`${stats?.employees?.managers || 0} managers  ·  ${stats?.employees?.staff || 0} staff`}
          />
        </div>
      </section>

      {/* ── Park Venues ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Park Venues</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={Icons.utensils}
            iconBg="bg-orange-50 text-orange-600"
            label="Restaurants"
            value={`${stats?.venues?.restaurantsOpen || 0} / ${stats?.venues?.restaurants || 0}`}
            sub="Currently open"
          />
          <StatCard
            icon={Icons.gift}
            iconBg="bg-pink-50 text-pink-600"
            label="Gift Shops"
            value={stats?.venues?.shops || 0}
            sub="Retail locations"
          />
          <StatCard
            icon={Icons.target}
            iconBg="bg-teal-50 text-teal-600"
            label="Games"
            value={`${stats?.venues?.gamesOpen || 0} / ${stats?.venues?.games || 0}`}
            sub="Currently open"
          />
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/dashboard/rides" icon={Icons.rides} label="Manage Rides" desc="View and edit ride status" />
          <QuickLink to="/dashboard/maintenance" icon={Icons.wrench} label="Maintenance" desc="Requests, closures, and alerts" />
          <QuickLink to="/dashboard/dining-shops" icon={Icons.utensils} label="Dining & Shops" desc="Restaurants, shops, games" />
          {isManager && (
            <QuickLink to="/dashboard/analytics" icon={Icons.chart} label="Analytics" desc="Reports and data insights" />
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, iconBg, label, value, sub, badge }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${iconBg}`}>
          {icon}
        </span>
        {badge && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function QuickLink({ to, icon, label, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-[#C8102E] hover:shadow-md transition-all"
    >
      <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-gray-50 text-gray-500 group-hover:bg-[#C8102E]/10 group-hover:text-[#C8102E] transition-colors">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <span className="text-gray-300 group-hover:text-[#C8102E] transition-colors">
        {Icons.arrow}
      </span>
    </Link>
  )
}

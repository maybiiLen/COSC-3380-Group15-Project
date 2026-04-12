import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../utils/api'
import { Link } from 'react-router-dom'

export default function Home() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    try {
      const token = localStorage.getItem("accessToken")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // Fetch rides
      const ridesRes = await fetch(`${API_BASE_URL}/api/rides?all=true`)
      const rides = await ridesRes.json()

      // Fetch maintenance
      const maintRes = await fetch(`${API_BASE_URL}/api/maintenance`)
      const maintenance = await maintRes.json()

      // Fetch employees
      const empRes = await fetch(`${API_BASE_URL}/api/employees`)
      const employees = await empRes.json()

      // Fetch restaurants, gift shops, games
      const restRes = await fetch(`${API_BASE_URL}/api/park-ops/restaurants`)
      const restaurants = await restRes.json()

      const shopRes = await fetch(`${API_BASE_URL}/api/park-ops/gift-shops`)
      const shops = await shopRes.json()

      const gameRes = await fetch(`${API_BASE_URL}/api/park-ops/games`)
      const games = await gameRes.json()

      // Fetch ticket data if manager/admin
      let ticketStats = null
      if (["manager", "admin"].includes(user?.role)) {
        try {
          const ticketRes = await fetch(`${API_BASE_URL}/api/tickets/all-purchases`, { headers })
          const ticketData = await ticketRes.json()
          if (ticketRes.ok) ticketStats = ticketData.totals
        } catch {}
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-4 text-gray-400">Loading dashboard data...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Welcome back, {user?.email?.split("@")[0]}
        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[#C8102E] text-white uppercase">
          {user?.role}
        </span>
      </p>

      {/* ─── Primary Stats ─── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="🎢" label="Rides Operational" value={`${stats?.rides?.operational || 0} / ${stats?.rides?.total || 0}`}
          sub={stats?.rides?.closed > 0 ? `${stats.rides.closed} closed` : "All systems go"} color="green" />

        <StatCard icon="🔧" label="Maintenance" value={stats?.maintenance?.pending || 0}
          sub={`${stats?.maintenance?.inProgress || 0} in progress · ${stats?.maintenance?.completed || 0} done`}
          color={stats?.maintenance?.critical > 0 ? "red" : "yellow"}
          alert={stats?.maintenance?.critical > 0 ? `${stats.maintenance.critical} CRITICAL` : null} />

        {["manager", "admin"].includes(user?.role) && stats?.tickets && (
          <StatCard icon="💰" label="Total Revenue" value={`$${Number(stats.tickets.total_revenue || 0).toLocaleString()}`}
            sub={`${stats.tickets.total_tickets || 0} tickets · ${stats.tickets.total_transactions || 0} orders`} color="blue" />
        )}
        {["manager", "admin"].includes(user?.role) && !stats?.tickets && (
          <StatCard icon="🎟️" label="Tickets" value="—" sub="No ticket data yet" color="gray" />
        )}

        <StatCard icon="👥" label="Staff" value={stats?.employees?.total || 0}
          sub={`${stats?.employees?.managers || 0} managers · ${stats?.employees?.staff || 0} staff`} color="purple" />
      </div>

      {/* ─── Park Venues ─── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon="🍔" label="Restaurants" value={`${stats?.venues?.restaurantsOpen || 0} / ${stats?.venues?.restaurants || 0} open`}
          sub="Dining locations" color="orange" />
        <StatCard icon="🎁" label="Gift Shops" value={stats?.venues?.shops || 0}
          sub="Retail locations" color="pink" />
        <StatCard icon="🎯" label="Games" value={`${stats?.venues?.gamesOpen || 0} / ${stats?.venues?.games || 0} open`}
          sub="Attractions & activities" color="teal" />
      </div>

      {/* ─── Quick Links ─── */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/dashboard/rides" icon="🎢" label="Manage Rides" desc="View and edit ride status" />
          <QuickLink to="/dashboard/maintenance" icon="🔧" label="Maintenance" desc="View requests and closures" />
          <QuickLink to="/dashboard/dining-shops" icon="🍔" label="Dining & Shops" desc="Restaurants, shops, games, merch" />
          {["manager", "admin"].includes(user?.role) && (
            <QuickLink to="/dashboard/analytics" icon="📊" label="Analytics" desc="Reports and data insights" />
          )}
        </div>
      </div>

      {/* ─── Critical Alerts ─── */}
      {stats?.maintenance?.critical > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-bold text-red-800">⚠️ Critical Maintenance Alerts</h3>
          <p className="mt-1 text-sm text-red-700">
            {stats.maintenance.critical} critical maintenance request(s) require immediate attention. Affected rides have been automatically closed for safety.
          </p>
          <Link to="/dashboard/maintenance" className="mt-2 inline-block text-sm font-medium text-red-600 hover:underline">
            View Maintenance →
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, alert }) {
  const colors = {
    green: "border-green-200", blue: "border-blue-200", red: "border-red-200",
    yellow: "border-yellow-200", purple: "border-purple-200", orange: "border-orange-200",
    pink: "border-pink-200", teal: "border-teal-200", gray: "border-gray-200",
  }
  return (
    <div className={`rounded-xl border ${colors[color] || "border-gray-200"} bg-white p-5 shadow-sm`}>
      <div className="flex justify-between items-start">
        <div className="text-2xl">{icon}</div>
        {alert && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">{alert}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function QuickLink({ to, icon, label, desc }) {
  return (
    <Link to={to} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-[#C8102E] hover:shadow-md transition-all block">
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </Link>
  )
}
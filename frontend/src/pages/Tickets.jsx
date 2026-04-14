import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL, authFetch } from "../utils/api"

export default function Tickets() {
  const { user } = useAuth()
  const [data, setData] = useState({ details: [], summary: [], totals: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState({ ticket_type: "", start_date: "", end_date: "" })

  async function fetchPurchases() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (filters.ticket_type) params.set("ticket_type", filters.ticket_type)
      if (filters.start_date) params.set("start_date", filters.start_date)
      if (filters.end_date) params.set("end_date", filters.end_date)

      const res = await authFetch(`${API_BASE_URL}/api/tickets/all-purchases?${params}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        setError(json.message || "Failed to load ticket data")
      }
    } catch (err) {
      console.error("Error:", err)
      setError("Could not connect to server")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPurchases() }, [])

  async function handleExportCSV() {
    const params = new URLSearchParams({ format: "csv" })
    if (filters.ticket_type) params.set("ticket_type", filters.ticket_type)
    if (filters.start_date) params.set("start_date", filters.start_date)
    if (filters.end_date) params.set("end_date", filters.end_date)

    const res = await authFetch(`${API_BASE_URL}/api/tickets/all-purchases?${params}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "ticket-purchases.csv"; a.click()
  }

  const t = data.totals

  return (
    <div>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Sales</h1>
          <p className="mt-1 text-sm text-gray-500">All ticket purchase transactions</p>
        </div>
        <button onClick={handleExportCSV} className="px-4 py-2 text-sm font-medium bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer">
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      {t && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">${Number(t.total_revenue || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Tickets Sold</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{t.total_tickets || 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Transactions</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{t.total_transactions || 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Avg Transaction</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">${t.avg_transaction || 0}</p>
          </div>
        </div>
      )}

      {/* Summary by type (Carl's drill-down: click to see breakdown) */}
      {data.summary.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.summary.map(s => (
            <div key={s.ticket_type} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer hover:border-[#C8102E] transition-colors"
              onClick={() => { setFilters({ ...filters, ticket_type: s.ticket_type }); setTimeout(fetchPurchases, 100) }}
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{s.ticket_type}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{s.total_tickets} tickets</p>
              <p className="text-sm text-gray-500">${Number(s.subtotal_revenue || 0).toLocaleString()} revenue · {s.total_transactions} orders</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ticket Type</label>
          <select value={filters.ticket_type} onChange={e => setFilters({ ...filters, ticket_type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
            <option value="">All Types</option>
            <option value="General Admission">General Admission</option>
            <option value="Season Pass">Season Pass</option>
            <option value="VIP Experience">VIP Experience</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" value={filters.start_date} onChange={e => setFilters({ ...filters, start_date: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" value={filters.end_date} onChange={e => setFilters({ ...filters, end_date: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
        </div>
        <button onClick={fetchPurchases} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 cursor-pointer">
          Apply Filters
        </button>
        {(filters.ticket_type || filters.start_date || filters.end_date) && (
          <button onClick={() => { setFilters({ ticket_type: "", start_date: "", end_date: "" }); setTimeout(fetchPurchases, 100) }}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
            Clear
          </button>
        )}
      </div>

      {/* Transactions table */}
      <table className="w-full text-sm mt-6">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Adults</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Children</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Total</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Card</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
          )}
          {!loading && error && (
            <tr><td colSpan="8" className="px-4 py-6 text-center text-red-500">{error}</td></tr>
          )}
          {!loading && !error && data.details.length === 0 && (
            <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-400">No transactions found. Try adjusting your filters or check back later.</td></tr>
          )}
          {data.details.map(d => (
            <tr key={d.purchase_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">#{d.purchase_id}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{d.customer_name}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${d.ticket_type === "General Admission" ? "bg-blue-100 text-blue-700" : ""}
                  ${d.ticket_type === "Season Pass" ? "bg-purple-100 text-purple-700" : ""}
                  ${d.ticket_type === "VIP Experience" ? "bg-amber-100 text-amber-700" : ""}
                `}>{d.ticket_type}</span>
              </td>
              <td className="px-4 py-3 text-gray-600">{d.adult_qty}</td>
              <td className="px-4 py-3 text-gray-600">{d.child_qty}</td>
              <td className="px-4 py-3 font-medium text-gray-900">${Number(d.total_price).toFixed(2)}</td>
              <td className="px-4 py-3 text-gray-400">{d.card_last_four ? `••••${d.card_last_four}` : "—"}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(d.purchase_date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
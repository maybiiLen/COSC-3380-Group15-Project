import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../utils/api'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'

// Chart palette — red family + complementary tones for categorical series
const CHART_COLORS = ['#C8102E', '#8C1D40', '#F59E0B', '#10B981', '#3B82F6', '#A855F7', '#EC4899']
const AXIS_COLOR = '#6B7280'
const GRID_COLOR = '#E5E7EB'
const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
}

const REPORTS = [
  { id: 'maintenance', label: 'Maintenance Report', desc: 'Maintenance requests by ride, employee, closures, and alerts' },
  { id: 'ticketSales', label: 'Ticket Sales Report', desc: 'Ticket purchases, revenue, and customer data' },
  { id: 'rideOperations', label: 'Ride Operations Report', desc: 'Ride dispatches, guest throughput, operator performance, and rejection rates' },
]

export default function Analytics() {
  const { user } = useAuth()
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [rides, setRides] = useState([])
  const [employees, setEmployees] = useState([])
  const [ticketTypes, setTicketTypes] = useState([])

  const [filters, setFilters] = useState({
    ride_id: '', employee_id: '', status: '', priority: '',
    ticket_type: '', customer_email: '', start_date: '', end_date: '',
  })

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides?all=true`).then(r => r.json()).then(d => setRides(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API_BASE_URL}/api/employees`).then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API_BASE_URL}/api/tickets/types`).then(r => r.json()).then(d => setTicketTypes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  function resetFilters() {
    setFilters({ ride_id: '', employee_id: '', status: '', priority: '', ticket_type: '', customer_email: '', start_date: '', end_date: '' })
    setShowResults(false)
    setReportData(null)
      }

  async function viewReport() {
    if (!selectedReport) return
    setLoading(true)
    setShowResults(false)

    const endpoint = selectedReport === 'maintenance' ? 'maintenance'
      : selectedReport === 'ticketSales' ? 'ticket-sales'
      : 'ride-operations'

    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/${endpoint}?${params}`)
      const data = await res.json()
      setReportData(data)
      setShowResults(true)
    } catch {
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  async function saveAsCSV() {
    if (!selectedReport) return
    const endpoint = selectedReport === 'maintenance' ? 'maintenance'
      : selectedReport === 'ticketSales' ? 'ticket-sales'
      : 'ride-operations'

    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.set('format', 'csv')

    const res = await fetch(`${API_BASE_URL}/api/reports/${endpoint}?${params}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedReport}-report.csv`
    a.click()
  }

  if (!["manager", "admin"].includes(user?.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">Only managers and administrators can access reports.</p>
        </div>
      </div>
    )
  }

  const reportInfo = REPORTS.find(r => r.id === selectedReport)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <p className="mt-1 text-sm text-gray-500">Select a report, set your filters, and click View Report</p>

      {/* Report Selection */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => { setSelectedReport(r.id); setShowResults(false); setReportData(null) }}
            className={`text-left p-4 rounded-xl border cursor-pointer transition-all ${
              selectedReport === r.id
                ? 'border-[#C8102E] bg-red-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <p className={`text-sm font-bold ${selectedReport === r.id ? 'text-[#C8102E]' : 'text-gray-900'}`}>{r.label}</p>
            <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Filter Fields */}
      {selectedReport && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{reportInfo?.label}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Ride filter — maintenance, rideOperations */}
            {['maintenance', 'rideOperations'].includes(selectedReport) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ride</label>
                <select value={filters.ride_id} onChange={e => setFilters({...filters, ride_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">All Rides</option>
                  {rides.map(r => <option key={r.ride_id} value={r.ride_id}>{r.ride_name}</option>)}
                </select>
              </div>
            )}

            {/* Employee filter — maintenance, rideOperations (operator) */}
            {['maintenance', 'rideOperations'].includes(selectedReport) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{selectedReport === 'rideOperations' ? 'Operator' : 'Employee'}</label>
                <select value={filters.employee_id} onChange={e => setFilters({...filters, employee_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">{selectedReport === 'rideOperations' ? 'All Operators' : 'All Employees'}</option>
                  {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}
                </select>
              </div>
            )}

            {/* Status filter — maintenance */}
            {selectedReport === 'maintenance' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            )}

            {/* Priority filter — maintenance */}
            {selectedReport === 'maintenance' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <select value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">All Priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            )}

            {/* Ticket type filter — ticketSales (loaded from DB) */}
            {selectedReport === 'ticketSales' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ticket Type</label>
                <select value={filters.ticket_type} onChange={e => setFilters({...filters, ticket_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">All Types</option>
                  {ticketTypes.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer email filter — ticketSales */}
            {selectedReport === 'ticketSales' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Customer Email</label>
                <input type="text" placeholder="Search by email..." value={filters.customer_email}
                  onChange={e => setFilters({...filters, customer_email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
              </div>
            )}

            {/* Date range — label reflects what the date actually filters on for each report */}
            {(() => {
              const dateLabel =
                selectedReport === 'maintenance'    ? 'Request Creation Date' :
                selectedReport === 'ticketSales'    ? 'Ticket Purchased Date' :
                selectedReport === 'rideOperations' ? 'Dispatch Date' :
                'Date'
              return (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{dateLabel} From</label>
                    <input type="date" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{dateLabel} To</label>
                    <input type="date" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
                  </div>
                </>
              )
            })()}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button onClick={viewReport} disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer disabled:opacity-50">
              {loading ? 'Loading...' : 'View Report'}
            </button>
            {showResults && (
              <button onClick={saveAsCSV}
                className="px-6 py-2.5 text-sm font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-700 cursor-pointer flex items-center gap-1">
                Save As CSV
              </button>
            )}
            <button onClick={resetFilters}
              className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* REPORT RESULTS — only shown after View Report is clicked */}
      {/* ═══════════════════════════════════════════ */}
      {showResults && reportData && (
        <div className="mt-6 space-y-6">

          {/* ─── Maintenance Report Results ─── */}
          {selectedReport === 'maintenance' && (
            <>
              <MaintenanceCharts data={reportData} />
              <ReportTable title="Maintenance Summary by Ride" columns={['Ride', 'Total', 'Pending', 'In Progress', 'Completed', 'Completion %', 'Avg Hours', 'Min Hours', 'Max Hours', 'Total Downtime', 'Employees', 'Closure Related', 'Alerts']}
                rows={reportData.summary?.map(r => [r.ride_name, r.total_requests, r.pending, r.in_progress, r.completed, `${r.completion_rate_pct}%`, r.avg_hours_to_complete ?? '—', r.min_hours ?? '—', r.max_hours ?? '—', `${r.total_downtime_hours ?? '—'}h`, r.distinct_employees, r.closure_related, r.total_alerts])}
                totals={reportData.totals ? ['TOTAL', reportData.totals.total_requests, reportData.totals.pending, reportData.totals.in_progress, reportData.totals.completed, `${reportData.totals.completion_rate_pct}%`, reportData.totals.avg_hours_to_complete ?? '—', reportData.totals.min_hours ?? '—', reportData.totals.max_hours ?? '—', `${reportData.totals.total_downtime_hours ?? '—'}h`, reportData.totals.distinct_employees, reportData.totals.closure_related, reportData.totals.total_alerts] : null} />
              <ReportTable title="Maintenance Detail" columns={['ID', 'Ride', 'Description', 'Priority', 'Status', 'Assigned To', 'Request Date', 'Completed At', 'Hours to Complete', 'Zone Closed', 'Closure Type', 'Alerts']}
                rows={reportData.details?.map(r => [`#${r.request_id}`, r.ride_name, r.description, r.priority, r.status, r.assigned_to, new Date(r.request_date).toLocaleDateString(), r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—', r.hours_to_complete ?? '—', r.zone_was_closed ? 'Yes' : 'No', r.closure_type || '—', r.alerts_sent])} />
            </>
          )}

          {/* ─── Ticket Sales Report Results ─── */}
          {selectedReport === 'ticketSales' && (
            <>
              <TicketSalesCharts data={reportData} />
              <ReportTable title="Sales by Ticket Type" columns={['Type', 'Category', 'Fast Pass', 'Price', 'Sold', 'Revenue', 'Revenue %', 'Customers', 'Orders', 'Avg Order']}
                rows={reportData.byType?.map(r => [r.ticket_type, r.ticket_category || '—', r.fast_pass ? 'Yes' : 'No', `$${Number(r.price).toFixed(2)}`, r.tickets_sold, `$${Number(r.subtotal_revenue).toLocaleString()}`, `${r.revenue_share_pct}%`, r.distinct_customers, r.total_transactions, `$${Number(r.avg_transaction).toFixed(2)}`])}
                totals={reportData.totals ? ['TOTAL', '', '', '', reportData.totals.total_tickets, `$${Number(reportData.totals.total_revenue || 0).toLocaleString()}`, `${reportData.totals.revenue_share_pct}%`, reportData.totals.distinct_customers, reportData.totals.total_transactions, `$${Number(reportData.totals.avg_price || 0).toFixed(2)}`] : null} />
              <ReportTable title="Transaction Details" columns={['ID', 'Customer', 'Email', 'Phone', 'Type', 'Category', 'Fast Pass', 'Adults', 'Children', 'Adult Price', 'Child Price', 'Total', 'Visit Date', 'Purchased']}
                rows={reportData.details?.map(r => [`#${r.purchase_id}`, r.customer_name, r.customer_email || '—', r.customer_phone || '—', r.ticket_type, r.ticket_category || '—', r.fast_pass ? 'Yes' : 'No', r.adult_qty, r.child_qty, `$${Number(r.unit_price_adult).toFixed(2)}`, `$${Number(r.unit_price_child).toFixed(2)}`, `$${Number(r.total_price).toFixed(2)}`, r.visit_date ? new Date(r.visit_date).toLocaleDateString() : '—', new Date(r.purchase_date).toLocaleDateString()])} />
            </>
          )}

          {/* ─── Ride Operations Report Results ─── */}
          {selectedReport === 'rideOperations' && (
            <>
              <RideOperationsCharts data={reportData} />
              <ReportTable title="Throughput by Ride" columns={['Ride', 'Zone', 'Dispatches', 'Guests Served', 'Avg Guests/Run', 'Avg Cycle (s)', 'Min Cycle', 'Max Cycle', 'Operating Hrs', 'Operators', 'Rejections', 'Rejection %']}
                rows={reportData.summary?.map(r => [r.ride_name, r.ride_zone, r.total_dispatches, r.total_guests_served, r.avg_guests_per_dispatch ?? '—', r.avg_cycle_seconds ?? '—', r.min_cycle_seconds ?? '—', r.max_cycle_seconds ?? '—', `${r.total_operating_hours ?? '—'}h`, r.distinct_operators, r.rejection_count, `${r.rejection_rate_pct ?? 0}%`])}
                totals={reportData.totals ? ['TOTAL', `${reportData.totals.distinct_rides} rides`, reportData.totals.total_dispatches, reportData.totals.total_guests_served, reportData.totals.avg_guests_per_dispatch ?? '—', reportData.totals.avg_cycle_seconds ?? '—', '', '', `${reportData.totals.total_operating_hours ?? '—'}h`, reportData.totals.distinct_operators, reportData.totals.total_rejections, `${reportData.totals.rejection_rate_pct ?? 0}%`] : null} />
              <ReportTable title="Operator Performance" columns={['Operator', 'Role', 'Dispatches Run', 'Guests Served', 'Avg Guests/Run', 'Operating Hrs', 'Rides Operated']}
                rows={reportData.operatorSummary?.map(r => [r.operator_name, r.operator_role, r.dispatches_run, r.total_guests_served, r.avg_guests_per_dispatch ?? '—', `${r.total_operating_hours ?? '—'}h`, r.distinct_rides_operated])} />
              <ReportTable title="Dispatch Details" columns={['ID', 'Dispatched At', 'Ride', 'Zone', 'Operator', 'Role', 'Guests', 'Cycle (s)', 'Cycle (min)', 'Notes']}
                rows={reportData.details?.map(r => [`#${r.dispatch_id}`, new Date(r.dispatched_at).toLocaleString(), r.ride_name, r.ride_zone, r.operator_name, r.operator_role, r.guest_count, r.cycle_duration_s ?? '—', r.cycle_duration_min ?? '—', r.dispatch_notes || '—'])} />
            </>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Reusable Report Table Component ───
function ReportTable({ title, columns, rows, totals }) {
  if (!rows || rows.length === 0) return null
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-medium text-gray-900' : 'text-gray-600'} max-w-xs truncate`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {totals && (
              <tr className="bg-blue-50 font-semibold">
                {totals.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-sm text-gray-900">{cell}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Chart Card wrapper ───────────────────────────────
function ChartCard({ title, children, height = 280 }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-3">{title}</h3>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  )
}

function ChartEmpty() {
  return <div className="h-full flex items-center justify-center text-xs text-gray-400">No data for this chart yet.</div>
}

// ─── Maintenance Charts ───────────────────────────────
function MaintenanceCharts({ data }) {
  const byRide = useMemo(() => {
    return (data.summary || []).map(r => ({ name: r.ride_name, value: Number(r.total_requests || 0) }))
  }, [data])

  const priorityStatus = useMemo(() => {
    const priorities = ['Critical', 'High', 'Medium', 'Low']
    return priorities.map(p => {
      const subset = (data.details || []).filter(d => d.priority === p)
      return {
        name: p,
        Pending: subset.filter(d => d.status === 'Pending').length,
        'In Progress': subset.filter(d => d.status === 'In Progress').length,
        Completed: subset.filter(d => d.status === 'Completed').length,
      }
    })
  }, [data])

  const overTime = useMemo(() => {
    const byDay = new Map()
    ;(data.details || []).forEach(d => {
      const k = (d.request_date || '').slice(0, 10)
      if (!k) return
      byDay.set(k, (byDay.get(k) || 0) + 1)
    })
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-30)
      .map(([date, count]) => ({ date: date.slice(5), count }))
  }, [data])

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3">Charts</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Maintenance by Ride">
          {byRide.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRide} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: AXIS_COLOR, fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="By Priority × Status">
          {priorityStatus.every(r => r.Pending + r['In Progress'] + r.Completed === 0) ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityStatus} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#4B5563' }} />
                <Bar dataKey="Pending" stackId="a" fill={CHART_COLORS[0]} />
                <Bar dataKey="In Progress" stackId="a" fill={CHART_COLORS[2]} />
                <Bar dataKey="Completed" stackId="a" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mb-6">
        <ChartCard title="Maintenance Over Time (last 30 days)" height={240}>
          {overTime.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="count" name="Requests" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[0] }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Ticket Sales Charts ──────────────────────────────
function TicketSalesCharts({ data }) {
  const byType = useMemo(() => {
    return (data.byType || []).map(r => ({ name: r.ticket_type, value: Number(r.tickets_sold || 0) }))
  }, [data])

  const revenueOverTime = useMemo(() => {
    const byDay = new Map()
    ;(data.details || []).forEach(d => {
      const k = (d.purchase_date || '').slice(0, 10)
      if (!k) return
      byDay.set(k, (byDay.get(k) || 0) + Number(d.total_price || 0))
    })
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-30)
      .map(([date, revenue]) => ({ date: date.slice(5), revenue: Number(revenue.toFixed(2)) }))
  }, [data])

  // Daily gate-demand forecast: adults + children by visit_date.
  // This is the canonical theme-park operations analytic — ops, staffing,
  // and ride queuing teams all work off a chart exactly like this.
  const gateDemand = useMemo(() => {
    const byDay = new Map()
    ;(data.details || []).forEach(d => {
      const k = (d.visit_date || '').slice(0, 10)
      if (!k) return
      const row = byDay.get(k) || { adults: 0, children: 0 }
      row.adults   += Number(d.adult_qty || 0)
      row.children += Number(d.child_qty || 0)
      byDay.set(k, row)
    })
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-30)
      .map(([date, { adults, children }]) => ({
        date: date.slice(5),        // MM-DD
        Adults: adults,
        Children: children,
      }))
  }, [data])

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3">Charts</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Tickets Sold by Type">
          {byType.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#4B5563' }} verticalAlign="bottom" height={32} />
                <Pie data={byType} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="#FFFFFF" strokeWidth={2}>
                  {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Gate Demand by Visit Date (Adults + Children)">
          {gateDemand.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gateDemand} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Adults"   stackId="a" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Children" stackId="a" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      <div className="mb-6">
        <ChartCard title="Revenue Over Time (last 30 days)" height={240}>
          {revenueOverTime.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="revenue" name="Revenue ($)" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[0] }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Ride Operations Charts ───────────────────────────
function RideOperationsCharts({ data }) {
  // Dispatches per day — a line per top-5 rides by dispatch count
  const dispatchSeries = useMemo(() => {
    const rideCounts = new Map()
    ;(data.details || []).forEach(d => {
      rideCounts.set(d.ride_name, (rideCounts.get(d.ride_name) || 0) + 1)
    })
    const topRides = [...rideCounts.entries()].sort(([, a], [, b]) => b - a).slice(0, 5).map(([n]) => n)

    const byDay = new Map()
    ;(data.details || []).forEach(d => {
      if (!topRides.includes(d.ride_name)) return
      const k = (d.dispatched_at || '').slice(0, 10)
      if (!k) return
      if (!byDay.has(k)) byDay.set(k, { date: k.slice(5) })
      const row = byDay.get(k)
      row[d.ride_name] = (row[d.ride_name] || 0) + 1
    })
    return {
      rows: [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
      rides: topRides,
    }
  }, [data])

  // Rejections by ride (proxy for "by code" since detail data doesn't carry code)
  const rejectionsByRide = useMemo(() => {
    return (data.summary || [])
      .filter(r => r.rejection_count > 0)
      .map(r => ({ name: r.ride_name, value: Number(r.rejection_count || 0) }))
  }, [data])

  // Operator hours — horizontal bar
  const operatorHours = useMemo(() => {
    return (data.operatorSummary || [])
      .map(r => ({ label: r.operator_name, value: Number(r.total_operating_hours || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [data])

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3">Charts</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Dispatches per Day (top 5 rides)">
          {dispatchSeries.rows.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dispatchSeries.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#4B5563' }} />
                {dispatchSeries.rides.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Rejections by Ride">
          {rejectionsByRide.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#4B5563' }} verticalAlign="bottom" height={32} />
                <Pie data={rejectionsByRide} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="#FFFFFF" strokeWidth={2}>
                  {rejectionsByRide.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mb-6">
        <ChartCard title="Operator Hours (top 10)">
          {operatorHours.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operatorHours} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={120} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="value" name="Operating Hours" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
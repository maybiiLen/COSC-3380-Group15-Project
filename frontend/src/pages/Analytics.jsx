import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../utils/api'

const REPORTS = [
  { id: 'maintenance', label: 'Maintenance Report', desc: 'Maintenance requests by ride and employee', tables: ['maintenance_requests', 'rides', 'employees'] },
  { id: 'rideUsage', label: 'Ride Usage Report', desc: 'Ride activity, visitor counts, and wait times', tables: ['rides', 'ride_usage', 'maintenance_requests'] },
  { id: 'ticketSales', label: 'Ticket Sales Report', desc: 'Ticket purchases, revenue, and customer data', tables: ['ticket_purchases', 'customers', 'ticket_types'] },
  { id: 'employeeActivity', label: 'Employee Activity Report', desc: 'Employee task assignments and performance', tables: ['employees', 'maintenance_requests', 'rides'] },
]

export default function Analytics() {
  const { user } = useAuth()
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showRawTables, setShowRawTables] = useState(false)
  const [rides, setRides] = useState([])
  const [employees, setEmployees] = useState([])
  const [ticketTypes, setTicketTypes] = useState([])

  const [filters, setFilters] = useState({
    ride_id: '', employee_id: '', status: '', priority: '',
    ticket_type: '', customer_name: '', start_date: '', end_date: '',
  })

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides?all=true`).then(r => r.json()).then(d => setRides(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API_BASE_URL}/api/employees`).then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API_BASE_URL}/api/tickets/types`).then(r => r.json()).then(d => setTicketTypes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  function resetFilters() {
    setFilters({ ride_id: '', employee_id: '', status: '', priority: '', ticket_type: '', customer_name: '', start_date: '', end_date: '' })
    setShowResults(false)
    setReportData(null)
    setShowRawTables(false)
  }

  async function viewReport() {
    if (!selectedReport) return
    setLoading(true)
    setShowResults(false)

    const endpoint = selectedReport === 'maintenance' ? 'maintenance'
      : selectedReport === 'rideUsage' ? 'ride-usage'
      : selectedReport === 'ticketSales' ? 'ticket-sales'
      : 'employee-activity'

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
      : selectedReport === 'rideUsage' ? 'ride-usage'
      : selectedReport === 'ticketSales' ? 'ticket-sales'
      : 'employee-activity'

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
      <h1 className="text-2xl font-bold text-gray-900">Report Request</h1>
      <p className="mt-1 text-sm text-gray-500">Select a report, set your filters, and click View Report</p>

      {/* Report Selection */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => { setSelectedReport(r.id); setShowResults(false); setReportData(null); setShowRawTables(false) }}
            className={`text-left p-4 rounded-xl border cursor-pointer transition-all ${
              selectedReport === r.id
                ? 'border-[#C8102E] bg-red-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <p className={`text-sm font-bold ${selectedReport === r.id ? 'text-[#C8102E]' : 'text-gray-900'}`}>{r.label}</p>
            <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
            <p className="text-xs text-gray-400 mt-2">Tables: {r.tables.join(', ')}</p>
          </button>
        ))}
      </div>

      {/* Filter Fields */}
      {selectedReport && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{reportInfo?.label}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Ride filter — maintenance, rideUsage */}
            {['maintenance', 'rideUsage'].includes(selectedReport) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ride</label>
                <select value={filters.ride_id} onChange={e => setFilters({...filters, ride_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">All Rides</option>
                  {rides.map(r => <option key={r.ride_id} value={r.ride_id}>{r.ride_name}</option>)}
                </select>
              </div>
            )}

            {/* Employee filter — maintenance, employeeActivity */}
            {['maintenance', 'employeeActivity'].includes(selectedReport) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
                <select value={filters.employee_id} onChange={e => setFilters({...filters, employee_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]">
                  <option value="">All Employees</option>
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

            {/* Priority filter — maintenance, employeeActivity */}
            {['maintenance', 'employeeActivity'].includes(selectedReport) && (
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

            {/* Customer name filter — ticketSales */}
            {selectedReport === 'ticketSales' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Customer Name</label>
                <input type="text" placeholder="Search by name..." value={filters.customer_name}
                  onChange={e => setFilters({...filters, customer_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
              </div>
            )}

            {/* Date range — all reports */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Activity Date From</label>
              <input type="date" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Activity Date To</label>
              <input type="date" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8102E]" />
            </div>
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
                💾 Save As CSV
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

          {/* Tables Used Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500">Tables used:</span>
            {(reportData.tables_used || reportInfo?.tables || []).map(t => (
              <span key={t} className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{t}</span>
            ))}
          </div>

          {/* ─── Maintenance Report Results ─── */}
          {selectedReport === 'maintenance' && (
            <>
              <ReportTable title="Maintenance Summary by Ride" columns={['Ride', 'Total', 'Pending', 'In Progress', 'Completed', 'Completion %', 'Avg Hours', 'Downtime']}
                rows={reportData.summary?.map(r => [r.ride_name, r.total_requests, r.pending, r.in_progress, r.completed, `${r.completion_rate_pct}%`, r.avg_hours_to_complete ?? '—', `${r.total_downtime_hours ?? '—'}h`])}
                totals={reportData.totals ? ['TOTAL', reportData.totals.total_requests, reportData.totals.pending, reportData.totals.in_progress, reportData.totals.completed, `${reportData.totals.completion_rate_pct}%`, reportData.totals.avg_hours_to_complete ?? '—', `${reportData.totals.total_downtime_hours ?? '—'}h`] : null} />
              <ReportTable title="Maintenance Detail" columns={['ID', 'Ride', 'Description', 'Priority', 'Status', 'Assigned To', 'Date']}
                rows={reportData.details?.map(r => [`#${r.request_id}`, r.ride_name, r.description, r.priority, r.status, r.assigned_to, new Date(r.request_date).toLocaleDateString()])} />
            </>
          )}

          {/* ─── Ride Usage Report Results ─── */}
          {selectedReport === 'rideUsage' && (
            <>
              <ReportTable title="Usage by Zone" columns={['Zone', 'Rides', 'Total Rides', 'Visitors', 'Rides/Visitor', 'Avg Wait', 'Fast Pass %']}
                rows={reportData.byZone?.map(r => [r.zone_name, r.rides_in_zone, r.total_rides, r.unique_customers, r.rides_per_visitor, `${r.avg_wait_time} min`, `${r.fast_pass_percentage}%`])}
                totals={reportData.totals ? ['TOTAL', reportData.totals.total_ride_count, reportData.totals.total_rides, reportData.totals.unique_customers, reportData.totals.rides_per_visitor, `${reportData.totals.avg_wait_time} min`, `${reportData.totals.fast_pass_percentage}%`] : null} />
              <ReportTable title="Usage by Ride" columns={['Ride', 'Zone', 'Status', 'Total Rides', 'Visitors', 'Utilization %', 'Maintenance']}
                rows={reportData.byRide?.map(r => [r.ride_name, r.location, r.status, r.total_rides, r.unique_customers, `${r.utilization_pct}%`, r.maintenance_requests])} />
            </>
          )}

          {/* ─── Ticket Sales Report Results ─── */}
          {selectedReport === 'ticketSales' && (
            <>
              <ReportTable title="Sales by Ticket Type" columns={['Type', 'Category', 'Fast Pass', 'Price', 'Sold', 'Revenue', 'Revenue %', 'Customers', 'Orders', 'Avg Order']}
                rows={reportData.byType?.map(r => [r.ticket_type, r.ticket_category || '—', r.fast_pass ? 'Yes' : 'No', `$${Number(r.price).toFixed(2)}`, r.tickets_sold, `$${Number(r.subtotal_revenue).toLocaleString()}`, `${r.revenue_share_pct}%`, r.distinct_customers, r.total_transactions, `$${Number(r.avg_transaction).toFixed(2)}`])}
                totals={reportData.totals ? ['TOTAL', '', '', '', reportData.totals.total_tickets, `$${Number(reportData.totals.total_revenue || 0).toLocaleString()}`, '100%', reportData.totals.distinct_customers, reportData.totals.total_transactions, `$${Number(reportData.totals.avg_price || 0).toFixed(2)}`] : null} />
              <ReportTable title="Transaction Details" columns={['ID', 'Customer', 'Email', 'Type', 'Category', 'Adults', 'Children', 'Total', 'Visit Date', 'Purchased']}
                rows={reportData.details?.map(r => [`#${r.purchase_id}`, r.customer_name, r.customer_email || '—', r.ticket_type, r.ticket_category || '—', r.adult_qty, r.child_qty, `$${Number(r.total_price).toFixed(2)}`, r.visit_date || '—', new Date(r.purchase_date).toLocaleDateString()])} />
            </>
          )}

          {/* ─── Employee Activity Report Results ─── */}
          {selectedReport === 'employeeActivity' && (
            <>
              <ReportTable title="Employee Summary" columns={['Employee', 'Role', 'Total Tasks', 'Completed', 'In Progress', 'Pending', 'Completion %', 'Avg Hours', 'Rides Serviced']}
                rows={reportData.summary?.map(r => [r.employee_name, r.employee_role, r.total_tasks, r.completed_tasks, r.in_progress_tasks, r.pending_tasks, `${r.completion_rate}%`, r.avg_hours_to_complete ?? '—', r.rides_serviced])}
                totals={reportData.totals ? ['TOTAL', '', reportData.totals.total_tasks, reportData.totals.completed, reportData.totals.in_progress, reportData.totals.pending, `${reportData.totals.completion_rate}%`, reportData.totals.avg_hours ?? '—', reportData.totals.rides_serviced] : null} />
              <ReportTable title="Task Details" columns={['Employee', 'Role', 'Ride', 'Zone', 'Task', 'Priority', 'Status', 'Assigned', 'Hours']}
                rows={reportData.details?.map(r => [r.employee_name, r.employee_role, r.ride_name, r.ride_zone, r.task_description, r.priority, r.status, new Date(r.assigned_date).toLocaleDateString(), r.hours_to_complete ?? '—'])} />
            </>
          )}

          {/* ─── RAW TABLE DATA ─── */}
          <div className="mt-4">
            <button onClick={() => setShowRawTables(!showRawTables)}
              className="text-sm font-medium text-[#C8102E] hover:underline cursor-pointer">
              {showRawTables ? 'Hide' : 'Show'} Source Tables Used ({(reportData.tables_used || []).join(', ')})
            </button>

            {showRawTables && reportData.raw_tables && (
              <div className="mt-4 space-y-6">
                {Object.entries(reportData.raw_tables).map(([tableName, rows]) => (
                  <div key={tableName}>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">
                      Table: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{tableName}</code>
                      <span className="text-xs text-gray-400 ml-2">({rows.length} rows shown)</span>
                    </h4>
                    {rows.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              {Object.keys(rows[0]).map(col => (
                                <th key={col} className="px-3 py-2 text-left font-medium text-gray-500 border-b">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {rows.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-3 py-1.5 text-gray-600 border-b max-w-xs truncate">
                                    {val === null ? <span className="text-gray-300">NULL</span>
                                      : typeof val === 'boolean' ? (val ? 'true' : 'false')
                                      : String(val).length > 50 ? String(val).slice(0, 50) + '...'
                                      : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No data in this table</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
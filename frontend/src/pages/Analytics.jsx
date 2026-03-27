import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../utils/api'

export default function Analytics() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('maintenance')
  const [maintenanceReports, setMaintenanceReports] = useState({ details: [], summary: [], totals: null })
  const [rideUsageReports, setRideUsageReports] = useState({ byRide: [], byZone: [], totals: null })
  const [ticketSalesReports, setTicketSalesReports] = useState({ byType: [], totals: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    maintenance: { ride_id: '', status: '', priority: '', start_date: '', end_date: '' },
    rideUsage: { ride_id: '', start_date: '', end_date: '' },
    ticketSales: { start_date: '', end_date: '' }
  })

  const [rides, setRides] = useState([])

  useEffect(() => {
    fetchRides()
  }, [])

  useEffect(() => {
    fetchReports()
  }, [activeTab])

  async function fetchRides() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides`)
      const data = await res.json()
      setRides(data)
    } catch (err) {
      console.error('Error fetching rides:', err)
    }
  }

  async function fetchReports() {
    setLoading(true)
    setError('')

    try {
      let url = `${API_BASE_URL}/api/reports/${activeTab === 'maintenance' ? 'maintenance' : activeTab === 'rideUsage' ? 'ride-usage' : 'ticket-sales'}`
      const params = new URLSearchParams()

      Object.entries(filters[activeTab]).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      if (params.toString()) url += `?${params.toString()}`

      const res = await fetch(url)
      const data = await res.json()

      if (activeTab === 'maintenance') {
        setMaintenanceReports(data)
      } else if (activeTab === 'rideUsage') {
        setRideUsageReports(data)
      } else {
        setTicketSalesReports(data)
      }
    } catch (err) {
      setError('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  async function exportToCSV() {
    try {
      let url = `${API_BASE_URL}/api/reports/${activeTab === 'maintenance' ? 'maintenance' : activeTab === 'rideUsage' ? 'ride-usage' : 'ticket-sales'}`
      const params = new URLSearchParams()

      Object.entries(filters[activeTab]).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      params.append('format', 'csv')

      url += `?${params.toString()}`

      const res = await fetch(url)
      const csvContent = await res.text()

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${activeTab}-report.csv`
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError('Failed to export CSV')
    }
  }

  function updateFilter(key, value) {
    setFilters(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: value }
    }))
  }

  function renderFilters() {
    const currentFilters = filters[activeTab]

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activeTab !== 'ticketSales' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ride</label>
              <select
                value={currentFilters.ride_id || ''}
                onChange={(e) => updateFilter('ride_id', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Rides</option>
                {rides.map(ride => (
                  <option key={ride.ride_id} value={ride.ride_id}>{ride.ride_name}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={currentFilters.status || ''}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={currentFilters.priority || ''}
                  onChange={(e) => updateFilter('priority', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">All Priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={currentFilters.start_date || ''}
              onChange={(e) => updateFilter('start_date', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={currentFilters.end_date || ''}
              onChange={(e) => updateFilter('end_date', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={fetchReports}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Apply Filters
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              setFilters(prev => ({
                ...prev,
                [activeTab]: activeTab === 'maintenance'
                  ? { ride_id: '', status: '', priority: '', start_date: '', end_date: '' }
                  : activeTab === 'rideUsage'
                  ? { ride_id: '', start_date: '', end_date: '' }
                  : { start_date: '', end_date: '' }
              }))
              fetchReports()
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Clear Filters
          </button>
        </div>
      </div>
    )
  }

  function renderMaintenanceTable() {
    const { details, summary, totals } = maintenanceReports

    return (
      <div className="space-y-6">
        {/* Details Table */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Maintenance Request Details</h3>
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ride</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {details.map((report) => (
                <tr key={report.request_id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{report.request_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{report.ride_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{report.description}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      report.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                      report.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                      report.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {report.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      report.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      report.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {report.hours_to_complete || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {report.first_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary by Ride */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Summary by Ride</h3>
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ride Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Requests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Downtime</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summary.map((ride, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{ride.ride_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.total_requests}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.pending}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.in_progress}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.completed}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.completion_rate_pct}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.avg_hours_to_complete || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.total_downtime_hours || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.distinct_employees}</td>
                </tr>
              ))}
              {/* Grand Total Row */}
              {totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.total_requests}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.pending}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.in_progress}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.completed}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.completion_rate_pct}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.avg_hours_to_complete || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.total_downtime_hours || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.distinct_employees}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderRideUsageTable() {
    const { byRide, byZone, totals } = rideUsageReports

    return (
      <div className="space-y-6">
        {/* By Ride Table */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Usage by Ride</h3>
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ride Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Rides</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Riders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rides/Visitor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Wait</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Wait</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fast Pass</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FP %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {byRide.map((ride) => (
                <tr key={ride.ride_id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{ride.ride_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.total_rides}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.unique_customers}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.rides_per_visitor}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.avg_wait_time}min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.max_wait_time}min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.fast_pass_uses}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.fast_pass_percentage}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.utilization_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Zone Table */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Usage by Zone</h3>
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Rides</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Riders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rides/Visitor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Wait</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Wait</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fast Pass Uses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FP %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {byZone.map((zone, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{zone.zone_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.total_rides}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.unique_customers}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.rides_per_visitor}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.avg_wait_time}min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.max_wait_time}min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.fast_pass_uses}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{zone.fast_pass_percentage}%</td>
                </tr>
              ))}
              {/* Grand Total Row */}
              {totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.total_rides}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.unique_customers}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.rides_per_visitor}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.avg_wait_time}min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.max_wait_time}min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.fast_pass_uses}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{totals.fast_pass_percentage}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderTicketSalesTable() {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Ticket Sales by Type</h3>
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tickets Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Park Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Park Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ticketSalesReports.byType?.map((ticket) => (
                <tr key={ticket.ticket_type}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{ticket.ticket_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">${Number(ticket.price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.tickets_sold}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">${Number(ticket.subtotal_revenue).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.revenue_share_pct}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.distinct_customers}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.avg_park_hours}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.total_park_hours}</td>
                </tr>
              )) || (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-sm text-gray-500 text-center">No ticket data available</td>
                </tr>
              )}

              {ticketSalesReports.totals && (
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">GRAND TOTAL</td>
                  <td className="px-6 py-4 text-sm text-gray-900">${Number(ticketSalesReports.totals.avg_price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticketSalesReports.totals.total_tickets}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">${Number(ticketSalesReports.totals.total_revenue).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">100.0%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticketSalesReports.totals.distinct_customers}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">—</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticketSalesReports.totals.total_park_hours}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Role check - only manager and admin can access Analytics
  if (!["manager", "admin"].includes(user?.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Park performance and reports</p>

        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>You don't have permission to view this page. Only managers and administrators can access analytics.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <p className="mt-1 text-sm text-gray-500">Park performance and reports</p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'maintenance', label: 'Maintenance Reports' },
              { id: 'rideUsage', label: 'Ride Usage Reports' },
              { id: 'ticketSales', label: 'Ticket Sales Reports' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {renderFilters()}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading reports...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === 'maintenance' && renderMaintenanceTable()}
              {activeTab === 'rideUsage' && renderRideUsageTable()}
              {activeTab === 'ticketSales' && renderTicketSalesTable()}

              {((activeTab === 'maintenance' && maintenanceReports.details?.length === 0) ||
                (activeTab === 'rideUsage' && rideUsageReports.byRide?.length === 0) ||
                (activeTab === 'ticketSales' && ticketSalesReports.byType?.length === 0)) && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No data available for the selected filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

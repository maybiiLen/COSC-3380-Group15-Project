import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../utils/api'
import { Link } from 'react-router-dom'

// CougarRide branding
import cougarrideLogo from '../assets/cougarride-logo.png'

export default function Analytics() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('maintenance')
  const [maintenanceReports, setMaintenanceReports] = useState({ details: [], summary: [], totals: null })
  const [rideUsageReports, setRideUsageReports] = useState({ byRide: [], byZone: [], totals: null })
  const [ticketSalesReports, setTicketSalesReports] = useState({ byType: [], totals: null })
  const [ticketTransactions, setTicketTransactions] = useState([])
  const [showTransactions, setShowTransactions] = useState(false)
  const [transactionFilter, setTransactionFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    maintenance: { ride_id: '', status: '', priority: '', start_date: '', end_date: '' },
    rideUsage: { ride_id: '', start_date: '', end_date: '' },
    ticketSales: { ticket_type: '', start_date: '', end_date: '' }
  })

  const [rides, setRides] = useState([])

  const f = "'DM Sans', sans-serif"

  useEffect(() => { fetchRides() }, [])
  useEffect(() => { fetchReports() }, [activeTab])

  async function fetchRides() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides?all=true`)
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
        // Also fetch transactions for drill-down
        fetchTicketTransactions()
      }
    } catch (err) {
      setError('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTicketTransactions(typeFilter) {
    try {
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams()
      if (typeFilter) params.set('ticket_type', typeFilter)
      if (filters.ticketSales.start_date) params.set('start_date', filters.ticketSales.start_date)
      if (filters.ticketSales.end_date) params.set('end_date', filters.ticketSales.end_date)

      const res = await fetch(`${API_BASE_URL}/api/tickets/all-purchases?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setTicketTransactions(data.details || [])
      }
    } catch (err) {
      console.error('Error fetching transactions:', err)
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
      <div style={{
        margin: "1.5rem",
        padding: "1.5rem",
        background: "#141313",
        borderRadius: "12px",
        border: "1px solid #2A2929"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem"
        }}>
          {activeTab !== 'ticketSales' && (
            <div>
              <label style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                marginBottom: "0.5rem",
                fontFamily: f,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Ride</label>
              <select
                value={currentFilters.ride_id || ''}
                onChange={(e) => updateFilter('ride_id', e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#222",
                  border: "1px solid #3A3939",
                  borderRadius: "8px",
                  color: "white",
                  fontFamily: f,
                  fontSize: "0.85rem",
                  outline: "none"
                }}
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
                <label style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: "0.5rem",
                  fontFamily: f,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>Status</label>
                <select
                  value={currentFilters.status || ''}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "#222",
                    border: "1px solid #3A3939",
                    borderRadius: "8px",
                    color: "white",
                    fontFamily: f,
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                >
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: "0.5rem",
                  fontFamily: f,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>Priority</label>
                <select
                  value={currentFilters.priority || ''}
                  onChange={(e) => updateFilter('priority', e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "#222",
                    border: "1px solid #3A3939",
                    borderRadius: "8px",
                    color: "white",
                    fontFamily: f,
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
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

          {activeTab === 'ticketSales' && (
            <div>
              <label style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                marginBottom: "0.5rem",
                fontFamily: f,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Ticket Type</label>
              <select
                value={currentFilters.ticket_type || ''}
                onChange={(e) => updateFilter('ticket_type', e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#222",
                  border: "1px solid #3A3939",
                  borderRadius: "8px",
                  color: "white",
                  fontFamily: f,
                  fontSize: "0.85rem",
                  outline: "none"
                }}
              >
                <option value="">All Types</option>
                <option value="General Admission">General Admission</option>
                <option value="Season Pass">Season Pass</option>
                <option value="VIP Experience">VIP Experience</option>
              </select>
            </div>
          )}

          <div>
            <label style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              marginBottom: "0.5rem",
              fontFamily: f,
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>Start Date</label>
            <input
              type="date"
              value={currentFilters.start_date || ''}
              onChange={(e) => updateFilter('start_date', e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#222",
                border: "1px solid #3A3939",
                borderRadius: "8px",
                color: "white",
                fontFamily: f,
                fontSize: "0.85rem",
                outline: "none"
              }}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              marginBottom: "0.5rem",
              fontFamily: f,
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>End Date</label>
            <input
              type="date"
              value={currentFilters.end_date || ''}
              onChange={(e) => updateFilter('end_date', e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#222",
                border: "1px solid #3A3939",
                borderRadius: "8px",
                color: "white",
                fontFamily: f,
                fontSize: "0.85rem",
                outline: "none"
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <button
            onClick={fetchReports}
            style={{
              padding: "0.75rem 1.5rem",
              background: "linear-gradient(135deg, #C8102E, #8C1D40)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontFamily: f,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 2px 8px rgba(200,16,46,0.3)"
            }}
            onMouseEnter={e => e.target.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.target.style.transform = "translateY(0)"}
          >
            🔄 Apply Filters
          </button>
          <button
            onClick={exportToCSV}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#2A2929",
              color: "white",
              border: "1px solid #3A3939",
              borderRadius: "8px",
              fontFamily: f,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
            onMouseEnter={e => { e.target.style.background = "#3A3939"; e.target.style.transform = "translateY(-1px)" }}
            onMouseLeave={e => { e.target.style.background = "#2A2929"; e.target.style.transform = "translateY(0)" }}
          >
            📊 Export CSV
          </button>
          <button
            onClick={() => {
              setFilters(prev => ({
                ...prev,
                [activeTab]: activeTab === 'maintenance'
                  ? { ride_id: '', status: '', priority: '', start_date: '', end_date: '' }
                  : activeTab === 'rideUsage'
                  ? { ride_id: '', start_date: '', end_date: '' }
                  : { ticket_type: '', start_date: '', end_date: '' }
              }))
              setTimeout(fetchReports, 100)
            }}
            style={{
              padding: "0.75rem 1.5rem",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid #3A3939",
              borderRadius: "8px",
              fontFamily: f,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
            onMouseEnter={e => { e.target.style.color = "rgba(255,255,255,0.8)"; e.target.style.borderColor = "#C8102E" }}
            onMouseLeave={e => { e.target.style.color = "rgba(255,255,255,0.6)"; e.target.style.borderColor = "#3A3939" }}
          >
            🗑️ Clear Filters
          </button>
        </div>
      </div>
    )
  }

  function renderMaintenanceTable() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "white",
            marginBottom: "1rem"
          }}>Maintenance Summary by Ride</h3>
          <div style={{ overflowX: "auto", background: "#141313", borderRadius: "12px", border: "1px solid #2A2929" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#1A1919" }}>
                <tr>
                  {['Ride Name', 'Total Requests', 'Pending', 'In Progress', 'Completed', 'Completion %', 'Avg Hours', 'Total Downtime'].map((header) => (
                    <th key={header} style={{
                      padding: "1rem 1.5rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {maintenanceReports.summary?.map((row) => (
                <tr key={row.ride_name} style={{
                  transition: "background-color 0.15s",
                  cursor: "pointer"
                }}
                onMouseEnter={e => e.target.style.backgroundColor = "#222"}
                onMouseLeave={e => e.target.style.backgroundColor = "transparent"}
                >
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "white",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.ride_name}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.total_requests}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "#FFB74D",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.pending}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "#64B5F6",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.in_progress}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "#81C784",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.completed}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.completion_rate_pct}%</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.avg_hours_to_complete ?? '—'}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{row.total_downtime_hours ?? '—'}h</td>
                </tr>
              ))}
              {maintenanceReports.totals && (
                <tr style={{
                  background: "#2A2929",
                  fontWeight: 600
                }}>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "white",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>GRAND TOTAL</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.total_requests}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "#FFB74D",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.pending}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "#64B5F6",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.in_progress}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "#81C784",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.completed}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.completion_rate_pct}%</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.avg_hours_to_complete ?? '—'}</td>
                  <td style={{
                    padding: "1rem 1.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid #2A2929",
                    fontFamily: f
                  }}>{maintenanceReports.totals.total_downtime_hours ?? '—'}h</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

        {/* Detail rows */}
        <div>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "white",
            marginBottom: "1rem"
          }}>Maintenance Detail Rows</h3>
          <div style={{ overflowX: "auto", background: "#141313", borderRadius: "12px", border: "1px solid #2A2929" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#1A1919" }}>
                <tr>
                  {['ID', 'Ride', 'Description', 'Priority', 'Status', 'Assigned To', 'Date'].map((header) => (
                    <th key={header} style={{
                      padding: "1rem 1.5rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maintenanceReports.details?.map((row) => (
                  <tr key={row.request_id} style={{
                    transition: "background-color 0.15s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>#{row.request_id}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{row.ride_name}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f,
                      maxWidth: "300px",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap"
                    }}>{row.description}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>
                      <span style={{
                        display: "inline-flex",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: row.priority === 'Critical' ? 'rgba(244,67,54,0.2)' :
                                   row.priority === 'High' ? 'rgba(255,152,0,0.2)' :
                                   row.priority === 'Medium' ? 'rgba(255,193,7,0.2)' :
                                   'rgba(76,175,80,0.2)',
                        color: row.priority === 'Critical' ? '#FFCDD2' :
                               row.priority === 'High' ? '#FFE0B2' :
                               row.priority === 'Medium' ? '#FFF3C4' :
                               '#C8E6C9'
                      }}>{row.priority}</span>
                    </td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>
                      <span style={{
                        display: "inline-flex",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: row.status === 'Completed' ? 'rgba(76,175,80,0.2)' :
                                   row.status === 'In Progress' ? 'rgba(33,150,243,0.2)' :
                                   'rgba(255,193,7,0.2)',
                        color: row.status === 'Completed' ? '#81C784' :
                               row.status === 'In Progress' ? '#64B5F6' :
                               '#FFB74D'
                      }}>{row.status}</span>
                    </td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{row.first_name || 'Unassigned'}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.6)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{new Date(row.request_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderRideUsageTable() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "white",
            marginBottom: "1rem"
          }}>Ride Usage by Zone</h3>
          <div style={{ overflowX: "auto", background: "#141313", borderRadius: "12px", border: "1px solid #2A2929" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#1A1919" }}>
                <tr>
                  {['Zone', 'Rides', 'Total Rides', 'Unique Visitors', 'Rides/Visitor', 'Avg Wait', 'Fast Pass %'].map((header) => (
                    <th key={header} style={{
                      padding: "1rem 1.5rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rideUsageReports.byZone?.map((zone) => (
                  <tr key={zone.zone_name} style={{
                    transition: "background-color 0.15s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.zone_name}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.rides_in_zone}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.total_rides}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.unique_customers}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.rides_per_visitor}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.avg_wait_time} min</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{zone.fast_pass_percentage}%</td>
                  </tr>
                ))}
                {rideUsageReports.totals && (
                  <tr style={{
                    background: "#2A2929",
                    fontWeight: 600
                  }}>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>GRAND TOTAL</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{rideUsageReports.totals.total_ride_count}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{rideUsageReports.totals.total_rides}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{rideUsageReports.totals.unique_customers}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{rideUsageReports.totals.rides_per_visitor}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{rideUsageReports.totals.avg_wait_time} min</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{rideUsageReports.totals.fast_pass_percentage}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "white",
            marginBottom: "1rem"
          }}>Ride Usage Detail</h3>
          <div style={{ overflowX: "auto", background: "#141313", borderRadius: "12px", border: "1px solid #2A2929" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#1A1919" }}>
                <tr>
                  {['Ride', 'Zone', 'Status', 'Total Rides', 'Visitors', 'Avg Wait', 'Utilization %', 'Maintenance'].map((header) => (
                    <th key={header} style={{
                      padding: "1rem 1.5rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rideUsageReports.byRide?.map((ride) => (
                  <tr key={ride.ride_id} style={{
                    transition: "background-color 0.15s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.ride_name}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.location}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>
                      <span style={{
                        display: "inline-flex",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: ride.status === 'Operational' ? 'rgba(76,175,80,0.2)' :
                                   ride.status === 'Maintenance' ? 'rgba(255,193,7,0.2)' :
                                   'rgba(244,67,54,0.2)',
                        color: ride.status === 'Operational' ? '#81C784' :
                               ride.status === 'Maintenance' ? '#FFB74D' :
                               '#FFCDD2'
                      }}>{ride.status}</span>
                    </td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.total_rides}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.unique_customers}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.avg_wait_time} min</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.utilization_pct}%</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ride.maintenance_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderTicketSalesTable() {
    const totals = ticketSalesReports.totals

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Summary cards — clickable for drill-down (Carl's request) */}
        {ticketSalesReports.byType?.length > 0 && (
          <div>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "white",
              marginBottom: "1rem"
            }}>
              Sales by Ticket Type
              <span style={{
                fontSize: "0.85rem",
                fontWeight: 400,
                color: "rgba(255,255,255,0.6)",
                marginLeft: "0.5rem",
                fontFamily: f
              }}>— click a type to see its transactions</span>
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1rem"
            }}>
              {ticketSalesReports.byType.map(t => (
                <div key={t.ticket_type}
                  onClick={() => {
                    setTransactionFilter(t.ticket_type)
                    fetchTicketTransactions(t.ticket_type)
                    setShowTransactions(true)
                  }}
                  style={{
                    background: transactionFilter === t.ticket_type ? "rgba(200,16,46,0.15)" : "#141313",
                    border: transactionFilter === t.ticket_type ? "1px solid #C8102E" : "1px solid #2A2929",
                    borderRadius: "12px",
                    padding: "1.5rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: transactionFilter === t.ticket_type ? "0 4px 12px rgba(200,16,46,0.2)" : "none"
                  }}
                  onMouseEnter={e => {
                    if (transactionFilter !== t.ticket_type) {
                      e.currentTarget.style.borderColor = "#C8102E"
                      e.currentTarget.style.background = "rgba(200,16,46,0.08)"
                    }
                  }}
                  onMouseLeave={e => {
                    if (transactionFilter !== t.ticket_type) {
                      e.currentTarget.style.borderColor = "#2A2929"
                      e.currentTarget.style.background = "#141313"
                    }
                  }}
                >
                  <p style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "0.5rem",
                    fontFamily: f
                  }}>{t.ticket_type}</p>
                  <p style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: "white",
                    margin: "0.5rem 0",
                    fontFamily: f
                  }}>{t.tickets_sold} tickets</p>
                  <p style={{
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                    fontFamily: f
                  }}>
                    ${Number(t.subtotal_revenue || 0).toLocaleString()} revenue · {t.total_transactions} orders
                  </p>
                  <p style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.6)",
                    marginTop: "0.5rem",
                    fontFamily: f
                  }}>{t.revenue_share_pct}% of total revenue</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary table */}
        <div>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "white",
            marginBottom: "1rem"
          }}>Ticket Sales Summary</h3>
          <p style={{
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "1rem",
            fontFamily: f
          }}>
            Data sourced from <code style={{
              background: "#2A2929",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              color: "#FFB74D"
            }}>ticket_purchases</code> table — all real transaction data from customer purchases.
          </p>
          <div style={{ overflowX: "auto", background: "#141313", borderRadius: "12px", border: "1px solid #2A2929" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#1A1919" }}>
                <tr>
                  {['Ticket Type', 'Unit Price', 'Tickets Sold', 'Revenue', 'Revenue %', 'Orders', 'Avg Order'].map((header) => (
                    <th key={header} style={{
                      padding: "1rem 1.5rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ticketSalesReports.byType?.map((ticket) => (
                  <tr key={ticket.ticket_type}
                    style={{
                      cursor: "pointer",
                      transition: "background-color 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    onClick={() => {
                      setTransactionFilter(ticket.ticket_type)
                      fetchTicketTransactions(ticket.ticket_type)
                      setShowTransactions(true)
                    }}
                  >
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ticket.ticket_type}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>${Number(ticket.price).toFixed(2)}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ticket.tickets_sold}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>${Number(ticket.subtotal_revenue).toFixed(2)}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ticket.revenue_share_pct}%</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{ticket.total_transactions}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>${Number(ticket.avg_transaction).toFixed(2)}</td>
                  </tr>
                ))}
                {totals && (
                  <tr style={{ background: "rgba(200,16,46,0.1)", borderTop: "2px solid #C8102E" }}>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "white",
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>GRAND TOTAL</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>—</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{totals.total_tickets}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>${Number(totals.total_revenue || 0).toFixed(2)}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>100.0%</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>{totals.total_transactions}</td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      borderBottom: "1px solid #2A2929",
                      fontFamily: f
                    }}>${Number(totals.avg_price || 0).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drill-down: Transaction details (Carl's specific request) */}
        {showTransactions && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "white"
              }}>
                Transaction Details
                {transactionFilter && (
                  <span style={{
                    marginLeft: "0.5rem",
                    display: "inline-flex",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: "#C8102E",
                    color: "white",
                    fontFamily: f
                  }}>
                    {transactionFilter}
                  </span>
                )}
              </h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {transactionFilter && (
                  <button onClick={() => {
                    setTransactionFilter('')
                    fetchTicketTransactions('')
                  }} style={{
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.6)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: f,
                    transition: "color 0.15s"
                  }}
                  onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.8)"}
                  onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.6)"}>
                    Show All Types
                  </button>
                )}
                <button onClick={() => setShowTransactions(false)} style={{
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.5)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: f,
                  transition: "color 0.15s"
                }}
                onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.5)"}>
                  Hide
                </button>
              </div>
            </div>
            <p style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "1rem",
              fontFamily: f
            }}>
              Showing {ticketTransactions.length} individual purchase transaction{ticketTransactions.length !== 1 ? 's' : ''} from the <code style={{
                background: "#2A2929",
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                fontSize: "0.75rem",
                color: "#FFB74D"
              }}>ticket_purchases</code> table.
              {' '}<Link to="/dashboard/tickets" style={{
                color: "#C8102E",
                textDecoration: "none",
                fontWeight: 600,
                fontFamily: f
              }}
              onMouseEnter={e => e.target.style.textDecoration = "underline"}
              onMouseLeave={e => e.target.style.textDecoration = "none"}>View full Tickets dashboard →</Link>
            </p>
            <div style={{ overflowX: "auto", background: "#141313", borderRadius: "12px", border: "1px solid #2A2929" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#1A1919" }}>
                  <tr>
                    {['ID', 'Customer', 'Type', 'Adults', 'Children', 'Total', 'Card', 'Date'].map((header) => (
                      <th key={header} style={{
                        padding: "1rem 1.5rem",
                        textAlign: "left",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.6)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ticketTransactions.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{
                        padding: "2rem 1rem",
                        textAlign: "center",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "0.85rem",
                        fontFamily: f
                      }}>No transactions found</td>
                    </tr>
                  )}
                  {ticketTransactions.map(d => (
                    <tr key={d.purchase_id} style={{
                      transition: "background-color 0.15s",
                      cursor: "pointer"
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        color: "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>#{d.purchase_id}</td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "white",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>{d.customer_name}</td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>
                        <span style={{
                          display: "inline-flex",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: d.ticket_type === 'General Admission' ? 'rgba(33,150,243,0.2)' :
                                     d.ticket_type === 'Season Pass' ? 'rgba(156,39,176,0.2)' :
                                     'rgba(255,193,7,0.2)',
                          color: d.ticket_type === 'General Admission' ? '#90CAF9' :
                                 d.ticket_type === 'Season Pass' ? '#CE93D8' :
                                 '#FFE082'
                        }}>{d.ticket_type}</span>
                      </td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        color: "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>{d.adult_qty}</td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        color: "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>{d.child_qty}</td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "white",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>${Number(d.total_price).toFixed(2)}</td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        color: "rgba(255,255,255,0.5)",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>{d.card_last_four ? `••••${d.card_last_four}` : '—'}</td>
                      <td style={{
                        padding: "1rem 1.5rem",
                        fontSize: "0.85rem",
                        color: "rgba(255,255,255,0.6)",
                        borderBottom: "1px solid #2A2929",
                        fontFamily: f
                      }}>{new Date(d.purchase_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", paddingTop: "1rem" }}>
          <Link to="/dashboard/tickets" style={{
            fontSize: "0.85rem",
            color: "#C8102E",
            textDecoration: "none",
            fontWeight: 600,
            fontFamily: f
          }}
          onMouseEnter={e => e.target.style.textDecoration = "underline"}
          onMouseLeave={e => e.target.style.textDecoration = "none"}>
            View full Ticket Sales dashboard with all transactions →
          </Link>
        </div>
      </div>
    )
  }

  // Role check
  if (!["manager", "admin"].includes(user?.role)) {
    return (
      <div style={{
        background: "#0F0E0E",
        minHeight: "100vh",
        fontFamily: f,
        color: "white"
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
        `}</style>

        {/* Header with CougarRide branding */}
        <div style={{
          padding: "2rem 2rem 1rem",
          borderBottom: "1px solid #1A1919",
          background: "linear-gradient(135deg, #0F0E0E 0%, #1A1919 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
            <img src={cougarrideLogo} alt="CougarRide" style={{ height: "40px", width: "auto" }} />
            <div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "2rem",
                fontWeight: 900,
                color: "white",
                margin: 0
              }}>Analytics Dashboard</h1>
              <p style={{
                fontFamily: f,
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.6)",
                margin: 0
              }}>Park performance and operational reports</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "2rem" }}>
          <div style={{
            background: "#1A1919",
            borderRadius: "16px",
            border: "1px solid #2A2929",
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
          }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(229,57,53,0.15)",
              border: "2px solid rgba(229,57,53,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: "2rem"
            }}>🔒</div>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#EF9A9A",
              margin: "0 0 0.75rem"
            }}>Access Denied</h3>
            <p style={{
              fontFamily: f,
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.6)",
              margin: 0,
              lineHeight: 1.5
            }}>Only managers and administrators can access analytics reports and performance data.</p>
            <div style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1rem",
              background: "rgba(244,132,95,0.1)",
              border: "1px solid rgba(244,132,95,0.2)",
              borderRadius: "8px",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)"
            }}>
              💡 Contact your administrator to request access if needed
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: "#0F0E0E",
      minHeight: "100vh",
      fontFamily: f,
      color: "white"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Header with CougarRide branding */}
      <div style={{
        padding: "2rem 2rem 1rem",
        borderBottom: "1px solid #1A1919",
        background: "linear-gradient(135deg, #0F0E0E 0%, #1A1919 100%)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <img src={cougarrideLogo} alt="CougarRide" style={{ height: "40px", width: "auto" }} />
          <div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "2rem",
              fontWeight: 900,
              color: "white",
              margin: 0
            }}>Analytics Dashboard</h1>
            <p style={{
              fontFamily: f,
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.6)",
              margin: 0
            }}>Park performance and operational reports</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "2rem" }}>
        <div style={{
          background: "#1A1919",
          borderRadius: "16px",
          border: "1px solid #2A2929",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}>
          <div style={{ borderBottom: "1px solid #2A2929", padding: "1.5rem 1.5rem 0" }}>
            <nav style={{ display: "flex", gap: "2rem", marginBottom: "-1px" }}>
              {[
                { id: 'maintenance', label: 'Maintenance Reports', icon: '🔧' },
                { id: 'rideUsage', label: 'Ride Usage Reports', icon: '📊' },
                { id: 'ticketSales', label: 'Ticket Sales Reports', icon: '💰' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowTransactions(false); setTransactionFilter('') }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1.25rem",
                    background: activeTab === tab.id ? "linear-gradient(135deg, #8C1D40, #C8102E)" : "transparent",
                    color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.6)",
                    border: "none",
                    borderRadius: "8px 8px 0 0",
                    fontFamily: f,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    borderBottom: activeTab === tab.id ? "2px solid #C8102E" : "2px solid transparent"
                  }}
                  onMouseEnter={e => {
                    if (activeTab !== tab.id) {
                      e.target.style.color = "rgba(255,255,255,0.8)"
                      e.target.style.background = "rgba(200,16,46,0.1)"
                    }
                  }}
                  onMouseLeave={e => {
                    if (activeTab !== tab.id) {
                      e.target.style.color = "rgba(255,255,255,0.6)"
                      e.target.style.background = "transparent"
                    }
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

        {renderFilters()}

          {error && (
            <div style={{
              margin: "1.5rem",
              padding: "1rem 1.5rem",
              background: "rgba(229,57,53,0.15)",
              border: "1px solid rgba(229,57,53,0.3)",
              borderRadius: "12px"
            }}>
              <p style={{
                fontFamily: f,
                fontSize: "0.85rem",
                color: "#EF9A9A",
                margin: 0
              }}>❌ {error}</p>
            </div>
          )}

          <div style={{ margin: "1.5rem" }}>
            {loading ? (
              <div style={{
                textAlign: "center",
                padding: "3rem",
                background: "#141313",
                borderRadius: "12px",
                border: "1px solid #2A2929"
              }}>
                <p style={{
                  fontFamily: f,
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.6)",
                  margin: 0
                }}>⏳ Loading reports...</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
              {activeTab === 'maintenance' && renderMaintenanceTable()}
              {activeTab === 'rideUsage' && renderRideUsageTable()}
              {activeTab === 'ticketSales' && renderTicketSalesTable()}

                {((activeTab === 'maintenance' && maintenanceReports.details?.length === 0) ||
                  (activeTab === 'rideUsage' && rideUsageReports.byRide?.length === 0) ||
                  (activeTab === 'ticketSales' && ticketSalesReports.byType?.length === 0)) && !loading && (
                  <div style={{
                    textAlign: "center",
                    padding: "3rem",
                    background: "#141313",
                    borderRadius: "12px",
                    border: "1px solid #2A2929"
                  }}>
                    <p style={{
                      fontFamily: f,
                      fontSize: "0.9rem",
                      color: "rgba(255,255,255,0.5)",
                      margin: 0
                    }}>📭 No data available for the selected filters.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
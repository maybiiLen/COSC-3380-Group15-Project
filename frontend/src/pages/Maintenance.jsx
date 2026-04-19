import { useEffect, useState } from "react"
import Search from "../assets/search.svg"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL, authFetch } from "../utils/api"

export default function Maintenance() {
  const [requests, setRequests] = useState([])
  const [rides, setRides] = useState([])
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState("All Status")
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formData, setFormData] = useState({
    ride_id: "",
    employee_id: "",
    description: "",
    priority: "Medium",
    status: "Pending"
  })

  useEffect(() => {
    fetchRequests()
    fetchRides()
    fetchEmployees()
  }, [])

  async function fetchRequests() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance`)
      const data = await res.json()
      setRequests(data)
    } catch (err) {
      setError("Failed to load maintenance requests")
    } finally {
      setLoading(false)
    }
  }

  async function fetchRides() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides?all=true`)
      const data = await res.json()
      setRides(data)
    } catch (err) {
      console.log("Failed to load rides:", err)
    }
  }

  async function fetchEmployees() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees`)
      const data = await res.json()
      setEmployees(data)
    } catch (err) {
      console.log("Failed to load employees:", err)
    }
  }

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  function openAddModal() {
    setEditId(null)
    setFormData({ ride_id: "", employee_id: "", description: "", priority: "Medium", status: "Pending" })
    setIsOpen(true)
  }

  function openEditModal(req) {
    setEditId(req.request_id)
    setFormData({
      ride_id: req.ride_id,
      employee_id: req.employee_id || "",
      description: req.description,
      priority: req.priority,
      status: req.status
    })
    setIsOpen(true)
  }

  async function handleSubmit() {
    try {
      if (editId) {
        const res = await fetch(`${API_BASE_URL}/api/maintenance/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.message || "Failed to update request")
          return
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/maintenance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.message || "Failed to create request")
          return
        }
      }

      setIsOpen(false)
      setEditId(null)
      // Refetch both — trigger may have changed ride status
      fetchRequests()
      fetchRides()
    } catch (err) {
      console.log("Submit error:", err)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/${deleteId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || "Failed to delete request")
        return
      }
      setDeleteId(null)
      fetchRequests()
      fetchRides()
    } catch (err) {
      console.log("Delete error:", err)
    }
  }

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.ride_name?.toLowerCase().includes(search.toLowerCase()) ||
      req.description?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "All Status" || req.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const priorityColor = {
    Low: "bg-blue-100 text-blue-700",
    Medium: "bg-yellow-100 text-yellow-700",
    High: "bg-orange-100 text-orange-700",
    Critical: "bg-red-100 text-red-700"
  }

  const statusColor = {
    Pending: "bg-gray-100 text-gray-700",
    "In Progress": "bg-yellow-100 text-yellow-700",
    Completed: "bg-green-100 text-green-700"
  }

  const inputClass = "border border-gray-400 rounded-lg px-3 py-2.5 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20 outline-none font-normal text-sm"

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
      <p className="mt-1 text-sm text-gray-500">Track ride maintenance and repairs</p>

      {/* Toolbar */}
      <div className="flex justify-center mt-6 rounded-xl border border-gray-200 bg-white p-6 gap-10 shadow-sm text-gray-400">
        <div className="flex-1 flex gap-2 border border-gray-900/40 rounded-lg p-2 text-lg text-black focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-[#C8102E]/20">
          <img src={Search} className="h-6 w-6 pt-1" />
          <input
            type="text"
            placeholder="Search by ride or description..."
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none w-full"
          />
        </div>
        <div className="flex border border-gray-900/40 rounded-lg text-black focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-[#C8102E]/20">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="outline-none px-3"
          >
            <option value="All Status">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center justify-center gap-1 border border-gray-900/40 rounded-lg bg-[#C8102E] text-white px-3 py-2 hover:bg-[#C8102E]/80 cursor-pointer"
            onClick={openAddModal}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New Request
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-red-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.021-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Archive Request</h2>
              <p className="text-sm text-gray-500 mt-1">This hides the request from the list. Reports will still include it.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer transition-colors">Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="font-bold text-xl text-gray-900">{editId ? "Edit Request" : "New Maintenance Request"}</h1>
                <p className="text-sm text-gray-500">{editId ? "Update the maintenance request" : "Submit a new maintenance request"}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg cursor-pointer transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5 font-medium text-gray-700">
              Ride
              <select name="ride_id" value={formData.ride_id} onChange={handleChange} className={inputClass} required>
                <option value="">Select a ride...</option>
                {rides.map((ride) => (
                  <option key={ride.ride_id} value={ride.ride_id}>{ride.ride_name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 font-medium text-gray-700">
              Assigned Employee (optional)
              <select name="employee_id" value={formData.employee_id} onChange={handleChange} className={inputClass}>
                <option value="">Unassigned</option>
                {employees
                  .filter((emp) => String(emp.role).toLowerCase() === "staff")
                  .map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>{emp.full_name}</option>
                  ))}
              </select>
              <span className="text-xs text-gray-500 font-normal">Only staff-role employees can be assigned maintenance work.</span>
            </div>

            <div className="flex flex-col gap-1.5 font-medium text-gray-700">
              Description
              <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Describe the maintenance issue..." rows={3} className={inputClass + " resize-none"} required />
            </div>

            <div className="flex gap-4 font-medium text-gray-700">
              <div className="flex flex-col gap-1.5 flex-1">
                Priority
                <select name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                Status
                <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200" />
            <div className="flex justify-center gap-10">
              <button className="border px-10 rounded-xl p-2 font-medium bg-[#C8102E] text-white shadow-lg hover:bg-[#C8102E]/80 cursor-pointer transition-colors" onClick={handleSubmit}>
                {editId ? "Update" : "Submit"}
              </button>
              <button className="border px-10 rounded-xl p-2 font-medium bg-black text-white shadow-lg hover:bg-black/80 cursor-pointer transition-colors" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <table className="w-full text-sm mt-6">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Ride</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Assigned To</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Priority</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
          )}
          {error && (
            <tr><td colSpan="8" className="px-4 py-6 text-center text-red-400">{error}</td></tr>
          )}
          {filteredRequests.length === 0 && !loading && (
            <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-400">No maintenance requests found</td></tr>
          )}
          {filteredRequests.map((req) => (
            <tr key={req.request_id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">{req.request_id}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{req.ride_name}</td>
              <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{req.description}</td>
              <td className="px-4 py-3 text-gray-600">{req.employee_name || "—"}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColor[req.priority] || ""}`}>
                  {req.priority}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[req.status] || ""}`}>
                  {req.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{new Date(req.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 flex gap-1">
                <button onClick={() => openEditModal(req)} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
{["manager", "admin"].includes(user?.role) && String(req.status).toLowerCase() === "completed" && <button onClick={() => setDeleteId(req.request_id)} title="Archive this completed request (kept for reports)" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.021-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ─── PARK CLOSURES SECTION (manager/admin only) ─── */}
      {["manager", "admin"].includes(user?.role) && (
        <ParkClosuresSection />
      )}

    </div>
  )
}

// ─── Park Closures Sub-Component ───
function ParkClosuresSection() {
  const [closures, setClosures] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ zone: "", closure_type: "Weather", reason: "" })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchClosures() }, [])

  async function fetchClosures() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/park-closures`)
      if (res.ok) {
        const data = await res.json()
        setClosures(Array.isArray(data) ? data : [])
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/park-closures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowAdd(false)
        setForm({ zone: "", closure_type: "Weather", reason: "" })
        fetchClosures()
      } else {
        const err = await res.json()
        alert(err.message || "Failed to create closure")
      }
    } catch (err) { console.error(err) }
  }

  async function handleLift(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/park-closures/${id}/deactivate`, { method: "PATCH" })
      if (!res.ok) {
        const err = await res.json()
        alert(err.message || "Failed to lift closure")
      }
      fetchClosures()
    } catch (err) { console.error(err) }
  }

  async function handleArchive(id) {
    if (!confirm("Archive this closure? It will disappear from the list but stay in reports.")) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/park-closures/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        alert(err.message || "Failed to archive closure")
      }
      fetchClosures()
    } catch (err) { console.error(err) }
  }

  return (
    <div className="mt-10">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zone Closures</h2>
          <p className="text-sm text-gray-500">Close entire zones due to weather, emergency, or safety — triggers automatically shut down all rides in the zone</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">
          Create Zone Closure
        </button>
      </div>

      {/* Create Closure Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <h2 className="font-bold text-xl text-gray-900 mb-4">Create Zone Closure</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <select required value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]">
                <option value="">Select Zone</option>
                <option value="Zone A">Zone A</option>
                <option value="Zone B">Zone B</option>
                <option value="Zone C">Zone C</option>
                <option value="Zone D">Zone D</option>
              </select>
              <select value={form.closure_type} onChange={e => setForm({...form, closure_type: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]">
                <option value="Weather">Weather</option>
                <option value="Emergency">Emergency</option>
                <option value="Safety">Safety</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Event">Event</option>
              </select>
              <textarea placeholder="Reason for closure" required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" rows={3} />
              <p className="text-xs text-red-500">This will automatically close ALL rides in the selected zone and notify staff via the notification trigger.</p>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">Activate Closure</button>
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Closures Table */}
      {loading ? (
        <p className="text-gray-400 text-sm py-4">Loading closures...</p>
      ) : closures.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-gray-400 text-sm text-center">No zone closures on record.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Zone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Reason</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Started</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ended</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {closures.map(c => (
              <tr key={c.closure_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.zone}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    c.closure_type === "Emergency" ? "bg-red-100 text-red-700" :
                    c.closure_type === "Weather" ? "bg-blue-100 text-blue-700" :
                    c.closure_type === "Safety" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>{c.closure_type}</span>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{c.reason}</td>
                <td className="px-4 py-3">
                  {c.is_active ?
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Active</span> :
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Resolved</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.started_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.ended_at ? new Date(c.ended_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3">
                  {c.is_active ? (
                    <button onClick={() => handleLift(c.closure_id)}
                      className="text-green-600 hover:text-green-800 text-xs font-medium cursor-pointer">
                      Lift Closure
                    </button>
                  ) : (
                    <button onClick={() => handleArchive(c.closure_id)}
                      title="Archive this resolved closure (kept for reports)"
                      className="text-red-500 hover:text-red-700 text-xs font-medium cursor-pointer">
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
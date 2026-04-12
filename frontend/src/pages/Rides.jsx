import { useEffect, useState } from "react"
import Search from "../assets/search.svg"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"

export default function Rides() {
  const [rides, setRides] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All Status")
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const { user } = useAuth()
  const canCRUD = ["manager", "admin"].includes(user?.role)

  const [form, setForm] = useState({
    ride_name: "", capacity_per_cycle: "", min_height_in: "", location: "Zone A",
    status: "Operational", description: "", image_url: "", ride_type: "", thrill_level: "",
  })

  useEffect(() => { fetchRides() }, [])

  async function fetchRides() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides?all=true`)
      const data = await res.json()
      setRides(Array.isArray(data) ? data : [])
    } catch { setError("Failed to load rides") }
    finally { setLoading(false) }
  }

  function resetForm() {
    setForm({ ride_name: "", capacity_per_cycle: "", min_height_in: "", location: "Zone A", status: "Operational", description: "", image_url: "", ride_type: "", thrill_level: "" })
  }

  function openEdit(ride) {
    setEditItem(ride)
    setForm({
      ride_name: ride.ride_name || "",
      capacity_per_cycle: ride.capacity_per_cycle || "",
      min_height_in: ride.min_height_in || "",
      location: ride.location || "Zone A",
      status: ride.status || "Operational",
      description: ride.description || "",
      image_url: ride.image_url || "",
      ride_type: ride.ride_type || "",
      thrill_level: ride.thrill_level || "",
    })
  }

  async function handleAdd(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          capacity_per_cycle: Number(form.capacity_per_cycle),
          min_height_in: Number(form.min_height_in),
        }),
      })
      if (res.ok) { setShowAdd(false); resetForm(); fetchRides() }
      else { const d = await res.json(); alert(d.message || "Failed") }
    } catch (err) { console.error(err) }
  }

  async function handleEditSave(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides/${editItem.ride_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          capacity_per_cycle: Number(form.capacity_per_cycle),
          min_height_in: Number(form.min_height_in),
        }),
      })
      if (res.ok) { setEditItem(null); resetForm(); fetchRides() }
      else { const d = await res.json(); alert(d.message || "Failed") }
    } catch (err) { console.error(err) }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rides/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        setRides(rides.map(r => r.ride_id === Number(deleteId) ? { ...r, is_operational: false, status: "Decommissioned" } : r))
      }
      setDeleteId(null)
    } catch (err) { console.error(err) }
  }

  const filtered = rides.filter(r => {
    return r.ride_name.toLowerCase().includes(search.toLowerCase())
      && (status === "All Status" || r.status === status)
  })

  const inp = "border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E] w-full"

  function statusBadge(s) {
    const map = {
      Operational: "bg-green-100 text-green-700",
      Maintenance: "bg-yellow-100 text-yellow-700",
      Closed: "bg-red-100 text-red-700",
      Decommissioned: "bg-gray-100 text-gray-500",
    }
    return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[s] || "bg-gray-100 text-gray-500"}`}>{s}</span>
  }

  return (
    <div>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rides</h1>
          <p className="mt-1 text-sm text-gray-500">Manage park rides and attractions</p>
        </div>
        {canCRUD && (
          <button onClick={() => { setShowAdd(true); resetForm() }}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer">
            + Add Ride
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="mt-6 flex gap-3">
        <div className="flex-1 flex gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:border-[#C8102E]">
          <img src={Search} className="h-5 w-5 opacity-40" />
          <input type="text" placeholder="Search rides..." onChange={e => setSearch(e.target.value)}
            className="outline-none w-full text-sm" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="All Status">All Status</option>
          <option value="Operational">Operational</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Closed">Closed</option>
          <option value="Decommissioned">Decommissioned</option>
        </select>
      </div>

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm">
            <h2 className="font-bold text-lg text-gray-900 mb-2">Decommission Ride?</h2>
            <p className="text-sm text-gray-500 mb-4">This ride will be marked as decommissioned and hidden from customers.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">Decommission</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAdd || editItem) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl text-gray-900">{editItem ? "Edit Ride" : "Add New Ride"}</h2>
              <button onClick={() => { setShowAdd(false); setEditItem(null) }} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={editItem ? handleEditSave : handleAdd} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Ride Name</label>
                <input required placeholder="Cougar Express" value={form.ride_name} onChange={e => setForm({...form, ride_name: e.target.value})} className={inp} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Capacity Per Cycle</label>
                  <input type="number" required placeholder="32" value={form.capacity_per_cycle} onChange={e => setForm({...form, capacity_per_cycle: e.target.value})} className={inp} />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Min Height (inches)</label>
                  <input type="number" placeholder="48" value={form.min_height_in} onChange={e => setForm({...form, min_height_in: e.target.value})} className={inp} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Location</label>
                  <select value={form.location} onChange={e => setForm({...form, location: e.target.value})} className={inp}>
                    <option value="Zone A">Zone A</option>
                    <option value="Zone B">Zone B</option>
                    <option value="Zone C">Zone C</option>
                    <option value="Zone D">Zone D</option>
                  </select>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>
                    <option value="Operational">Operational</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Closed">Closed</option>
                    {editItem && <option value="Decommissioned">Decommissioned</option>}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Ride Type</label>
                  <select value={form.ride_type} onChange={e => setForm({...form, ride_type: e.target.value})} className={inp}>
                    <option value="">Select Type</option>
                    <option value="Roller Coaster">Roller Coaster</option>
                    <option value="Thrill Ride">Thrill Ride</option>
                    <option value="Water Ride">Water Ride</option>
                    <option value="Dark Ride">Dark Ride</option>
                    <option value="Family Ride">Family Ride</option>
                  </select>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Thrill Level</label>
                  <select value={form.thrill_level} onChange={e => setForm({...form, thrill_level: e.target.value})} className={inp}>
                    <option value="">Select Level</option>
                    <option value="Family">Family</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                    <option value="Extreme">Extreme</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Description</label>
                <textarea rows={3} placeholder="Describe this ride for park visitors..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inp} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Image URL</label>
                <input placeholder="https://images.unsplash.com/..." value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} className={inp} />
                {form.image_url && (
                  <img src={form.image_url} alt="Preview" className="mt-1 rounded-lg h-24 w-full object-cover border border-gray-200"
                    onError={e => { e.currentTarget.style.display = "none" }} />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer">
                  {editItem ? "Save Changes" : "Add Ride"}
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setEditItem(null) }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ride Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Capacity</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Min Height</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Thrill</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
              {canCRUD && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(ride => (
              <tr key={ride.ride_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {ride.image_url && <img src={ride.image_url} className="w-8 h-8 rounded object-cover" onError={e => { e.currentTarget.style.display = "none" }} />}
                    <span className="font-medium text-gray-900">{ride.ride_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{ride.ride_type || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{ride.location}</td>
                <td className="px-4 py-3 text-gray-600">{ride.capacity_per_cycle}</td>
                <td className="px-4 py-3 text-gray-600">{ride.min_height_in > 0 ? `${ride.min_height_in}"` : "None"}</td>
                <td className="px-4 py-3">{statusBadge(ride.status)}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{ride.thrill_level || "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{ride.description || "—"}</td>
                {canCRUD && (
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(ride)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer">Edit</button>
                    {ride.status !== "Decommissioned" && (
                      <button onClick={() => setDeleteId(ride.ride_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
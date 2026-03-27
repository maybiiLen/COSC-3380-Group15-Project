import { useEffect, useState } from "react"
import Search from "../assets/search.svg"
import { useAuth } from "../context/AuthContext"

export default function Rides() {
  const [rides, setRides] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [status, setStatus] = useState("All Status")
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    capacity: "",
    minHeight: "",
    location: "",
    status: "Operational"
  })

  useEffect(() => {
    async function fetchRides() {
      try {
        const res = await fetch("/api/rides")
        const data = await res.json()
        console.log("Rides data:", data)
        setRides(data)
      } catch (err) {
        setError("Failed to load rides")
      } finally {
        setLoading(false)
      }
    }

    fetchRides()
  }, [])

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_name: formData.name,
          capacity_per_cycle: Number(formData.capacity),
          min_height_in: Number(formData.minHeight),
          location: formData.location,
          status: formData.status
        })
      })

      const newRide = await res.json()

      if (!res.ok) {
        alert(newRide.message || "Failed to add ride")
        return
      }

      setRides([...rides, newRide])
      setIsOpen(false)
      setFormData({
        name: "",
        capacity: "",
        minHeight: "",
        location: "",
        status: "Operational"
      })
    } catch (err) {
      console.log("Submit error:", err)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/rides/${deleteId}`, {
        method: "DELETE"
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.message || "Failed to delete ride")
        return
      }

      setRides(rides.filter((ride) => ride.ride_id !== Number(deleteId)))
      setDeleteId(null)

    } catch (err) {
      console.log("Delete error:", err)
    }
  }

  const filteredRides = rides.filter((ride) => {
    const matchesSearch = ride.ride_name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === "All Status" || ride.status === status
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Rides</h1>
      <p className="mt-1 text-sm text-gray-500">Manage park rides and attractions</p>

      {/* Toolbar */}
      <div className="flex justify-center mt-6 rounded-xl border border-gray-200 bg-white p-6 gap-10 shadow-sm text-gray-400">
        <div className="flex-1 flex gap-2 border border-gray-900/40 rounded-lg p-2 text-lg text-black focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-[#C8102E]/20">
          <img src={Search} className="h-6 w-6 pt-1" />
          <input
            type="text"
            placeholder="Search Rides..."
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none w-full"
          />
        </div>
        <div className="flex border border-gray-900/40 rounded-lg text-black focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-[#C8102E]/20">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="outline-none px-3"
          >
            <option value="All Status">All Status</option>
            <option value="Operational">Operational</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        {["staff", "manager", "admin"].includes(user?.role) && (
          <div className="flex">
            <button
              className="flex items-center justify-center gap-1 border border-gray-900/40 rounded-lg bg-[#C8102E] text-white px-3 py-2 hover:bg-[#C8102E]/80 cursor-pointer"
              onClick={() => setIsOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add Ride
            </button>
          </div>
        )}
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
              <h2 className="text-lg font-bold text-gray-900">Delete Ride</h2>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete ride #{deleteId}? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ride Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="font-bold text-xl text-gray-900">Add New Ride</h1>
                <p className="text-sm text-gray-500">Fill in the details for the new ride</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg cursor-pointer transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-1.5 font-medium text-gray-700">
              Ride Name
              <input type="text" name="name" className="border border-gray-400 rounded-lg px-3 py-2.5 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20 outline-none font-normal" value={formData.name} onChange={handleChange} placeholder="Cougar Express" />
            </div>
            <div className="flex gap-4 font-medium text-gray-700">
              <div className="flex flex-col gap-1.5 flex-1">
                Capacity
                <input type="number" name="capacity" className="border border-gray-400 rounded-lg px-3 py-2.5 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20 outline-none w-full font-normal" value={formData.capacity} onChange={handleChange} placeholder="250" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                Min Height (in)
                <input type="number" name="minHeight" className="border border-gray-400 rounded-lg px-3 py-2.5 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20 outline-none w-full font-normal" value={formData.minHeight} onChange={handleChange} placeholder="72" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 font-medium text-gray-700">
              Location
              <input type="text" name="location" className="border border-gray-400 rounded-lg px-3 py-2.5 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20 outline-none font-normal" value={formData.location} onChange={handleChange} placeholder="Zone A" />
            </div>
            <div className="flex items-center gap-3 font-medium text-gray-700">
              Status
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <select name="status" value={formData.status} onChange={handleChange} className={`outline-none px-3 py-2 font-medium cursor-pointer
                  ${formData.status === "Operational" ? "bg-green-600 text-white" : ""}
                  ${formData.status === "Maintenance" ? "bg-yellow-600 text-white" : ""}
                  ${formData.status === "Closed"      ? "bg-red-600 text-white"   : ""}
                `}>
                  <option value="Operational">Operational</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="border-t border-gray-200" />
            <div className="flex justify-center gap-10">
              <button className="border px-10 rounded-xl p-2 font-medium bg-[#C8102E] text-white shadow-lg hover:bg-[#C8102E]/80 cursor-pointer transition-colors" onClick={handleSubmit}>
                Submit
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
            <th className="px-10 py-3 text-left font-medium text-gray-500">Ride ID</th>
            <th className="px-10 py-3 text-left font-medium text-gray-500">Ride Name</th>
            <th className="px-10 py-3 text-left font-medium text-gray-500">Capacity</th>
            <th className="px-10 py-3 text-left font-medium text-gray-500">Min Height</th>
            <th className="px-10 py-3 text-left font-medium text-gray-500">Location</th>
            <th className="px-10 py-3 text-left font-medium text-gray-500">Wait Time</th>
            <th className="px-10 py-3 text-left font-medium text-gray-500">Status</th>
{["staff", "manager", "admin"].includes(user?.role) && (
              <th className="px-10 py-3 text-left font-medium text-gray-500">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <tr>
              <td colSpan={["staff", "manager", "admin"].includes(user?.role) ? "8" : "7"} className="px-10 py-6 text-center text-gray-400">Loading rides...</td>
            </tr>
          )}
          {error && (
            <tr>
              <td colSpan={["staff", "manager", "admin"].includes(user?.role) ? "8" : "7"} className="px-10 py-6 text-center text-red-400">{error}</td>
            </tr>
          )}
          {filteredRides.length === 0 && !loading && (
            <tr>
              <td colSpan={["staff", "manager", "admin"].includes(user?.role) ? "8" : "7"} className="px-10 py-6 text-center text-gray-400">No rides found</td>
            </tr>
          )}
          {filteredRides.map((ride) => (
            <tr key={ride.ride_id} className="hover:bg-gray-50 transition-colors">
              <td className="px-10 py-3 text-gray-600">{ride.ride_id}</td>
              <td className="px-10 py-3 font-medium text-gray-900">{ride.ride_name}</td>
              <td className="px-10 py-3 text-gray-600">{ride.capacity_per_cycle}</td>
              <td className="px-10 py-3 text-gray-600">{ride.min_height_in}</td>
              <td className="px-10 py-3 text-gray-600">{ride.location}</td>
              <td className="px-10 py-3 text-gray-600">{ride.wait_time ?? "—"}</td>
              <td className="px-10 py-3">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${ride.status === "Operational" ? "bg-green-100 text-green-700" : ""}
                  ${ride.status === "Maintenance" ? "bg-yellow-100 text-yellow-700" : ""}
                  ${ride.status === "Closed"      ? "bg-red-100 text-red-700"      : ""}
                `}>
                  {ride.status}
                </span>
              </td>
              {["staff", "manager", "admin"].includes(user?.role) && (
                <td className="px-10 py-3">
                  <button onClick={() => setDeleteId(ride.ride_id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 713.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.021-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
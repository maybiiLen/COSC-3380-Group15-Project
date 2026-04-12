import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"

const TABS = [
  { id: "restaurants", label: "Restaurants", icon: "🍔" },
  { id: "gift-shops", label: "Gift Shops", icon: "🎁" },
  { id: "games", label: "Games", icon: "🎯" },
  { id: "merch", label: "Merchandise", icon: "🧸" },
]

export default function ParkOperations() {
  const { user } = useAuth()
  const [tab, setTab] = useState("restaurants")
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({})
  const canEdit = ["manager", "admin"].includes(user?.role)

  useEffect(() => { fetchData() }, [tab])

  async function fetchData() {
    setLoading(true)
    try {
      const endpoint = tab === "closures" ? "park-closures" : tab
      const res = await fetch(`${API_BASE_URL}/api/park-ops/${endpoint}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    try {
      const endpoint = tab === "closures" ? "park-closures" : tab
      const res = await fetch(`${API_BASE_URL}/api/park-ops/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowAdd(false)
        setForm({})
        fetchData()
      }
    } catch (err) {
      console.error("Error:", err)
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure?")) return
    try {
      const endpoint = tab === "closures" ? "park-closures" : tab
      await fetch(`${API_BASE_URL}/api/park-ops/${endpoint}/${id}`, { method: "DELETE" })
      fetchData()
    } catch (err) {
      console.error("Error:", err)
    }
  }

  async function handleDeactivateClosure(id) {
    try {
      await fetch(`${API_BASE_URL}/api/park-ops/park-closures/${id}/deactivate`, { method: "PATCH" })
      fetchData()
    } catch (err) {
      console.error("Error:", err)
    }
  }

  function statusBadge(status) {
    const isOpen = status === 1 || status === true
    return (
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {isOpen ? "Open" : "Closed"}
      </span>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dining & Shops</h1>
          <p className="mt-1 text-sm text-gray-500">Manage restaurants, gift shops, games, and merchandise</p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowAdd(true); setForm({}) }}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer">
            + Add {TABS.find(t => t.id === tab)?.label.slice(0, -1) || "Item"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
              tab === t.id ? "bg-[#C8102E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl text-gray-900">
                {tab === "closures" ? "Create Zone Closure" : `Add ${TABS.find(t => t.id === tab)?.label.slice(0, -1)}`}
              </h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              {tab === "restaurants" && (
                <>
                  <input placeholder="Name" required value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <input placeholder="Food Type (e.g. American, Asian)" value={form.food_type || ""} onChange={e => setForm({...form, food_type: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <input placeholder="Location (e.g. Zone A)" required value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                </>
              )}
              {tab === "gift-shops" && (
                <>
                  <input placeholder="Name" required value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <input placeholder="Location" required value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                </>
              )}
              {tab === "games" && (
                <>
                  <input placeholder="Game Name" required value={form.game_name || ""} onChange={e => setForm({...form, game_name: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <input placeholder="Max Players" type="number" value={form.max_players || ""} onChange={e => setForm({...form, max_players: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <input placeholder="Location" required value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                </>
              )}
              {tab === "merch" && (
                <>
                  <input placeholder="Product Name" required value={form.merch_name || ""} onChange={e => setForm({...form, merch_name: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <input placeholder="Category (e.g. Apparel, Toys)" value={form.merch_category || ""} onChange={e => setForm({...form, merch_category: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  <div className="flex gap-3">
                    <input placeholder="Wholesale $" type="number" step="0.01" value={form.wholesale_price || ""} onChange={e => setForm({...form, wholesale_price: e.target.value})}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                    <input placeholder="Retail $" type="number" step="0.01" value={form.retail_price || ""} onChange={e => setForm({...form, retail_price: e.target.value})}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={form.game_award || false} onChange={e => setForm({...form, game_award: e.target.checked})} />
                    This is a game prize (not sold directly)
                  </label>
                  <input placeholder="Sold Location" value={form.sold_location || ""} onChange={e => setForm({...form, sold_location: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" />
                </>
              )}
              {tab === "closures" && (
                <>
                  <select required value={form.zone || ""} onChange={e => setForm({...form, zone: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]">
                    <option value="">Select Zone</option>
                    <option value="Zone A">Zone A</option>
                    <option value="Zone B">Zone B</option>
                    <option value="Zone C">Zone C</option>
                    <option value="Zone D">Zone D</option>
                  </select>
                  <select value={form.closure_type || "Weather"} onChange={e => setForm({...form, closure_type: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]">
                    <option value="Weather">Weather</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Safety">Safety</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Event">Event</option>
                  </select>
                  <textarea placeholder="Reason for closure" required value={form.reason || ""} onChange={e => setForm({...form, reason: e.target.value})}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]" rows={3} />
                  <p className="text-xs text-red-500">⚠️ This will automatically close ALL rides in the selected zone and notify staff.</p>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer">
                  {tab === "closures" ? "Activate Closure" : "Add"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="mt-6">
        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
        ) : data.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">No {tab.replace("-", " ")} found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {tab === "restaurants" && (
                  <><th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Food Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Total Sales</th>
                  {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}</>
                )}
                {tab === "gift-shops" && (
                  <><th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Total Sales</th>
                  {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}</>
                )}
                {tab === "games" && (
                  <><th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Game</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Max Players</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Total Sales</th>
                  {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}</>
                )}
                {tab === "merch" && (
                  <><th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Wholesale</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Retail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Prize?</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}</>
                )}
                {tab === "closures" && (
                  <><th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Zone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Started</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ended</th>
                  {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}</>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tab === "restaurants" && data.map(r => (
                <tr key={r.restaurant_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">#{r.restaurant_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.food_type || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.location}</td>
                  <td className="px-4 py-3">{statusBadge(r.operational_status)}</td>
                  <td className="px-4 py-3 text-gray-900">${Number(r.total_sales || 0).toLocaleString()}</td>
                  {canEdit && <td className="px-4 py-3"><button onClick={() => handleDelete(r.restaurant_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button></td>}
                </tr>
              ))}
              {tab === "gift-shops" && data.map(g => (
                <tr key={g.gift_shop_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">#{g.gift_shop_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.location}</td>
                  <td className="px-4 py-3">{statusBadge(g.operational_status)}</td>
                  <td className="px-4 py-3 text-gray-900">${Number(g.total_sales || 0).toLocaleString()}</td>
                  {canEdit && <td className="px-4 py-3"><button onClick={() => handleDelete(g.gift_shop_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button></td>}
                </tr>
              ))}
              {tab === "games" && data.map(g => (
                <tr key={g.game_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">#{g.game_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{g.game_name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.max_players}</td>
                  <td className="px-4 py-3 text-gray-600">{g.location}</td>
                  <td className="px-4 py-3">{statusBadge(g.operational_status)}</td>
                  <td className="px-4 py-3 text-gray-900">${Number(g.total_sales || 0).toLocaleString()}</td>
                  {canEdit && <td className="px-4 py-3"><button onClick={() => handleDelete(g.game_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button></td>}
                </tr>
              ))}
              {tab === "merch" && data.map(m => (
                <tr key={m.merch_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">#{m.merch_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.merch_name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.merch_category}</td>
                  <td className="px-4 py-3 text-gray-600">${Number(m.wholesale_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-900">{m.game_award ? "—" : `$${Number(m.retail_price || 0).toFixed(2)}`}</td>
                  <td className="px-4 py-3">{m.game_award ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Prize</span> : "No"}</td>
                  <td className="px-4 py-3 text-gray-600">{m.sold_location}</td>
                  {canEdit && <td className="px-4 py-3"><button onClick={() => handleDelete(m.merch_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button></td>}
                </tr>
              ))}
              {tab === "closures" && data.map(c => (
                <tr key={c.closure_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">#{c.closure_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.zone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.closure_type === "Emergency" ? "bg-red-100 text-red-700" :
                      c.closure_type === "Weather" ? "bg-blue-100 text-blue-700" :
                      c.closure_type === "Safety" ? "bg-orange-100 text-orange-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{c.closure_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{c.reason}</td>
                  <td className="px-4 py-3">
                    {c.is_active ?
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Active</span> :
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Resolved</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.ended_at ? new Date(c.ended_at).toLocaleString() : "—"}</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      {c.is_active && (
                        <button onClick={() => handleDeactivateClosure(c.closure_id)}
                          className="text-green-600 hover:text-green-800 text-xs font-medium cursor-pointer">
                          ✅ Lift Closure
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
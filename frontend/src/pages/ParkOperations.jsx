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
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({})
  const canEdit = ["manager", "admin"].includes(user?.role)

  useEffect(() => { fetchData() }, [tab])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/${tab}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (err) { console.error("Error:", err) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) { setShowAdd(false); setForm({}); fetchData() }
    } catch (err) { console.error(err) }
  }

  async function handleEditSave(e) {
    e.preventDefault()
    const idField = tab === "restaurants" ? "restaurant_id" : tab === "gift-shops" ? "gift_shop_id" : tab === "games" ? "game_id" : "merch_id"
    const id = editItem[idField]
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/${tab}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) { setEditItem(null); setForm({}); fetchData() }
    } catch (err) { console.error(err) }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure?")) return
    try {
      await fetch(`${API_BASE_URL}/api/park-ops/${tab}/${id}`, { method: "DELETE" })
      fetchData()
    } catch (err) { console.error(err) }
  }

  function openEdit(item) {
    setEditItem(item)
    if (tab === "restaurants") {
      setForm({ name: item.name, food_type: item.food_type || "", location: item.location, operational_status: item.operational_status, description: item.description || "", image_url: item.image_url || "" })
    } else if (tab === "gift-shops") {
      setForm({ name: item.name, location: item.location, operational_status: item.operational_status, description: item.description || "", image_url: item.image_url || "" })
    } else if (tab === "games") {
      setForm({ game_name: item.game_name, max_players: item.max_players, location: item.location, operational_status: item.operational_status, description: item.description || "", image_url: item.image_url || "", prize_type: item.prize_type || "" })
    } else {
      setForm({ merch_name: item.merch_name, merch_category: item.merch_category, wholesale_price: item.wholesale_price, retail_price: item.retail_price, game_award: item.game_award, sold_location: item.sold_location })
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

  const inp = "border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C8102E]"

  // Form fields per tab
  function renderFormFields() {
    if (tab === "restaurants") return (
      <>
        <input placeholder="Name" required value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} className={inp} />
        <input placeholder="Food Type (e.g. American, Asian)" value={form.food_type || ""} onChange={e => setForm({...form, food_type: e.target.value})} className={inp} />
        <input placeholder="Location (e.g. Zone A)" required value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} className={inp} />
        <textarea placeholder="Description" rows={2} value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className={inp} />
        <input placeholder="Image URL" value={form.image_url || ""} onChange={e => setForm({...form, image_url: e.target.value})} className={inp} />
        <select value={form.operational_status ?? 1} onChange={e => setForm({...form, operational_status: Number(e.target.value)})} className={inp}>
          <option value={1}>Open</option>
          <option value={0}>Closed</option>
        </select>
      </>
    )
    if (tab === "gift-shops") return (
      <>
        <input placeholder="Name" required value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} className={inp} />
        <input placeholder="Location" required value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} className={inp} />
        <textarea placeholder="Description" rows={2} value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className={inp} />
        <input placeholder="Image URL" value={form.image_url || ""} onChange={e => setForm({...form, image_url: e.target.value})} className={inp} />
        <select value={form.operational_status ?? 1} onChange={e => setForm({...form, operational_status: Number(e.target.value)})} className={inp}>
          <option value={1}>Open</option>
          <option value={0}>Closed</option>
        </select>
      </>
    )
    if (tab === "games") return (
      <>
        <input placeholder="Game Name" required value={form.game_name || ""} onChange={e => setForm({...form, game_name: e.target.value})} className={inp} />
        <input placeholder="Max Players" type="number" value={form.max_players || ""} onChange={e => setForm({...form, max_players: e.target.value})} className={inp} />
        <input placeholder="Location" required value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} className={inp} />
        <textarea placeholder="Description" rows={2} value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className={inp} />
        <input placeholder="Image URL" value={form.image_url || ""} onChange={e => setForm({...form, image_url: e.target.value})} className={inp} />
        <input placeholder="Prize Type (e.g. Giant Stuffed Bear)" value={form.prize_type || ""} onChange={e => setForm({...form, prize_type: e.target.value})} className={inp} />
        <select value={form.operational_status ?? 1} onChange={e => setForm({...form, operational_status: Number(e.target.value)})} className={inp}>
          <option value={1}>Open</option>
          <option value={0}>Closed</option>
        </select>
      </>
    )
    if (tab === "merch") return (
      <>
        <input placeholder="Product Name" required value={form.merch_name || ""} onChange={e => setForm({...form, merch_name: e.target.value})} className={inp} />
        <input placeholder="Category (e.g. Apparel, Toys)" value={form.merch_category || ""} onChange={e => setForm({...form, merch_category: e.target.value})} className={inp} />
        <div className="flex gap-3">
          <input placeholder="Wholesale $" type="number" step="0.01" value={form.wholesale_price || ""} onChange={e => setForm({...form, wholesale_price: e.target.value})} className={`flex-1 ${inp}`} />
          <input placeholder="Retail $" type="number" step="0.01" value={form.retail_price || ""} onChange={e => setForm({...form, retail_price: e.target.value})} className={`flex-1 ${inp}`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.game_award || false} onChange={e => setForm({...form, game_award: e.target.checked})} />
          This is a game prize (not sold directly)
        </label>
        <input placeholder="Sold Location" value={form.sold_location || ""} onChange={e => setForm({...form, sold_location: e.target.value})} className={inp} />
      </>
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

      {/* Add/Edit Modal */}
      {(showAdd || editItem) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl text-gray-900">
                {editItem ? `Edit ${TABS.find(t => t.id === tab)?.label.slice(0, -1)}` : `Add ${TABS.find(t => t.id === tab)?.label.slice(0, -1)}`}
              </h2>
              <button onClick={() => { setShowAdd(false); setEditItem(null) }} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={editItem ? handleEditSave : handleAdd} className="flex flex-col gap-3">
              {renderFormFields()}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer">
                  {editItem ? "Save Changes" : "Add"}
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setEditItem(null) }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {tab === "restaurants" && <>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Food Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                    {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}
                  </>}
                  {tab === "gift-shops" && <>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                    {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}
                  </>}
                  {tab === "games" && <>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Game</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Players</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Prize</th>
                    {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}
                  </>}
                  {tab === "merch" && <>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Wholesale</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Retail</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Prize?</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                    {canEdit && <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>}
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tab === "restaurants" && data.map(r => (
                  <tr key={r.restaurant_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.food_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.location}</td>
                    <td className="px-4 py-3">{statusBadge(r.operational_status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.description || "—"}</td>
                    {canEdit && <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer">Edit</button>
                      <button onClick={() => handleDelete(r.restaurant_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button>
                    </td>}
                  </tr>
                ))}
                {tab === "gift-shops" && data.map(g => (
                  <tr key={g.gift_shop_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-3 text-gray-600">{g.location}</td>
                    <td className="px-4 py-3">{statusBadge(g.operational_status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{g.description || "—"}</td>
                    {canEdit && <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(g)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer">Edit</button>
                      <button onClick={() => handleDelete(g.gift_shop_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button>
                    </td>}
                  </tr>
                ))}
                {tab === "games" && data.map(g => (
                  <tr key={g.game_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{g.game_name}</td>
                    <td className="px-4 py-3 text-gray-600">{g.max_players}</td>
                    <td className="px-4 py-3 text-gray-600">{g.location}</td>
                    <td className="px-4 py-3">{statusBadge(g.operational_status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{g.prize_type || "—"}</td>
                    {canEdit && <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(g)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer">Edit</button>
                      <button onClick={() => handleDelete(g.game_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button>
                    </td>}
                  </tr>
                ))}
                {tab === "merch" && data.map(m => (
                  <tr key={m.merch_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.merch_name}</td>
                    <td className="px-4 py-3 text-gray-600">{m.merch_category}</td>
                    <td className="px-4 py-3 text-gray-600">${Number(m.wholesale_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-900">{m.game_award ? "—" : `$${Number(m.retail_price || 0).toFixed(2)}`}</td>
                    <td className="px-4 py-3">{m.game_award ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Prize</span> : "No"}</td>
                    <td className="px-4 py-3 text-gray-600">{m.sold_location}</td>
                    {canEdit && <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(m)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer">Edit</button>
                      <button onClick={() => handleDelete(m.merch_id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
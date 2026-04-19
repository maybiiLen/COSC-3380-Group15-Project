import { useState, useEffect } from "react"
import { API_BASE_URL, authFetch } from "../utils/api"

/**
 * Full-page Notifications inbox. Replaces the old sidebar dropdown bell.
 * Supports:
 *   - mark one / mark all as read
 *   - delete one notification
 *   - clear the entire inbox
 *   - filter: all / unread / read
 */
export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all") // all | unread | read
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // notification object
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(`${API_BASE_URL}/api/notifications`)
      if (!res.ok) throw new Error("Failed to load notifications")
      setItems(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id) {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: "PATCH",
      })
      if (res.ok) {
        setItems(items.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
      }
    } catch {}
  }

  async function markAllRead() {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
      })
      if (res.ok) setItems(items.map(n => ({ ...n, is_read: true })))
    } catch {}
  }

  async function deleteOne(id) {
    setBusy(true)
    try {
      const res = await authFetch(`${API_BASE_URL}/api/notifications/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setItems(items.filter(n => n.notification_id !== id))
        setConfirmDelete(null)
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.message || "Failed to delete notification")
      }
    } catch (err) {
      alert("Network error while deleting")
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    setBusy(true)
    try {
      const res = await authFetch(`${API_BASE_URL}/api/notifications`, {
        method: "DELETE",
      })
      if (res.ok) {
        setItems([])
        setConfirmClear(false)
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.message || "Failed to clear inbox")
      }
    } catch (err) {
      alert("Network error while clearing inbox")
    } finally {
      setBusy(false)
    }
  }

  const unreadCount = items.filter(n => !n.is_read).length
  const filtered = items.filter(n => {
    if (filter === "unread") return !n.is_read
    if (filter === "read") return n.is_read
    return true
  })

  const timeAgo = (date) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
    return `${Math.floor(mins / 1440)}d ago`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {items.length} total · {unreadCount} unread
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Mark all as read
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={items.length === 0}
            className="px-3 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Clear inbox
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex items-center gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All ({items.length})
        </FilterPill>
        <FilterPill active={filter === "unread"} onClick={() => setFilter("unread")}>
          Unread ({unreadCount})
        </FilterPill>
        <FilterPill active={filter === "read"} onClick={() => setFilter("read")}>
          Read ({items.length - unreadCount})
        </FilterPill>
      </div>

      {/* List */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading && (
          <div className="px-6 py-10 text-sm text-gray-400 text-center">Loading…</div>
        )}
        {error && (
          <div className="px-6 py-10 text-sm text-red-600 text-center">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M15 17h5l-1.4-1.4A7 7 0 0 1 17 10.6V9a5 5 0 0 0-10 0v1.6A7 7 0 0 1 5.4 15.6L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {filter === "unread" ? "You're all caught up." : filter === "read" ? "No read notifications." : "No notifications yet."}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === "all" && "Assignments and alerts will show up here."}
            </p>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {filtered.map(n => (
              <li
                key={n.notification_id}
                className={`px-5 py-4 flex items-start gap-3 transition-colors ${n.is_read ? "" : "bg-red-50/50"}`}
              >
                {/* Unread dot */}
                <div className="pt-1 shrink-0">
                  {n.is_read ? (
                    <div className="h-2 w-2" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[#C8102E]" />
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    {n.type && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 uppercase tracking-wider">
                        {n.type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.notification_id)}
                      className="text-xs font-medium text-[#C8102E] hover:text-[#a50d25] cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(n)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition-colors"
                    title="Delete notification"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.021-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Clear-all confirmation modal */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-red-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.021-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Clear all notifications?</h2>
              <p className="text-sm text-gray-500 mt-1">
                This permanently deletes all {items.length} notifications in your inbox. You can't undo this.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClear(false)}
                disabled={busy}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={clearAll}
                disabled={busy}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer transition-colors disabled:opacity-60"
              >
                {busy ? "Clearing…" : "Clear inbox"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Delete this notification?</h2>
              <p className="text-sm text-gray-500 mt-1">
                "{confirmDelete.title}" will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={busy}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteOne(confirmDelete.notification_id)}
                disabled={busy}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer transition-colors disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
        active
          ? "bg-red-50 border-[#C8102E] text-[#C8102E]"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  )
}

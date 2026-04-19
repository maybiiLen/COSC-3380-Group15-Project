import { useState, useEffect } from "react"
import { API_BASE_URL, authFetch } from "../utils/api"
import { useAuth } from "../context/AuthContext"

/**
 * Staff-only dashboard. Lists the logged-in user's assigned maintenance
 * requests that are still open (Pending, In Progress, Awaiting Review).
 * Staff cannot edit or delete — the only action is "Mark Done" which
 * transitions the request to Awaiting Review and notifies a manager.
 * A manager must then confirm the work to close the request.
 */
export default function MyTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState("")
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(`${API_BASE_URL}/api/maintenance/my-tasks`)
      if (!res.ok) throw new Error("Failed to load tasks")
      setTasks(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function markDone(id) {
    setBusyId(id)
    try {
      const res = await authFetch(`${API_BASE_URL}/api/maintenance/${id}/mark-awaiting-review`, {
        method: "PATCH",
      })
      if (res.ok) {
        setConfirmId(null)
        await load()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.message || "Failed to mark task as done")
      }
    } catch {
      alert("Network error")
    } finally {
      setBusyId(null)
    }
  }

  const open = tasks.filter(t => t.status !== "Awaiting Review")
  const awaiting = tasks.filter(t => t.status === "Awaiting Review")

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="mt-1 text-sm text-gray-500">
          {tasks.length === 0
            ? "No tasks assigned to you."
            : `${open.length} open · ${awaiting.length} awaiting manager review`}
        </p>
      </div>

      {loading && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          Loading…
        </div>
      )}
      {error && !loading && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">You're all caught up.</p>
          <p className="mt-1 text-xs text-gray-400">New assignments will appear here.</p>
        </div>
      )}

      {!loading && !error && open.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Open Tasks</h2>
          <div className="grid gap-3">
            {open.map(t => (
              <TaskCard key={t.request_id}>
                <TaskBody t={t} />
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={t.status} />
                  <button
                    onClick={() => setConfirmId(t.request_id)}
                    disabled={busyId === t.request_id}
                    className="px-3 py-2 text-xs font-semibold bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer disabled:opacity-60"
                  >
                    Mark Done
                  </button>
                </div>
              </TaskCard>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && awaiting.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Waiting for Manager Review</h2>
          <div className="grid gap-3">
            {awaiting.map(t => (
              <TaskCard key={t.request_id} muted>
                <TaskBody t={t} />
                <StatusPill status={t.status} />
              </TaskCard>
            ))}
          </div>
        </section>
      )}

      {/* Confirm "Mark Done" modal */}
      {confirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Mark this task as done?</h2>
              <p className="text-sm text-gray-500 mt-1">
                A manager will be notified to review and close out the request.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                disabled={busyId !== null}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => markDone(confirmId)}
                disabled={busyId !== null}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#C8102E] text-white rounded-lg hover:bg-[#a50d25] cursor-pointer disabled:opacity-60"
              >
                {busyId !== null ? "Submitting…" : "Mark Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pieces ──────────────────────────────────────────
function TaskCard({ children, muted = false }) {
  return (
    <div className={`rounded-xl border p-5 flex items-start justify-between gap-4 flex-wrap ${
      muted ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 shadow-sm"
    }`}>
      {children}
    </div>
  )
}

function TaskBody({ t }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-gray-900">{t.ride_name}</h3>
        <PriorityPill priority={t.priority} />
      </div>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{t.description}</p>
      <p className="text-xs text-gray-400 mt-2">
        Ride currently <span className="font-medium">{t.ride_status}</span> · Assigned {new Date(t.created_at).toLocaleDateString()}
      </p>
    </div>
  )
}

function PriorityPill({ priority }) {
  const map = {
    Critical: "bg-red-100 text-red-700",
    High: "bg-orange-100 text-orange-700",
    Medium: "bg-yellow-100 text-yellow-700",
    Low: "bg-blue-100 text-blue-700",
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${map[priority] || "bg-gray-100 text-gray-700"}`}>
      {priority}
    </span>
  )
}

function StatusPill({ status }) {
  const map = {
    "Pending":           "bg-gray-100 text-gray-700",
    "In Progress":       "bg-blue-100 text-blue-700",
    "Awaiting Review":   "bg-amber-100 text-amber-800",
    "Completed":         "bg-green-100 text-green-700",
  }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  )
}

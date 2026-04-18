import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"

// CougarRide branding
import cougarrideLogo from '../assets/cougarride-logo.png'

export default function Staff() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "staff",
    hourly_rate: "",
  })
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ role: "staff", hourly_rate: "", shift_start: "", shift_end: "", ride_id: "" })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const isAdmin = user?.role === "admin"
  const f = "'DM Sans', sans-serif"

  const roleColors = {
    admin: { bg: "rgba(200,16,46,0.15)", color: "#C8102E", border: "rgba(200,16,46,0.3)" },
    manager: { bg: "rgba(140,29,64,0.15)", color: "#8C1D40", border: "rgba(140,29,64,0.3)" },
    staff: { bg: "rgba(244,132,95,0.15)", color: "#F4845F", border: "rgba(244,132,95,0.3)" },
  }

  useEffect(() => {
    fetchEmployees()
    fetch(`${API_BASE_URL}/api/rides?all=true`).then(r => r.json()).then(d => setRides(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function fetchEmployees() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees`)
      const data = await res.json()
      setEmployees(data)
    } catch (err) {
      console.error("Error fetching employees:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setCreating(true)

    try {
      const token = localStorage.getItem("accessToken")
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`
      const res = await fetch(`${API_BASE_URL}/api/auth/register/employee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(`Employee ${fullName} has been added successfully!`)
        setForm({ first_name: "", last_name: "", email: "", password: "", role: "staff", hourly_rate: "" })
        setShowCreate(false)
        fetchEmployees()
      } else {
        setError(data.message || "Failed to create employee")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  function openEdit(emp) {
    setEditItem(emp)
    setEditForm({
      role: emp.role || "staff",
      hourly_rate: emp.hourly_rate || "",
      shift_start: emp.shift_start || "",
      shift_end: emp.shift_end || "",
      ride_id: emp.ride_id || "",
    })
    setError("")
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees/${editItem.employee_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editForm.role,
          hourly_rate: editForm.hourly_rate ? Number(editForm.hourly_rate) : null,
          shift_start: editForm.shift_start || null,
          shift_end: editForm.shift_end || null,
          ride_id: editForm.ride_id ? Number(editForm.ride_id) : null,
        }),
      })
      if (res.ok) {
        setSuccess(`${editItem.full_name} updated successfully!`)
        setEditItem(null)
        fetchEmployees()
      } else {
        const d = await res.json()
        setError(d.message || "Failed to update")
      }
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        setSuccess("Employee removed successfully.")
        setDeleteId(null)
        fetchEmployees()
      } else {
        const d = await res.json()
        setError(d.message || "Failed to delete")
        setDeleteId(null)
      }
    } catch { setError("Network error"); setDeleteId(null) }
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

      {/* Header */}
      <div style={{
        padding: "2rem 2rem 1rem",
        borderBottom: "1px solid #1A1919",
        background: "linear-gradient(135deg, #0F0E0E 0%, #1A1919 100%)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <img src={cougarrideLogo} alt="CougarRide" style={{ height: "40px", width: "auto" }} />
            <div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "2rem",
                fontWeight: 900,
                color: "white",
                margin: 0
              }}>Staff Management</h1>
              <p style={{
                fontFamily: f,
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.6)",
                margin: 0
              }}>
                {isAdmin ? "👥 View and manage employee accounts" : "👀 View current staff members"}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                background: "linear-gradient(135deg, #C8102E, #8C1D40)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontFamily: f,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: "0 2px 8px rgba(200,16,46,0.3)"
              }}
              onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.target.style.transform = "translateY(0)"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" /><path d="M12 5v14" />
              </svg>
              Add Employee
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "2rem" }}>

        {/* Success/Error messages */}
        {success && (
          <div style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.5rem",
            background: "rgba(76,175,80,0.15)",
            border: "1px solid rgba(76,175,80,0.3)",
            borderRadius: "12px",
            fontFamily: f,
            fontSize: "0.85rem",
            color: "#81C784"
          }}>
            ✅ {success}
          </div>
        )}
        {error && (
          <div style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.5rem",
            background: "rgba(229,57,53,0.15)",
            border: "1px solid rgba(229,57,53,0.3)",
            borderRadius: "12px",
            fontFamily: f,
            fontSize: "0.85rem",
            color: "#EF9A9A"
          }}>
            ❌ {error}
          </div>
        )}

        {/* Summary cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem"
        }}>
          {[
            { label: "Total Staff", value: employees.length, icon: "👥", color: "#C8102E" },
            { label: "Managers", value: employees.filter(e => e.role === "manager").length, icon: "👨‍💼", color: "#8C1D40" },
            { label: "Staff Members", value: employees.filter(e => e.role === "staff").length, icon: "👷‍♀️", color: "#F4845F" }
          ].map((card, i) => (
            <div key={i} style={{
              background: "#1A1919",
              borderRadius: "16px",
              border: "1px solid #2A2929",
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              transition: "transform 0.15s"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: `linear-gradient(135deg, ${card.color}20, ${card.color}10)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem"
                }}>{card.icon}</div>
                <p style={{
                  fontFamily: f,
                  fontSize: "0.8rem",
                  color: "rgba(255,255,255,0.6)",
                  margin: 0,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>{card.label}</p>
              </div>
              <p style={{
                fontFamily: f,
                fontSize: "2rem",
                fontWeight: 900,
                color: card.color,
                margin: 0
              }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Create Employee Modal — Admin only */}
        {showCreate && isAdmin && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            backdropFilter: "blur(4px)"
          }}>
            <div style={{
              background: "#1A1919",
              borderRadius: "16px",
              border: "1px solid #2A2929",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
              padding: "2rem",
              width: "100%",
              maxWidth: "28rem",
              margin: "1rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                  <h2 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "1.5rem",
                    fontWeight: 900,
                    color: "white",
                    margin: 0
                  }}>Add New Employee</h2>
                  <p style={{
                    fontFamily: f,
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.6)",
                    margin: "0.25rem 0 0"
                  }}>Create a login for a new team member</p>
                </div>
                <button
                  onClick={() => { setShowCreate(false); setError("") }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    padding: "0.5rem",
                    borderRadius: "8px",
                    transition: "color 0.15s"
                  }}
                  onMouseEnter={e => e.target.style.color = "white"}
                  onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.6)"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: "block",
                      fontFamily: f,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                      marginBottom: "0.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>First Name</label>
                    <input
                      type="text"
                      required
                      value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })}
                      placeholder="Jane"
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
                      onFocus={e => e.target.style.borderColor = "#C8102E"}
                      onBlur={e => e.target.style.borderColor = "#3A3939"}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: "block",
                      fontFamily: f,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                      marginBottom: "0.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Last Name</label>
                    <input
                      type="text"
                      required
                      value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })}
                      placeholder="Smith"
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
                      onFocus={e => e.target.style.borderColor = "#C8102E"}
                      onBlur={e => e.target.style.borderColor = "#3A3939"}
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontFamily: f,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="jane.smith@cougarride.com"
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
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  />
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontFamily: f,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Temporary Password</label>
                  <input
                    type="text"
                    required
                    value={form.password}
                    minLength={8}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 characters"
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
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  />
                  <p style={{
                    fontFamily: f,
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.5)",
                    margin: "0.25rem 0 0"
                  }}>Employee will use this to log in for the first time</p>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontFamily: f,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      background: "#222",
                      border: "1px solid #3A3939",
                      borderRadius: "8px",
                      color: "white",
                      fontFamily: f,
                      fontSize: "0.85rem",
                      outline: "none",
                      cursor: "pointer"
                    }}
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p style={{
                    fontFamily: f,
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.5)",
                    margin: "0.25rem 0 0"
                  }}>
                    {form.role === "staff" && "Can view rides, manage maintenance tasks"}
                    {form.role === "manager" && "Can manage rides, view reports, oversee staff work"}
                    {form.role === "admin" && "Full access including employee management"}
                  </p>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontFamily: f,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Hourly Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.hourly_rate}
                    onChange={e => setForm({ ...form, hourly_rate: e.target.value })}
                    placeholder="18.50"
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
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: "0.75rem",
                    background: "rgba(229,57,53,0.15)",
                    border: "1px solid rgba(229,57,53,0.3)",
                    borderRadius: "8px",
                    fontFamily: f,
                    fontSize: "0.8rem",
                    color: "#EF9A9A"
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: creating ? "#666" : "linear-gradient(135deg, #C8102E, #8C1D40)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontFamily: f,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: creating ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      opacity: creating ? 0.7 : 1
                    }}
                  >
                    {creating ? "Creating..." : "Create Account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setError("") }}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: "transparent",
                      color: "rgba(255,255,255,0.7)",
                      border: "1px solid #3A3939",
                      borderRadius: "8px",
                      fontFamily: f,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={e => e.target.style.borderColor = "#C8102E"}
                    onMouseLeave={e => e.target.style.borderColor = "#3A3939"}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Employee Modal */}
        {editItem && isAdmin && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
            backdropFilter: "blur(4px)"
          }}>
            <div style={{
              background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)", padding: "2rem",
              width: "100%", maxWidth: "28rem", margin: "1rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 900, color: "white", margin: 0 }}>Edit Employee</h2>
                  <p style={{ fontFamily: f, fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", margin: "0.25rem 0 0" }}>{editItem.full_name} · {editItem.email}</p>
                </div>
                <button onClick={() => setEditItem(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "0.5rem", borderRadius: "8px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontFamily: f, fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{ width: "100%", padding: "0.75rem", background: "#222", border: "1px solid #3A3939", borderRadius: "8px", color: "white", fontFamily: f, fontSize: "0.85rem", outline: "none", cursor: "pointer" }}>
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontFamily: f, fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Hourly Rate ($)</label>
                  <input type="number" step="0.01" placeholder="15.00" value={editForm.hourly_rate} onChange={e => setEditForm({...editForm, hourly_rate: e.target.value})} style={{ width: "100%", padding: "0.75rem", background: "#222", border: "1px solid #3A3939", borderRadius: "8px", color: "white", fontFamily: f, fontSize: "0.85rem", outline: "none" }} />
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontFamily: f, fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Shift Start</label>
                    <input type="time" value={editForm.shift_start} onChange={e => setEditForm({...editForm, shift_start: e.target.value})} style={{ width: "100%", padding: "0.75rem", background: "#222", border: "1px solid #3A3939", borderRadius: "8px", color: "white", fontFamily: f, fontSize: "0.85rem", outline: "none" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontFamily: f, fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Shift End</label>
                    <input type="time" value={editForm.shift_end} onChange={e => setEditForm({...editForm, shift_end: e.target.value})} style={{ width: "100%", padding: "0.75rem", background: "#222", border: "1px solid #3A3939", borderRadius: "8px", color: "white", fontFamily: f, fontSize: "0.85rem", outline: "none" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontFamily: f, fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Assigned Ride</label>
                  <select value={editForm.ride_id} onChange={e => setEditForm({...editForm, ride_id: e.target.value})} style={{ width: "100%", padding: "0.75rem", background: "#222", border: "1px solid #3A3939", borderRadius: "8px", color: "white", fontFamily: f, fontSize: "0.85rem", outline: "none", cursor: "pointer" }}>
                    <option value="">No Ride Assignment</option>
                    {rides.map(r => <option key={r.ride_id} value={r.ride_id}>{r.ride_name} ({r.location})</option>)}
                  </select>
                </div>
                {error && <div style={{ padding: "0.75rem", background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.3)", borderRadius: "8px", fontFamily: f, fontSize: "0.8rem", color: "#EF9A9A" }}>{error}</div>}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  <button type="submit" disabled={saving} style={{ flex: 1, padding: "0.75rem", background: saving ? "#666" : "linear-gradient(135deg, #C8102E, #8C1D40)", color: "white", border: "none", borderRadius: "8px", fontFamily: f, fontSize: "0.85rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => setEditItem(null)} style={{ flex: 1, padding: "0.75rem", background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid #3A3939", borderRadius: "8px", fontFamily: f, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteId && isAdmin && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
            backdropFilter: "blur(4px)"
          }}>
            <div style={{
              background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)", padding: "2rem",
              width: "100%", maxWidth: "24rem", margin: "1rem"
            }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.3rem", fontWeight: 900, color: "white", margin: "0 0 0.75rem" }}>Remove Employee?</h2>
              <p style={{ fontFamily: f, fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", margin: "0 0 1.5rem" }}>This will permanently delete the employee and their user account. This action cannot be undone.</p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={handleDelete} style={{ flex: 1, padding: "0.75rem", background: "#E53935", color: "white", border: "none", borderRadius: "8px", fontFamily: f, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>Delete</button>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "0.75rem", background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid #3A3939", borderRadius: "8px", fontFamily: f, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Employees table */}
        <div style={{
          background: "#1A1919",
          borderRadius: "16px",
          border: "1px solid #2A2929",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            padding: "1.5rem",
            borderBottom: "1px solid #2A2929",
            background: "linear-gradient(135deg, #1A1919 0%, #141313 100%)"
          }}>
            <h3 style={{
              fontFamily: f,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "white",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              👥 Staff Directory
            </h3>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              fontSize: "0.9rem",
              borderCollapse: "collapse"
            }}>
              <thead>
                <tr style={{ background: "#141313", borderBottom: "1px solid #2A2929" }}>
                  {["ID", "Name", "Email", "Role", "Hourly Rate", ...(isAdmin ? ["Actions"] : [])].map((header) => (
                    <th key={header} style={{
                      padding: "1rem 1.5rem",
                      textAlign: "left",
                      fontFamily: f,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.7)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="6" style={{
                      padding: "3rem",
                      textAlign: "center",
                      fontFamily: f,
                      color: "rgba(255,255,255,0.5)"
                    }}>
                      ⏳ Loading employees...
                    </td>
                  </tr>
                )}
                {!loading && employees.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{
                      padding: "3rem",
                      textAlign: "center",
                      fontFamily: f,
                      color: "rgba(255,255,255,0.5)"
                    }}>
                      👤 No employees found
                    </td>
                  </tr>
                )}
                {employees.map((emp, index) => (
                  <tr key={emp.employee_id} style={{
                    borderBottom: index < employees.length - 1 ? "1px solid #2A2929" : "none",
                    background: "transparent",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(200,16,46,0.05)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontFamily: f,
                      color: "rgba(255,255,255,0.6)",
                      fontWeight: 500
                    }}>
                      #{emp.employee_id}
                    </td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontFamily: f,
                      fontWeight: 600,
                      color: "white"
                    }}>
                      {emp.full_name}
                    </td>
                    <td style={{
                      padding: "1rem 1.5rem",
                      fontFamily: f,
                      color: "rgba(255,255,255,0.7)",
                      fontSize: "0.85rem"
                    }}>
                      {emp.email}
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <span style={{
                        display: "inline-flex",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "50px",
                        fontSize: "0.75rem",
                        fontFamily: f,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        background: roleColors[emp.role]?.bg || "rgba(255,255,255,0.1)",
                        color: roleColors[emp.role]?.color || "#fff",
                        border: `1px solid ${roleColors[emp.role]?.border || "rgba(255,255,255,0.2)"}`
                      }}>
                        {emp.role}
                      </span>
                    </td>
                    <td style={{ padding: "1rem 1.5rem", fontFamily: f, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
                      {emp.hourly_rate ? `$${Number(emp.hourly_rate).toFixed(2)}/hr` : "—"}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "1rem 1.5rem" }}>
                        {emp.role === "admin" ? (
                          <span style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Protected</span>
                        ) : (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button onClick={() => openEdit(emp)} style={{ fontFamily: f, fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.75rem", borderRadius: "6px", cursor: "pointer", background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.3)", transition: "all 0.15s" }}>Edit</button>
                            <button onClick={() => setDeleteId(emp.employee_id)} style={{ fontFamily: f, fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.75rem", borderRadius: "6px", cursor: "pointer", background: "rgba(239,68,68,0.15)", color: "#F87171", border: "1px solid rgba(239,68,68,0.3)", transition: "all 0.15s" }}>Delete</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!isAdmin && (
          <div style={{
            marginTop: "2rem",
            padding: "1rem",
            background: "rgba(244,132,95,0.1)",
            border: "1px solid rgba(244,132,95,0.2)",
            borderRadius: "12px",
            textAlign: "center"
          }}>
            <p style={{
              fontFamily: f,
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              margin: 0
            }}>
              🔒 Only administrators can create or modify employee accounts
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
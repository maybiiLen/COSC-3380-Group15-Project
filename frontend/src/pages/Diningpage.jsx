import { useState, useEffect } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const foodIcons = { "American": "🍔", "Asian": "🍜", "Italian": "🍕", "BBQ": "🥩", "Snacks & Drinks": "🍿", "Mexican": "🌮" }

export default function DiningPage() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/park-ops/restaurants`)
      .then(r => r.json())
      .then(data => { setRestaurants(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openCount = restaurants.filter(r => r.operational_status === 1).length
  const cuisineTypes = [...new Set(restaurants.map(r => r.food_type).filter(Boolean))]
  const filtered = filter === "all" ? restaurants : filter === "open" ? restaurants.filter(r => r.operational_status === 1) : restaurants.filter(r => r.food_type === filter)

  return (
    <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
      <CustomerNav />

      {/* Hero */}
      <div style={{
        paddingTop: "94px",
        background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #0F0E0E 100%)",
        padding: "140px 2rem 4rem", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 0%, rgba(76,175,80,0.15) 0%, transparent 60%)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: f, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#81C784" }}>Dining & Refreshments</span>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0.5rem 0 0.75rem" }}>Fuel Your Adventure</h1>
          <p style={{ fontFamily: f, fontSize: "0.95rem", color: "rgba(255,255,255,0.6)", maxWidth: "550px", margin: "0 auto" }}>
            From quick bites to sit-down meals — {restaurants.length} dining locations with {openCount} currently open.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "center", gap: "3rem", padding: "2rem", flexWrap: "wrap" }}>
        {[
          { value: restaurants.length, label: "Total Locations", color: "white" },
          { value: openCount, label: "Open Now", color: "#4CAF50" },
          { value: restaurants.length - openCount, label: "Closed", color: "#F44336" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: fh, fontSize: "2rem", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: f, fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", padding: "0 2rem 2rem", flexWrap: "wrap" }}>
        <FilterBtn label="All" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterBtn label="Open Now" active={filter === "open"} onClick={() => setFilter("open")} />
        {cuisineTypes.map(c => (
          <FilterBtn key={c} label={`${foodIcons[c] || "🍽️"} ${c}`} active={filter === c} onClick={() => setFilter(c)} />
        ))}
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem 5rem" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: f }}>Loading restaurants...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
            {filtered.map(r => (
              <div key={r.restaurant_id} style={{
                background: "var(--cr-surface)", borderRadius: "16px", border: "1px solid var(--cr-border)",
                padding: "2rem",
                transition: "transform 0.3s var(--ease-out-expo), border-color 0.3s, box-shadow 0.3s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#4CAF50"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.4)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cr-border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                  <div style={{ fontSize: "2.5rem" }}>{foodIcons[r.food_type] || "🍽️"}</div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "4px 12px", borderRadius: "50px",
                    background: r.operational_status === 1 ? "rgba(76,175,80,0.12)" : "rgba(244,67,54,0.12)",
                    border: `1px solid ${r.operational_status === 1 ? "rgba(76,175,80,0.25)" : "rgba(244,67,54,0.25)"}`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.operational_status === 1 ? "#4CAF50" : "#F44336" }} />
                    <span style={{ fontFamily: f, fontSize: "0.65rem", fontWeight: 600, color: r.operational_status === 1 ? "#81C784" : "#EF9A9A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {r.operational_status === 1 ? "Open" : "Closed"}
                    </span>
                  </div>
                </div>
                <h2 style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 700, color: "white", margin: "0 0 0.35rem" }}>{r.name}</h2>
                <p style={{ fontFamily: f, fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", margin: "0 0 0.75rem" }}>{r.food_type || "Variety"} Cuisine</p>
                <div style={{ display: "flex", gap: "1rem", fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
                  <span>📍 {r.location}</span>
                  {r.total_sales > 0 && <span>💰 ${Number(r.total_sales).toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  )
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "'DM Sans', sans-serif", fontSize: "0.76rem", fontWeight: 600,
      padding: "7px 18px", borderRadius: "50px", cursor: "pointer",
      background: active ? "var(--cr-red)" : "transparent",
      color: active ? "white" : "rgba(255,255,255,0.5)",
      border: active ? "1px solid var(--cr-red)" : "1px solid var(--cr-border)",
      transition: "all 0.2s",
    }}>{label}</button>
  )
}
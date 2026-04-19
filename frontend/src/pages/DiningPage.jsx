import { useState, useEffect } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"
import heroImg from "../assets/actions/food.jpg"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const FALLBACK = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800"

export default function DiningPage() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("All")

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/park-ops/restaurants`)
      .then(r => r.json())
      .then(d => { setRestaurants(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const foodTypes = ["All", ...new Set(restaurants.map(r => r.food_type).filter(Boolean))]
  const filtered = filter === "All" ? restaurants : restaurants.filter(r => r.food_type === filter)
  const openCount = restaurants.filter(r => r.operational_status === 1).length

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <CustomerNav />
      <div style={{ paddingTop: "94px" }}>
        <div style={{
          position: "relative",
          padding: "5rem 2rem",
          textAlign: "center",
          backgroundImage: `linear-gradient(135deg, rgba(27,94,32,0.72), rgba(46,125,50,0.65), rgba(15,14,14,0.75)), url(${heroImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
        }}>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0 0 0.75rem", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}>Dining & Refreshments</h1>
          <p style={{ fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.9)", maxWidth: "600px", margin: "0 auto", textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}>
            {restaurants.length} dining locations · {openCount} currently open · Mobile ordering at select locations
          </p>
        </div>

        <div style={{ background: "white", padding: "1rem 0", borderBottom: "1px solid #e5e5e8", position: "sticky", top: "94px", zIndex: 10 }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {foodTypes.map(type => (
              <button key={type} onClick={() => setFilter(type)} style={{
                fontFamily: f, fontSize: "0.78rem", fontWeight: 600, padding: "8px 20px", borderRadius: "50px", cursor: "pointer",
                border: "1px solid", background: filter === type ? "#C8102E" : "white",
                color: filter === type ? "white" : "#555", borderColor: filter === type ? "#C8102E" : "#ddd",
              }}>{type === "All" ? "All Restaurants" : type}</button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
          {loading ? <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem" }}>Loading...</p> : filtered.length === 0 ? <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem" }}>No restaurants found.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {filtered.map((r, idx) => {
                const isOpen = r.operational_status === 1
                return (
                  <div key={r.restaurant_id} style={{
                    display: "flex", gap: 0, borderRadius: "16px", overflow: "hidden",
                    background: "white", border: "1px solid #e5e5e8", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "transform 0.3s, box-shadow 0.3s", animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ flex: "0 0 300px", height: "220px", overflow: "hidden", position: "relative" }}>
                      <img src={r.image_url || FALLBACK} alt={r.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        onError={e => { e.currentTarget.src = FALLBACK }} />
                      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", padding: "4px 14px", borderRadius: "50px", fontFamily: f, fontSize: "0.58rem", fontWeight: 700, color: "white", letterSpacing: "1px", textTransform: "uppercase" }}>{r.location}</div>
                    </div>
                    <div style={{ flex: 1, padding: "1.75rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{r.name}</h2>
                        <span style={{ fontFamily: f, fontSize: "0.55rem", fontWeight: 700, padding: "3px 10px", borderRadius: "50px", background: isOpen ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)", color: isOpen ? "#2E7D32" : "#C62828", textTransform: "uppercase", letterSpacing: "1px" }}>{isOpen ? "Open Now" : "Closed"}</span>
                      </div>
                      <span style={{ fontFamily: f, fontSize: "0.72rem", fontWeight: 600, color: "#999", marginBottom: "0.75rem" }}>{r.food_type || "Variety"} Cuisine</span>
                      {r.description && <p style={{ fontFamily: f, fontSize: "0.88rem", color: "#666", lineHeight: 1.6, margin: "0 0 1rem", maxWidth: "550px" }}>{r.description}</p>}
                      <div style={{ display: "flex", gap: "1.5rem", fontFamily: f, fontSize: "0.78rem", color: "#888" }}>
                        <div>📍 {r.location}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <CustomerFooter />
      </div>
    </div>
  )
}
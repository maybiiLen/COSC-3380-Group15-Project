import { useState, useEffect } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

const ZONES = ["All", "Zone A", "Zone B", "Zone C", "Zone D"]
const ZONE_NAMES = { "Zone A": "Thrill Alley", "Zone B": "Adventure Trail", "Zone C": "Rapids Row", "Zone D": "Family Fun" }

const thrillColor = (t) => {
  if (t === "Extreme") return "#E53935"
  if (t === "High") return "#FF6D00"
  if (t === "Moderate") return "#FFB300"
  return "#4CAF50"
}

const customerStatus = (s) => {
  if (s === "Operational") return { label: "Open", bg: "rgba(76,175,80,0.1)", color: "#2E7D32" }
  if (s === "Maintenance") return { label: "Maintenance", bg: "rgba(255,183,77,0.1)", color: "#E65100" }
  return { label: "Closed", bg: "rgba(244,67,54,0.1)", color: "#C62828" }
}

const FALLBACK_IMG = "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?w=800"

export default function CustomerRidesPage() {
  const [rides, setRides] = useState([])
  const [activeZone, setActiveZone] = useState("All")

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides?all=true`)
      .then(r => r.json())
      .then(d => setRides(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const filteredRides = activeZone === "All"
    ? rides.filter(r => r.status !== "Decommissioned")
    : rides.filter(r => r.location === activeZone && r.status !== "Decommissioned")

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <CustomerNav />
      <div style={{ paddingTop: "94px" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #C8102E, #8C1D40, #0F0E0E)",
          padding: "4rem 2rem", textAlign: "center",
        }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎢</div>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0 0 0.75rem" }}>
            Rides & Attractions
          </h1>
          <p style={{ fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.85)", maxWidth: "600px", margin: "0 auto" }}>
            {rides.filter(r => r.status === "Operational").length} rides open today · {rides.length} total attractions across 4 themed zones
          </p>
        </div>

        {/* Zone Filter */}
        <div style={{
          background: "white", padding: "1rem 0", borderBottom: "1px solid #e5e5e8",
          position: "sticky", top: "94px", zIndex: 10,
        }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {ZONES.map(zone => (
              <button key={zone} onClick={() => setActiveZone(zone)} style={{
                fontFamily: f, fontSize: "0.78rem", fontWeight: 600,
                padding: "8px 20px", borderRadius: "50px", cursor: "pointer",
                border: "1px solid",
                background: activeZone === zone ? "#C8102E" : "white",
                color: activeZone === zone ? "white" : "#555",
                borderColor: activeZone === zone ? "#C8102E" : "#ddd",
                transition: "all 0.15s",
              }}>
                {zone === "All" ? "All Rides" : `${zone} — ${ZONE_NAMES[zone]}`}
              </button>
            ))}
          </div>
        </div>

        {/* Ride Cards */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
          {filteredRides.length === 0 ? (
            <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem" }}>
              {rides.length === 0 ? "Loading rides..." : "No rides in this zone."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {filteredRides.map((ride, idx) => {
                const st = customerStatus(ride.status)
                return (
                  <div key={ride.ride_id} style={{
                    display: "flex", gap: 0, borderRadius: "16px", overflow: "hidden",
                    background: "white", border: "1px solid #e5e5e8",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "transform 0.3s, box-shadow 0.3s",
                    animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}
                  >
                    {/* Image */}
                    <div style={{ flex: "0 0 400px", height: "280px", overflow: "hidden", position: "relative" }}>
                      <img
                        src={ride.image_url || FALLBACK_IMG}
                        alt={ride.ride_name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s ease" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        onError={e => { e.currentTarget.src = FALLBACK_IMG }}
                      />
                      <div style={{
                        position: "absolute", top: 12, left: 12,
                        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                        padding: "4px 14px", borderRadius: "50px",
                        fontFamily: f, fontSize: "0.58rem", fontWeight: 700,
                        color: "white", letterSpacing: "1px", textTransform: "uppercase",
                      }}>{ride.location}</div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, padding: "1.75rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{ride.ride_name}</h2>
                        <span style={{
                          fontFamily: f, fontSize: "0.55rem", fontWeight: 700,
                          padding: "3px 10px", borderRadius: "50px",
                          background: st.bg, color: st.color,
                          textTransform: "uppercase", letterSpacing: "1px",
                        }}>{st.label}</span>
                      </div>

                      {ride.ride_type && (
                        <span style={{ fontFamily: f, fontSize: "0.72rem", fontWeight: 600, color: "#999", marginBottom: "0.75rem" }}>
                          {ride.ride_type}
                        </span>
                      )}

                      <p style={{ fontFamily: f, fontSize: "0.88rem", color: "#666", lineHeight: 1.6, margin: "0 0 1.25rem", maxWidth: "550px" }}>
                        {ride.description || "An exciting ride experience awaits."}
                      </p>

                      <div style={{ display: "flex", gap: "1.5rem", fontFamily: f, fontSize: "0.78rem", color: "#888", flexWrap: "wrap" }}>
                        {ride.thrill_level && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: thrillColor(ride.thrill_level) }} />
                            {ride.thrill_level} Thrill
                          </div>
                        )}
                        {ride.min_height_in > 0 && (
                          <div>📏 Min {ride.min_height_in}" tall</div>
                        )}
                        <div>👥 {ride.capacity_per_cycle} per cycle</div>
                        {ride.wait_time > 0 && (
                          <div>⏱️ ~{ride.wait_time} min wait</div>
                        )}
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
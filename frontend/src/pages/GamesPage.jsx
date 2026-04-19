import { useState, useEffect } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"
import heroImg from "../assets/actions/games.jpg"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const FALLBACK = "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800"

export default function GamesPage() {
  const [games, setGames] = useState([])
  const [merch, setMerch] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("All")

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/park-ops/games`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/park-ops/merch`).then(r => r.json()),
    ])
      .then(([g, m]) => { setGames(Array.isArray(g) ? g : []); setMerch(Array.isArray(m) ? m.filter(x => x.game_award) : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const zones = ["All", ...new Set(games.map(g => g.location).filter(Boolean))]
  const filtered = filter === "All" ? games : games.filter(g => g.location === filter)
  const openCount = games.filter(g => g.operational_status === 1).length

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <CustomerNav />
      <div style={{ paddingTop: "94px" }}>
        <div style={{
          position: "relative",
          padding: "5rem 2rem",
          textAlign: "center",
          backgroundImage: `linear-gradient(135deg, rgba(74,20,140,0.72), rgba(106,27,154,0.65), rgba(15,14,14,0.78)), url(${heroImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
        }}>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0 0 0.75rem", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}>Games & Entertainment</h1>
          <p style={{ fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.9)", maxWidth: "600px", margin: "0 auto", textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}>
            {games.length} midway games · {openCount} currently open · Win prizes and take home memories!
          </p>
        </div>

        <div style={{ background: "white", padding: "1rem 0", borderBottom: "1px solid #e5e5e8", position: "sticky", top: "94px", zIndex: 10 }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {zones.map(zone => (
              <button key={zone} onClick={() => setFilter(zone)} style={{
                fontFamily: f, fontSize: "0.78rem", fontWeight: 600, padding: "8px 20px", borderRadius: "50px", cursor: "pointer",
                border: "1px solid", background: filter === zone ? "#C8102E" : "white",
                color: filter === zone ? "white" : "#555", borderColor: filter === zone ? "#C8102E" : "#ddd",
              }}>{zone === "All" ? "All Games" : zone}</button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
          {loading ? <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem" }}>Loading...</p> : (
            <>
              {filtered.length === 0 ? <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem" }}>No games found.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "3rem" }}>
                  {filtered.map((g, idx) => {
                    const isOpen = g.operational_status === 1
                    return (
                      <div key={g.game_id} style={{
                        display: "flex", gap: 0, borderRadius: "16px", overflow: "hidden",
                        background: "white", border: "1px solid #e5e5e8", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        transition: "transform 0.3s, box-shadow 0.3s", animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <div style={{ flex: "0 0 300px", height: "220px", overflow: "hidden", position: "relative" }}>
                          <img src={g.image_url || FALLBACK} alt={g.game_name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s" }}
                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                            onError={e => { e.currentTarget.src = FALLBACK }} />
                          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", padding: "4px 14px", borderRadius: "50px", fontFamily: f, fontSize: "0.58rem", fontWeight: 700, color: "white", letterSpacing: "1px", textTransform: "uppercase" }}>{g.location}</div>
                        </div>
                        <div style={{ flex: 1, padding: "1.75rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                            <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{g.game_name}</h2>
                            <span style={{ fontFamily: f, fontSize: "0.55rem", fontWeight: 700, padding: "3px 10px", borderRadius: "50px", background: isOpen ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)", color: isOpen ? "#2E7D32" : "#C62828", textTransform: "uppercase", letterSpacing: "1px" }}>{isOpen ? "Now Playing" : "Closed"}</span>
                          </div>
                          <span style={{ fontFamily: f, fontSize: "0.72rem", fontWeight: 600, color: "#999", marginBottom: "0.75rem" }}>Up to {g.max_players} player{g.max_players > 1 ? "s" : ""}</span>
                          {g.description && <p style={{ fontFamily: f, fontSize: "0.88rem", color: "#666", lineHeight: 1.6, margin: "0 0 1rem", maxWidth: "550px" }}>{g.description}</p>}
                          <div style={{ display: "flex", gap: "1.5rem", fontFamily: f, fontSize: "0.78rem", color: "#888", flexWrap: "wrap" }}>
                            <div>📍 {g.location}</div>
                            {g.prize_type && <div>🏆 Prize: {g.prize_type}</div>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {merch.length > 0 && (
                <div style={{ background: "#f9f9f9", borderRadius: "16px", border: "1px solid #e5e5e8", padding: "2.5rem" }}>
                  <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", textAlign: "center", margin: "0 0 0.5rem" }}>🏆 Prizes You Can Win</h2>
                  <p style={{ fontFamily: f, fontSize: "0.85rem", color: "#999", textAlign: "center", margin: "0 0 2rem" }}>Show off your skills and take home one of these</p>
                  <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", flexWrap: "wrap" }}>
                    {merch.map(m => (
                      <div key={m.merch_id} style={{ background: "white", borderRadius: "14px", border: "1px solid #e5e5e8", padding: "1.25rem 1.75rem", textAlign: "center", minWidth: "160px" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎁</div>
                        <h4 style={{ fontFamily: f, fontSize: "0.9rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.3rem" }}>{m.merch_name}</h4>
                        <p style={{ fontFamily: f, fontSize: "0.72rem", color: "#999", margin: 0 }}>Win at {m.sold_location}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <CustomerFooter />
      </div>
    </div>
  )
}
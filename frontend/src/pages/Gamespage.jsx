import { useState, useEffect } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

export default function GamesPage() {
  const [games, setGames] = useState([])
  const [merch, setMerch] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/park-ops/games`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/park-ops/merch`).then(r => r.json()),
    ])
      .then(([gData, mData]) => {
        setGames(Array.isArray(gData) ? gData : [])
        setMerch(Array.isArray(mData) ? mData.filter(m => m.game_award) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const openCount = games.filter(g => g.operational_status === 1).length
  const gameColors = ["#6A1B9A", "#E65100", "#00838F", "#C62828", "#283593", "#2E7D32"]

  return (
    <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
      <CustomerNav />

      {/* Hero */}
      <div style={{
        paddingTop: "94px",
        background: "linear-gradient(135deg, #4A148C 0%, #6A1B9A 50%, #0F0E0E 100%)",
        padding: "140px 2rem 4rem", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(186,104,200,0.15) 0%, transparent 60%)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: f, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#CE93D8" }}>Games & Entertainment</span>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0.5rem 0 0.75rem" }}>Win Big, Play Bigger</h1>
          <p style={{ fontFamily: f, fontSize: "0.95rem", color: "rgba(255,255,255,0.6)", maxWidth: "550px", margin: "0 auto" }}>
            Test your skills at {games.length} midway games. {openCount} currently open. Win prizes from plush toys to giant stuffed animals!
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 2rem 5rem" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: f }}>Loading games...</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginBottom: "3rem" }}>
              {games.map((g, idx) => (
                <div key={g.game_id} style={{
                  background: `linear-gradient(145deg, ${gameColors[idx % gameColors.length]}22, ${gameColors[idx % gameColors.length]}08)`,
                  borderRadius: "16px",
                  border: `1px solid ${gameColors[idx % gameColors.length]}40`,
                  padding: "2rem", textAlign: "center",
                  transition: "transform 0.3s var(--ease-out-expo), box-shadow 0.3s",
                  animation: `fadeInUp 0.5s ease-out ${idx * 0.06}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = `0 16px 40px ${gameColors[idx % gameColors.length]}25` }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</div>
                  <h2 style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 700, color: "white", margin: "0 0 0.5rem" }}>{g.game_name}</h2>
                  <p style={{ fontFamily: f, fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", margin: "0 0 0.5rem" }}>
                    Up to {g.max_players} player{g.max_players > 1 ? "s" : ""}
                  </p>
                  <p style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", margin: "0 0 1rem" }}>📍 {g.location}</p>
                  <div style={{
                    display: "inline-flex", padding: "5px 14px", borderRadius: "50px",
                    background: g.operational_status === 1 ? "rgba(76,175,80,0.12)" : "rgba(244,67,54,0.12)",
                    border: `1px solid ${g.operational_status === 1 ? "rgba(76,175,80,0.25)" : "rgba(244,67,54,0.25)"}`,
                  }}>
                    <span style={{ fontFamily: f, fontSize: "0.7rem", fontWeight: 600, color: g.operational_status === 1 ? "#81C784" : "#EF9A9A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {g.operational_status === 1 ? "Now Playing" : "Closed"}
                    </span>
                  </div>
                  {g.total_sales > 0 && (
                    <p style={{ fontFamily: f, fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", marginTop: "0.75rem" }}>
                      💰 ${Number(g.total_sales).toLocaleString()} in prizes
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Prizes */}
            {merch.length > 0 && (
              <div style={{
                background: "linear-gradient(145deg, rgba(255,193,7,0.06), rgba(255,193,7,0.02))",
                borderRadius: "20px", border: "1px solid rgba(255,193,7,0.15)",
                padding: "2.5rem",
              }}>
                <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "white", textAlign: "center", margin: "0 0 0.5rem" }}>🏆 Prizes You Can Win</h2>
                <p style={{ fontFamily: f, fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", textAlign: "center", margin: "0 0 2rem" }}>Show off your skills and take home one of these</p>
                <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                  {merch.map(m => (
                    <div key={m.merch_id} style={{
                      background: "rgba(255,193,7,0.06)", borderRadius: "14px",
                      border: "1px solid rgba(255,193,7,0.15)",
                      padding: "1.25rem 1.75rem", textAlign: "center", minWidth: "160px",
                      transition: "transform 0.3s var(--ease-out-expo)",
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                    >
                      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎁</div>
                      <h4 style={{ fontFamily: fh, fontSize: "0.88rem", fontWeight: 700, color: "#FFE082", margin: "0 0 0.3rem" }}>{m.merch_name}</h4>
                      <p style={{ fontFamily: f, fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", margin: 0 }}>Win at {m.sold_location}</p>
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
  )
}
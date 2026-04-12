import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const categoryIcons = { "Apparel": "👕", "Toys": "🧸", "Souvenirs": "🏰", "Prizes": "🏆", "General": "🛍️" }

export default function ShoppingPage() {
  const [shops, setShops] = useState([])
  const [merch, setMerch] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/park-ops/gift-shops`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/park-ops/merch`).then(r => r.json()),
    ])
      .then(([shopData, merchData]) => {
        setShops(Array.isArray(shopData) ? shopData : [])
        setMerch(Array.isArray(merchData) ? merchData : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const categories = [...new Set(merch.map(m => m.merch_category))].filter(Boolean)
  const filteredMerch = filter === "all" ? merch.filter(m => !m.game_award) :
    filter === "prizes" ? merch.filter(m => m.game_award) :
    merch.filter(m => !m.game_award && m.merch_category === filter)

  return (
    <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
      <CustomerNav />

      {/* Hero */}
      <div style={{
        paddingTop: "94px",
        background: "linear-gradient(135deg, #00695C 0%, #00838F 50%, #0F0E0E 100%)",
        padding: "140px 2rem 4rem", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(0,188,212,0.12) 0%, transparent 60%)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: f, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#80DEEA" }}>Gift Shops & Souvenirs</span>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0.5rem 0 0.75rem" }}>Take Home the Magic</h1>
          <p style={{ fontFamily: f, fontSize: "0.95rem", color: "rgba(255,255,255,0.6)", maxWidth: "550px", margin: "0 auto" }}>
            Browse {shops.length} gift shop locations for exclusive CougarRide merchandise. Season Pass holders get 10% off!
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 2rem 5rem" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: f }}>Loading shops...</p>
        ) : (
          <>
            {/* Gift Shop Locations */}
            <h2 style={{ fontFamily: fh, fontSize: "1.3rem", fontWeight: 700, color: "white", margin: "0 0 1.25rem" }}>Our Locations</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
              {shops.map((s, idx) => (
                <div key={s.gift_shop_id} style={{
                  background: "var(--cr-surface)", borderRadius: "16px", border: "1px solid var(--cr-border)",
                  padding: "1.75rem", display: "flex", alignItems: "center", gap: "1.25rem",
                  transition: "transform 0.3s var(--ease-out-expo), border-color 0.3s, box-shadow 0.3s",
                  animation: `fadeInUp 0.5s ease-out ${idx * 0.08}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#00BCD4"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.35)" }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cr-border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
                >
                  <div style={{ fontSize: "2.5rem" }}>🎁</div>
                  <div>
                    <h3 style={{ fontFamily: fh, fontSize: "1.05rem", fontWeight: 700, color: "white", margin: "0 0 0.25rem" }}>{s.name}</h3>
                    <p style={{ fontFamily: f, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", margin: "0 0 0.25rem" }}>📍 {s.location}</p>
                    {s.total_sales > 0 && (
                      <p style={{ fontFamily: f, fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", margin: 0 }}>💰 ${Number(s.total_sales).toLocaleString()} in sales</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Category filter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <h2 style={{ fontFamily: fh, fontSize: "1.3rem", fontWeight: 700, color: "white", margin: 0 }}>Merchandise</h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <FilterBtn label="All" active={filter === "all"} onClick={() => setFilter("all")} />
                {categories.map(c => (
                  <FilterBtn key={c} label={c} active={filter === c} onClick={() => setFilter(c)} />
                ))}
                <FilterBtn label="🏆 Game Prizes" active={filter === "prizes"} onClick={() => setFilter("prizes")} />
              </div>
            </div>

            {/* Merchandise Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
              {filteredMerch.map((m, idx) => (
                <div key={m.merch_id} style={{
                  background: m.game_award ? "linear-gradient(145deg, rgba(255,193,7,0.08), rgba(255,193,7,0.02))" : "var(--cr-surface)",
                  borderRadius: "14px",
                  border: m.game_award ? "1px solid rgba(255,193,7,0.2)" : "1px solid var(--cr-border)",
                  padding: "1.5rem", textAlign: "center",
                  transition: "transform 0.3s var(--ease-out-expo), box-shadow 0.3s",
                  animation: `fadeInUp 0.4s ease-out ${idx * 0.04}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
                >
                  <div style={{ fontSize: "2.2rem", marginBottom: "0.6rem" }}>{m.game_award ? "🏆" : (categoryIcons[m.merch_category] || "🛍️")}</div>
                  <h3 style={{ fontFamily: fh, fontSize: "0.92rem", fontWeight: 700, color: m.game_award ? "#FFE082" : "white", margin: "0 0 0.3rem" }}>{m.merch_name}</h3>
                  <p style={{ fontFamily: f, fontSize: "0.73rem", color: "rgba(255,255,255,0.35)", margin: "0 0 0.5rem" }}>
                    {m.merch_category} · {m.sold_location}
                  </p>
                  {m.game_award ? (
                    <span style={{ fontFamily: f, fontSize: "0.76rem", fontWeight: 600, color: "#FFB74D" }}>Win at {m.sold_location}</span>
                  ) : (
                    <span style={{ fontFamily: fh, fontSize: "1.1rem", fontWeight: 700, color: "white" }}>${Number(m.retail_price).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>

            {filteredMerch.length === 0 && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: f, padding: "2rem" }}>No items in this category.</p>
            )}
          </>
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
import { useState, useEffect } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const FALLBACK = "https://images.unsplash.com/photo-1513267048331-5611cad62e41?w=800"
const CATEGORY_ICONS = { "Apparel": "👕", "Toys": "🧸", "Souvenirs": "🏰", "Prizes": "🏆", "General": "🛍️" }

export default function ShoppingPage() {
  const [shops, setShops] = useState([])
  const [merch, setMerch] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("All")

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/park-ops/gift-shops`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/park-ops/merch`).then(r => r.json()),
    ])
      .then(([s, m]) => { setShops(Array.isArray(s) ? s : []); setMerch(Array.isArray(m) ? m : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = ["All", ...new Set(merch.map(m => m.merch_category).filter(Boolean))]
  const retailMerch = merch.filter(m => !m.game_award)
  const filteredMerch = filter === "All" ? retailMerch : retailMerch.filter(m => m.merch_category === filter)

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <CustomerNav />
      <div style={{ paddingTop: "94px" }}>
        <div style={{ background: "linear-gradient(135deg, #00695C, #00897B, #26A69A)", padding: "4rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎁</div>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0 0 0.75rem" }}>Gift Shops & Souvenirs</h1>
          <p style={{ fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.85)", maxWidth: "600px", margin: "0 auto" }}>
            {shops.length} gift shop locations · Exclusive CougarRide merch · Season Pass holders get 10% off!
          </p>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
          {loading ? <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem" }}>Loading...</p> : (
            <>
              <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: "0 0 1.25rem" }}>Our Locations</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "3rem" }}>
                {shops.map((s, idx) => (
                  <div key={s.gift_shop_id} style={{
                    display: "flex", gap: 0, borderRadius: "16px", overflow: "hidden",
                    background: "white", border: "1px solid #e5e5e8", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "transform 0.3s, box-shadow 0.3s", animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ flex: "0 0 300px", height: "200px", overflow: "hidden", position: "relative" }}>
                      <img src={s.image_url || FALLBACK} alt={s.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        onError={e => { e.currentTarget.src = FALLBACK }} />
                      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", padding: "4px 14px", borderRadius: "50px", fontFamily: f, fontSize: "0.58rem", fontWeight: 700, color: "white", letterSpacing: "1px", textTransform: "uppercase" }}>{s.location}</div>
                    </div>
                    <div style={{ flex: 1, padding: "1.75rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: "0 0 0.5rem" }}>{s.name}</h2>
                      {s.description && <p style={{ fontFamily: f, fontSize: "0.88rem", color: "#666", lineHeight: 1.6, margin: "0 0 1rem", maxWidth: "550px" }}>{s.description}</p>}
                      <div style={{ fontFamily: f, fontSize: "0.78rem", color: "#888" }}>📍 {s.location}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Available Merchandise</h2>
                <p style={{ fontFamily: f, fontSize: "0.82rem", color: "#999", margin: 0 }}>Available for purchase in-park at our gift shop locations</p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilter(cat)} style={{
                    fontFamily: f, fontSize: "0.78rem", fontWeight: 600, padding: "8px 20px", borderRadius: "50px", cursor: "pointer",
                    border: "1px solid", background: filter === cat ? "#C8102E" : "white",
                    color: filter === cat ? "white" : "#555", borderColor: filter === cat ? "#C8102E" : "#ddd",
                  }}>{cat === "All" ? "All Items" : `${CATEGORY_ICONS[cat] || "🛍️"} ${cat}`}</button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem", marginBottom: "3rem" }}>
                {filteredMerch.map((m, idx) => (
                  <div key={m.merch_id} style={{
                    borderRadius: "16px", overflow: "hidden", background: "white", border: "1px solid #e5e5e8",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)", transition: "transform 0.3s, box-shadow 0.3s",
                    animation: `fadeInUp 0.4s ease-out ${idx * 0.03}s both`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontSize: "4rem" }}>
                      {CATEGORY_ICONS[m.merch_category] || "🛍️"}
                    </div>
                    <div style={{ padding: "1.25rem" }}>
                      <h3 style={{ fontFamily: fh, fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.3rem" }}>{m.merch_name}</h3>
                      <p style={{ fontFamily: f, fontSize: "0.75rem", color: "#999", margin: "0 0 0.5rem" }}>{m.merch_category} · {m.sold_location}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 800, color: "#1a1a1a" }}>${Number(m.retail_price).toFixed(2)}</span>
                        <span style={{ fontFamily: f, fontSize: "0.65rem", fontWeight: 600, padding: "3px 10px", borderRadius: "50px", background: "rgba(0,150,136,0.1)", color: "#00695C", textTransform: "uppercase", letterSpacing: "0.5px" }}>In-Park Only</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredMerch.length === 0 && <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "2rem" }}>No items in this category.</p>}
            </>
          )}
        </div>
        <CustomerFooter />
      </div>
    </div>
  )
}
import { useState, useEffect, useMemo } from "react"
import { API_BASE_URL } from "../utils/api"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"
import heroImg from "../assets/actions/gift-shop.jpg"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const FALLBACK = "https://images.unsplash.com/photo-1513267048331-5611cad62e41?w=800"
const CATEGORY_ICONS = { "Apparel": "👕", "Toys": "🧸", "Souvenirs": "🏰", "Prizes": "🏆", "General": "🛍️" }

export default function ShoppingPage() {
  const [shops, setShops] = useState([])
  const [merch, setMerch] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("All")

  // Cart state: { [merch_id]: qty }
  const [cart, setCart] = useState({})
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [receipt, setReceipt] = useState(null)

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

  const merchById = useMemo(() => {
    const map = new Map()
    retailMerch.forEach(m => map.set(m.merch_id, m))
    return map
  }, [retailMerch])

  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({ item: merchById.get(Number(id)), qty }))
    .filter(l => l.item)

  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0)
  const cartTotal = cartLines.reduce((sum, l) => sum + Number(l.item.retail_price) * l.qty, 0)

  function addToCart(merch_id) {
    setCart(c => ({ ...c, [merch_id]: (c[merch_id] || 0) + 1 }))
  }
  function setQty(merch_id, qty) {
    setCart(c => {
      const next = { ...c }
      if (qty <= 0) delete next[merch_id]
      else next[merch_id] = qty
      return next
    })
  }

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <CustomerNav />
      <div style={{ paddingTop: "94px" }}>
        <div style={{
          position: "relative",
          padding: "5rem 2rem",
          textAlign: "center",
          backgroundImage: `linear-gradient(135deg, rgba(0,105,92,0.72), rgba(0,137,123,0.65), rgba(15,14,14,0.75)), url(${heroImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
        }}>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0 0 0.75rem", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}>Gift Shops & Souvenirs</h1>
          <p style={{ fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.9)", maxWidth: "600px", margin: "0 auto", textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}>
            {shops.length} gift shop locations · Shop in-park or online · Season Pass holders get 10% off!
          </p>

          {/* Cart button */}
          <button
            onClick={() => setShowCart(true)}
            style={{
              position: "absolute", top: "1.5rem", right: "2rem",
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.6rem 1.2rem", background: "white", color: "#00695C",
              border: "none", borderRadius: "50px", fontFamily: f, fontSize: "0.85rem",
              fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            🛒 Cart
            {cartCount > 0 && (
              <span style={{
                background: "#C8102E", color: "white", borderRadius: "50px",
                padding: "2px 10px", fontSize: "0.75rem", fontWeight: 800,
              }}>{cartCount}</span>
            )}
          </button>
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
                <h2 style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Shop Merchandise</h2>
                <p style={{ fontFamily: f, fontSize: "0.82rem", color: "#999", margin: 0 }}>Order online for delivery, or pick up in-park at any gift shop.</p>
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
                    display: "flex", flexDirection: "column",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <MerchImage item={m} />
                    <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", flex: 1 }}>
                      <h3 style={{ fontFamily: fh, fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.3rem" }}>{m.merch_name}</h3>
                      {m.description && (
                        <p style={{ fontFamily: f, fontSize: "0.78rem", color: "#666", margin: "0 0 0.4rem", lineHeight: 1.45 }}>{m.description}</p>
                      )}
                      <p style={{ fontFamily: f, fontSize: "0.75rem", color: "#999", margin: "0 0 0.75rem" }}>{m.merch_category} · {m.sold_location}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                        <span style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 800, color: "#1a1a1a" }}>${Number(m.retail_price).toFixed(2)}</span>
                        {cart[m.merch_id] ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button onClick={() => setQty(m.merch_id, cart[m.merch_id] - 1)} style={iconBtn}>−</button>
                            <span style={{ fontFamily: f, fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{cart[m.merch_id]}</span>
                            <button onClick={() => setQty(m.merch_id, cart[m.merch_id] + 1)} style={iconBtn}>+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(m.merch_id)} style={{
                            fontFamily: f, fontSize: "0.75rem", fontWeight: 700, padding: "7px 14px",
                            borderRadius: "50px", background: "#C8102E", color: "white",
                            border: "none", cursor: "pointer",
                          }}>+ Add</button>
                        )}
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

      {/* Cart drawer */}
      {showCart && (
        <CartDrawer
          lines={cartLines} total={cartTotal}
          onClose={() => setShowCart(false)}
          onSetQty={setQty}
          onCheckout={() => { setShowCart(false); setShowCheckout(true) }}
        />
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <CheckoutModal
          lines={cartLines} total={cartTotal}
          onClose={() => setShowCheckout(false)}
          onSuccess={r => { setReceipt(r); setCart({}); setShowCheckout(false) }}
        />
      )}

      {/* Receipt modal */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════

const iconBtn = {
  width: "26px", height: "26px", borderRadius: "50%", border: "1px solid #ddd",
  background: "white", cursor: "pointer", fontFamily: f, fontSize: "0.9rem", fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center", color: "#555",
}

// Merch image with a graceful emoji fallback when the image URL is empty
// or the remote image fails to load.
function MerchImage({ item, size = "card" }) {
  const [failed, setFailed] = useState(false)
  const showImg = item.image_url && !failed
  const isCard = size === "card"
  const isThumb = size === "thumb"
  const containerStyle = isCard
    ? { height: "180px", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem", overflow: "hidden" }
    : { width: 52, height: 52, background: "#f5f5f5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0, overflow: "hidden" }

  return (
    <div style={containerStyle}>
      {showImg ? (
        <img
          src={item.image_url}
          alt={item.merch_name}
          onError={() => setFailed(true)}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
            borderRadius: isThumb ? 10 : 0,
          }}
        />
      ) : (
        CATEGORY_ICONS[item.merch_category] || "🛍️"
      )}
    </div>
  )
}

function CartDrawer({ lines, total, onClose, onSetQty, onCheckout }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(420px, 100%)", height: "100%", background: "white",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 800, margin: 0 }}>Your Cart</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#888" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>
          {lines.length === 0 && <p style={{ fontFamily: f, color: "#999", textAlign: "center", padding: "3rem 0" }}>Your cart is empty.</p>}
          {lines.map(l => (
            <div key={l.item.merch_id} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem 0", borderBottom: "1px solid #f3f3f3" }}>
              <MerchImage item={l.item} size="thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>{l.item.merch_name}</p>
                <p style={{ fontFamily: f, fontSize: "0.72rem", color: "#999", margin: "2px 0 6px" }}>${Number(l.item.retail_price).toFixed(2)} each</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button onClick={() => onSetQty(l.item.merch_id, l.qty - 1)} style={iconBtn}>−</button>
                  <span style={{ fontFamily: f, fontWeight: 700 }}>{l.qty}</span>
                  <button onClick={() => onSetQty(l.item.merch_id, l.qty + 1)} style={iconBtn}>+</button>
                  <span style={{ marginLeft: "auto", fontFamily: f, fontWeight: 700, color: "#1a1a1a" }}>
                    ${(Number(l.item.retail_price) * l.qty).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid #eee", background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontFamily: f, fontWeight: 600, color: "#666" }}>Total</span>
            <span style={{ fontFamily: fh, fontWeight: 800, fontSize: "1.3rem" }}>${total.toFixed(2)}</span>
          </div>
          <button
            disabled={lines.length === 0}
            onClick={onCheckout}
            style={{
              width: "100%", padding: "12px", borderRadius: "10px", border: "none",
              background: lines.length === 0 ? "#ccc" : "#C8102E", color: "white",
              fontFamily: f, fontSize: "0.9rem", fontWeight: 700,
              cursor: lines.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckoutModal({ lines, total, onClose, onSuccess }) {
  const [form, setForm] = useState({
    buyer_name: "", buyer_email: "", shipping_address: "",
    cardholder_name: "", card_number: "", exp: "", cvv: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function submit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/park-ops/merch/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: form.buyer_name.trim(),
          buyer_email: form.buyer_email.trim(),
          shipping_address: form.shipping_address.trim(),
          cardholder_name: form.cardholder_name.trim() || form.buyer_name.trim(),
          card_number: form.card_number,
          items: lines.map(l => ({ merch_id: l.item.merch_id, qty: l.qty })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "Checkout failed")
        return
      }
      onSuccess({ ...data, buyer_name: form.buyer_name, buyer_email: form.buyer_email })
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const input = {
    width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd",
    fontFamily: f, fontSize: "0.85rem", outline: "none",
  }
  const label = { fontFamily: f, fontSize: "0.72rem", fontWeight: 600, color: "#555", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.4px" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} style={{
        background: "white", borderRadius: "14px", width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 800, margin: 0 }}>Checkout</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#888" }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <h3 style={{ fontFamily: fh, fontSize: "0.85rem", fontWeight: 800, margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "#555" }}>Contact & Shipping</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div>
              <label style={label}>Full Name</label>
              <input required value={form.buyer_name} onChange={e => setForm({ ...form, buyer_name: e.target.value })} style={input} />
            </div>
            <div>
              <label style={label}>Email</label>
              <input required type="email" value={form.buyer_email} onChange={e => setForm({ ...form, buyer_email: e.target.value })} style={input} />
            </div>
          </div>
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={label}>Shipping Address</label>
            <textarea rows={2} value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} style={{ ...input, resize: "vertical" }} placeholder="1234 Main St, Houston, TX 77004" />
          </div>

          <h3 style={{ fontFamily: fh, fontSize: "0.85rem", fontWeight: 800, margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "#555" }}>Payment</h3>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={label}>Cardholder Name</label>
            <input value={form.cardholder_name} onChange={e => setForm({ ...form, cardholder_name: e.target.value })} style={input} placeholder={form.buyer_name || "John Doe"} />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={label}>Card Number</label>
            <input required minLength={13} maxLength={19}
              value={form.card_number}
              onChange={e => setForm({ ...form, card_number: e.target.value.replace(/[^\d\s]/g, "") })}
              style={input} placeholder="4242 4242 4242 4242" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={label}>Expiration</label>
              <input required placeholder="MM/YY" value={form.exp} onChange={e => setForm({ ...form, exp: e.target.value })} style={input} />
            </div>
            <div>
              <label style={label}>CVV</label>
              <input required minLength={3} maxLength={4} value={form.cvv} onChange={e => setForm({ ...form, cvv: e.target.value })} style={input} />
            </div>
          </div>

          {/* Order summary */}
          <div style={{ background: "#fafafa", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" }}>
            <p style={{ fontFamily: f, fontSize: "0.72rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 0.5rem" }}>Order Summary</p>
            {lines.map(l => (
              <div key={l.item.merch_id} style={{ display: "flex", justifyContent: "space-between", fontFamily: f, fontSize: "0.82rem", color: "#555", padding: "2px 0" }}>
                <span>{l.item.merch_name} × {l.qty}</span>
                <span>${(Number(l.item.retail_price) * l.qty).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid #e5e5e5" }}>
              <span style={{ fontFamily: f, fontWeight: 700, color: "#1a1a1a" }}>Total</span>
              <span style={{ fontFamily: fh, fontWeight: 800, fontSize: "1.1rem", color: "#1a1a1a" }}>${total.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.25)", fontFamily: f, fontSize: "0.8rem", color: "#E53935", marginBottom: "0.75rem", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button disabled={submitting} type="submit" style={{
            width: "100%", padding: "12px", borderRadius: "10px", border: "none",
            background: submitting ? "#999" : "#C8102E", color: "white",
            fontFamily: f, fontSize: "0.9rem", fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
          }}>
            {submitting ? "Processing..." : `Pay $${total.toFixed(2)}`}
          </button>
        </div>
      </form>
    </div>
  )
}

function ReceiptModal({ receipt, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1002, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "14px", width: "min(440px, 100%)", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✅</div>
        <h2 style={{ fontFamily: fh, fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.5rem" }}>Thanks, {receipt.buyer_name}!</h2>
        <p style={{ fontFamily: f, fontSize: "0.85rem", color: "#666", margin: "0 0 1.25rem" }}>
          Your order <strong>#{receipt.purchase_id}</strong> is confirmed. A receipt has been sent to <strong>{receipt.buyer_email}</strong>.
        </p>
        <div style={{ background: "#fafafa", borderRadius: "10px", padding: "1rem", textAlign: "left", marginBottom: "1.25rem" }}>
          {receipt.items?.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: f, fontSize: "0.82rem", color: "#555", padding: "2px 0" }}>
              <span>{it.merch_name} × {it.qty}</span>
              <span>${Number(it.line_total).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e5e5e5" }}>
            <span style={{ fontFamily: f, fontWeight: 700 }}>Total</span>
            <span style={{ fontFamily: fh, fontWeight: 800 }}>${Number(receipt.total_price).toFixed(2)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          padding: "10px 24px", borderRadius: "10px", border: "none",
          background: "#C8102E", color: "white", fontFamily: f, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
        }}>
          Keep Shopping
        </button>
      </div>
    </div>
  )
}

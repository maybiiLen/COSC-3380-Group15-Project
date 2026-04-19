import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import { Link } from "react-router-dom"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

// Hero + per-ticket card images
import heroImg         from "../assets/actions/buy-tickets.jpg"
import imgSeasonPass   from "../assets/actions/season-pass.jpg"
import imgRides        from "../assets/actions/rides.jpg"
import imgVip          from "../assets/rides/hero-cougar-express.jpg"
import imgFastPass     from "../assets/rides/hero-haunted-mansion.jpg"
import imgChild        from "../assets/rides/bumper-cars.jpg"
import imgSenior       from "../assets/rides/ferris-wheel.jpg"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

// Per-ticket hero image. Falls back to a generic park photo.
const TICKET_IMAGES = {
  "General Admission": imgRides,
  "Season Pass":       imgSeasonPass,
  "VIP Experience":    imgVip,
  "Fast Pass":         imgFastPass,
  "Child (Under 12)":  imgChild,
  "Senior (65+)":      imgSenior,
}

const ICONS = { "General Admission": "🎟️", "Season Pass": "⭐", "VIP Experience": "👑", "Fast Pass": "⚡", "Child (Under 12)": "🧒", "Senior (65+)": "👴" }
const FEATURES = {
  "General Admission": ["All rides included", "Access to all zones", "Valid for one day"],
  "Season Pass": ["Unlimited visits", "10% off dining", "10% off merchandise", "Priority parking"],
  "VIP Experience": ["Skip-the-line on all rides", "Reserved show seating", "Free meal voucher", "Souvenir lanyard"],
  "Fast Pass": ["Skip-the-line on all rides", "Priority queue access"],
  "Child (Under 12)": ["All rides included", "Valid for one day", "Discounted child rate"],
  "Senior (65+)": ["All rides included", "Valid for one day", "Discounted senior rate"],
}
const POPULAR = "Season Pass"

export default function TicketShop() {
  const { user } = useAuth()
  const [ticketOptions, setTicketOptions] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [step, setStep] = useState("browse")
  const [cart, setCart] = useState([])
  const [visitDate, setVisitDate] = useState("")
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvv: "", name: "" })
  const [buyerName, setBuyerName] = useState(user?.full_name || "")
  const [buyerEmail, setBuyerEmail] = useState(user?.email || "")
  const [processing, setProcessing] = useState(false)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState("")
  const [parkClosures, setParkClosures] = useState([])

  useEffect(() => {
    async function loadTicketTypes() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/tickets/types`)
        const data = await res.json()
        const mapped = data.map(t => ({
          id: t.name,
          price: parseFloat(t.adult_price),
          child: parseFloat(t.child_price),
          desc: t.description || "Theme park ticket",
          icon: ICONS[t.name] || "🎫",
          features: FEATURES[t.name] || ["Park access included"],
          fast_pass: t.fast_pass,
        }))
        setTicketOptions(mapped)
      } catch {
        setError("Failed to load ticket types")
      } finally {
        setLoadingTypes(false)
      }
    }
    loadTicketTypes()

    // Load park closures for visit date validation
    fetch(`${API_BASE_URL}/api/park-ops/park-closures`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setParkClosures(data) })
      .catch(() => {})
  }, [])

  function getTotalQty() {
    return cart.reduce((sum, item) => sum + item.adult_qty + item.child_qty, 0)
  }

  function isDateParkClosed(dateStr) {
    if (!dateStr || parkClosures.length === 0) return false
    const d = new Date(dateStr)
    return parkClosures.some(pc => {
      if (!pc.is_active) return false
      const zone = (pc.zone || "").toUpperCase()
      if (zone !== "ALL" && zone !== "PARK_WIDE" && zone !== "PARK-WIDE") return false
      const start = new Date(pc.started_at || pc.start_date)
      const end = pc.ended_at || pc.end_date ? new Date(pc.ended_at || pc.end_date) : new Date(start.getTime() + 365 * 86400000)
      return d >= start && d <= end
    })
  }

  function validateCart() {
    const today = new Date().toISOString().split("T")[0]
    const totalQty = getTotalQty()

    // Visit date is optional. Only validate if the user actually entered one.
    if (visitDate && visitDate < today) {
      return "Visit date must be today or in the future"
    }
    if (totalQty <= 0) {
      return "Your cart must include at least one adult or child ticket"
    }
    if (visitDate && isDateParkClosed(visitDate)) {
      return `The park is closed on ${visitDate}. Please select a different date.`
    }
    return null
  }

  function addToCart(ticketId, type) {
    const existing = cart.find(c => c.ticket_type === ticketId)
    if (existing) {
      setCart(cart.map(c => c.ticket_type === ticketId ? { ...c, [type]: c[type] + 1 } : c))
    } else {
      setCart([...cart, { ticket_type: ticketId, adult_qty: type === "adult_qty" ? 1 : 0, child_qty: type === "child_qty" ? 1 : 0 }])
    }
  }

  function updateCart(ticketId, type, value) {
    const v = Math.max(0, value)
    setCart(cart.map(c => c.ticket_type === ticketId ? { ...c, [type]: v } : c).filter(c => c.adult_qty + c.child_qty > 0))
  }

  function getTotal() {
    return cart.reduce((sum, item) => {
      const t = ticketOptions.find(o => o.id === item.ticket_type)
      return sum + (item.adult_qty * t.price) + (item.child_qty * t.child)
    }, 0)
  }

  async function handleCheckout(e) {
    e.preventDefault()
    setError("")
    if (cart.length === 0) return
    setProcessing(true)
    try {
      const token = localStorage.getItem("accessToken")
      const headers = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_BASE_URL}/api/tickets/purchase`, {
        method: "POST", headers,
        body: JSON.stringify({
          items: cart,
          card_last_four: cardForm.number.slice(-4),
          cardholder_name: cardForm.name,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          visit_date: visitDate || null,
        }),
      })
      const data = await res.json()
      if (res.ok) { setOrder(data); setStep("confirmation"); setCart([]) }
      else { setError(data.message || "Purchase failed") }
    } catch { setError("Network error — please try again") }
    finally { setProcessing(false) }
  }

  const steps = ["Browse", "Cart", "Checkout", "Confirmation"]
  const stepIdx = { browse: 0, cart: 1, checkout: 2, confirmation: 3 }

  return (
    <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
      <CustomerNav />

      {/* Hero banner */}
      <div style={{
        paddingTop: "94px",
        padding: "140px 2rem 4rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        backgroundImage: `linear-gradient(135deg, rgba(11,29,58,0.78), rgba(26,10,46,0.7), rgba(15,14,14,0.85)), url(${heroImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 30% 0%, rgba(200,16,46,0.25) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: f, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "var(--cr-coral)" }}>Passes & Tickets</span>
          <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0.5rem 0 0.75rem", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>Choose Your Adventure</h1>
          <p style={{ fontFamily: f, fontSize: "0.95rem", color: "rgba(255,255,255,0.85)", maxWidth: "500px", margin: "0 auto", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
            All passes include full-day park access. Children under 3 enter free.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "0.5rem", padding: "1.5rem 2rem",
        background: "var(--cr-bg)", borderBottom: "1px solid var(--cr-border)",
      }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: i <= stepIdx[step] ? "var(--cr-red)" : "var(--cr-surface)",
              border: `2px solid ${i <= stepIdx[step] ? "var(--cr-red)" : "var(--cr-border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: f, fontSize: "0.7rem", fontWeight: 700,
              color: i <= stepIdx[step] ? "var(--cr-red)" : "#999",
              transition: "all 0.3s",
            }}>
              {i < stepIdx[step] ? "✓" : i + 1}
            </div>
            <span style={{
              fontFamily: f, fontSize: "0.75rem", fontWeight: 600,
              color: i <= stepIdx[step] ? "var(--cr-red)" : "#999",
              transition: "color 0.3s",
            }}>{s}</span>
            {i < steps.length - 1 && (
              <div style={{
                width: 40, height: 2, borderRadius: 1,
                background: i < stepIdx[step] ? "var(--cr-red)" : "var(--cr-border)",
                margin: "0 0.25rem",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 2rem 5rem" }}>
        {/* ═══ BROWSE ═══ */}
        {step === "browse" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
              {ticketOptions.map(t => (
                <div key={t.id} style={{
                  background: "var(--cr-surface)", borderRadius: "16px",
                  border: t.id === POPULAR ? "2px solid var(--cr-red)" : "1px solid var(--cr-border)",
                  display: "flex", flexDirection: "column",
                  position: "relative", overflow: "hidden",
                  transition: "transform 0.3s var(--ease-out-expo), box-shadow 0.3s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.4)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
                >
                  {/* Ticket photo banner */}
                  <div style={{
                    height: "160px",
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url(${TICKET_IMAGES[t.id] || imgRides})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    position: "relative",
                  }} />

                  {/* Popular badge */}
                  {t.id === POPULAR && (
                    <div style={{
                      position: "absolute", top: 14, right: -30,
                      background: "var(--cr-red)", color: "white",
                      fontFamily: f, fontSize: "0.6rem", fontWeight: 700,
                      padding: "4px 36px", textTransform: "uppercase", letterSpacing: "1px",
                      transform: "rotate(35deg)", zIndex: 2,
                    }}>Best Value</div>
                  )}

                  <div style={{ padding: "1.75rem 2rem 2rem", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h2 style={{ fontFamily: fh, fontSize: "1.3rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.3rem" }}>{t.id}</h2>
                  <p style={{ fontFamily: f, fontSize: "0.8rem", color: "#666", lineHeight: 1.5, margin: "0 0 1rem" }}>{t.desc}</p>

                  <div style={{ marginBottom: "1.25rem" }}>
                    {t.features.map((feat, i) => (
                      <div key={i} style={{ fontFamily: f, fontSize: "0.76rem", color: "#777", padding: "3px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "#4CAF50", fontSize: "0.7rem" }}>✓</span> {feat}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "auto" }}>
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem 0.85rem", marginBottom: "1rem" }}>
                      <span style={{ fontFamily: fh, fontSize: "2rem", fontWeight: 800, color: "#111827" }}>${t.price}</span>
                      <span style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 600, color: "#555" }}>adult</span>
                      <span style={{ fontFamily: fh, fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>${t.child}</span>
                      <span style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 600, color: "#555" }}>child</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => addToCart(t.id, "adult_qty")} style={{
                        flex: 1, padding: "10px", fontFamily: f, fontSize: "0.8rem", fontWeight: 700,
                        background: "var(--cr-gradient-brand)", color: "white",
                        border: "none", borderRadius: "10px", cursor: "pointer",
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                      >Add Adult</button>
                      <button onClick={() => addToCart(t.id, "child_qty")} style={{
                        flex: 1, padding: "10px", fontFamily: f, fontSize: "0.8rem", fontWeight: 600,
                        background: "transparent", color: "#555",
                        border: "1px solid var(--cr-border)", borderRadius: "10px", cursor: "pointer",
                        transition: "border-color 0.2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--cr-border)"}
                      >Add Child</button>
                    </div>
                  </div>
                  </div> {/* /card body */}
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{
                marginTop: "2rem", padding: "1.25rem 1.5rem",
                background: "var(--cr-surface)", borderRadius: "14px",
                border: "1px solid var(--cr-red)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: "1rem",
                animation: "fadeInUp 0.3s ease-out",
              }}>
                <div style={{ fontFamily: f, fontSize: "0.9rem", color: "#666" }}>
                  🛒 {cart.reduce((s, c) => s + c.adult_qty + c.child_qty, 0)} ticket(s) in cart
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <span style={{ fontFamily: fh, fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>${getTotal()}</span>
                  <button onClick={() => setStep("cart")} style={{
                    fontFamily: f, fontSize: "0.85rem", fontWeight: 700,
                    padding: "12px 28px", background: "var(--cr-gradient-brand)",
                    color: "white", border: "none", borderRadius: "50px", cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(200,16,46,0.35)",
                  }}>View Cart →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ CART ═══ */}
        {step === "cart" && (
          <>
            <button onClick={() => setStep("browse")} style={{ fontFamily: f, fontSize: "0.8rem", color: "#999", background: "transparent", border: "none", cursor: "pointer", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> Back to Tickets
            </button>
            <h1 style={{ fontFamily: fh, fontSize: "1.8rem", fontWeight: 800, color: "#111827", margin: "0 0 2rem" }}>Your Cart</h1>

            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", background: "var(--cr-surface)", borderRadius: "16px", border: "1px solid var(--cr-border)" }}>
                <p style={{ fontFamily: f, color: "#999" }}>Your cart is empty.</p>
                <button onClick={() => setStep("browse")} style={{ marginTop: "1rem", fontFamily: f, fontSize: "0.85rem", fontWeight: 700, padding: "10px 24px", background: "var(--cr-red)", color: "white", border: "none", borderRadius: "50px", cursor: "pointer" }}>Browse Tickets</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  {cart.map(item => {
                    const t = ticketOptions.find(o => o.id === item.ticket_type)
                    const subtotal = (item.adult_qty * t.price) + (item.child_qty * t.child)
                    return (
                      <div key={item.ticket_type} style={{
                        background: "var(--cr-surface)", borderRadius: "14px", border: "1px solid var(--cr-border)",
                        padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between",
                        alignItems: "center", flexWrap: "wrap", gap: "1rem",
                      }}>
                        <div>
                          <h3 style={{ fontFamily: fh, fontSize: "1.05rem", fontWeight: 700, color: "#111827", margin: "0 0 0.5rem" }}>{t.icon} {item.ticket_type}</h3>
                          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                            {/* Adult qty */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: f, fontSize: "0.8rem", color: "#777" }}>Adults</span>
                              <div style={{ display: "flex", alignItems: "center", background: "var(--cr-border)", borderRadius: "8px" }}>
                                <button onClick={() => updateCart(item.ticket_type, "adult_qty", item.adult_qty - 1)} style={qtyBtnStyle}>−</button>
                                <span style={{ fontFamily: f, fontWeight: 600, color: "#111827", minWidth: 20, textAlign: "center" }}>{item.adult_qty}</span>
                                <button onClick={() => updateCart(item.ticket_type, "adult_qty", item.adult_qty + 1)} style={qtyBtnStyle}>+</button>
                              </div>
                            </div>
                            {/* Child qty */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: f, fontSize: "0.8rem", color: "#777" }}>Children</span>
                              <div style={{ display: "flex", alignItems: "center", background: "var(--cr-border)", borderRadius: "8px" }}>
                                <button onClick={() => updateCart(item.ticket_type, "child_qty", item.child_qty - 1)} style={qtyBtnStyle}>−</button>
                                <span style={{ fontFamily: f, fontWeight: 600, color: "#111827", minWidth: 20, textAlign: "center" }}>{item.child_qty}</span>
                                <button onClick={() => updateCart(item.ticket_type, "child_qty", item.child_qty + 1)} style={qtyBtnStyle}>+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontFamily: fh, fontSize: "1.3rem", fontWeight: 700, color: "#111827" }}>${subtotal}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Visit date */}
                <div style={{ background: "var(--cr-surface)", borderRadius: "14px", border: `1px solid ${visitDate && (visitDate < new Date().toISOString().split("T")[0] || isDateParkClosed(visitDate)) ? "var(--cr-red)" : "var(--cr-border)"}`, padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
                  <label style={labelSt}>Visit Date <span style={{ color: "#999", fontSize: "0.7rem", fontWeight: 500 }}>(optional)</span></label>
                  <input type="date" value={visitDate} onChange={e => { setVisitDate(e.target.value); setError("") }}
                    min={new Date().toISOString().split("T")[0]}
                    style={{ ...inputSt, width: "auto", colorScheme: "light" }} />
                  {visitDate && visitDate < new Date().toISOString().split("T")[0] && (
                    <p style={{ fontFamily: f, fontSize: "0.8rem", color: "#E53935", marginTop: "0.5rem", fontWeight: 600 }}>
                      Visit date must be today or in the future
                    </p>
                  )}
                  {visitDate && isDateParkClosed(visitDate) && !(visitDate < new Date().toISOString().split("T")[0]) && (
                    <p style={{ fontFamily: f, fontSize: "0.8rem", color: "#E53935", marginTop: "0.5rem", fontWeight: 600 }}>
                      The park is closed on this date. Please select a different date.
                    </p>
                  )}
                  {!visitDate && (
                    <p style={{ fontFamily: f, fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
                      Optional — pick a date if you already know when you'll visit
                    </p>
                  )}
                </div>

                {error && (
                  <div style={{ padding: "14px 18px", borderRadius: "10px", background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.25)", fontFamily: f, fontSize: "0.85rem", color: "#E53935", marginBottom: "1rem", whiteSpace: "pre-line", fontWeight: 600 }}>{error}</div>
                )}

                <div style={{
                  padding: "1.25rem 1.5rem", background: "var(--cr-surface)",
                  borderRadius: "14px", border: "2px solid var(--cr-red)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontFamily: f, fontSize: "0.65rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "1px" }}>Order Total</div>
                    <div style={{ fontFamily: fh, fontSize: "2rem", fontWeight: 800, color: "#111827" }}>${getTotal()}</div>
                    <div style={{ fontFamily: f, fontSize: "0.7rem", color: "#999", marginTop: "2px" }}>{getTotalQty()} ticket(s)</div>
                  </div>
                  <button onClick={() => {
                    const violation = validateCart()
                    if (violation) {
                      setError(violation)
                      return
                    }
                    setError("")
                    setStep("checkout")
                  }} style={{
                    fontFamily: f, fontSize: "0.9rem", fontWeight: 700,
                    padding: "14px 32px",
                    background: !validateCart() ? "var(--cr-gradient-brand)" : "linear-gradient(135deg, #999, #777)",
                    color: "white", border: "none", borderRadius: "50px", cursor: "pointer",
                    boxShadow: !validateCart() ? "0 4px 20px rgba(200,16,46,0.4)" : "none",
                  }}>Proceed to Checkout →</button>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ CHECKOUT ═══ */}
        {step === "checkout" && (
          <>
            <button onClick={() => setStep("cart")} style={{ fontFamily: f, fontSize: "0.8rem", color: "#999", background: "transparent", border: "none", cursor: "pointer", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> Back to Cart
            </button>
            <h1 style={{ fontFamily: fh, fontSize: "1.8rem", fontWeight: 800, color: "#111827", margin: "0 0 0.5rem" }}>Checkout</h1>
            <p style={{ fontFamily: f, fontSize: "0.85rem", color: "#999", marginBottom: "2rem" }}>Complete your purchase — your tickets will be ready instantly.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem", alignItems: "start" }}>
              <form onSubmit={handleCheckout}>
                <div style={{ background: "var(--cr-surface)", borderRadius: "16px", border: "1px solid var(--cr-border)", padding: "2rem" }}>
                  <h2 style={{ fontFamily: fh, fontSize: "1rem", fontWeight: 700, color: "#111827", margin: "0 0 1.5rem" }}>Payment Details</h2>

                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>Full Name</label>
                      <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)}
                        placeholder="John Doe" required style={inputSt} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>Email Address</label>
                      <input type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)}
                        placeholder="you@example.com" required style={inputSt} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={labelSt}>Cardholder Name</label>
                    <input type="text" value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value })}
                      placeholder="John Doe" required style={inputSt} />
                  </div>

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={labelSt}>Card Number</label>
                    <input type="text" value={cardForm.number}
                      onChange={e => setCardForm({ ...cardForm, number: e.target.value.replace(/\D/g, "").slice(0, 16) })}
                      placeholder="4242 4242 4242 4242" required minLength={16} maxLength={16} style={inputSt} />
                  </div>

                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>Expiry</label>
                      <input type="text" value={cardForm.expiry}
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, "").slice(0, 4)
                          if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2)
                          setCardForm({ ...cardForm, expiry: v })
                        }}
                        placeholder="MM/YY" required style={inputSt} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>CVV</label>
                      <input type="text" value={cardForm.cvv}
                        onChange={e => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        placeholder="123" required minLength={3} maxLength={4} style={inputSt} />
                    </div>
                  </div>

                  {error && (
                    <div style={{ padding: "14px 18px", borderRadius: "10px", background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.25)", fontFamily: f, fontSize: "0.85rem", color: "#E53935", marginBottom: "1rem", whiteSpace: "pre-line", fontWeight: 600 }}>{error}</div>
                  )}

                  <button type="submit" disabled={processing} style={{
                    width: "100%", padding: "14px", fontFamily: f, fontSize: "0.95rem", fontWeight: 700,
                    background: "var(--cr-gradient-brand)", color: "white",
                    border: "none", borderRadius: "50px", cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(200,16,46,0.4)",
                    opacity: processing ? 0.6 : 1,
                  }}>
                    {processing ? "Processing..." : `Pay $${getTotal()}`}
                  </button>

                  <p style={{ fontFamily: f, fontSize: "0.65rem", color: "#9ca3af", textAlign: "center", marginTop: "1rem" }}>
                    This is a demo — no real charges will be made.
                  </p>
                </div>
              </form>

              <div style={{ background: "var(--cr-surface)", borderRadius: "16px", border: "1px solid var(--cr-border)", padding: "1.5rem" }}>
                <h3 style={{ fontFamily: fh, fontSize: "0.9rem", fontWeight: 700, color: "#111827", margin: "0 0 1rem" }}>Order Summary</h3>
                {cart.map(item => {
                  const t = ticketOptions.find(o => o.id === item.ticket_type)
                  return (
                    <div key={item.ticket_type} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--cr-border)" }}>
                      <div style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{item.ticket_type}</div>
                      {item.adult_qty > 0 && <div style={{ fontFamily: f, fontSize: "0.75rem", color: "#999" }}>{item.adult_qty}× Adult @ ${t.price}</div>}
                      {item.child_qty > 0 && <div style={{ fontFamily: f, fontSize: "0.75rem", color: "#999" }}>{item.child_qty}× Child @ ${t.child}</div>}
                    </div>
                  )
                })}
                {visitDate && <div style={{ fontFamily: f, fontSize: "0.75rem", color: "#999", marginBottom: "0.75rem" }}>Visit: {visitDate}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem" }}>
                  <span style={{ fontFamily: f, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>Total</span>
                  <span style={{ fontFamily: fh, fontSize: "1.2rem", fontWeight: 700, color: "#111827" }}>${getTotal()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ CONFIRMATION ═══ */}
        {step === "confirmation" && order && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", animation: "fadeInUp 0.5s ease-out" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎉</div>
            <h1 style={{ fontFamily: fh, fontSize: "2.2rem", fontWeight: 900, color: "#111827", margin: "0 0 0.5rem" }}>You're All Set!</h1>
            <p style={{ fontFamily: f, fontSize: "1rem", color: "#777", marginBottom: "2rem" }}>
              Your tickets have been purchased. Order total: <strong style={{ color: "#111827" }}>${order.order_total}</strong>
            </p>

            <div style={{ background: "var(--cr-surface)", borderRadius: "16px", border: "1px solid var(--cr-border)", padding: "2rem", maxWidth: "500px", margin: "0 auto 2rem", textAlign: "left" }}>
              <h3 style={{ fontFamily: f, fontSize: "0.8rem", fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 1rem" }}>Order Details</h3>
              {order.purchases.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--cr-border)", fontFamily: f, fontSize: "0.85rem" }}>
                  <span style={{ color: "#555" }}>{p.ticket_type} ({p.adult_qty}A {p.child_qty > 0 ? `+ ${p.child_qty}C` : ""})</span>
                  <span style={{ color: "#111827", fontWeight: 600 }}>${Number(p.total_price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link to="/" style={{
                fontFamily: f, fontSize: "0.85rem", fontWeight: 700,
                padding: "12px 28px", background: "var(--cr-gradient-brand)",
                color: "white", borderRadius: "50px",
              }}>Back to Park</Link>
              <button onClick={() => { setStep("browse"); setOrder(null) }} style={{
                fontFamily: f, fontSize: "0.85rem", fontWeight: 600,
                padding: "12px 28px", background: "transparent", color: "#555",
                border: "1px solid var(--cr-border)", borderRadius: "50px", cursor: "pointer",
              }}>Buy More Tickets</button>
            </div>
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  )
}

const qtyBtnStyle = {
  width: 30, height: 30, background: "transparent", border: "none", color: "#111827", cursor: "pointer", fontSize: "1rem",
}

const labelSt = {
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.73rem", fontWeight: 600,
  color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px",
  display: "block", marginBottom: "6px",
}
const inputSt = {
  width: "100%", padding: "12px 14px", background: "var(--cr-surface-light)",
  border: "1px solid var(--cr-border-light)", borderRadius: "10px",
  color: "#111827", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem",
  outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
}
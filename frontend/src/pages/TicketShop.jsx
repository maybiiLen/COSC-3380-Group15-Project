import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import { Link } from "react-router-dom"
import cougarrideLogo from "../assets/cougarride-logo.png"

const TICKET_OPTIONS = [
  { id: "General Admission", price: 49, child: 35, desc: "Full-day access to all rides and attractions. Valid for one visit.", icon: "🎟️", features: ["All rides included", "Access to all zones", "Valid for one day"] },
  { id: "Season Pass", price: 149, child: 99, desc: "Unlimited visits through the end of the season. 10% off food & merch.", icon: "⭐", features: ["Unlimited visits", "10% off dining", "10% off merchandise", "Priority parking"] },
  { id: "VIP Experience", price: 89, child: 69, desc: "Skip-the-line access, reserved seating, and a complimentary meal voucher.", icon: "👑", features: ["Skip-the-line on all rides", "Reserved show seating", "Free meal voucher", "Souvenir lanyard"] },
]

export default function TicketShop() {
  const { user } = useAuth()
  const [step, setStep] = useState("browse") // browse → cart → checkout → confirmation
  const [cart, setCart] = useState([])
  const [visitDate, setVisitDate] = useState("")
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvv: "", name: "" })
  const [guestEmail, setGuestEmail] = useState("")
  const [processing, setProcessing] = useState(false)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState("")

  const f = "'DM Sans', sans-serif"

  function addToCart(ticketId, type) {
    const existing = cart.find(c => c.ticket_type === ticketId)
    if (existing) {
      setCart(cart.map(c => c.ticket_type === ticketId
        ? { ...c, [type]: c[type] + 1 } : c))
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
      const t = TICKET_OPTIONS.find(o => o.id === item.ticket_type)
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
        method: "POST",
        headers,
        body: JSON.stringify({
          items: cart,
          card_last_four: cardForm.number.slice(-4),
          cardholder_name: cardForm.name,
          visit_date: visitDate || null,
          guest_email: !user ? guestEmail : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setOrder(data)
        setStep("confirmation")
        setCart([])
      } else {
        setError(data.message || "Purchase failed")
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ background: "#0F0E0E", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Top nav */}
      <nav style={{
        background: "#0A0909", borderBottom: "1px solid #1A1919",
        padding: "0 2rem", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <img src={cougarrideLogo} alt="CougarRide" style={{ height: "34px" }} />
          <span style={{ fontFamily: f, fontSize: "1rem", fontWeight: 900, color: "#C8102E", letterSpacing: "2px", textTransform: "uppercase" }}>COUGARIDE</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {cart.length > 0 && step === "browse" && (
            <button onClick={() => setStep("cart")} style={{
              fontFamily: f, fontSize: "0.8rem", fontWeight: 700,
              padding: "8px 20px", background: "#C8102E", color: "white",
              border: "none", borderRadius: "50px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              🛒 Cart ({cart.reduce((s, c) => s + c.adult_qty + c.child_qty, 0)})
            </button>
          )}
          <Link to="/" style={{ fontFamily: f, fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>← Back to Park</Link>
        </div>
      </nav>

      <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "2.5rem 2rem" }}>

        {/* ═══ STEP 1: BROWSE TICKETS ═══ */}
        {step === "browse" && (
          <>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <span style={{ fontFamily: f, fontSize: "0.75rem", letterSpacing: "3px", textTransform: "uppercase", color: "#F4845F" }}>Passes & Tickets</span>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", fontWeight: 900, color: "white", margin: "0.5rem 0" }}>Choose Your Adventure</h1>
              <p style={{ fontFamily: f, fontSize: "0.9rem", color: "rgba(255,255,255,0.45)" }}>All passes include full-day park access. Children under 3 enter free.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
              {TICKET_OPTIONS.map(t => (
                <div key={t.id} style={{
                  background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929",
                  padding: "2rem", display: "flex", flexDirection: "column",
                }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{t.icon}</div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: "white", margin: "0 0 0.3rem" }}>{t.id}</h2>
                  <p style={{ fontFamily: f, fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: "0 0 1rem" }}>{t.desc}</p>

                  <div style={{ marginBottom: "1.25rem" }}>
                    {t.features.map((feat, i) => (
                      <div key={i} style={{ fontFamily: f, fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", padding: "3px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "#4CAF50", fontSize: "0.7rem" }}>✓</span> {feat}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "auto" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "1rem" }}>
                      <span style={{ fontFamily: f, fontSize: "2rem", fontWeight: 700, color: "white" }}>${t.price}</span>
                      <span style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>adult</span>
                      <span style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", marginLeft: "0.5rem" }}>${t.child} child</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => addToCart(t.id, "adult_qty")} style={{
                        flex: 1, padding: "10px", fontFamily: f, fontSize: "0.8rem", fontWeight: 700,
                        background: "linear-gradient(135deg, #C8102E, #8C1D40)", color: "white",
                        border: "none", borderRadius: "8px", cursor: "pointer",
                      }}>Add Adult</button>
                      <button onClick={() => addToCart(t.id, "child_qty")} style={{
                        flex: 1, padding: "10px", fontFamily: f, fontSize: "0.8rem", fontWeight: 600,
                        background: "transparent", color: "rgba(255,255,255,0.6)",
                        border: "1px solid #2A2929", borderRadius: "8px", cursor: "pointer",
                      }}>Add Child</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{
                marginTop: "2rem", padding: "1.25rem 1.5rem", background: "#1A1919",
                borderRadius: "14px", border: "1px solid #2A2929",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
              }}>
                <div style={{ fontFamily: f, fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
                  {cart.reduce((s, c) => s + c.adult_qty + c.child_qty, 0)} ticket(s) in cart
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <span style={{ fontFamily: f, fontSize: "1.5rem", fontWeight: 700, color: "white" }}>${getTotal()}</span>
                  <button onClick={() => setStep("cart")} style={{
                    fontFamily: f, fontSize: "0.85rem", fontWeight: 700,
                    padding: "12px 28px", background: "linear-gradient(135deg, #C8102E, #8C1D40)",
                    color: "white", border: "none", borderRadius: "50px", cursor: "pointer",
                  }}>View Cart →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 2: CART REVIEW ═══ */}
        {step === "cart" && (
          <>
            <button onClick={() => setStep("browse")} style={{ fontFamily: f, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", background: "transparent", border: "none", cursor: "pointer", marginBottom: "1.5rem" }}>← Back to Tickets</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "white", margin: "0 0 2rem" }}>Your Cart</h1>

            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929" }}>
                <p style={{ fontFamily: f, color: "rgba(255,255,255,0.4)" }}>Your cart is empty.</p>
                <button onClick={() => setStep("browse")} style={{ marginTop: "1rem", fontFamily: f, fontSize: "0.85rem", fontWeight: 700, padding: "10px 24px", background: "#C8102E", color: "white", border: "none", borderRadius: "50px", cursor: "pointer" }}>Browse Tickets</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                  {cart.map(item => {
                    const t = TICKET_OPTIONS.find(o => o.id === item.ticket_type)
                    const subtotal = (item.adult_qty * t.price) + (item.child_qty * t.child)
                    return (
                      <div key={item.ticket_type} style={{
                        background: "#1A1919", borderRadius: "14px", border: "1px solid #2A2929",
                        padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between",
                        alignItems: "center", flexWrap: "wrap", gap: "1rem",
                      }}>
                        <div>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "white", margin: "0 0 0.5rem" }}>{t.icon} {item.ticket_type}</h3>
                          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: f, fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Adults</span>
                              <div style={{ display: "flex", alignItems: "center", background: "#2A2929", borderRadius: "8px" }}>
                                <button onClick={() => updateCart(item.ticket_type, "adult_qty", item.adult_qty - 1)} style={{ width: 30, height: 30, background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "1rem" }}>−</button>
                                <span style={{ fontFamily: f, fontWeight: 600, color: "white", minWidth: 20, textAlign: "center" }}>{item.adult_qty}</span>
                                <button onClick={() => updateCart(item.ticket_type, "adult_qty", item.adult_qty + 1)} style={{ width: 30, height: 30, background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "1rem" }}>+</button>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: f, fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Children</span>
                              <div style={{ display: "flex", alignItems: "center", background: "#2A2929", borderRadius: "8px" }}>
                                <button onClick={() => updateCart(item.ticket_type, "child_qty", item.child_qty - 1)} style={{ width: 30, height: 30, background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "1rem" }}>−</button>
                                <span style={{ fontFamily: f, fontWeight: 600, color: "white", minWidth: 20, textAlign: "center" }}>{item.child_qty}</span>
                                <button onClick={() => updateCart(item.ticket_type, "child_qty", item.child_qty + 1)} style={{ width: 30, height: 30, background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "1rem" }}>+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontFamily: f, fontSize: "1.3rem", fontWeight: 700, color: "white" }}>${subtotal}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Visit date */}
                <div style={{ background: "#1A1919", borderRadius: "14px", border: "1px solid #2A2929", padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
                  <label style={{ fontFamily: f, fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Planned Visit Date (optional)</label>
                  <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
                    style={{ padding: "10px 14px", background: "#222", border: "1px solid #3A3939", borderRadius: "8px", color: "white", fontFamily: f, fontSize: "0.9rem", outline: "none", colorScheme: "dark" }} />
                </div>

                {/* Total + checkout */}
                <div style={{
                  padding: "1.25rem 1.5rem", background: "#1A1919",
                  borderRadius: "14px", border: "1px solid #C8102E",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontFamily: f, fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px" }}>Order Total</div>
                    <div style={{ fontFamily: f, fontSize: "2rem", fontWeight: 700, color: "white" }}>${getTotal()}</div>
                  </div>
                  <button onClick={() => setStep("checkout")} style={{
                    fontFamily: f, fontSize: "0.9rem", fontWeight: 700,
                    padding: "14px 32px", background: "linear-gradient(135deg, #C8102E, #8C1D40)",
                    color: "white", border: "none", borderRadius: "50px", cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(200,16,46,0.4)",
                  }}>Proceed to Checkout →</button>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ STEP 3: CHECKOUT ═══ */}
        {step === "checkout" && (
          <>
            <button onClick={() => setStep("cart")} style={{ fontFamily: f, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", background: "transparent", border: "none", cursor: "pointer", marginBottom: "1.5rem" }}>← Back to Cart</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "white", margin: "0 0 0.5rem" }}>Checkout</h1>
            <p style={{ fontFamily: f, fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", marginBottom: "2rem" }}>Complete your purchase — your tickets will be ready instantly.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem", alignItems: "start" }}>
              {/* Payment form */}
              <form onSubmit={handleCheckout}>
                <div style={{ background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929", padding: "2rem" }}>
                  <h2 style={{ fontFamily: f, fontSize: "1rem", fontWeight: 700, color: "white", margin: "0 0 1.5rem" }}>Payment Details</h2>

                  {!user && (
                    <div style={{ marginBottom: "1.25rem" }}>
                      <label style={labelSt}>Email Address</label>
                      <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                        placeholder="your@email.com" required
                        style={inputSt} />
                    </div>
                  )}

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={labelSt}>Cardholder Name</label>
                    <input type="text" value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value })}
                      placeholder="John Doe" required style={inputSt} />
                  </div>

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={labelSt}>Card Number</label>
                    <input type="text" value={cardForm.number}
                      onChange={e => setCardForm({ ...cardForm, number: e.target.value.replace(/\D/g, "").slice(0, 16) })}
                      placeholder="4242 4242 4242 4242" required minLength={16} maxLength={16}
                      style={inputSt} />
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
                        placeholder="123" required minLength={3} maxLength={4}
                        style={inputSt} />
                    </div>
                  </div>

                  {error && (
                    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.25)", fontFamily: f, fontSize: "0.8rem", color: "#EF9A9A", marginBottom: "1rem" }}>{error}</div>
                  )}

                  <button type="submit" disabled={processing} style={{
                    width: "100%", padding: "14px", fontFamily: f, fontSize: "0.95rem", fontWeight: 700,
                    background: "linear-gradient(135deg, #C8102E, #8C1D40)", color: "white",
                    border: "none", borderRadius: "50px", cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(200,16,46,0.4)",
                    opacity: processing ? 0.6 : 1,
                  }}>
                    {processing ? "Processing..." : `Pay $${getTotal()}`}
                  </button>

                  <p style={{ fontFamily: f, fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "1rem" }}>
                    This is a demo — no real charges will be made.
                  </p>
                </div>
              </form>

              {/* Order summary sidebar */}
              <div style={{ background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929", padding: "1.5rem" }}>
                <h3 style={{ fontFamily: f, fontSize: "0.9rem", fontWeight: 700, color: "white", margin: "0 0 1rem" }}>Order Summary</h3>
                {cart.map(item => {
                  const t = TICKET_OPTIONS.find(o => o.id === item.ticket_type)
                  return (
                    <div key={item.ticket_type} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid #2A2929" }}>
                      <div style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 600, color: "white" }}>{item.ticket_type}</div>
                      {item.adult_qty > 0 && <div style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{item.adult_qty}× Adult @ ${t.price}</div>}
                      {item.child_qty > 0 && <div style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{item.child_qty}× Child @ ${t.child}</div>}
                    </div>
                  )
                })}
                {visitDate && <div style={{ fontFamily: f, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem" }}>Visit: {visitDate}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem" }}>
                  <span style={{ fontFamily: f, fontSize: "0.9rem", fontWeight: 700, color: "white" }}>Total</span>
                  <span style={{ fontFamily: f, fontSize: "1.2rem", fontWeight: 700, color: "white" }}>${getTotal()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ STEP 4: CONFIRMATION ═══ */}
        {step === "confirmation" && order && (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎉</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.2rem", fontWeight: 900, color: "white", margin: "0 0 0.5rem" }}>You're All Set!</h1>
            <p style={{ fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.5)", marginBottom: "2rem" }}>
              Your tickets have been purchased. Order total: <strong style={{ color: "white" }}>${order.order_total}</strong>
            </p>

            <div style={{ background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929", padding: "2rem", maxWidth: "500px", margin: "0 auto 2rem", textAlign: "left" }}>
              <h3 style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 1rem" }}>Order Details</h3>
              {order.purchases.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #222", fontFamily: f, fontSize: "0.85rem" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{p.ticket_type} ({p.adult_qty}A {p.child_qty > 0 ? `+ ${p.child_qty}C` : ""})</span>
                  <span style={{ color: "white", fontWeight: 600 }}>${Number(p.total_price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link to="/" style={{
                fontFamily: f, fontSize: "0.85rem", fontWeight: 700,
                padding: "12px 28px", background: "linear-gradient(135deg, #C8102E, #8C1D40)",
                color: "white", borderRadius: "50px", textDecoration: "none",
              }}>Back to Park</Link>
              <button onClick={() => { setStep("browse"); setOrder(null) }} style={{
                fontFamily: f, fontSize: "0.85rem", fontWeight: 600,
                padding: "12px 28px", background: "transparent", color: "rgba(255,255,255,0.6)",
                border: "1px solid #2A2929", borderRadius: "50px", cursor: "pointer",
              }}>Buy More Tickets</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelSt = {
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 600,
  color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px",
  display: "block", marginBottom: "6px",
}
const inputSt = {
  width: "100%", padding: "12px 14px", background: "#222", border: "1px solid #3A3939",
  borderRadius: "10px", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem",
  outline: "none", boxSizing: "border-box",
}
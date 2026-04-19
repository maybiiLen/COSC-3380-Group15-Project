import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { API_BASE_URL } from "../utils/api"
import { useAuth } from "../context/AuthContext"
import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"
import heroImg from "../assets/actions/buy-tickets.jpg"

const f  = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

/**
 * Customer's purchase history page.
 * - Tickets come from GET /api/tickets/my-purchases (filters by user_id)
 * - Merch comes from GET /api/park-ops/merch/my-purchases (filters by email)
 * Both require auth. Shown on a single page with a Tickets / Merch tab switcher.
 */
export default function MyPurchases() {
  const { user } = useAuth()
  const [tab, setTab] = useState("tickets")
  const [tickets, setTickets] = useState([])
  const [merch, setMerch] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadingMerch, setLoadingMerch] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) { setLoadingTickets(false); setLoadingMerch(false); return }

    fetch(`${API_BASE_URL}/api/tickets/my-purchases`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => setTickets(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingTickets(false))

    fetch(`${API_BASE_URL}/api/park-ops/merch/my-purchases`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMerch(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingMerch(false))
  }, [])

  // If not logged in, prompt them to sign in
  if (!user) {
    return (
      <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
        <CustomerNav />
        <div style={{ paddingTop: "140px", textAlign: "center", padding: "10rem 2rem 6rem" }}>
          <h1 style={{ fontFamily: fh, fontSize: "2rem", color: "var(--cr-text)", marginBottom: "1rem" }}>Sign in to view your purchases</h1>
          <p style={{ fontFamily: f, color: "var(--cr-text-dim)", marginBottom: "2rem" }}>Your ticket and merchandise history will appear here once you're signed in.</p>
          <Link to="/auth" style={{
            display: "inline-block", padding: "12px 32px",
            background: "var(--cr-gradient-brand)", color: "white",
            fontFamily: f, fontSize: "0.85rem", fontWeight: 700,
            borderRadius: "50px", textDecoration: "none",
          }}>Sign In</Link>
        </div>
        <CustomerFooter />
      </div>
    )
  }

  const totalTickets = tickets.reduce((s, t) => s + (t.adult_qty || 0) + (t.child_qty || 0), 0)
  const totalSpend =
    tickets.reduce((s, t) => s + Number(t.total_price || 0), 0) +
    merch.reduce((s, m) => s + Number(m.total_price || 0), 0)

  return (
    <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
      <CustomerNav />

      {/* Hero */}
      <div style={{
        paddingTop: "94px",
        padding: "120px 2rem 4rem",
        position: "relative",
        backgroundImage: `linear-gradient(135deg, rgba(11,29,58,0.78), rgba(26,10,46,0.7), rgba(15,14,14,0.85)), url(${heroImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        textAlign: "center",
      }}>
        <span style={{ fontFamily: f, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "var(--cr-coral)" }}>Order History</span>
        <h1 style={{ fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "white", margin: "0.5rem 0 0.75rem", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
          My Purchases
        </h1>
        <p style={{ fontFamily: f, fontSize: "0.95rem", color: "rgba(255,255,255,0.85)", maxWidth: "500px", margin: "0 auto", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
          Every ticket and order you've placed with CougarRide.
        </p>
      </div>

      {/* Summary strip */}
      <div style={{ background: "var(--cr-bg-alt)", padding: "1.5rem 2rem", borderBottom: "1px solid var(--cr-border)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "2.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Summary label="Tickets bought" value={totalTickets} />
          <Summary label="Merch orders" value={merch.length} />
          <Summary label="Total spent" value={`$${totalSpend.toFixed(2)}`} />
        </div>
      </div>

      {/* Tabs + list */}
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2.5rem 2rem 4rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--cr-border)" }}>
          <TabBtn active={tab === "tickets"} onClick={() => setTab("tickets")}>Tickets ({tickets.length})</TabBtn>
          <TabBtn active={tab === "merch"} onClick={() => setTab("merch")}>Merchandise ({merch.length})</TabBtn>
        </div>

        {tab === "tickets" && (
          loadingTickets ? <Loading /> :
          tickets.length === 0 ? <Empty label="No ticket purchases yet" ctaHref="/tickets" ctaLabel="Browse Tickets" /> :
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {tickets.map(t => (
              <OrderCard key={`t-${t.purchase_id}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: fh, fontSize: "1.05rem", fontWeight: 700, color: "var(--cr-text)", margin: "0 0 0.25rem" }}>{t.ticket_type}</h3>
                  <p style={{ fontFamily: f, fontSize: "0.78rem", color: "var(--cr-text-dim)", margin: 0 }}>
                    {t.adult_qty > 0 && `${t.adult_qty} adult${t.adult_qty > 1 ? "s" : ""}`}
                    {t.adult_qty > 0 && t.child_qty > 0 && " · "}
                    {t.child_qty > 0 && `${t.child_qty} child${t.child_qty > 1 ? "ren" : ""}`}
                    {t.visit_date && ` · Visit ${new Date(t.visit_date).toLocaleDateString()}`}
                    {" · Purchased "}{new Date(t.purchase_date).toLocaleDateString()}
                  </p>
                </div>
                <OrderPrice value={t.total_price} />
              </OrderCard>
            ))}
          </div>
        )}

        {tab === "merch" && (
          loadingMerch ? <Loading /> :
          merch.length === 0 ? <Empty label="No merchandise orders yet" ctaHref="/shopping" ctaLabel="Browse Merch" /> :
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {merch.map(m => (
              <OrderCard key={`m-${m.purchase_id}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: fh, fontSize: "1.05rem", fontWeight: 700, color: "var(--cr-text)", margin: "0 0 0.25rem" }}>
                    Order #{m.purchase_id}
                  </h3>
                  <p style={{ fontFamily: f, fontSize: "0.78rem", color: "var(--cr-text-dim)", margin: "0 0 0.4rem" }}>
                    {(m.items || []).map(it => `${it.merch_name} × ${it.qty}`).join(" · ")}
                  </p>
                  <p style={{ fontFamily: f, fontSize: "0.72rem", color: "var(--cr-text-faint)", margin: 0 }}>
                    Purchased {new Date(m.purchase_date).toLocaleDateString()}
                    {m.card_last_four && ` · Card ending ${m.card_last_four}`}
                  </p>
                </div>
                <OrderPrice value={m.total_price} />
              </OrderCard>
            ))}
          </div>
        )}
      </div>

      <CustomerFooter />
    </div>
  )
}

// ─── Pieces ────────────────────────────────────────
function Summary({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: fh, fontSize: "1.6rem", fontWeight: 800, color: "var(--cr-text)" }}>{value}</div>
      <div style={{ fontFamily: f, fontSize: "0.7rem", fontWeight: 600, color: "var(--cr-text-dim)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>{label}</div>
    </div>
  )
}

function TabBtn({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: f, fontSize: "0.88rem", fontWeight: 700,
      padding: "0.85rem 1.4rem",
      background: "transparent",
      color: active ? "var(--cr-red)" : "var(--cr-text-dim)",
      border: "none",
      borderBottom: active ? "2px solid var(--cr-red)" : "2px solid transparent",
      marginBottom: "-1px",
      cursor: "pointer",
      transition: "color 0.15s",
    }}>
      {children}
    </button>
  )
}

function OrderCard({ children }) {
  return (
    <div style={{
      background: "white", borderRadius: "14px",
      padding: "1.25rem 1.5rem", border: "1px solid var(--cr-border)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: "1rem",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      {children}
    </div>
  )
}

function OrderPrice({ value }) {
  return (
    <div style={{ fontFamily: fh, fontSize: "1.35rem", fontWeight: 700, color: "var(--cr-text)" }}>
      ${Number(value || 0).toFixed(2)}
    </div>
  )
}

function Loading() {
  return <p style={{ textAlign: "center", color: "var(--cr-text-dim)", fontFamily: f, padding: "3rem" }}>Loading...</p>
}

function Empty({ label, ctaHref, ctaLabel }) {
  return (
    <div style={{
      textAlign: "center", padding: "3rem",
      background: "var(--cr-bg-alt)", borderRadius: "16px", border: "1px solid var(--cr-border)",
    }}>
      <p style={{ fontFamily: f, fontSize: "0.95rem", color: "var(--cr-text-dim)", marginBottom: "1.25rem" }}>{label}</p>
      <Link to={ctaHref} style={{
        display: "inline-block", padding: "10px 24px",
        background: "var(--cr-gradient-brand)", color: "white",
        fontFamily: f, fontSize: "0.82rem", fontWeight: 700,
        borderRadius: "50px", textDecoration: "none",
      }}>{ctaLabel}</Link>
    </div>
  )
}

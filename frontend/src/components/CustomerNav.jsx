import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import cougarrideLogo from "../assets/cougarride-logo.png"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

const menus = {
  tickets: {
    label: "Passes & Tickets",
    columns: [
      { heading: "PARK ADMISSION", items: [
        { label: "General Admission", href: "/tickets" },
        { label: "Season Passes", href: "/tickets" },
        { label: "VIP Experience", href: "/tickets" },
      ]},
      { heading: "UPGRADES", items: [
        { label: "Fast Pass", href: "/tickets" },
        { label: "Dining Plans", href: "/dining" },
      ]},
      { heading: "INFORMATION", items: [
        { label: "Group Tickets", href: "/tickets" },
        { label: "Student Discounts", href: "/tickets" },
      ]},
    ],
  },
  rides: {
    label: "Rides & Experiences",
    columns: [
      { heading: "PARK ZONES", items: [
        { label: "All Rides", href: "/rides" },
        { label: "Zone A — Thrill Alley", href: "/rides?zone=Zone+A" },
        { label: "Zone B — Adventure Trail", href: "/rides?zone=Zone+B" },
        { label: "Zone C — Rapids Row", href: "/rides?zone=Zone+C" },
        { label: "Zone D — Family Fun", href: "/rides?zone=Zone+D" },
      ]},
      { heading: "DINING & MORE", items: [
        { label: "Restaurants", href: "/dining" },
        { label: "Gift Shops", href: "/shopping" },
        { label: "Games & Prizes", href: "/games" },
      ]},
      { heading: "EXPERIENCES", items: [
        { label: "Special Events", href: "/#plan" },
        { label: "Birthday Parties", href: "/#plan" },
      ]},
    ],
  },
  info: {
    label: "Park Info",
    columns: [
      { heading: "PLAN YOUR VISIT", items: [
        { label: "Park Hours", href: "/#plan" },
        { label: "Park Map", href: "/#plan" },
        { label: "Parking & Directions", href: "/#plan" },
      ]},
      { heading: "POLICIES", items: [
        { label: "Safety Guidelines", href: "/#plan" },
        { label: "Accessibility", href: "/#plan" },
      ]},
      { heading: "CONTACT", items: [
        { label: "Guest Services", href: "/#plan" },
        { label: "Lost & Found", href: "/#plan" },
      ]},
    ],
  },
}

export default function CustomerNav() {
  const [openMenu, setOpenMenu] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === "/"

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 60) }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  async function handleLogout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
    logout()
    navigate("/")
  }

  // Display full name if available, otherwise fall back to email prefix
  const displayName = user?.full_name || user?.email?.split("@")[0] || ""

  const navBg = scrolled || !isHome
    ? "rgba(10,9,9,0.97)"
    : "rgba(10,9,9,0.4)"

  return (
    <nav
      style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100 }}
      onMouseLeave={() => setOpenMenu(null)}
    >
      {/* ─── TOP UTILITY BAR ─── */}
      <div style={{
        background: "#060606",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 2rem", height: "34px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: f, fontSize: "0.7rem", color: "rgba(255,255,255,0.45)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#4CAF50", animation: "pulse 2s infinite",
            }} />
            <span>Park Open</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <span>Hours: <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>10 AM – 8 PM</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {user && (
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              Welcome, <strong style={{ color: "white" }}>{displayName}</strong>
              {["staff", "manager", "admin"].includes(user.role) && (
                <span style={{
                  marginLeft: 6, fontSize: "0.58rem", padding: "2px 7px",
                  background: "var(--cr-red)", color: "white", borderRadius: "4px",
                  textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700,
                }}>
                  {user.role}
                </span>
              )}
            </span>
          )}
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <Link to="/" style={{
            color: "rgba(255,255,255,0.45)", fontSize: "0.7rem",
            display: "flex", alignItems: "center", gap: "4px",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Search
          </Link>
        </div>
      </div>

      {/* ─── MAIN NAV BAR ─── */}
      <div style={{
        background: navBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: scrolled || !isHome ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        padding: "0 2rem", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "background 0.4s, border-color 0.4s",
      }}>
        {/* Logo */}
        <Link to="/" style={{
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <img src={cougarrideLogo} alt="CougarRide" style={{ height: "36px", width: "auto" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{
              fontFamily: fh, fontSize: "1.15rem", fontWeight: 800,
              color: "white", letterSpacing: "1.5px", textTransform: "uppercase",
              lineHeight: 1.1,
            }}>CougarRide</span>
            <span style={{
              fontFamily: f, fontSize: "0.55rem", fontWeight: 500,
              color: "rgba(255,255,255,0.35)", letterSpacing: "1px",
              textTransform: "uppercase",
            }}>Theme Park</span>
          </div>
        </Link>

        {/* Center nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
          {Object.entries(menus).map(([key, menu]) => (
            <div key={key} style={{ position: "relative" }}
              onMouseEnter={() => setOpenMenu(key)}
            >
              <button style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontFamily: f, fontSize: "0.84rem", fontWeight: 600,
                color: openMenu === key ? "white" : "rgba(255,255,255,0.65)",
                padding: "8px 16px", borderRadius: "8px",
                transition: "color 0.2s, background 0.2s",
                display: "flex", alignItems: "center", gap: "5px",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "white"}
              onMouseLeave={e => { if (openMenu !== key) e.currentTarget.style.color = "rgba(255,255,255,0.65)" }}
              >
                {menu.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: openMenu === key ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Right side: auth + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user ? (
            <>
              <Link to="/my-purchases" style={{
                fontFamily: f, fontSize: "0.73rem", fontWeight: 700,
                color: "rgba(255,255,255,0.65)", padding: "7px 16px",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50px",
                display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cr-red)"; e.currentTarget.style.color = "white" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                My Purchases
              </Link>
              {["staff", "manager", "admin"].includes(user.role) && (
                <Link to="/dashboard" style={{
                  fontFamily: f, fontSize: "0.73rem", fontWeight: 700,
                  color: "rgba(255,255,255,0.65)", padding: "7px 16px",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50px",
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cr-red)"; e.currentTarget.style.color = "white" }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                  Dashboard
                </Link>
              )}
              <button onClick={handleLogout} style={{
                fontFamily: f, fontSize: "0.72rem", fontWeight: 600,
                padding: "7px 16px", background: "transparent",
                color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "50px", cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)" }}
              >Logout</button>
            </>
          ) : (
            <Link to="/auth" style={{
              fontFamily: f, fontSize: "0.73rem", fontWeight: 600,
              color: "rgba(255,255,255,0.55)", padding: "7px 16px",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50px",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "white" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)" }}
            >Sign Up / Login</Link>
          )}
          <Link to="/tickets" style={{
            fontFamily: f, fontSize: "0.78rem", fontWeight: 700,
            padding: "10px 24px",
            background: "var(--cr-gradient-brand)",
            color: "white", borderRadius: "50px",
            letterSpacing: "0.3px",
            boxShadow: "0 4px 20px rgba(200,16,46,0.3)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(200,16,46,0.45)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(200,16,46,0.3)" }}
          >Buy Tickets</Link>
        </div>
      </div>

      {/* ─── MEGA DROPDOWN ─── */}
      {openMenu && (
        <div
          onMouseEnter={() => {}}
          onMouseLeave={() => setOpenMenu(null)}
          style={{
            position: "absolute", left: 0, right: 0,
            background: "rgba(10,9,9,0.98)",
            backdropFilter: "blur(24px)",
            borderBottom: "2px solid var(--cr-red)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            padding: "2.5rem 3rem",
            animation: "dropIn 0.2s ease-out",
          }}
        >
          <div style={{
            maxWidth: "1100px", margin: "0 auto",
            display: "grid",
            gridTemplateColumns: `repeat(${menus[openMenu].columns.length}, 1fr)`,
            gap: "3rem",
          }}>
            {menus[openMenu].columns.map((col, i) => (
              <div key={i}>
                <h4 style={{
                  fontFamily: f, fontSize: "0.62rem", fontWeight: 700,
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
                  letterSpacing: "2.5px", margin: "0 0 1.25rem",
                  paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>{col.heading}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {col.items.map((item, j) => {
                    const isHash = item.href.includes("#")
                    const shared = {
                      key: j,
                      onClick: () => setOpenMenu(null),
                      style: {
                        fontFamily: f, fontSize: "0.88rem", fontWeight: 500,
                        color: "rgba(255,255,255,0.6)",
                        transition: "color 0.15s, padding-left 0.15s",
                        display: "flex", alignItems: "center", gap: "8px",
                      },
                      onMouseEnter: e => { e.currentTarget.style.color = "white"; e.currentTarget.style.paddingLeft = "4px" },
                      onMouseLeave: e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.paddingLeft = "0" },
                    }
                    return isHash
                      ? <a {...shared} href={item.href}>{item.label}</a>
                      : <Link {...shared} to={item.href}>{item.label}</Link>
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

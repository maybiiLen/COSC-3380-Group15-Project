import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import { useNavigate, Link } from "react-router-dom"

// Ride card images (from collage)
import imgCougarExpress from "../assets/rides/cougar-express.jpg"
import imgThunderCanyon from "../assets/rides/thunder-canyon.jpg"
import imgSkyScreamer from "../assets/rides/sky-screamer.jpg"
import imgWildRiverRapids from "../assets/rides/wild-river-rapids.jpg"
import imgGalacticSpinner from "../assets/rides/galactic-spinner.jpg"
import imgMiniCoaster from "../assets/rides/mini-coaster.jpg"
import imgFerrisWheel from "../assets/rides/ferris-wheel.jpg"
import imgHauntedMansion from "../assets/rides/haunted-mansion.jpg"
import imgBumperCars from "../assets/rides/bumper-cars.jpg"

// Hero slideshow images (high-res)
import heroImgCougarExpress from "../assets/rides/hero-cougar-express.jpg"
import heroImgHauntedMansion from "../assets/rides/hero-haunted-mansion.jpg"
import heroImgWelcome from "../assets/rides/hero-welcome.jpg"
import heroImgSeasonPass from "../assets/rides/hero-season-pass.png"

// Brand logo
import cougarrideLogo from "../assets/cougarride-logo.png"
import cougarrideLogoMd from "../assets/cougarride-logo-md.png"

// ────────────────────────────────────────────
// RIDE IMAGES + DESCRIPTIONS (keyed by ride_name from DB)
// ────────────────────────────────────────────
const RIDE_META = {
  "Cougar Express": { img: imgCougarExpress, desc: "Our signature steel coaster with sweeping drops, high-speed turns, and stunning mountain views. Not for the faint of heart." },
  "Thunder Canyon": { img: imgThunderCanyon, desc: "A wild mine train adventure through rugged canyon terrain with sudden drops and dark tunnels." },
  "Sky Screamer": { img: imgSkyScreamer, desc: "Soar 200 feet above the park on this extreme swing ride with panoramic views and heart-pounding free-fall moments." },
  "Wild River Rapids": { img: imgWildRiverRapids, desc: "Grab your crew and brave the rapids — you will get soaked on this whitewater rafting adventure." },
  "Galactic Spinner": { img: imgGalacticSpinner, desc: "A cosmic spinning ride under neon lights. Each pod spins independently as you orbit the galaxy." },
  "Mini Coaster": { img: imgMiniCoaster, desc: "A dragon-themed family coaster with gentle hills and playful turns. Perfect for young adventurers and first-time riders." },
  "Ferris Wheel": { img: imgFerrisWheel, desc: "Take in the glittering skyline from our illuminated Ferris wheel — the perfect ride for a sunset view of the park." },
  "Haunted Mansion": { img: imgHauntedMansion, desc: "Enter if you dare. This dark ride takes you through 13 rooms of ghostly encounters and spine-chilling surprises." },
  "Bumper Cars": { img: imgBumperCars, desc: "Classic fun for all ages. Bump, dodge, and crash your way through our neon-lit arena." },
}

// ────────────────────────────────────────────
// HERO SLIDESHOW DATA
// ────────────────────────────────────────────
const HERO_SLIDES = [
  { img: heroImgWelcome, tag: "Welcome", title: "CougarRide", subtitle: "Where Every Ride Tells a Story", cta: "Explore the Park", href: "#rides" },
  { img: heroImgCougarExpress, tag: "Featured Ride", title: "Cougar Express", subtitle: "Our #1 rated coaster — 3 inversions, 65 mph top speed through rugged canyon terrain", cta: "Explore Rides", href: "#rides" },
  { img: heroImgHauntedMansion, tag: "New Experience", title: "Haunted Mansion", subtitle: "13 rooms of terror await beyond the iron gates. Are you brave enough to enter?", cta: "Learn More", href: "#rides" },
  { img: heroImgSeasonPass, tag: "Limited Time Offer", title: "Season Pass Sale", subtitle: "Unlimited visits all season long — starting at just $149. Plus 10% off food & merch.", cta: "Buy Now", href: "#tickets" },
]

// ────────────────────────────────────────────
// TICKETS CTA — links to dedicated /tickets page
// ────────────────────────────────────────────
function TicketsCTA() {
  return (
    <div id="tickets" style={{ background: "#0F0E0E", padding: "5rem 2rem" }}>
      <div style={{
        maxWidth: "1050px", margin: "0 auto",
        background: "linear-gradient(135deg, #8C1D40 0%, #C8102E 50%, #F4845F 100%)",
        borderRadius: "20px", padding: "3.5rem 3rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "2rem",
      }}>
        <div style={{ maxWidth: "500px" }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", fontWeight: 700,
            letterSpacing: "2.5px", textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)", display: "inline-block", marginBottom: "0.75rem",
            background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "50px",
          }}>Passes & Tickets</span>
          <h2 style={{
            fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
            fontWeight: 900, color: "white", margin: "0 0 0.75rem", lineHeight: 1.1,
          }}>Your Adventure Starts Here</h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem",
            color: "rgba(255,255,255,0.8)", lineHeight: 1.5, margin: 0,
          }}>
            General Admission from <strong>$49</strong> · Season Passes from <strong>$149</strong> · VIP from <strong>$89</strong>
          </p>
        </div>
        <Link to="/tickets" style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 700,
          padding: "16px 40px", background: "white", color: "#8C1D40",
          borderRadius: "50px", textDecoration: "none",
          letterSpacing: "0.5px", boxShadow: "0 8px 25px rgba(0,0,0,0.2)",
          transition: "transform 0.15s",
        }}>Buy Tickets →</Link>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// NAVBAR — Six Flags style with mega dropdowns
// Top bar: park hours + greeting | Search + Cart
// Main bar: Logo | Passes & Tickets ▾ | Rides & Experiences ▾ | Park Info ▾ | Buy Tickets CTA
// ────────────────────────────────────────────
function CustomerNav({ user, onLogout }) {
  const [openMenu, setOpenMenu] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const menus = {
    tickets: {
      label: "Passes & Tickets",
      columns: [
        { heading: "PARK ADMISSION", items: [
          { label: "General Admission", href: "#tickets" },
          { label: "Season Passes", href: "#tickets" },
          { label: "VIP Experience", href: "#tickets" },
        ]},
        { heading: "UPGRADES", items: [
          { label: "Fast Pass", href: "#tickets" },
          { label: "Dining Plans", href: "#plan" },
          { label: "Parking", href: "#plan" },
        ]},
        { heading: "INFORMATION", items: [
          { label: "Group Tickets", href: "#tickets" },
          { label: "Student Discounts", href: "#tickets" },
          ...(user ? [{ label: "My Purchases", href: "#my-purchases" }] : []),
        ]},
      ],
    },
    rides: {
      label: "Rides & Experiences",
      columns: [
        { heading: "RIDES & ATTRACTIONS", items: [
          { label: "All Rides", href: "#rides" },
          { label: "Thrill Rides", href: "#rides" },
          { label: "Family Rides", href: "#rides" },
          { label: "Kids Rides", href: "#rides" },
        ]},
        { heading: "DINING & MORE", items: [
          { label: "Restaurants", href: "#plan" },
          { label: "Gift Shop", href: "#plan" },
        ]},
        { heading: "EXPERIENCES", items: [
          { label: "Special Events", href: "#plan" },
          { label: "Birthday Parties", href: "#plan" },
        ]},
      ],
    },
    info: {
      label: "Park Info",
      columns: [
        { heading: "PLAN YOUR VISIT", items: [
          { label: "Park Hours", href: "#plan" },
          { label: "Park Map", href: "#plan" },
          { label: "Parking & Directions", href: "#plan" },
        ]},
        { heading: "POLICIES", items: [
          { label: "Safety Guidelines", href: "#plan" },
          { label: "Dress Code", href: "#plan" },
          { label: "Accessibility", href: "#plan" },
        ]},
        { heading: "CONTACT", items: [
          { label: "Guest Services", href: "#plan" },
          { label: "Lost & Found", href: "#plan" },
        ]},
      ],
    },
  }

  const f = "'DM Sans', sans-serif"

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100 }}
      onMouseLeave={() => setOpenMenu(null)}
    >
      {/* ─── TOP BAR (park hours + greeting + search/cart) ─── */}
      <div style={{
        background: "#0A0909", borderBottom: "1px solid #1A1919",
        padding: "0 2rem", height: "36px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: f, fontSize: "0.72rem", color: "rgba(255,255,255,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span>Park: <span style={{ color: "#4CAF50", fontWeight: 600 }}>10:00 AM - 8:00 PM</span></span>
          <span style={{ color: "#2A2929" }}>|</span>
          <span>Status: <span style={{ color: "#4CAF50", fontWeight: 600 }}>Open</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {user && (
            <span style={{ color: "rgba(255,255,255,0.6)" }}>
              Hello, <strong style={{ color: "white" }}>{user.email.split("@")[0]}</strong>
              {["staff", "manager", "admin"].includes(user.role) && (
                <span style={{ marginLeft: "6px", fontSize: "0.6rem", padding: "2px 6px", background: "#C8102E", color: "white", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{user.role}</span>
              )}
            </span>
          )}

          {/* Search */}
          <button onClick={() => setSearchOpen(!searchOpen)} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "4px",
            fontFamily: f, fontSize: "0.72rem",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Search
          </button>

          <span style={{ color: "#2A2929" }}>|</span>

          {/* Cart */}
          <button style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "4px",
            fontFamily: f, fontSize: "0.72rem",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Cart
          </button>
        </div>
      </div>

      {/* ─── MAIN NAV BAR ─── */}
      <div style={{
        background: "rgba(15,14,14,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 2rem", height: "56px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }) }} style={{
          display: "flex", alignItems: "center", gap: "8px",
          textDecoration: "none",
        }}>
          <img src={cougarrideLogo} alt="CougarRide" style={{ height: "38px", width: "auto" }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "1.15rem", fontWeight: 900,
            color: "#C8102E", letterSpacing: "2px", textTransform: "uppercase",
          }}>COUGARIDE</span>
        </a>

        {/* Menu items */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {Object.entries(menus).map(([key, menu]) => (
            <div key={key} style={{ position: "relative" }}
              onMouseEnter={() => setOpenMenu(key)}
            >
              <button style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontFamily: f, fontSize: "0.85rem", fontWeight: 600,
                color: openMenu === key ? "white" : "rgba(255,255,255,0.6)",
                padding: "8px 16px", borderRadius: "6px",
                transition: "color 0.15s",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                {menu.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: openMenu === key ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Right side: auth + buy tickets */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {user ? (
            <>
              {["staff", "manager", "admin"].includes(user.role) && (
                <Link to="/dashboard" style={{
                  fontFamily: f, fontSize: "0.75rem", fontWeight: 700,
                  color: "white", textDecoration: "none",
                  padding: "8px 18px",
                  background: "linear-gradient(135deg, #C8102E, #8C1D40)",
                  borderRadius: "50px",
                  display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: "0 2px 10px rgba(200,16,46,0.3)",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard
                </Link>
              )}
              <button onClick={onLogout} style={{
                fontFamily: f, fontSize: "0.72rem", fontWeight: 600,
                padding: "6px 14px", background: "transparent",
                color: "rgba(255,255,255,0.5)", border: "1px solid #2A2929",
                borderRadius: "50px", cursor: "pointer",
              }}>Logout</button>
            </>
          ) : (
            <Link to="/auth" style={{
              fontFamily: f, fontSize: "0.75rem", fontWeight: 600,
              color: "rgba(255,255,255,0.5)", textDecoration: "none",
              padding: "6px 14px", border: "1px solid #2A2929", borderRadius: "50px",
            }}>Log In or Create Account</Link>
          )}
          <Link to="/tickets" style={{
            fontFamily: f, fontSize: "0.75rem", fontWeight: 700,
            padding: "9px 22px",
            background: "linear-gradient(135deg, #C8102E, #8C1D40)",
            color: "white", borderRadius: "50px", textDecoration: "none",
            letterSpacing: "0.5px",
            boxShadow: "0 2px 12px rgba(200,16,46,0.3)",
          }}>Buy Tickets</Link>
        </div>
      </div>

      {/* ─── MEGA DROPDOWN ─── */}
      {openMenu && (
        <div
          onMouseEnter={() => {}}
          onMouseLeave={() => setOpenMenu(null)}
          style={{
            position: "absolute", left: 0, right: 0,
            background: "#141313", borderBottom: "2px solid #C8102E",
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
            padding: "2rem 3rem",
            animation: "dropIn 0.15s ease-out",
          }}
        >
          <div style={{ maxWidth: "1050px", margin: "0 auto", display: "grid", gridTemplateColumns: `repeat(${menus[openMenu].columns.length}, 1fr)`, gap: "2.5rem" }}>
            {menus[openMenu].columns.map((col, i) => (
              <div key={i}>
                <h4 style={{
                  fontFamily: f, fontSize: "0.65rem", fontWeight: 700,
                  color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
                  letterSpacing: "2px", margin: "0 0 1rem", paddingBottom: "0.5rem",
                  borderBottom: "1px solid #2A2929",
                }}>{col.heading}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {col.items.map((item, j) => (
                    <a key={j} href={item.href} onClick={() => setOpenMenu(null)} style={{
                      fontFamily: f, fontSize: "0.9rem", fontWeight: 500,
                      color: "rgba(255,255,255,0.7)", textDecoration: "none",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => e.target.style.color = "white"}
                    onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.7)"}
                    >{item.label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SEARCH OVERLAY ─── */}
      {searchOpen && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          background: "#141313", borderBottom: "2px solid #C8102E",
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          padding: "1.5rem 3rem",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
        }}>
          <input
            type="text" placeholder="Search rides, tickets, experiences..." autoFocus
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%", maxWidth: "500px", padding: "12px 18px",
              background: "#222", border: "1px solid #3A3939", borderRadius: "10px",
              color: "white", fontFamily: f, fontSize: "0.95rem", outline: "none",
            }}
            onFocus={e => e.target.style.borderColor = "#C8102E"}
            onBlur={e => e.target.style.borderColor = "#3A3939"}
          />
          <button onClick={() => { setSearchOpen(false); setSearchQuery("") }} style={{
            background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontFamily: f, fontSize: "0.85rem",
          }}>Cancel</button>
        </div>
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </nav>
  )
}

// ────────────────────────────────────────────
// HERO SLIDESHOW
// ────────────────────────────────────────────
function HeroSection() {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef(null)

  // Auto-advance every 6 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % HERO_SLIDES.length), 6000)
    return () => clearInterval(timerRef.current)
  }, [])

  function goTo(idx) {
    setCurrent(idx)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % HERO_SLIDES.length), 6000)
  }

  const slide = HERO_SLIDES[current]
  const f = "'DM Sans', sans-serif"

  return (
    <div style={{
      position: "relative", height: "85vh", minHeight: "500px", overflow: "hidden",
    }}>
      {/* Background image */}
      {HERO_SLIDES.map((s, i) => (
        <div key={i} style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${s.img})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: i === current ? 1 : 0,
          transition: "opacity 0.8s ease-in-out",
        }} />
      ))}

      {/* Dark overlay for text readability */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)",
      }} />

      {/* Bottom gradient fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "120px",
        background: "linear-gradient(transparent, #0F0E0E)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 2, height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 4rem", maxWidth: "700px",
      }}>
        <div key={current} style={{ animation: "heroFadeIn 0.6s ease-out" }}>
          <span style={{
            fontFamily: f, fontSize: "0.7rem", fontWeight: 700,
            letterSpacing: "2.5px", textTransform: "uppercase",
            color: "#F4845F", display: "inline-block", marginBottom: "0.75rem",
            background: "rgba(244,132,95,0.12)", padding: "5px 14px", borderRadius: "50px",
          }}>{slide.tag}</span>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", fontWeight: 900,
            color: "white", lineHeight: 1.05, margin: "0 0 0.75rem",
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}>{slide.title}</h1>

          <p style={{
            fontFamily: f, fontSize: "clamp(0.95rem, 1.8vw, 1.15rem)",
            color: "rgba(255,255,255,0.8)", margin: "0 0 2rem",
            lineHeight: 1.5, maxWidth: "480px",
          }}>{slide.subtitle}</p>

          <a href={slide.href} style={{
            display: "inline-block", fontFamily: f, fontSize: "0.85rem", fontWeight: 700,
            padding: "14px 32px", background: "linear-gradient(135deg, #C8102E, #8C1D40)",
            color: "white", borderRadius: "50px", textDecoration: "none",
            letterSpacing: "0.5px", boxShadow: "0 4px 20px rgba(200,16,46,0.4)",
            transition: "transform 0.15s",
          }}>{slide.cta} →</a>
        </div>
      </div>

      {/* Slide indicators */}
      <div style={{
        position: "absolute", bottom: "2rem", left: "4rem", zIndex: 3,
        display: "flex", gap: "10px", alignItems: "center",
      }}>
        {HERO_SLIDES.map((s, i) => (
          <button key={i} onClick={() => goTo(i)} style={{
            width: i === current ? "36px" : "10px", height: "10px",
            borderRadius: "5px", border: "none", cursor: "pointer",
            background: i === current ? "#C8102E" : "rgba(255,255,255,0.3)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Prev / Next arrows */}
      <div style={{
        position: "absolute", bottom: "2rem", right: "4rem", zIndex: 3,
        display: "flex", gap: "8px",
      }}>
        <button onClick={() => goTo((current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)} style={arrowBtnStyle}>‹</button>
        <button onClick={() => goTo((current + 1) % HERO_SLIDES.length)} style={arrowBtnStyle}>›</button>
      </div>

      <style>{`
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const arrowBtnStyle = {
  width: "40px", height: "40px", borderRadius: "50%",
  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
  color: "white", fontSize: "1.3rem", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(8px)",
}

// ────────────────────────────────────────────
// RIDES SHOWCASE — image cards with Learn More modal
// ────────────────────────────────────────────
function RidesSection() {
  const [rides, setRides] = useState([])
  const [selectedRide, setSelectedRide] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides`)
      .then(res => res.json())
      .then(data => setRides(data))
      .catch(() => {})
  }, [])

  const f = "'DM Sans', sans-serif"

  // Map status to customer-friendly label
  const customerStatus = (status) => {
    if (status === "Operational") return { label: "Open", color: "#4CAF50" }
    if (status === "Maintenance") return { label: "Temporarily Closed", color: "#FF9800" }
    return { label: "Closed", color: "#E53935" }
  }

  return (
    <div id="rides" style={{ background: "#0F0E0E", padding: "5rem 2rem" }}>
      <div style={{ maxWidth: "1150px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <span style={{ fontFamily: f, fontSize: "0.75rem", letterSpacing: "3px", textTransform: "uppercase", color: "#F4845F" }}>Attractions</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 900, color: "white", margin: "0.6rem 0 0.4rem" }}>Our Rides & Experiences</h2>
          <p style={{ fontFamily: f, fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", maxWidth: "550px", margin: "0 auto" }}>
            From gentle family rides to extreme coasters — there's an adventure for everyone at CougarRide.
          </p>
        </div>

        {rides.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: f }}>Loading rides...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
            {rides.map(ride => {
              const meta = RIDE_META[ride.ride_name] || {}
              const st = customerStatus(ride.status)
              return (
                <div key={ride.ride_id} style={{
                  borderRadius: "16px", overflow: "hidden",
                  background: "#1A1919", border: "1px solid #2A2929",
                  transition: "transform 0.25s, box-shadow 0.25s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Ride image */}
                  <div style={{
                    position: "relative", height: "200px", overflow: "hidden",
                  }}>
                    <img src={meta.img} alt={ride.ride_name} style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      transition: "transform 0.4s ease",
                    }}
                    onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                    onMouseLeave={e => e.target.style.transform = "scale(1)"}
                    />
                    {/* Status badge */}
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      background: st.color, color: "white",
                      fontFamily: f, fontSize: "0.6rem", fontWeight: 700,
                      padding: "4px 12px", borderRadius: "50px",
                      letterSpacing: "1px", textTransform: "uppercase",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}>{st.label}</div>
                    {/* Bottom gradient */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: "60px",
                      background: "linear-gradient(transparent, #1A1919)",
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <h3 style={{
                      fontFamily: "'Playfair Display', serif", fontSize: "1.25rem",
                      fontWeight: 700, color: "white", margin: "0 0 0.35rem",
                    }}>{ride.ride_name}</h3>
                    <p style={{
                      fontFamily: f, fontSize: "0.82rem",
                      color: "rgba(255,255,255,0.5)", margin: "0 0 1rem",
                      lineHeight: 1.5, display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{meta.desc || "An exciting ride experience awaits you."}</p>

                    <button onClick={() => setSelectedRide(ride)} style={{
                      fontFamily: f, fontSize: "0.78rem", fontWeight: 700,
                      color: "#F4845F", background: "transparent", border: "none",
                      cursor: "pointer", padding: 0, letterSpacing: "0.5px",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}>
                      Learn More <span style={{ fontSize: "1rem" }}>→</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── LEARN MORE MODAL ─── */}
      {selectedRide && (
        <div onClick={() => setSelectedRide(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "2rem",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: "650px",
            background: "#1A1919", borderRadius: "20px",
            border: "1px solid #2A2929", overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            animation: "heroFadeIn 0.3s ease-out",
          }}>
            {/* Modal image */}
            <div style={{ position: "relative", height: "280px" }}>
              <img src={RIDE_META[selectedRide.ride_name]?.img} alt={selectedRide.ride_name} style={{
                width: "100%", height: "100%", objectFit: "cover",
              }} />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "100px",
                background: "linear-gradient(transparent, #1A1919)",
              }} />
              <button onClick={() => setSelectedRide(null)} style={{
                position: "absolute", top: 14, right: 14,
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(0,0,0,0.5)", border: "none",
                color: "white", fontSize: "1.2rem", cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}>✕</button>
            </div>

            {/* Modal content */}
            <div style={{ padding: "1.5rem 2rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <h2 style={{
                  fontFamily: "'Playfair Display', serif", fontSize: "1.6rem",
                  fontWeight: 900, color: "white", margin: 0,
                }}>{selectedRide.ride_name}</h2>
                <span style={{
                  fontFamily: f, fontSize: "0.6rem", fontWeight: 700,
                  padding: "3px 10px", borderRadius: "50px",
                  background: customerStatus(selectedRide.status).color,
                  color: "white", textTransform: "uppercase", letterSpacing: "1px",
                }}>{customerStatus(selectedRide.status).label}</span>
              </div>

              <p style={{
                fontFamily: f, fontSize: "0.9rem",
                color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
                margin: "0 0 1.5rem",
              }}>{RIDE_META[selectedRide.ride_name]?.desc}</p>

              {/* Ride details grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem",
                padding: "1.25rem", background: "#141313", borderRadius: "12px",
              }}>
                {[
                  { label: "Zone", value: selectedRide.location },
                  { label: "Wait Time", value: selectedRide.status === "Operational" ? `${selectedRide.wait_time} min` : "N/A" },
                  { label: "Height Req.", value: selectedRide.min_height_in > 0 ? `${selectedRide.min_height_in}"` : "None" },
                ].map((item, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: f, fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "4px" }}>{item.label}</div>
                    <div style={{ fontFamily: f, fontSize: "1rem", fontWeight: 700, color: "white" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// MY PURCHASES — only shown when logged in
// ────────────────────────────────────────────
function PurchasesSection() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) { setLoading(false); return }

    fetch(`${API_BASE_URL}/api/tickets/my-purchases`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => { setPurchases(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div id="my-purchases" style={{ background: "linear-gradient(180deg, #0F0E0E, #1A1919)", padding: "5rem 2rem" }}>
      <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "3px", textTransform: "uppercase", color: "#F4845F" }}>Order History</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 900, color: "white", margin: "0.6rem 0" }}>My Purchases</h2>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
        ) : purchases.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "#1A1919", borderRadius: "16px", border: "1px solid #2A2929" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.4)" }}>
              {localStorage.getItem("accessToken")
                ? "No purchases yet. Grab some tickets above! 🎢"
                : "Sign in to view your purchase history."}
            </p>
            {!localStorage.getItem("accessToken") && (
              <Link to="/auth" style={{
                display: "inline-block", marginTop: "1rem",
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 600,
                padding: "10px 24px", background: "#C8102E", color: "white",
                borderRadius: "50px", textDecoration: "none",
              }}>Log In or Create Account</Link>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {purchases.map(p => (
              <div key={p.purchase_id} style={{
                background: "#1A1919", borderRadius: "14px", padding: "1.5rem",
                border: "1px solid #2A2929",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: "1rem",
              }}>
                <div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "white", margin: "0 0 0.3rem" }}>{p.ticket_type}</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>
                    {p.adult_qty > 0 && `${p.adult_qty} adult${p.adult_qty > 1 ? "s" : ""}`}
                    {p.adult_qty > 0 && p.child_qty > 0 && " · "}
                    {p.child_qty > 0 && `${p.child_qty} child${p.child_qty > 1 ? "ren" : ""}`}
                    {" · "}Purchased {new Date(p.purchase_date).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "white" }}>
                  ${Number(p.total_price).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// PLAN YOUR VISIT
// ────────────────────────────────────────────
function PlanSection() {
  const items = [
    { icon: "🕐", title: "Park Hours", detail: "10 AM – 8 PM", sub: "Hours may vary by season" },
    { icon: "🅿️", title: "Parking", detail: "Free Standard", sub: "Premium spots $15" },
    { icon: "🍔", title: "Dining", detail: "4 Restaurants", sub: "Mobile ordering available" },
    { icon: "🛡️", title: "Safety", detail: "Daily Inspections", sub: "All rides certified" },
  ]

  return (
    <div style={{ background: "#1A1919", padding: "5rem 2rem" }}>
      <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "3px", textTransform: "uppercase", color: "#F4845F" }}>Plan Your Visit</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 900, color: "white", margin: "0.6rem 0" }}>Know Before You Go</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: "#222", borderRadius: "14px", padding: "1.5rem", border: "1px solid #2A2929", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "0.6rem" }}>{item.icon}</div>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 0.4rem" }}>{item.title}</h3>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "white", margin: "0 0 0.2rem" }}>{item.detail}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// FOOTER
// ────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: "#0A0909", padding: "3rem 2rem", borderTop: "1px solid #1A1919" }}>
      <div style={{ maxWidth: "1050px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "0.5rem" }}>
          <img src={cougarrideLogoMd} alt="CougarRide" style={{ height: "50px", width: "auto" }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "1.4rem", fontWeight: 900,
            color: "#C8102E", letterSpacing: "3px", textTransform: "uppercase",
          }}>COUGARIDE</span>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", margin: "0 0 1.25rem" }}>
          University of Houston Theme Park · Est. 2026
        </p>

        {/* Footer nav links */}
        <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {[
            { label: "Tickets", href: "/tickets" },
            { label: "Park Hours", href: "#plan" },
            { label: "Guest Services", href: "#plan" },
            { label: "Accessibility", href: "#plan" },
            { label: "Careers", href: "#" },
          ].map(link => (
            <a key={link.label} href={link.href} style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem",
              color: "rgba(255,255,255,0.35)", textDecoration: "none",
            }}>{link.label}</a>
          ))}
        </div>

        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem", color: "rgba(255,255,255,0.18)", lineHeight: 1.8, marginBottom: "1.5rem" }}>
          All tickets are nontransferable and nonrefundable. Rides subject to availability, weather closures, and maintenance schedules.
          <br />© 2026 CougarRide — COSC 3380 Group 15. All rights reserved.
        </div>

        {/* Team login — subtle, at the very bottom */}
        <div style={{ borderTop: "1px solid #1A1919", paddingTop: "1rem" }}>
          <Link to="/auth" style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem",
            color: "rgba(255,255,255,0.15)", textDecoration: "none",
            letterSpacing: "0.5px",
          }}>Team Member Login</Link>
        </div>
      </div>
    </footer>
  )
}

// ────────────────────────────────────────────
// MAIN EXPORT
// ────────────────────────────────────────────
export default function CustomerLanding() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
    logout()
    navigate("/")
  }

  return (
    <div style={{ background: "#0F0E0E", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>
      <CustomerNav user={user} onLogout={handleLogout} />
      <div style={{ paddingTop: "92px" }}>
        <HeroSection />
        <TicketsCTA />
        <RidesSection />
        <PurchasesSection />
        <PlanSection />
        <Footer />
      </div>
    </div>
  )
}
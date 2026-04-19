import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import { useNavigate, Link, useLocation } from "react-router-dom"

import CustomerNav from "../components/CustomerNav"
import CustomerFooter from "../components/CustomerFooter"

// Ride card images
import imgCougarExpress from "../assets/rides/cougar-express.jpg"
import imgThunderCanyon from "../assets/rides/thunder-canyon.jpg"
import imgSkyScreamer from "../assets/rides/sky-screamer.jpg"
import imgWildRiverRapids from "../assets/rides/wild-river-rapids.jpg"
import imgGalacticSpinner from "../assets/rides/galactic-spinner.jpg"
import imgMiniCoaster from "../assets/rides/mini-coaster.jpg"
import imgFerrisWheel from "../assets/rides/ferris-wheel.jpg"
import imgHauntedMansion from "../assets/rides/haunted-mansion.jpg"
import imgBumperCars from "../assets/rides/bumper-cars.jpg"
import imgDropTower from "../assets/rides/drop-tower.jpg"

// Hero images
import heroImgCougarExpress from "../assets/rides/hero-cougar-express.jpg"
import heroImgCougarExpressNew from "../assets/rides/hero-cougar-express-new.jpg"
import heroImgHauntedMansion from "../assets/rides/hero-haunted-mansion.jpg"
import heroImgHauntedMansionNew from "../assets/rides/hero-haunted-mansion-new.jpg"
import heroImgWelcome from "../assets/rides/hero-welcome.jpg"
import heroImgRefreshments from "../assets/rides/hero-refreshments.jpg"
import heroImgSeasonPass from "../assets/rides/hero-season-pass.png"

// Action card images
import actionSeasonPass from "../assets/actions/season-pass.jpg"
import actionBuyTickets from "../assets/actions/buy-tickets.jpg"
import actionFood from "../assets/actions/food.jpg"
import actionRides from "../assets/actions/rides.jpg"
import actionGames from "../assets/actions/games.jpg"
import actionGiftShop from "../assets/actions/gift-shop.jpg"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"
const fd = "'Playfair Display', serif"

// ─── RIDE METADATA ───
const RIDE_META = {
  "Cougar Express": { img: imgCougarExpress, desc: "Our signature steel coaster with sweeping drops, high-speed turns, and stunning mountain views. Not for the faint of heart.", thrill: "Extreme" },
  "Thunder Canyon": { img: imgThunderCanyon, desc: "A wild mine train adventure through rugged canyon terrain with sudden drops and dark tunnels.", thrill: "High" },
  "Sky Screamer": { img: imgSkyScreamer, desc: "Soar 200 feet above the park on this extreme swing ride with panoramic views and heart-pounding free-fall moments.", thrill: "Extreme" },
  "Wild River Rapids": { img: imgWildRiverRapids, desc: "Grab your crew and brave the rapids — you will get soaked on this whitewater rafting adventure.", thrill: "Moderate" },
  "Galactic Spinner": { img: imgGalacticSpinner, desc: "A cosmic spinning ride under neon lights. Each pod spins independently as you orbit the galaxy.", thrill: "Moderate" },
  "Mini Coaster": { img: imgMiniCoaster, desc: "A dragon-themed family coaster with gentle hills and playful turns. Perfect for young adventurers.", thrill: "Family" },
  "Ferris Wheel": { img: imgFerrisWheel, desc: "Take in the glittering skyline from our illuminated Ferris wheel — the perfect ride for a sunset view.", thrill: "Family" },
  "Haunted Mansion": { img: imgHauntedMansion, desc: "Enter if you dare. This dark ride takes you through 13 rooms of ghostly encounters.", thrill: "Moderate" },
  "Bumper Cars": { img: imgBumperCars, desc: "Classic fun for all ages. Bump, dodge, and crash your way through our neon-lit arena.", thrill: "Family" },
  "Drop Tower": { img: imgDropTower, desc: "Plunge from dizzying heights in a heart-stopping free-fall. Hold on tight!", thrill: "Extreme" },
}

// ─── HERO SLIDES ───
const HERO_SLIDES = [
  { img: heroImgWelcome, tag: "Welcome to", title: "CougarRide", subtitle: "Where Every Ride Tells a Story", cta: "Explore the Park", href: "#rides" },
  { img: heroImgRefreshments, tag: "Summer Refreshments", title: "Ice Cold Fun", subtitle: "Stay energized with our diverse dining options", cta: "Explore Dining", href: "/dining" },
  { img: heroImgCougarExpressNew, tag: "Featured Ride", title: "Cougar Express", subtitle: "Experience the ultimate thrill on our signature coaster", cta: "Explore Rides", href: "#rides" },
  { img: heroImgHauntedMansionNew, tag: "New Experience", title: "Haunted Mansion", subtitle: "Face your fears in our latest attraction", cta: "Learn More", href: "#rides" },
]

const ZONES = ["All", "Zone A", "Zone B", "Zone C", "Zone D"]

// ────────────────────────────────────────────
// HERO SLIDESHOW
// ────────────────────────────────────────────
function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const DURATION = 6000
  const startRef = useRef(Date.now())

  useEffect(() => {
    const frame = () => {
      const elapsed = Date.now() - startRef.current
      setProgress(Math.min((elapsed / DURATION) * 100, 100))
      if (elapsed >= DURATION) { goTo((current + 1) % HERO_SLIDES.length); return }
      raf.current = requestAnimationFrame(frame)
    }
    const raf = { current: requestAnimationFrame(frame) }
    return () => cancelAnimationFrame(raf.current)
  }, [current])

  function goTo(i) { setCurrent(i); setProgress(0); startRef.current = Date.now() }

  const slide = HERO_SLIDES[current]

  return (
    <div style={{
      position: "relative", height: "85vh", minHeight: "500px",
      overflow: "hidden", clipPath: "polygon(0 0, 100% 0, 100% 92%, 0 100%)",
    }}>
      {HERO_SLIDES.map((s, i) => (
        <div key={i} style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${s.img})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: i === current ? 1 : 0,
          transition: "opacity 0.8s ease-in-out",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
          }} />
        </div>
      ))}

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 2,
        height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "0 4rem",
        maxWidth: "700px",
      }}>
        <span style={{
          fontFamily: f, fontSize: "0.7rem", fontWeight: 700,
          letterSpacing: "3px", textTransform: "uppercase",
          color: "var(--cr-coral)",
          animation: "fadeInUp 0.4s ease-out",
        }}>{slide.tag}</span>

        <h1 style={{
          fontFamily: fd, fontSize: "clamp(2.8rem, 5vw, 4.2rem)",
          fontWeight: 900, fontStyle: "italic", color: "white",
          margin: "0.5rem 0", lineHeight: 1.1,
          textShadow: "0 4px 30px rgba(0,0,0,0.5)",
          animation: "fadeInUp 0.5s ease-out 0.1s both",
        }}>{slide.title}</h1>

        <p style={{
          fontFamily: f, fontSize: "clamp(0.85rem, 1.5vw, 1rem)",
          color: "rgba(255,255,255,0.7)", maxWidth: "450px",
          lineHeight: 1.5, margin: "0 0 1.5rem",
          animation: "fadeInUp 0.5s ease-out 0.2s both",
        }}>{slide.subtitle}</p>

        {slide.href.startsWith("/") ? (
          <Link to={slide.href} style={heroCTAStyle}>{slide.cta} <span style={{ fontSize: "1.1rem" }}>→</span></Link>
        ) : (
          <a href={slide.href} onClick={(e) => {
            e.preventDefault()
            const id = slide.href.replace("#", "")
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
          }} style={heroCTAStyle}>{slide.cta} <span style={{ fontSize: "1.1rem" }}>→</span></a>
        )}
      </div>

      {/* Slide indicators */}
      <div style={{
        position: "absolute", bottom: "12%", left: "4rem", zIndex: 3,
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        {HERO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} style={{
            width: i === current ? "40px" : "10px",
            height: "4px", border: "none", cursor: "pointer",
            borderRadius: "2px", overflow: "hidden",
            background: i === current ? "transparent" : "rgba(255,255,255,0.25)",
            position: "relative",
            transition: "width 0.4s var(--ease-out-expo)",
          }}>
            {i === current && (
              <>
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.2)", borderRadius: "2px" }} />
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${progress}%`, background: "var(--cr-red)", borderRadius: "2px", transition: "width 0.1s linear" }} />
              </>
            )}
          </button>
        ))}
        <span style={{
          fontFamily: f, fontSize: "0.65rem", color: "rgba(255,255,255,0.3)",
          marginLeft: "12px", fontWeight: 500,
        }}>
          {String(current + 1).padStart(2, "0")} / {String(HERO_SLIDES.length).padStart(2, "0")}
        </span>
      </div>

      {/* Arrow buttons */}
      <div style={{
        position: "absolute", bottom: "10%", right: "4rem", zIndex: 3,
        display: "flex", gap: "8px",
      }}>
        <button onClick={() => goTo((current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)} style={arrowBtnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <button onClick={() => goTo((current + 1) % HERO_SLIDES.length)} style={arrowBtnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  )
}

const heroCTAStyle = {
  display: "inline-flex", alignItems: "center", gap: "8px",
  fontFamily: f, fontSize: "0.88rem", fontWeight: 700,
  padding: "14px 32px",
  background: "var(--cr-gradient-brand)",
  color: "white", borderRadius: "50px",
  letterSpacing: "0.3px",
  boxShadow: "0 8px 30px rgba(200,16,46,0.35)",
  transition: "transform 0.2s, box-shadow 0.2s",
}

const arrowBtnStyle = {
  width: "44px", height: "44px", borderRadius: "50%",
  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
  color: "white", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(8px)",
  transition: "background 0.2s, border-color 0.2s",
}

// ────────────────────────────────────────────
// "WHAT WOULD YOU LIKE TO DO?" — Six Flags style (WHITE THEME)
// ────────────────────────────────────────────
function WhatToDoSection() {
  const callouts = [
    { img: actionFood, title: "Restaurants", href: "/dining" },
    { img: actionRides, title: "Rides", href: "/rides" },
    { img: actionGames, title: "Games", href: "/games" },
    { img: actionGiftShop, title: "Shopping", href: "/shopping" },
  ]

  return (
    <div style={{ padding: "3rem 2rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{
        fontFamily: fh, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800,
        color: "var(--cr-text)", textAlign: "center", marginBottom: "2rem",
      }}>
        What would you like to do today?
      </h2>

      {/* Top row: 2 large featured cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <Link to="/tickets" style={{
          position: "relative", borderRadius: "16px", overflow: "hidden",
          height: "260px", display: "flex", flexDirection: "column",
          justifyContent: "flex-end", padding: "1.75rem",
        }}
        onMouseEnter={e => { e.currentTarget.querySelector('.card-arrow').style.transform = "translateX(4px)"; e.currentTarget.querySelector('.card-bg').style.transform = "scale(1.05)" }}
        onMouseLeave={e => { e.currentTarget.querySelector('.card-arrow').style.transform = "translateX(0)"; e.currentTarget.querySelector('.card-bg').style.transform = "scale(1)" }}
        >
          <div className="card-bg" style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${actionSeasonPass})`,
            backgroundSize: "cover", backgroundPosition: "center",
            transition: "transform 0.6s var(--ease-out-expo)",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <span style={{
              fontFamily: f, fontSize: "0.62rem", fontWeight: 700,
              letterSpacing: "2px", textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", display: "block",
            }}>Best Value</span>
            <h3 style={{
              fontFamily: fh, fontSize: "1.8rem", fontWeight: 800,
              color: "white", margin: "0 0 0.5rem",
            }}>Season Passes</h3>
            <p style={{
              fontFamily: f, fontSize: "0.85rem",
              color: "rgba(255,255,255,0.7)", margin: "0 0 1rem",
              maxWidth: "320px",
            }}>Unlimited visits all season long for one easy price!</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 700, color: "white" }}>Learn More</span>
              <svg className="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: "transform 0.2s" }}>
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </div>
        </Link>

        <Link to="/tickets" style={{
          position: "relative", borderRadius: "16px", overflow: "hidden",
          height: "260px", display: "flex", flexDirection: "column",
          justifyContent: "flex-end", padding: "1.75rem",
        }}
        onMouseEnter={e => { e.currentTarget.querySelector('.card-arrow').style.transform = "translateX(4px)"; e.currentTarget.querySelector('.card-bg').style.transform = "scale(1.05)" }}
        onMouseLeave={e => { e.currentTarget.querySelector('.card-arrow').style.transform = "translateX(0)"; e.currentTarget.querySelector('.card-bg').style.transform = "scale(1)" }}
        >
          <div className="card-bg" style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${actionBuyTickets})`,
            backgroundSize: "cover", backgroundPosition: "center",
            transition: "transform 0.6s var(--ease-out-expo)",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <span style={{
              fontFamily: f, fontSize: "0.62rem", fontWeight: 700,
              letterSpacing: "2px", textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", display: "block",
            }}>Day Passes</span>
            <h3 style={{
              fontFamily: fh, fontSize: "1.8rem", fontWeight: 800,
              color: "white", margin: "0 0 0.5rem",
            }}>Buy Tickets</h3>
            <p style={{
              fontFamily: f, fontSize: "0.85rem",
              color: "rgba(255,255,255,0.7)", margin: "0 0 1rem",
              maxWidth: "320px",
            }}>General admission, VIP, and Fast Pass options available.</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: f, fontSize: "0.85rem", fontWeight: 700, color: "white" }}>Buy Now</span>
              <svg className="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: "transform 0.2s" }}>
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom row: 4 callout cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {callouts.map(c => {
          const isHash = c.href.startsWith("/#")
          const El = isHash ? "a" : Link
          const linkProp = isHash ? { href: c.href } : { to: c.href }
          return (
            <El key={c.title} {...linkProp} style={{
              position: "relative", borderRadius: "16px", overflow: "hidden",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "flex-end",
              textAlign: "center",
              transition: "transform 0.3s var(--ease-out-expo), box-shadow 0.3s",
              minHeight: "140px", padding: "1.25rem",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.15)"; e.currentTarget.querySelector('.callout-bg').style.transform = "scale(1.08)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.querySelector('.callout-bg').style.transform = "scale(1)" }}
            >
              <div className="callout-bg" style={{
                position: "absolute", inset: 0,
                backgroundImage: `url(${c.img})`,
                backgroundSize: "cover", backgroundPosition: "center",
                transition: "transform 0.5s var(--ease-out-expo)",
              }} />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 100%)",
              }} />
              <h3 style={{
                fontFamily: fh, fontSize: "1.1rem", fontWeight: 700,
                color: "white", position: "relative", zIndex: 1,
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}>{c.title}</h3>
            </El>
          )
        })}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// RIDES SECTION — Grid with Zone Filters (WHITE THEME)
// ────────────────────────────────────────────
function RidesSection({ initialZone }) {
  const [rides, setRides] = useState([])
  const [activeZone, setActiveZone] = useState(initialZone || "All")
  const [selectedRide, setSelectedRide] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides`)
      .then(res => res.json())
      .then(data => setRides(data))
      .catch(() => {})
  }, [])

  // Update filter if initialZone changes (from URL hash)
  useEffect(() => {
    if (initialZone) setActiveZone(initialZone)
  }, [initialZone])

  const filteredRides = activeZone === "All"
    ? rides
    : rides.filter(r => r.location === activeZone)

  const customerStatus = (status) => {
    if (status === "Operational") return { label: "Open", color: "#4CAF50" }
    if (status === "Maintenance") return { label: "Closed for Maintenance", color: "#FF9800" }
    return { label: "Closed", color: "#E53935" }
  }

  return (
    <div id="rides" style={{ background: "var(--cr-bg-alt)", padding: "3rem 0 4rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <span style={{
            fontFamily: f, fontSize: "0.68rem", fontWeight: 700,
            letterSpacing: "3px", textTransform: "uppercase",
            color: "var(--cr-coral)",
          }}>Attractions</span>
          <h2 style={{
            fontFamily: fh, fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontWeight: 800,
            color: "var(--cr-text)", margin: "0.4rem 0 0",
          }}>Our Rides & Experiences</h2>
        </div>

        {/* Zone filter tabs */}
        <div style={{
          display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap",
        }}>
          {ZONES.map(zone => (
            <button key={zone} onClick={() => setActiveZone(zone)} style={{
              fontFamily: f, fontSize: "0.8rem", fontWeight: 600,
              padding: "8px 20px", borderRadius: "50px", cursor: "pointer",
              border: activeZone === zone ? "2px solid var(--cr-red)" : "2px solid var(--cr-border)",
              background: activeZone === zone ? "var(--cr-red)" : "white",
              color: activeZone === zone ? "white" : "var(--cr-text-muted)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { if (activeZone !== zone) { e.currentTarget.style.borderColor = "var(--cr-red)"; e.currentTarget.style.color = "var(--cr-red)" } }}
            onMouseLeave={e => { if (activeZone !== zone) { e.currentTarget.style.borderColor = "var(--cr-border)"; e.currentTarget.style.color = "var(--cr-text-muted)" } }}
            >
              {zone}
            </button>
          ))}
        </div>

        {/* Ride grid */}
        {filteredRides.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--cr-text-dim)", fontFamily: f, padding: "2rem" }}>
            {rides.length === 0 ? "Loading rides..." : "No rides in this zone."}
          </p>
        ) : (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}>
            {filteredRides.map((ride, idx) => {
              const meta = RIDE_META[ride.ride_name] || {}
              const st = customerStatus(ride.status)
              return (
                <div key={ride.ride_id} style={{
                  borderRadius: "16px", overflow: "hidden",
                  background: "white", border: "1px solid var(--cr-border)",
                  transition: "transform 0.3s var(--ease-out-expo), box-shadow 0.3s",
                  cursor: "pointer",
                  animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                onClick={() => setSelectedRide(ride)}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.12)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  <div style={{ position: "relative", height: "200px", overflow: "hidden" }}>
                    <img src={meta.img} alt={ride.ride_name} style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      transition: "transform 0.5s var(--ease-out-expo)",
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    />
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      background: st.color, color: "white",
                      fontFamily: f, fontSize: "0.58rem", fontWeight: 700,
                      padding: "4px 12px", borderRadius: "50px",
                      letterSpacing: "1px", textTransform: "uppercase",
                    }}>{st.label}</div>
                    <div style={{
                      position: "absolute", top: 12, left: 12,
                      background: "rgba(0,0,0,0.55)", color: "white",
                      fontFamily: f, fontSize: "0.55rem", fontWeight: 600,
                      padding: "3px 10px", borderRadius: "50px",
                      letterSpacing: "1px", backdropFilter: "blur(4px)",
                    }}>{ride.location}</div>
                  </div>

                  <div style={{ padding: "1rem 1.25rem 1.25rem" }}>
                    <h3 style={{
                      fontFamily: fh, fontSize: "1.1rem", fontWeight: 700,
                      color: "var(--cr-text)", margin: "0 0 0.25rem",
                    }}>{ride.ride_name}</h3>
                    <p style={{
                      fontFamily: f, fontSize: "0.78rem",
                      color: "var(--cr-text-dim)", margin: "0 0 0.75rem",
                      lineHeight: 1.5, display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{meta.desc || "An exciting ride experience awaits."}</p>

                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{
                        fontFamily: f, fontSize: "0.7rem", fontWeight: 600,
                        color: "var(--cr-coral)", display: "flex", alignItems: "center", gap: "4px",
                      }}>
                        Learn More
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      </span>
                      {ride.wait_time > 0 && ride.status === "Operational" && (
                        <span style={{
                          fontFamily: f, fontSize: "0.68rem", fontWeight: 600,
                          color: "var(--cr-text-faint)",
                        }}>{ride.wait_time} min wait</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── RIDE DETAIL MODAL ─── */}
        {selectedRide && (
          <div onClick={() => setSelectedRide(null)} style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem", animation: "fadeIn 0.2s ease-out",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "100%", maxWidth: "650px",
              background: "white", borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
              animation: "scaleIn 0.3s var(--ease-out-expo)",
            }}>
              <div style={{ position: "relative", height: "280px" }}>
                <img src={RIDE_META[selectedRide.ride_name]?.img} alt={selectedRide.ride_name} style={{
                  width: "100%", height: "100%", objectFit: "cover",
                }} />
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: "120px",
                  background: "linear-gradient(transparent, white)",
                }} />
                <button onClick={() => setSelectedRide(null)} style={{
                  position: "absolute", top: 14, right: 14,
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(0,0,0,0.5)", border: "none",
                  color: "white", fontSize: "1rem", cursor: "pointer",
                  backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </div>

              <div style={{ padding: "1.25rem 2rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <h2 style={{
                    fontFamily: fh, fontSize: "1.5rem", fontWeight: 800,
                    color: "var(--cr-text)", margin: 0,
                  }}>{selectedRide.ride_name}</h2>
                  <span style={{
                    fontFamily: f, fontSize: "0.58rem", fontWeight: 700,
                    padding: "3px 10px", borderRadius: "50px",
                    background: customerStatus(selectedRide.status).color,
                    color: "white", textTransform: "uppercase", letterSpacing: "1px",
                  }}>{customerStatus(selectedRide.status).label}</span>
                </div>

                <p style={{
                  fontFamily: f, fontSize: "0.88rem",
                  color: "var(--cr-text-muted)", lineHeight: 1.6,
                  margin: "0 0 1.5rem",
                }}>{RIDE_META[selectedRide.ride_name]?.desc}</p>

                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem",
                  padding: "1.25rem", background: "var(--cr-bg-alt)", borderRadius: "12px",
                }}>
                  {[
                    { label: "Zone", value: selectedRide.location },
                    { label: "Wait Time", value: selectedRide.status === "Operational" ? `${selectedRide.wait_time} min` : "N/A" },
                    { label: "Height Req.", value: selectedRide.min_height_in > 0 ? `${selectedRide.min_height_in}"` : "None" },
                  ].map((item, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: f, fontSize: "0.58rem", color: "var(--cr-text-faint)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "4px" }}>{item.label}</div>
                      <div style={{ fontFamily: fh, fontSize: "1rem", fontWeight: 700, color: "var(--cr-text)" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// PLAN YOUR VISIT (WHITE THEME)
// ────────────────────────────────────────────
function PlanSection() {
  const [counts, setCounts] = useState({ restaurants: 0, rides: 0, games: 0, shops: 0 })

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/park-ops/restaurants`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/rides`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/park-ops/games`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/park-ops/gift-shops`).then(r => r.json()),
    ])
      .then(([rest, rides, games, shops]) => {
        setCounts({
          restaurants: Array.isArray(rest) ? rest.filter(r => r.operational_status === 1).length : 0,
          rides: Array.isArray(rides) ? rides.filter(r => r.status === "Operational").length : 0,
          games: Array.isArray(games) ? games.filter(g => g.operational_status === 1).length : 0,
          shops: Array.isArray(shops) ? shops.length : 0,
        })
      })
      .catch(() => {})
  }, [])

  const items = [
    // Images chosen to match each button's description — no reuse of existing /assets photos.
    { img: "https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=600&q=70", title: "Park Hours",   detail: "10 AM – 8 PM",              sub: "Hours may vary by season" },
    { img: "https://images.pexels.com/photos/1659740/pexels-photo-1659740.jpeg?auto=compress&cs=tinysrgb&w=600", title: "Rides",        detail: `${counts.rides} Open`,       sub: "Height requirements apply" },
    { img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=70", title: "Dining",       detail: `${counts.restaurants} Restaurants`, sub: "Mobile ordering available" },
    { img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=70", title: "Games",        detail: `${counts.games} Open`,       sub: "Win prizes & souvenirs" },
    { img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=70", title: "Shopping",     detail: `${counts.shops} Gift Shops`, sub: "Exclusive CougarRide merch" },
    { img: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=70", title: "Parking",      detail: "Free Standard",             sub: "Premium spots $15" },
    { img: "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=600&q=70", title: "Safety",       detail: "Daily Inspections",          sub: "All rides certified" },
    { img: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=600&q=70", title: "Park App",     detail: "Live Wait Times",            sub: "Real-time updates" },
  ]

  return (
    <div id="plan" style={{ background: "var(--cr-bg-alt)", padding: "3rem 2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <span style={{ fontFamily: f, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "var(--cr-coral)" }}>Plan Your Visit</span>
          <h2 style={{ fontFamily: fh, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, color: "var(--cr-text)", margin: "0.4rem 0" }}>Know Before You Go</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {items.map((item, i) => (
            <div key={i} style={{
              background: "white", borderRadius: "14px",
              border: "1px solid var(--cr-border)",
              overflow: "hidden",
              transition: "transform 0.3s var(--ease-out-expo), box-shadow 0.3s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}
            >
              <div style={{
                position: "relative", height: "120px",
                background: "linear-gradient(135deg, var(--cr-red), var(--cr-red-dark))",
                overflow: "hidden",
              }}>
                <img
                  src={item.img}
                  alt={item.title}
                  loading="lazy"
                  onError={e => { e.currentTarget.style.display = "none" }}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div style={{ padding: "1.25rem", textAlign: "center" }}>
                <h3 style={{ fontFamily: f, fontSize: "0.65rem", fontWeight: 700, color: "var(--cr-text-faint)", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 0.4rem" }}>{item.title}</h3>
                <div style={{ fontFamily: fh, fontSize: "1.05rem", fontWeight: 700, color: "var(--cr-text)", margin: "0 0 0.2rem" }}>{item.detail}</div>
                <div style={{ fontFamily: f, fontSize: "0.72rem", color: "var(--cr-text-dim)" }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// MAIN EXPORT
// ────────────────────────────────────────────
export default function CustomerLanding() {
  const location = useLocation()
  const [zoneFilter, setZoneFilter] = useState("All")

  // Parse zone from hash: /#rides?zone=Zone+A
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes("zone=")) {
      const params = new URLSearchParams(hash.split("?")[1] || "")
      const zone = params.get("zone")
      if (zone) setZoneFilter(zone)
    }
  }, [location])

  return (
    <div style={{ background: "var(--cr-bg)", minHeight: "100vh" }}>
      <CustomerNav />
      <div style={{ paddingTop: "94px" }}>
        <HeroSection />
        <WhatToDoSection />
        <ParkPromise />
        <PlanSection />
        <CustomerFooter />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// PARK PROMISE — creative filler section
// ────────────────────────────────────────────
function ParkPromise() {
  return (
    <div style={{
      position: "relative",
      padding: "6rem 2rem",
      textAlign: "center",
      backgroundImage: `linear-gradient(135deg, rgba(200,16,46,0.82) 0%, rgba(140,29,64,0.88) 60%, rgba(15,14,14,0.85) 100%), url(${heroImgWelcome})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h2 style={{
          fontFamily: "var(--font-heading)", fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 900, color: "white", margin: "0 0 1.5rem", lineHeight: 1.1,
          textShadow: "0 2px 20px rgba(0,0,0,0.45)",
        }}>More Than a Theme Park.<br />It's Where Memories Are Made.</h2>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "1.1rem",
          color: "rgba(255,255,255,0.9)", lineHeight: 1.7, margin: "0 0 2.5rem",
          textShadow: "0 1px 10px rgba(0,0,0,0.35)",
        }}>
          From the moment you walk through our gates, every detail is designed to create unforgettable experiences.
          World-class rides, award-winning dining, live entertainment, and the warmest staff in the industry — all
          waiting for you at CougarRide.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "3rem", flexWrap: "wrap" }}>
          {[
            { num: "10+", label: "Rides & Attractions" },
            { num: "5", label: "Dining Locations" },
            { num: "4", label: "Park Zones" },
            { num: "100%", label: "Fun Guaranteed" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "2.5rem", fontWeight: 900, color: "white", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}>{s.num}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "1px", textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
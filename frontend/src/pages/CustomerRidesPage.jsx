import { useState, useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { API_BASE_URL } from "../utils/api"
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

// Hero image
import heroImgWelcome from "../assets/rides/hero-welcome.jpg"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

const RIDE_META = {
  "Cougar Express": { img: imgCougarExpress, desc: "Our signature steel coaster with sweeping drops, high-speed turns, and stunning mountain views. Not for the faint of heart.", thrill: "Extreme", type: "Roller Coaster" },
  "Thunder Canyon": { img: imgThunderCanyon, desc: "A wild mine train adventure through rugged canyon terrain with sudden drops and dark tunnels.", thrill: "High", type: "Roller Coaster" },
  "Sky Screamer": { img: imgSkyScreamer, desc: "Soar 200 feet above the park on this extreme swing ride with panoramic views and heart-pounding free-fall moments.", thrill: "Extreme", type: "Thrill Ride" },
  "Wild River Rapids": { img: imgWildRiverRapids, desc: "Grab your crew and brave the rapids — you will get soaked on this whitewater rafting adventure.", thrill: "Moderate", type: "Water Ride" },
  "Galactic Spinner": { img: imgGalacticSpinner, desc: "A cosmic spinning ride under neon lights. Each pod spins independently as you orbit the galaxy.", thrill: "Moderate", type: "Thrill Ride" },
  "Mini Coaster": { img: imgMiniCoaster, desc: "A dragon-themed family coaster with gentle hills and playful turns. Perfect for young adventurers.", thrill: "Family", type: "Family Ride" },
  "Ferris Wheel": { img: imgFerrisWheel, desc: "Take in the glittering skyline from our illuminated Ferris wheel — the perfect ride for a sunset view.", thrill: "Family", type: "Family Ride" },
  "Haunted Mansion": { img: imgHauntedMansion, desc: "Enter if you dare. This dark ride takes you through 13 rooms of ghostly encounters.", thrill: "Moderate", type: "Dark Ride" },
  "Bumper Cars": { img: imgBumperCars, desc: "Classic fun for all ages. Bump, dodge, and crash your way through our neon-lit arena.", thrill: "Family", type: "Family Ride" },
  "Drop Tower": { img: imgDropTower, desc: "Plunge from dizzying heights in a heart-stopping free-fall. Hold on tight!", thrill: "Extreme", type: "Thrill Ride" },
}

const ZONES = ["All", "Zone A", "Zone B", "Zone C", "Zone D"]
const ZONE_NAMES = {
  "Zone A": "Thrill Alley",
  "Zone B": "Adventure Trail",
  "Zone C": "Rapids Row",
  "Zone D": "Family Fun",
}

const thrillColor = (t) => {
  if (t === "Extreme") return "#E53935"
  if (t === "High") return "#FF6D00"
  if (t === "Moderate") return "#FFB300"
  return "#4CAF50"
}

export default function CustomerRidesPage() {
  const [rides, setRides] = useState([])
  const [searchParams] = useSearchParams()
  const initialZone = searchParams.get("zone") || "All"
  const [activeZone, setActiveZone] = useState(initialZone)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides`)
      .then(res => res.json())
      .then(data => setRides(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const filteredRides = activeZone === "All"
    ? rides
    : rides.filter(r => r.location === activeZone)

  const customerStatus = (status) => {
    if (status === "Operational") return { label: "Open", color: "#4CAF50", bg: "rgba(76,175,80,0.1)" }
    if (status === "Maintenance") return { label: "Temporarily Closed", color: "#FF9800", bg: "rgba(255,152,0,0.1)" }
    return { label: "Closed", color: "#E53935", bg: "rgba(229,57,53,0.1)" }
  }

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <CustomerNav />

      {/* ── Hero Banner ── */}
      <div style={{
        position: "relative", height: "50vh", minHeight: "350px",
        overflow: "hidden", marginTop: "94px",
      }}>
        <img src={heroImgWelcome} alt="Rides at CougarRide" style={{
          width: "100%", height: "100%", objectFit: "cover",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)",
        }} />
        <div style={{
          position: "absolute", bottom: "3rem", left: "3rem", zIndex: 2,
          maxWidth: "600px",
        }}>
          <h1 style={{
            fontFamily: fh, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900,
            color: "white", margin: "0 0 0.5rem",
            textShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}>Rides</h1>
          <p style={{
            fontFamily: f, fontSize: "1rem", color: "rgba(255,255,255,0.75)",
            lineHeight: 1.5, maxWidth: "500px",
          }}>
            With world-class coasters and family-friendly attractions, everyone can go all out at CougarRide.
          </p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{
        background: "white", padding: "1rem 0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        position: "sticky", top: "94px", zIndex: 50,
        borderBottom: "1px solid #e5e5e8",
      }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto", padding: "0 2rem",
          display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap",
        }}>
          {ZONES.map(zone => (
            <button key={zone} onClick={() => setActiveZone(zone)} style={{
              fontFamily: f, fontSize: "0.85rem", fontWeight: 600,
              padding: "10px 24px", borderRadius: "50px", cursor: "pointer",
              border: activeZone === zone ? "2px solid #C8102E" : "2px solid #e5e5e8",
              background: activeZone === zone ? "#C8102E" : "white",
              color: activeZone === zone ? "white" : "#555",
              transition: "all 0.2s",
            }}>
              {zone === "All" ? "All Rides" : `${zone} — ${ZONE_NAMES[zone]}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rides List (Vertical) ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        {filteredRides.length === 0 ? (
          <p style={{ textAlign: "center", color: "#999", fontFamily: f, padding: "3rem", fontSize: "1rem" }}>
            {rides.length === 0 ? "Loading rides..." : "No rides in this zone."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {filteredRides.map((ride, idx) => {
              const meta = RIDE_META[ride.ride_name] || {}
              const st = customerStatus(ride.status)
              return (
                <div key={ride.ride_id} style={{
                  display: "flex", gap: "0",
                  borderRadius: "16px", overflow: "hidden",
                  background: "white", border: "1px solid #e5e5e8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  {/* Image Left */}
                  <div style={{
                    flex: "0 0 400px", height: "280px", overflow: "hidden",
                    position: "relative",
                  }}>
                    <img src={meta.img} alt={ride.ride_name} style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      transition: "transform 0.6s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    />
                    <div style={{
                      position: "absolute", top: 12, left: 12,
                      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                      padding: "4px 14px", borderRadius: "50px",
                      fontFamily: f, fontSize: "0.58rem", fontWeight: 700,
                      color: "white", letterSpacing: "1px", textTransform: "uppercase",
                    }}>{ride.location}</div>
                  </div>

                  {/* Info Right */}
                  <div style={{
                    flex: 1, padding: "1.75rem 2rem",
                    display: "flex", flexDirection: "column", justifyContent: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                      <h2 style={{
                        fontFamily: fh, fontSize: "1.5rem", fontWeight: 800,
                        color: "#1a1a1a", margin: 0,
                      }}>{ride.ride_name}</h2>
                      <span style={{
                        fontFamily: f, fontSize: "0.55rem", fontWeight: 700,
                        padding: "3px 10px", borderRadius: "50px",
                        background: st.bg, color: st.color,
                        textTransform: "uppercase", letterSpacing: "1px",
                      }}>{st.label}</span>
                    </div>

                    {meta.type && (
                      <span style={{
                        fontFamily: f, fontSize: "0.72rem", fontWeight: 600,
                        color: "#999", marginBottom: "0.75rem",
                      }}>{meta.type}</span>
                    )}

                    <p style={{
                      fontFamily: f, fontSize: "0.88rem", color: "#666",
                      lineHeight: 1.6, margin: "0 0 1.25rem",
                      maxWidth: "550px",
                    }}>{meta.desc || "An exciting ride experience awaits."}</p>

                    {/* Stats row */}
                    <div style={{
                      display: "flex", gap: "2rem", flexWrap: "wrap",
                    }}>
                      {meta.thrill && (
                        <div>
                          <div style={{ fontFamily: f, fontSize: "0.58rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "3px" }}>Thrill Level</div>
                          <div style={{
                            fontFamily: fh, fontSize: "0.9rem", fontWeight: 700,
                            color: thrillColor(meta.thrill),
                          }}>{meta.thrill}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontFamily: f, fontSize: "0.58rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "3px" }}>Height Req.</div>
                        <div style={{ fontFamily: fh, fontSize: "0.9rem", fontWeight: 700, color: "#1a1a1a" }}>
                          {ride.min_height_in > 0 ? `${ride.min_height_in}"` : "None"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontFamily: f, fontSize: "0.58rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "3px" }}>Capacity</div>
                        <div style={{ fontFamily: fh, fontSize: "0.9rem", fontWeight: 700, color: "#1a1a1a" }}>
                          {ride.capacity_per_cycle} per cycle
                        </div>
                      </div>
                      {ride.wait_time > 0 && ride.status === "Operational" && (
                        <div>
                          <div style={{ fontFamily: f, fontSize: "0.58rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "3px" }}>Wait Time</div>
                          <div style={{ fontFamily: fh, fontSize: "0.9rem", fontWeight: 700, color: "#1a1a1a" }}>
                            {ride.wait_time} min
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CustomerFooter />
    </div>
  )
}

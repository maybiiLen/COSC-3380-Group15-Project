import { Link } from "react-router-dom"
import cougarrideLogoMd from "../assets/cougarride-logo-md.png"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

const footerSections = [
  {
    title: "Passes & Tickets",
    links: [
      { label: "Season Passes", href: "/tickets" },
      { label: "Daily Tickets", href: "/tickets" },
      { label: "VIP Experience", href: "/tickets" },
      { label: "Fast Pass", href: "/tickets" },
      { label: "Group Tickets", href: "/tickets" },
      { label: "Student Discounts", href: "/tickets" },
    ],
  },
  {
    title: "Rides & Experiences",
    links: [
      { label: "All Attractions", href: "/#rides" },
      { label: "Dining", href: "/dining" },
      { label: "Games & Prizes", href: "/games" },
      { label: "Gift Shops", href: "/shopping" },
      { label: "Special Events", href: "/#plan" },
    ],
  },
  {
    title: "Park Info",
    links: [
      { label: "Calendar & Hours", href: "/#plan" },
      { label: "Park Map", href: "/#plan" },
      { label: "Accessibility", href: "/#plan" },
      { label: "FAQ", href: "/#plan" },
      { label: "Contact Us", href: "/#plan" },
      { label: "Park Policies", href: "/#plan" },
    ],
  },
]

const socials = [
  { label: "Facebook", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.025C22 6.491 17.52 2 12 2S2 6.491 2 12.025a10.03 10.03 0 0 0 8 9.825v-6.817H8v-3.008h2V9.52a3.508 3.508 0 0 1 3.5-3.509H16v3.008h-2c-.55 0-1 .45-1 1.002v2.005h3v3.008h-3V22c5.05-.501 9-4.772 9-9.975Z"/></svg> },
  { label: "Twitter", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.6468 10.4686L20.9321 2H19.2057L12.8799 9.3532L7.82741 2H2L9.6403 13.1193L2 22H3.72649L10.4068 14.2348L15.7425 22H21.5699L13.6464 10.4686H13.6468ZM11.2821 13.2173L10.508 12.1101L4.34857 3.29968H7.00037L11.9711 10.4099L12.7452 11.5172L19.2066 20.7594H16.5548L11.2821 13.2177V13.2173Z"/></svg> },
  { label: "Instagram", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg> },
  { label: "YouTube", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.995 9.952c.045-1.3-.24-2.59-.826-3.751a2.654 2.654 0 0 0-1.563-.909 71.193 71.193 0 0 0-7.604-.281 71.273 71.273 0 0 0-7.577.272c-.498.09-.959.324-1.326.672-.818.755-.908 2.044-1 3.135a43.872 43.872 0 0 0 0 5.886 8.68 8.68 0 0 0 .273 1.817c.11.46.331.883.645 1.236.37.367.842.613 1.353.708a41.01 41.01 0 0 0 5.906.3c3.18.046 5.969 0 9.267-.254a2.616 2.616 0 0 0 1.39-.708c.254-.254.444-.567.554-.909.325-.997.485-2.04.473-3.089.035-.508.035-3.58.035-4.125ZM9.95 14.622V9l5.378 2.825c-1.508.836-3.497 1.78-5.378 2.798Z"/></svg> },
]

export default function CustomerFooter() {
  return (
    <footer style={{
      background: "linear-gradient(180deg, #0A0909, #060606)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      paddingTop: "4rem",
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>
        {/* ─── Top section: logo + columns ─── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: "4rem",
          paddingBottom: "3rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {/* Left: Logo + socials */}
          <div>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}>
              <img src={cougarrideLogoMd} alt="CougarRide" style={{ height: "44px", width: "auto" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{
                  fontFamily: fh, fontSize: "1.2rem", fontWeight: 800,
                  color: "#C8102E", letterSpacing: "1.5px", textTransform: "uppercase",
                  lineHeight: 1.1,
                }}>CougarRide</span>
                <span style={{
                  fontFamily: f, fontSize: "0.55rem", fontWeight: 500,
                  color: "rgba(255,255,255,0.3)", letterSpacing: "1px",
                  textTransform: "uppercase",
                }}>Theme Park</span>
              </div>
            </Link>

            <p style={{
              fontFamily: f, fontSize: "0.78rem",
              color: "rgba(255,255,255,0.3)", lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}>
              University of Houston's premier amusement park experience. Home to 9 world-class rides and over 100 attractions.
            </p>

            {/* Social icons */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
              {socials.map(s => (
                <a key={s.label} href="#" aria-label={s.label} style={{
                  color: "rgba(255,255,255,0.35)",
                  transition: "color 0.2s, transform 0.2s",
                  display: "flex",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "white"; e.currentTarget.style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.transform = "translateY(0)" }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Right: Link columns */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem",
          }}>
            {footerSections.map(section => (
              <div key={section.title}>
                <h3 style={{
                  fontFamily: f, fontSize: "0.62rem", fontWeight: 700,
                  color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
                  letterSpacing: "2px", marginBottom: "1.25rem",
                }}>{section.title}</h3>
                <ul style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {section.links.map(link => {
                    const isHash = link.href.includes("#")
                    const style = {
                      fontFamily: f, fontSize: "0.82rem", fontWeight: 500,
                      color: "rgba(255,255,255,0.45)",
                      transition: "color 0.15s",
                      listStyle: "none",
                    }
                    const handlers = {
                      onMouseEnter: e => e.currentTarget.style.color = "white",
                      onMouseLeave: e => e.currentTarget.style.color = "rgba(255,255,255,0.45)",
                    }
                    return (
                      <li key={link.label} style={style} {...handlers}>
                        {isHash
                          ? <a href={link.href} style={{ color: "inherit" }}>{link.label}</a>
                          : <Link to={link.href} style={{ color: "inherit" }}>{link.label}</Link>
                        }
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Bottom bar ─── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.5rem 0", flexWrap: "wrap", gap: "1rem",
        }}>
          <div style={{
            fontFamily: f, fontSize: "0.68rem",
            color: "rgba(255,255,255,0.2)", lineHeight: 1.8,
          }}>
            <span>© 2026 CougarRide — COSC 3380 Group 15. All rights reserved.</span>
            <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.08)" }}>|</span>
            <a href="#" style={{ color: "rgba(255,255,255,0.2)", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
            >Privacy Policy</a>
            <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.08)" }}>|</span>
            <a href="#" style={{ color: "rgba(255,255,255,0.2)", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
            >Terms of Use</a>
            <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.08)" }}>|</span>
            <a href="#" style={{ color: "rgba(255,255,255,0.2)", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
            >Accessibility</a>
          </div>
          <Link to="/auth" style={{
            fontFamily: f, fontSize: "0.62rem",
            color: "rgba(255,255,255,0.12)", letterSpacing: "0.5px",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.12)"}
          >Team Member Login</Link>
        </div>
      </div>
    </footer>
  )
}

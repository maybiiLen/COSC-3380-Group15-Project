import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import cougarrideLogoMd from "../assets/cougarride-logo-md.png"

const f = "'DM Sans', sans-serif"
const fh = "var(--font-heading)"

export default function AuthPage() {
  const [step, setStep] = useState("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleEmailContinue(e) {
    e.preventDefault()
    if (!email) return
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/check-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.exists) setStep("login")
      else setStep("register")
    } catch { setError("Could not connect to server") }
    finally { setLoading(false) }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || "Invalid email or password"); return }
      login(data.accessToken, data.user)
      if (["staff", "manager", "admin"].includes(data.user.role)) navigate("/dashboard")
      else navigate("/")
    } catch { setError("Could not connect to server") }
    finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, date_of_birth: dateOfBirth, phone }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || "Registration failed"); return }
      const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ email, password }),
      })
      const loginData = await loginRes.json()
      if (loginRes.ok) { login(loginData.accessToken, loginData.user); navigate("/") }
      else setStep("login")
    } catch { setError("Could not connect to server") }
    finally { setLoading(false) }
  }

  function handleEditEmail() {
    setStep("email"); setPassword(""); setFullName(""); setDateOfBirth(""); setPhone(""); setError("")
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "#0F0E0E",
    }}>
      {/* ─── LEFT SIDE: Image panel ─── */}
      <div style={{
        flex: "0 0 45%", display: "flex", flexDirection: "column",
        justifyContent: "flex-end", alignItems: "center",
        backgroundImage: "url('/src/assets/auth-bg.jpg')",
        backgroundSize: "cover", backgroundPosition: "center",
        position: "relative", overflow: "hidden",
        padding: "3rem",
      }}>
        {/* Dark overlay for text readability */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)",
        }} />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center", paddingBottom: "2rem" }}>
          <img src={cougarrideLogoMd} alt="CougarRide" style={{
            height: "70px", width: "auto", marginBottom: "1.25rem",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
          }} />
          <h1 style={{
            fontFamily: fh, fontSize: "2.2rem", fontWeight: 900,
            color: "white", margin: "0 0 0.5rem",
            letterSpacing: "2px", textTransform: "uppercase",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}>CougarRide</h1>
          <p style={{
            fontFamily: f, fontSize: "0.8rem",
            color: "rgba(255,255,255,0.7)", letterSpacing: "2px",
            textTransform: "uppercase",
          }}>Theme Park Experience</p>

          <p style={{
            fontFamily: f, fontSize: "0.9rem",
            color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
            marginTop: "1.5rem", maxWidth: "320px",
          }}>
            Where every ride tells a story. Sign in to manage your tickets, view ride statuses, and access your personalized park experience.
          </p>
        </div>
      </div>

      {/* ─── RIGHT SIDE: Auth form ─── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "3rem",
      }}>
        {/* Back to park */}
        <Link to="/" style={{
          position: "absolute", top: "1.5rem", right: "2rem",
          fontFamily: f, fontSize: "0.78rem", fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          display: "flex", alignItems: "center", gap: "4px",
          transition: "color 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "white"}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back to Park
        </Link>

        <div style={{ width: "100%", maxWidth: "420px" }}>
          {/* ═══ STEP 1: Email ═══ */}
          {step === "email" && (
            <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
              <h2 style={headingStyle}>Welcome</h2>
              <p style={subtextStyle}>Enter your email to continue to CougarRide</p>

              <form onSubmit={handleEmailContinue}>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                  onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                />
                {error && <div style={errorStyle}>{error}</div>}
                <button type="submit" disabled={loading} style={primaryBtnStyle}>
                  {loading ? "Checking..." : "Continue"}
                </button>
              </form>

              <div style={dividerStyle}>
                <div style={dividerLine} />
                <span style={dividerText}>or</span>
                <div style={dividerLine} />
              </div>

              <button onClick={() => setStep("login")} style={secondaryBtnStyle}>
                Looking for username login?
              </button>
            </div>
          )}

          {/* ═══ STEP 2a: Login ═══ */}
          {step === "login" && (
            <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
              <h2 style={headingStyle}>Enter Your Password</h2>
              <p style={subtextStyle}>
                Sign in using <strong style={{ color: "white" }}>{email}</strong>{" "}
                <button onClick={handleEditEmail} style={editLinkStyle}>edit</button>
              </p>

              <form onSubmit={handleLogin}>
                {!email && (
                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={labelStyle}>Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required autoFocus style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                      onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                    />
                  </div>
                )}

                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Password</label>
                  <input type={showPassword ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required autoFocus style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                    onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={showHideBtnStyle}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {error && <div style={errorStyle}>{error}</div>}
                <button type="submit" disabled={loading} style={primaryBtnStyle}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <button onClick={handleEditEmail} style={backLinkStyle}>← Back</button>
            </div>
          )}

          {/* ═══ STEP 2b: Register ═══ */}
          {step === "register" && (
            <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
              <h2 style={headingStyle}>Create Your Account</h2>
              <p style={subtextStyle}>
                Join CougarRide with <strong style={{ color: "white" }}>{email}</strong>{" "}
                <button onClick={handleEditEmail} style={editLinkStyle}>edit</button>
              </p>

              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe" required autoFocus style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                    onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                  />
                </div>

                <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Date of Birth</label>
                    <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                      required style={{ ...inputStyle, colorScheme: "dark" }}
                      onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                      onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Phone</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="8325551234" required style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                      onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                    />
                  </div>
                </div>

                <div style={{ position: "relative", marginBottom: "0.25rem" }}>
                  <label style={labelStyle}>Password</label>
                  <input type={showPassword ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters" required minLength={8} style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "var(--cr-red)"}
                    onBlur={e => e.currentTarget.style.borderColor = "#3A3939"}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={showHideBtnStyle}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p style={{ fontFamily: f, fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", margin: "4px 0 0" }}>Must be at least 8 characters</p>

                {error && <div style={{ ...errorStyle, marginTop: "1rem" }}>{error}</div>}
                <button type="submit" disabled={loading} style={primaryBtnStyle}>
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </form>

              <button onClick={handleEditEmail} style={backLinkStyle}>← Back</button>
            </div>
          )}

          {/* Footer text */}
          <p style={{
            fontFamily: f, fontSize: "0.62rem",
            color: "rgba(255,255,255,0.12)", marginTop: "2.5rem",
            textAlign: "center", lineHeight: 1.6,
          }}>
            By continuing, you agree to CougarRide's Terms of Use and acknowledge our Privacy Policy.
            <br />© 2026 CougarRide — COSC 3380 Group 15
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Shared Styles ───

const headingStyle = {
  fontFamily: "var(--font-heading)",
  fontSize: "1.6rem", fontWeight: 800, color: "white",
  margin: "0 0 0.5rem",
}

const subtextStyle = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: "0.85rem", color: "rgba(255,255,255,0.45)",
  margin: "0 0 2rem", lineHeight: 1.5,
}

const labelStyle = {
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.73rem",
  fontWeight: 600, color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase", letterSpacing: "1px",
  display: "block", marginBottom: "6px",
}

const inputStyle = {
  width: "100%", padding: "13px 16px",
  background: "#1A1919", border: "1px solid #3A3939",
  borderRadius: "10px", color: "white",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
}

const errorStyle = {
  marginTop: "1rem", padding: "10px 14px", borderRadius: "10px",
  background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.25)",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: "#EF9A9A",
}

const primaryBtnStyle = {
  width: "100%", marginTop: "1.5rem", padding: "14px",
  background: "var(--cr-gradient-brand)",
  color: "white", border: "none", borderRadius: "50px",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 700,
  cursor: "pointer", letterSpacing: "0.5px",
  boxShadow: "0 4px 20px rgba(200,16,46,0.35)",
  transition: "transform 0.2s",
}

const secondaryBtnStyle = {
  width: "100%", padding: "12px",
  background: "transparent", color: "rgba(255,255,255,0.5)",
  border: "1px solid #2A2929", borderRadius: "50px",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 600,
  cursor: "pointer", transition: "all 0.2s",
}

const backLinkStyle = {
  display: "block", width: "100%", marginTop: "1.25rem",
  background: "transparent", border: "none",
  color: "rgba(255,255,255,0.3)", cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem",
  textAlign: "center",
}

const editLinkStyle = {
  background: "transparent", border: "none",
  color: "#5B9BD5", cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
  textDecoration: "underline", padding: 0,
}

const showHideBtnStyle = {
  position: "absolute", right: 12, top: 34,
  background: "transparent", border: "none",
  color: "rgba(255,255,255,0.35)", cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem",
}

const dividerStyle = {
  display: "flex", alignItems: "center", gap: "1rem",
  margin: "1.75rem 0",
}

const dividerLine = { flex: 1, height: "1px", background: "#2A2929" }

const dividerText = {
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem",
  color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "1px",
}
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../utils/api"
import cougarrideLogoMd from "../assets/cougarride-logo-md.png"

// ────────────────────────────────────────────
// DISNEY-STYLE AUTH FLOW
// 1. Enter email
// 2. Backend checks if email exists
//    → EXISTS: show password field (login)
//    → NEW: show create account form (register)
// "Looking for username login?" → jumps to email+password
// ────────────────────────────────────────────

export default function AuthPage() {
  // Steps: "email" → "login" or "register"
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

  // ─── Step 1: Check email against database ───
  async function handleEmailContinue(e) {
    e.preventDefault()
    if (!email) return
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (data.exists) {
        // Email found → go to password login
        setStep("login")
      } else {
        // New email → go to create account
        setStep("register")
      }
    } catch {
      setError("Could not connect to server")
    } finally {
      setLoading(false)
    }
  }

  // ─── Login ───
  async function handleLogin(e) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Invalid email or password")
        return
      }

      login(data.accessToken, data.user)
      if (["staff", "manager", "admin"].includes(data.user.role)) {
        navigate("/dashboard")
      } else {
        navigate("/")
      }
    } catch {
      setError("Could not connect to server")
    } finally {
      setLoading(false)
    }
  }

  // ─── Register ───
  async function handleRegister(e) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, date_of_birth: dateOfBirth, phone }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Registration failed")
        return
      }

      // Auto-login after register
      const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const loginData = await loginRes.json()
      if (loginRes.ok) {
        login(loginData.accessToken, loginData.user)
        navigate("/")
      } else {
        setStep("login")
      }
    } catch {
      setError("Could not connect to server")
    } finally {
      setLoading(false)
    }
  }

  // ─── Edit email (go back to step 1) ───
  function handleEditEmail() {
    setStep("email")
    setPassword("")
    setFullName("")
    setDateOfBirth("")
    setPhone("")
    setError("")
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0F0E0E 0%, #1A1919 50%, #0F0E0E 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "2rem",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Logo */}
      <Link to="/" style={{
        textDecoration: "none", marginBottom: "2.5rem", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <img src={cougarrideLogoMd} alt="CougarRide" style={{ height: "65px", width: "auto", marginBottom: "8px" }} />
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "1.5rem", fontWeight: 900,
          color: "#C8102E", letterSpacing: "3px", textTransform: "uppercase",
        }}>COUGARIDE</span>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.7rem", color: "rgba(255,255,255,0.3)",
          marginTop: "4px", letterSpacing: "1.5px", textTransform: "uppercase",
        }}>Theme Park Experience</p>
      </Link>

      {/* Auth card */}
      <div style={{
        width: "100%", maxWidth: "420px",
        background: "#1A1919", borderRadius: "20px",
        border: "1px solid #2A2929", padding: "2.5rem",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>

        {/* ═══════════════════════════════════════ */}
        {/* STEP 1: Enter email                    */}
        {/* ═══════════════════════════════════════ */}
        {step === "email" && (
          <>
            <h2 style={headingStyle}>Log In or Create Account</h2>
            <p style={subtextStyle}>Enter your email to continue to CougarRide</p>

            <form onSubmit={handleEmailContinue}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#C8102E"}
                onBlur={e => e.target.style.borderColor = "#3A3939"}
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
          </>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* STEP 2a: Login (email exists)          */}
        {/* ═══════════════════════════════════════ */}
        {step === "login" && (
          <>
            <h2 style={headingStyle}>Enter Your Password</h2>
            <p style={subtextStyle}>
              Sign in to your CougarRide account using{" "}
              <strong style={{ color: "white" }}>{email}</strong>{" "}
              <button onClick={handleEditEmail} style={editLinkStyle}>edit</button>
            </p>

            <form onSubmit={handleLogin}>
              {/* Only show email field if user came via "Looking for username login?" */}
              {!email && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoFocus
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  />
                </div>
              )}

              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Password</label>
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoFocus
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "#C8102E"}
                  onBlur={e => e.target.style.borderColor = "#3A3939"}
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

            <button onClick={handleEditEmail} style={backLinkStyle}>
              ← Back
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* STEP 2b: Create Account (new email)    */}
        {/* ═══════════════════════════════════════ */}
        {step === "register" && (
          <>
            <h2 style={headingStyle}>Create an Account to Continue</h2>
            <p style={subtextStyle}>
              With a CougarRide account, you can purchase tickets, track visits, and manage your park experience.
              Create your account using{" "}
              <strong style={{ color: "white" }}>{email}</strong>{" "}
              <button onClick={handleEditEmail} style={editLinkStyle}>edit</button>
            </p>

            <form onSubmit={handleRegister}>
              {/* Full Name */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="John Doe" required autoFocus
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "#C8102E"}
                  onBlur={e => e.target.style.borderColor = "#3A3939"}
                />
              </div>

              {/* Date of Birth + Phone side by side */}
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                    required style={{ ...inputStyle, colorScheme: "dark" }}
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="8325551234" required
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#C8102E"}
                    onBlur={e => e.target.style.borderColor = "#3A3939"}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ position: "relative", marginBottom: "0.25rem" }}>
                <label style={labelStyle}>Password</label>
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters" required minLength={8}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "#C8102E"}
                  onBlur={e => e.target.style.borderColor = "#3A3939"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={showHideBtnStyle}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem",
                color: "rgba(255,255,255,0.25)", margin: "4px 0 0",
              }}>Must be at least 8 characters</p>

              {error && <div style={{ ...errorStyle, marginTop: "1rem" }}>{error}</div>}

              <button type="submit" disabled={loading} style={primaryBtnStyle}>
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <button onClick={handleEditEmail} style={backLinkStyle}>
              ← Back
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <p style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem",
        color: "rgba(255,255,255,0.15)", marginTop: "2rem",
        textAlign: "center", maxWidth: "380px", lineHeight: 1.6,
      }}>
        By continuing, you agree to CougarRide's Terms of Use and acknowledge
        that you have read our Privacy Policy.
        <br />© 2026 CougarRide — COSC 3380 Group 15
      </p>
    </div>
  )
}

// ─── Shared styles ───

const headingStyle = {
  fontFamily: "'Playfair Display', serif",
  fontSize: "1.5rem", fontWeight: 700, color: "white",
  margin: "0 0 0.5rem", textAlign: "center",
}

const subtextStyle = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: "0.85rem", color: "rgba(255,255,255,0.45)",
  margin: "0 0 2rem", textAlign: "center", lineHeight: 1.5,
}

const labelStyle = {
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem",
  fontWeight: 600, color: "rgba(255,255,255,0.5)",
  textTransform: "uppercase", letterSpacing: "1px",
  display: "block", marginBottom: "6px",
}

const inputStyle = {
  width: "100%", padding: "13px 16px",
  background: "#222", border: "1px solid #3A3939",
  borderRadius: "10px", color: "white",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
}

const errorStyle = {
  marginTop: "1rem", padding: "10px 14px", borderRadius: "8px",
  background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.25)",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: "#EF9A9A",
}

const primaryBtnStyle = {
  width: "100%", marginTop: "1.5rem", padding: "14px",
  background: "linear-gradient(135deg, #C8102E, #8C1D40)",
  color: "white", border: "none", borderRadius: "50px",
  fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 700,
  cursor: "pointer", letterSpacing: "0.5px",
  boxShadow: "0 4px 20px rgba(200,16,46,0.35)",
  transition: "transform 0.15s",
}

const secondaryBtnStyle = {
  width: "100%", padding: "12px",
  background: "transparent", color: "rgba(255,255,255,0.6)",
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
  color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "1px",
}
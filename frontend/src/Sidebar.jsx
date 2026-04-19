import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

import cougarrideLogo from './assets/cougarride-logo.png';
import Ride from './assets/ride.svg';
import Staff from './assets/staff.svg'
import Food from './assets/food.svg';
import Gift from './assets/gift.svg';
import Merch from './assets/merch.svg';
import Maintenance from './assets/maintenance.svg';
import Analytics from './assets/analytics.svg';

import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { API_BASE_URL } from './utils/api';

// Inline bell icon used for the Notifications nav item — no asset file needed.
const BellIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
        <path d="M15 17h5l-1.4-1.4A7 7 0 0 1 17 10.6V9a5 5 0 0 0-10 0v1.6A7 7 0 0 1 5.4 15.6L4 17h5" />
        <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
)

const navList = [
    { label: "Rides", icon: Ride, path: "/dashboard/rides", roles: ["staff", "manager", "admin"] },
    { label: "Dining & Shops", icon: Gift, path: "/dashboard/dining-shops", roles: ["staff", "manager", "admin"] },
    { label: "Maintenance", icon: Maintenance, path: "/dashboard/maintenance", roles: ["staff", "manager", "admin"] },
    { label: "Notifications", iconNode: BellIcon, path: "/dashboard/notifications", roles: ["staff", "manager", "admin"], showBadge: true },
    { label: "Reports", icon: Analytics, path: "/dashboard/analytics", roles: ["manager", "admin"] },
    { label: "Staff", icon: Staff, path: "/dashboard/staff", roles: ["admin"] },
]

const f = "'DM Sans', sans-serif"


export default function Sidebar() {
    const [time, setTime] = useState(new Date())
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date())
        }, 60000)

        return () => clearInterval(interval)
    }, [])

    // Poll unread notification count every 15s so the sidebar badge stays fresh.
    useEffect(() => {
        async function fetchUnreadCount() {
            try {
                const token = localStorage.getItem("accessToken")
                if (!token) return
                const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                if (res.ok) {
                    const data = await res.json()
                    setUnreadCount(data.count || 0)
                }
            } catch {}
        }
        fetchUnreadCount()
        const interval = setInterval(fetchUnreadCount, 15000)
        return () => clearInterval(interval)
    }, [])

    const date = time.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
    })

    const clock = time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    })

    const navigate = useNavigate()
    const { user, logout } = useAuth()

    async function handleLogout() {
        await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        logout();
        navigate("/login")
    }

    return (
        <nav style={{
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #0F0E0E 0%, #1A1919 50%, #0F0E0E 100%)",
            borderRight: "1px solid #2A2929",
            padding: "1.5rem 1rem",
            minHeight: "100vh",
            width: "240px",
            fontFamily: f
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
            `}</style>

            {/* Logo Section */}
            <div style={{ marginBottom: "2rem" }}>
                <NavLink to="/" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    textDecoration: "none",
                    marginBottom: "0.5rem"
                }}>
                    <img src={cougarrideLogo} alt="CougarRide" style={{ height: "32px", width: "auto" }} />
                    <span style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "1.25rem",
                        fontWeight: 900,
                        color: "#C8102E",
                        letterSpacing: "1px"
                    }}>CougarRide</span>
                </NavLink>
                <p style={{
                    fontFamily: f,
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.6)",
                    margin: 0,
                    paddingLeft: "2.5rem",
                    letterSpacing: "0.5px"
                }}>Dashboard Portal</p>
            </div>

            {/* Navigation Menu */}
            <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
                {navList
                    .filter((item) => user?.role && item.roles.includes(user.role))
                    .map((item) => (
                        <li key={item.label}>
                            <NavLink
                                to={item.path}
                                style={({ isActive }) => ({
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    padding: "0.75rem 1rem",
                                    borderRadius: "10px",
                                    textDecoration: "none",
                                    fontFamily: f,
                                    fontSize: "0.9rem",
                                    fontWeight: isActive ? 600 : 500,
                                    color: isActive ? "white" : "rgba(255,255,255,0.7)",
                                    background: isActive
                                        ? "linear-gradient(135deg, #8C1D40, #C8102E)"
                                        : "transparent",
                                    border: isActive ? "1px solid #C8102E" : "1px solid transparent",
                                    transition: "all 0.15s ease",
                                    boxShadow: isActive ? "0 2px 8px rgba(200,16,46,0.3)" : "none"
                                })}
                                onMouseEnter={e => {
                                    if (!e.currentTarget.className.includes('active')) {
                                        e.currentTarget.style.background = "rgba(200,16,46,0.1)"
                                        e.currentTarget.style.color = "rgba(255,255,255,0.9)"
                                        e.currentTarget.style.borderColor = "rgba(200,16,46,0.3)"
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!e.currentTarget.className.includes('active')) {
                                        e.currentTarget.style.background = "transparent"
                                        e.currentTarget.style.color = "rgba(255,255,255,0.7)"
                                        e.currentTarget.style.borderColor = "transparent"
                                    }
                                }}
                            >
                                {item.iconNode ? (
                                    <span style={{ color: "white", display: "inline-flex" }}>
                                        {item.iconNode}
                                    </span>
                                ) : (
                                    <img
                                        src={item.icon}
                                        alt={item.label}
                                        style={{
                                            width: "18px",
                                            height: "18px",
                                            filter: "brightness(0) invert(1)",
                                            opacity: 0.8
                                        }}
                                    />
                                )}
                                <span>{item.label}</span>
                                {item.showBadge && unreadCount > 0 && (
                                    <span style={{
                                        marginLeft: "auto",
                                        minWidth: "20px",
                                        height: "20px",
                                        background: "#C8102E",
                                        borderRadius: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        color: "white",
                                        padding: "0 6px",
                                        border: "2px solid #141313",
                                    }}>
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                )}
                            </NavLink>
                        </li>
                    ))}
            </ul>

            {/* Bottom Section - Auto pushed to bottom */}
            <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
                {/* Current Time & Status */}
                <div style={{
                    background: "#141313",
                    borderRadius: "12px",
                    border: "1px solid #2A2929",
                    padding: "1rem",
                    textAlign: "center",
                    marginBottom: "1rem"
                }}>
                    <p style={{
                        fontFamily: f,
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.7)",
                        margin: "0 0 0.25rem",
                        fontWeight: 600
                    }}>{date}</p>
                    <p style={{
                        fontFamily: f,
                        fontSize: "1.1rem",
                        color: "white",
                        margin: "0 0 0.75rem",
                        fontWeight: 700,
                        letterSpacing: "1px"
                    }}>{clock}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <div style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#4CAF50",
                            animation: "pulse 2s infinite"
                        }}></div>
                        <span style={{
                            fontFamily: f,
                            fontSize: "0.75rem",
                            color: "#4CAF50",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                        }}>Park Open</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <NavLink
                        to="/"
                        style={{
                            display: "block",
                            padding: "0.75rem",
                            background: "rgba(200,16,46,0.15)",
                            border: "1px solid rgba(200,16,46,0.3)",
                            borderRadius: "8px",
                            textAlign: "center",
                            textDecoration: "none",
                            color: "#C8102E",
                            fontFamily: f,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            transition: "all 0.15s",
                            letterSpacing: "0.5px"
                        }}
                        onMouseEnter={e => {
                            e.target.style.background = "rgba(200,16,46,0.25)"
                            e.target.style.transform = "translateY(-1px)"
                        }}
                        onMouseLeave={e => {
                            e.target.style.background = "rgba(200,16,46,0.15)"
                            e.target.style.transform = "translateY(0)"
                        }}
                    >
                        View Park Site
                    </NavLink>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: "0.75rem",
                            background: "#2A2929",
                            border: "1px solid #3A3939",
                            borderRadius: "8px",
                            color: "white",
                            fontFamily: f,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            letterSpacing: "0.5px"
                        }}
                        onMouseEnter={e => {
                            e.target.style.background = "#F44336"
                            e.target.style.borderColor = "#F44336"
                            e.target.style.transform = "translateY(-1px)"
                        }}
                        onMouseLeave={e => {
                            e.target.style.background = "#2A2929"
                            e.target.style.borderColor = "#3A3939"
                            e.target.style.transform = "translateY(0)"
                        }}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </nav>
    )
}
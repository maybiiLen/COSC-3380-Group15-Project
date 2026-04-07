import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

import cougarrideLogo from './assets/cougarride-logo.png';
import cougarrideLogoMd from './assets/cougarride-logo-md.png';
import Home from './assets/home.svg';
import Ride from './assets/ride.svg';
import Staff from './assets/staff.svg'
import Ticket from './assets/ticket.svg';
import Food from './assets/food.svg';
import Gift from './assets/gift.svg';
import Merch from './assets/merch.svg';
import Maintenance from './assets/maintenance.svg';
import Analytics from './assets/analytics.svg';

import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { API_BASE_URL } from './utils/api';

const navList = [
    { label: "Home", icon: Home, path: "/dashboard", roles: ["staff", "manager", "admin"] },
    { label: "Rides", icon: Ride, path: "/dashboard/rides", roles: ["staff", "manager", "admin"] },
    { label: "Tickets", icon: Ticket, path: "/dashboard/tickets", roles: ["manager", "admin"] },
    { label: "Maintenance", icon: Maintenance, path: "/dashboard/maintenance", roles: ["staff", "manager", "admin"] },
    { label: "Analytics", icon: Analytics, path: "/dashboard/analytics", roles: ["manager", "admin"] },
    { label: "Staff", icon: Staff, path: "/dashboard/staff", roles: ["admin"] },
]

const f = "'DM Sans', sans-serif"

export default function Sidebar() {
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date())
        }, 60000)

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
                                {item.label}
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
                        🌐 View Park Site
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
                        🚪 Logout
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
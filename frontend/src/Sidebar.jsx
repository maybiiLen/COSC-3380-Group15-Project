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
    { label: "Dining & Shops", icon: Gift, path: "/dashboard/dining-shops", roles: ["staff", "manager", "admin"] },
    { label: "Tickets", icon: Ticket, path: "/dashboard/tickets", roles: ["manager", "admin"] },
    { label: "Maintenance", icon: Maintenance, path: "/dashboard/maintenance", roles: ["staff", "manager", "admin"] },
    { label: "Analytics", icon: Analytics, path: "/dashboard/analytics", roles: ["manager", "admin"] },
    { label: "Staff", icon: Staff, path: "/dashboard/staff", roles: ["admin"] },
]

const f = "'DM Sans', sans-serif"

// ─── Notification Bell Component ───
function NotificationBell({ user }) {
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        fetchUnreadCount()
        const interval = setInterval(fetchUnreadCount, 15000) // poll every 15s
        return () => clearInterval(interval)
    }, [])

    async function fetchUnreadCount() {
        try {
            const token = localStorage.getItem("accessToken")
            if (!token) return
            const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (res.ok) setUnreadCount(data.count)
        } catch {}
    }

    async function fetchNotifications() {
        try {
            const token = localStorage.getItem("accessToken")
            const res = await fetch(`${API_BASE_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (res.ok) setNotifications(data)
        } catch {}
    }

    async function markAsRead(id) {
        try {
            const token = localStorage.getItem("accessToken")
            await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            })
            setNotifications(notifications.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
            setUnreadCount(Math.max(0, unreadCount - 1))
        } catch {}
    }

    async function markAllRead() {
        try {
            const token = localStorage.getItem("accessToken")
            await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            })
            setNotifications(notifications.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        } catch {}
    }

    function toggleOpen() {
        if (!isOpen) fetchNotifications()
        setIsOpen(!isOpen)
    }

    const timeAgo = (date) => {
        const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
        if (mins < 1) return "just now"
        if (mins < 60) return `${mins}m ago`
        if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
        return `${Math.floor(mins / 1440)}d ago`
    }

    return (
        <div style={{ position: "relative", marginBottom: "1rem" }}>
            <button onClick={toggleOpen} style={{
                width: "100%", padding: "0.75rem 1rem",
                background: isOpen ? "rgba(200,16,46,0.15)" : "#141313",
                border: isOpen ? "1px solid rgba(200,16,46,0.3)" : "1px solid #2A2929",
                borderRadius: "10px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.75rem",
                color: "white", fontFamily: f, fontSize: "0.85rem", fontWeight: 600,
                transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,16,46,0.1)"; e.currentTarget.style.borderColor = "rgba(200,16,46,0.3)" }}
            onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.background = "#141313"; e.currentTarget.style.borderColor = "#2A2929" }}}
            >
                <span style={{ fontSize: "1.1rem" }}>🔔</span>
                Notifications
                {unreadCount > 0 && (
                    <span style={{
                        marginLeft: "auto", minWidth: "20px", height: "20px",
                        background: "#C8102E", borderRadius: "10px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.65rem", fontWeight: 700, color: "white",
                        padding: "0 6px",
                    }}>{unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: "absolute", left: "calc(100% + 8px)", top: 0,
                    width: "350px", maxHeight: "450px", overflowY: "auto",
                    background: "#1A1919", border: "1px solid #2A2929",
                    borderRadius: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                    zIndex: 100,
                }}>
                    <div style={{
                        padding: "1rem", borderBottom: "1px solid #2A2929",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                        <span style={{ fontFamily: f, fontSize: "0.9rem", fontWeight: 700, color: "white" }}>
                            Notifications
                        </span>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                fontFamily: f, fontSize: "0.7rem", color: "#C8102E", fontWeight: 600,
                            }}>Mark all read</button>
                        )}
                    </div>

                    {notifications.length === 0 ? (
                        <div style={{ padding: "2rem", textAlign: "center" }}>
                            <p style={{ fontFamily: f, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div key={n.notification_id} onClick={() => !n.is_read && markAsRead(n.notification_id)}
                                style={{
                                    padding: "0.75rem 1rem", borderBottom: "1px solid #222",
                                    cursor: n.is_read ? "default" : "pointer",
                                    background: n.is_read ? "transparent" : "rgba(200,16,46,0.05)",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={e => { if (!n.is_read) e.currentTarget.style.background = "rgba(200,16,46,0.1)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? "transparent" : "rgba(200,16,46,0.05)" }}
                            >
                                <div style={{ display: "flex", alignItems: "start", gap: "0.5rem" }}>
                                    {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8102E", marginTop: 6, flexShrink: 0 }} />}
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontFamily: f, fontSize: "0.78rem", fontWeight: 600, color: "white", margin: "0 0 2px" }}>{n.title}</p>
                                        <p style={{ fontFamily: f, fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", margin: "0 0 4px", lineHeight: 1.4 }}>{n.message}</p>
                                        <p style={{ fontFamily: f, fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", margin: 0 }}>{timeAgo(n.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

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

            {/* Notification Bell */}
            <NotificationBell user={user} />

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
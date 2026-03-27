import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

import logo from './assets/cougarride logo.png';
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

const navList = [
    { label: "Home", icon: Home, path: "/", roles: ["customer", "staff", "manager", "admin"] },
    { label: "Rides", icon: Ride, path: "/rides", roles: ["customer", "staff", "manager", "admin"] },
    { label: "Staff", icon: Staff, path: "/staff", roles: ["manager", "admin"] },
    { label: "Tickets", icon: Ticket, path: "/tickets", roles: ["customer", "staff", "manager", "admin"] },
    { label: "Restaurant", icon: Food, path: "/restaurant", roles: ["customer", "staff", "manager", "admin"] },
    { label: "Gift Shop", icon: Gift, path: "/gift-shop", roles: ["customer", "staff", "manager", "admin"] },
    { label: "Merchandise", icon: Merch, path: "/merchandise", roles: ["staff", "manager", "admin"] },
    { label: "Maintenance", icon: Maintenance, path: "/maintenance", roles: ["staff", "manager", "admin"] },
    { label: "Analytics", icon: Analytics, path: "/analytics", roles: ["manager", "admin"] },
]

const baseCase = "flex items-center gap-1.5 cursor-pointer text-white"
const activeCase = "bg-black/50 text-white p-1 rounded-md"
const inactiveCase = "hover:bg-black/50 hover:text-white p-1 rounded-md"

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
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        logout();
        navigate("/login")
    }

    return (
        <nav className="flex flex-col bg-[#C8102E] p-4">
            <div>
            <div className="flex items-center">
                <img src={logo} alt="CougarRide" className="h-10 w-auto" />
            </div>
            <p className="text-white text-xs mt-1">Theme Park Experience</p>
            </div>

            <ul className="flex flex-col gap-5 py-4 text-xl font-medium">
                {navList
                    .filter((item) => user?.role && item.roles.includes(user.role))
                    .map((item) => (
                        <li key={item.label}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `${baseCase} ${isActive ? activeCase : inactiveCase}`
                                }
                            >
                            <img src={item.icon} alt={item.label} className="w-5 h-5 filter brightness-0 invert" />
                            {item.label}
                            </NavLink>
                        </li>
                    ))}
            </ul>

            <div className='flex flex-col mt-auto items-center gap-1 text-white'>
                <p>{date}</p>
                <p>{clock}</p>
                <p>Park Status: 
                    <span className='text-green-300'> Open</span>
                </p>
                <button
                    onClick={handleLogout}
                    className="bg-white rounded-lg p-1 w-20 hover:bg-gray-200 text-black font-medium"
                >
                    Logout
                </button>
            </div>
        </nav>
    )
}
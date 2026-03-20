import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Login() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const navigate = useNavigate()

    function handleLogin() {
        if (username && password != null) {
            localStorage.setItem("isLoggedIn", "true")
            navigate("/")
        }
    }

    return (
        <div className="flex items-center justify-center h-screen bg-[#E53E3E]">
            <div className="flex flex-col items-center bg-white rounded-xl p-8 w-80 shadow-xl gap-4">
                <h1 className="text-4xl font-bold">🎢CougarRide</h1>
                <p className="text-gray-600">Theme Park Management System</p>

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border border-gray-300 rounded-lg p-1"
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-gray-300 rounded-lg p-1"
                />

                <button
                    onClick={handleLogin}
                    className="text-white bg-black rounded-lg p-1 hover:bg-gray-900"
                >
                    Sign In
                </button>
            </div>
        </div>
    )
}
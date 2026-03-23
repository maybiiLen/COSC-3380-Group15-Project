import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    date_of_birth: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        } else {
          setError(data.message || "Registration failed");
        }
        return;
      }

      // Auto-login after successful registration
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      const loginData = await loginRes.json();
      if (loginRes.ok) {
        login(loginData.accessToken, loginData.user);
        navigate("/");
      } else {
        navigate("/login");
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#E53E3E]">
      <div className="flex flex-col items-center bg-white rounded-xl p-8 w-96 shadow-xl gap-4">
        <h1 className="text-4xl font-bold">🎢CougarRide</h1>
        <p className="text-gray-600">Create your account</p>

        <form onSubmit={handleRegister} className="flex flex-col gap-3 w-full">
          <div>
            <input
              type="text"
              name="full_name"
              placeholder="Full Name"
              value={form.full_name}
              onChange={handleChange}
              required
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {fieldErrors.full_name && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.full_name[0]}</p>
            )}
          </div>

          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {fieldErrors.email && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.email[0]}</p>
            )}
          </div>

          <div>
            <input
              type="password"
              name="password"
              placeholder="Password (min 8 characters)"
              value={form.password}
              onChange={handleChange}
              required
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {fieldErrors.password && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.password[0]}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 ml-1">Date of Birth</label>
            <input
              type="date"
              name="date_of_birth"
              value={form.date_of_birth}
              onChange={handleChange}
              required
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {fieldErrors.date_of_birth && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.date_of_birth[0]}</p>
            )}
          </div>

          <div>
            <input
              type="tel"
              name="phone"
              placeholder="Phone (10-13 digits)"
              value={form.phone}
              onChange={handleChange}
              required
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {fieldErrors.phone && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.phone[0]}</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="text-white bg-black rounded-lg p-2 hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-[#E53E3E] font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

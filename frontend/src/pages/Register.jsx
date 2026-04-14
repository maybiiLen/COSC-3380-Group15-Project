import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { API_BASE_URL } from "../utils/api";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    phone: "",
    role: "customer",
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
      let endpoint, requestBody;

      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`;
      if (form.role === "customer") {
        endpoint = `${API_BASE_URL}/api/auth/register`;
        requestBody = {
          email: form.email,
          password: form.password,
          full_name: fullName,
          date_of_birth: form.date_of_birth,
          phone: form.phone,
        };
      } else {
        endpoint = `${API_BASE_URL}/api/auth/register/employee`;
        requestBody = {
          email: form.email,
          password: form.password,
          full_name: fullName,
          role: form.role,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
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

      const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
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

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20";

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Join CougarRide to get started"
      footerText="Already have an account?"
      footerLink="/login"
      footerLinkText="Sign in"
    >
      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        {/* Account Type */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Account Type</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="customer">Customer - Visit and enjoy the park</option>
            <option value="staff">Staff - Work at the park</option>
            <option value="manager">Manager - Manage park operations</option>
          </select>
        </div>

        {/* First Name + Last Name row */}
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">First Name</label>
            <input
              type="text"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder="John"
              required
              className={inputClass}
            />
            {fieldErrors.full_name && (
              <p className="text-xs text-red-500">{fieldErrors.full_name[0]}</p>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Last Name</label>
            <input
              type="text"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              placeholder="Smith"
              required
              className={inputClass}
            />
          </div>
        </div>

        {/* Phone (only for customers) */}
        {form.role === "customer" && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="7135551234"
              required
              className={inputClass}
            />
            {fieldErrors.phone && (
              <p className="text-xs text-red-500">{fieldErrors.phone[0]}</p>
            )}
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
            className={inputClass}
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-500">{fieldErrors.email[0]}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Min. 8 characters"
            required
            className={inputClass}
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-500">{fieldErrors.password[0]}</p>
          )}
        </div>

        {/* Date of Birth (only for customers) */}
        {form.role === "customer" && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Date of Birth</label>
            <input
              type="date"
              name="date_of_birth"
              value={form.date_of_birth}
              onChange={handleChange}
              required
              className={inputClass}
            />
            {fieldErrors.date_of_birth && (
              <p className="text-xs text-red-500">{fieldErrors.date_of_birth[0]}</p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#C8102E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a50d25] disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </AuthLayout>
  );
}

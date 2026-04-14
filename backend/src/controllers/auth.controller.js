const authService = require("../services/auth.service");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

const register = async (req, res) => {
  try {
    const { email, password, full_name, date_of_birth, phone } = req.body;
    const { user, customer } = await authService.registerUser(email, password, full_name, date_of_birth, phone);
    res.status(201).json({ user, customer });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
  }
};

const registerEmployee = async (req, res) => {
  try {
    const { email, password, full_name, role, hourly_rate } = req.body;
    const { user, employee } = await authService.registerEmployee(email, password, full_name, role, hourly_rate);
    res.status(201).json({ user, employee });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { accessToken, rawRefreshToken, user, profile } = await authService.loginUser(email, password);
    res.cookie("refreshToken", rawRefreshToken, COOKIE_OPTIONS);
    res.json({ accessToken, user, profile });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
  }
};

const refresh = async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }
    const { accessToken, rawRefreshToken: newRaw } = await authService.refreshTokens(rawRefreshToken);
    res.cookie("refreshToken", newRaw, COOKIE_OPTIONS);
    res.json({ accessToken });
  } catch (err) {
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
  }
};

const logout = async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    await authService.logoutUser(rawRefreshToken);
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.json({ message: "Logged out" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
  }
};

module.exports = { register, registerEmployee, login, refresh, logout };

const { Router } = require("../lib/router");
const { register, registerEmployee, login, refresh, logout } = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const { registerSchema, registerEmployeeSchema, loginSchema } = require("../validators/auth.validators");

const router = Router();

// Check if email exists (for Disney-style auth flow)
router.post("/check-email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const pool = require("../config/db");
  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  res.json({ exists: rows.length > 0 });
});

// Public — customer self-registration (always role='customer')
router.post("/register", validate(registerSchema), register);

// Admin only — create staff/manager/admin accounts
router.post("/register/employee", verifyToken, verifyRole("admin"), validate(registerEmployeeSchema), registerEmployee);

router.post("/login",   validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout",  logout);

module.exports = router;
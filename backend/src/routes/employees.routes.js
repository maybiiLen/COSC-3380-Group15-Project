const { Router } = require("../lib/router")
const router = Router()
const pool = require("../config/db")

// GET all employees (for dropdowns and staff page) — only active employees
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT employee_id, full_name, email, role, hourly_rate, ride_id, shift_start, shift_end, hire_date
       FROM employees
       WHERE is_active = true
       ORDER BY full_name`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT update an employee (role, hourly_rate, shift, ride assignment)
router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { role, hourly_rate, shift_start, shift_end, ride_id } = req.body

  try {
    // Block edits to admin-role employees (admins cannot modify other admins or themselves)
    const check = await pool.query("SELECT role FROM employees WHERE employee_id = $1", [id])
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" })
    }
    if (check.rows[0].role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot be edited" })
    }

    const { rows } = await pool.query(
      `UPDATE employees
       SET role        = COALESCE($1, role),
           hourly_rate = COALESCE($2, hourly_rate),
           shift_start = COALESCE($3, shift_start),
           shift_end   = COALESCE($4, shift_end),
           ride_id     = $5
       WHERE employee_id = $6
       RETURNING *`,
      [role, hourly_rate || null, shift_start || null, shift_end || null, ride_id || null, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" })
    }

    // Also update the users table role if the employee has a linked user account
    if (role && rows[0].user_id) {
      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, rows[0].user_id])
    }

    res.json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// DELETE an employee (soft delete — fires fn_guard_employee_deactivation trigger)
router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    // Block deletion of admin-role employees
    const check = await pool.query("SELECT role FROM employees WHERE employee_id = $1", [id])
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" })
    }
    if (check.rows[0].role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot be deleted" })
    }

    // Soft delete: flip is_active — the deactivation guard trigger validates
    // that no active operator assignments or open maintenance tasks exist.
    const { rows } = await pool.query(
      `UPDATE employees
       SET is_active = false
       WHERE employee_id = $1
       RETURNING *`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" })
    }

    res.json({ message: "Employee deactivated", employee: rows[0] })
  } catch (err) {
    console.log("DB error:", err.message)
    // Trigger rejection — surface as 409 Conflict with the raised message
    if (err.code === "ED001" || err.code === "ED002") {
      return res.status(409).json({ message: err.message, code: err.code, hint: err.hint })
    }
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
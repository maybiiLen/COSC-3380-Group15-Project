const { Router } = require("../lib/router")
const router = Router()
const pool = require("../config/db")

// GET all employees (for dropdowns and staff page)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT employee_id, full_name, email, role, hourly_rate, ride_id, shift_start, shift_end, hire_date FROM employees ORDER BY full_name"
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

// DELETE an employee (hard delete)
router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      "DELETE FROM employees WHERE employee_id = $1 RETURNING *",
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" })
    }

    // Also delete the linked user account if exists
    if (rows[0].user_id) {
      await pool.query("DELETE FROM users WHERE id = $1", [rows[0].user_id])
    }

    res.json({ message: "Employee deleted", employee: rows[0] })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
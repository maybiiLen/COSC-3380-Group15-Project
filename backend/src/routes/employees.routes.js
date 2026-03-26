const express = require("express")
const router = express.Router()
const pool = require("../config/db")

// GET all employees (for dropdowns and staff page)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT employee_id, full_name, email, role FROM employees ORDER BY full_name"
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
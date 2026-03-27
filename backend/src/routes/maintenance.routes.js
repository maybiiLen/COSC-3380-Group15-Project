const express = require("express")
const router = express.Router()
const pool = require("../config/db")

// ─── GET all maintenance requests (joined with ride + employee names) ───
// DATA QUERY 1: JOIN maintenance_requests with rides and employees
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        m.request_id,
        m.ride_id,
        r.ride_name,
        r.status       AS ride_status,
        m.employee_id,
        e.full_name     AS employee_name,
        m.description,
        m.priority,
        m.status,
        m.created_at,
        m.completed_at
      FROM maintenance_requests m
      JOIN rides r       ON r.ride_id = m.ride_id
      LEFT JOIN employees e ON e.employee_id = m.employee_id
      ORDER BY m.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET maintenance history for a specific ride ───
// DATA QUERY 2: Filter by ride with employee info + time tracking
router.get("/ride/:rideId", async (req, res) => {
  const { rideId } = req.params
  try {
    const { rows } = await pool.query(`
      SELECT
        m.request_id,
        m.description,
        m.priority,
        m.status,
        e.full_name     AS assigned_to,
        m.created_at,
        m.completed_at,
        CASE
          WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL
        END AS hours_to_complete
      FROM maintenance_requests m
      LEFT JOIN employees e ON e.employee_id = m.employee_id
      WHERE m.ride_id = $1
      ORDER BY m.created_at DESC
    `, [rideId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET maintenance summary report (count per ride grouped by status) ───
// DATA QUERY 3: Aggregate query with GROUP BY and JOIN
router.get("/report/summary", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.ride_id,
        r.ride_name,
        r.status AS current_ride_status,
        COUNT(m.request_id)                                          AS total_requests,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Pending')      AS pending,
        COUNT(m.request_id) FILTER (WHERE m.status = 'In Progress')  AS in_progress,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Completed')    AS completed,
        ROUND(AVG(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS avg_hours_to_complete
      FROM rides r
      LEFT JOIN maintenance_requests m ON m.ride_id = r.ride_id
      GROUP BY r.ride_id, r.ride_name, r.status
      HAVING COUNT(m.request_id) > 0
      ORDER BY total_requests DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST create a new maintenance request ───
router.post("/", async (req, res) => {
  const { ride_id, employee_id, description, priority, status } = req.body

  try {
    const { rows } = await pool.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ride_id, employee_id || null, description, priority || "Medium", status || "Pending"]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── PUT update a maintenance request (status, priority, description) ───
router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { status, priority, description, employee_id } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE maintenance_requests
       SET status      = COALESCE($1, status),
           priority    = COALESCE($2, priority),
           description = COALESCE($3, description),
           employee_id = COALESCE($4, employee_id)
       WHERE request_id = $5
       RETURNING *`,
      [status, priority, description, employee_id || null, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Maintenance request not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── DELETE a maintenance request ───
router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      "DELETE FROM maintenance_requests WHERE request_id = $1 RETURNING *",
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Maintenance request not found" })
    }

    res.json({ message: "Maintenance request deleted" })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
const express = require("express")
const router = express.Router()
const pool = require("../config/db")

// ─── GET all rides ───
// ?all=true → show all rides (for staff/manager views)
// default  → only show operational rides (for customer view)
router.get("/", async (req, res) => {
  try {
    const showAll = req.query.all === "true"
    const query = showAll
      ? "SELECT * FROM rides ORDER BY ride_id"
      : "SELECT * FROM rides WHERE is_operational = true ORDER BY ride_id"
    const { rows } = await pool.query(query)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST create a new ride ───
router.post("/", async (req, res) => {
  const { ride_name, capacity_per_cycle, min_height_in, location, status, description, image_url, ride_type, thrill_level } = req.body
  const wait_time = (Math.floor(Math.random() * 12) + 1) * 5

  try {
    const { rows } = await pool.query(
      `INSERT INTO rides (ride_name, capacity_per_cycle, min_height_in, location, status, wait_time, is_operational, description, image_url, ride_type, thrill_level)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
      RETURNING *`,
      [ride_name, capacity_per_cycle, min_height_in, location, status, wait_time, description || null, image_url || null, ride_type || null, thrill_level || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── PUT update/edit a ride ───
router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { ride_name, capacity_per_cycle, min_height_in, location, status, description, image_url, ride_type, thrill_level } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE rides
       SET ride_name         = COALESCE($1, ride_name),
           capacity_per_cycle = COALESCE($2, capacity_per_cycle),
           min_height_in     = COALESCE($3, min_height_in),
           location          = COALESCE($4, location),
           status            = COALESCE($5, status),
           description       = COALESCE($6, description),
           image_url         = COALESCE($7, image_url),
           ride_type         = COALESCE($8, ride_type),
           thrill_level      = COALESCE($9, thrill_level)
       WHERE ride_id = $10
       RETURNING *`,
      [ride_name, capacity_per_cycle, min_height_in, location, status, description, image_url, ride_type, thrill_level, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Ride not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── DELETE (soft delete) — mark ride as non-operational ───
// Preserves historical data (visitor counts, maintenance records)
router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      `UPDATE rides
       SET is_operational = false, status = 'Decommissioned'
       WHERE ride_id = $1
       RETURNING *`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Ride not found" })
    }

    res.status(200).json({ message: "Ride decommissioned (soft-deleted)", ride: rows[0] })
  } catch (err) {
    console.log("DB error: ", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── PATCH restore a decommissioned ride ───
router.patch("/:id/restore", async (req, res) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      `UPDATE rides
       SET is_operational = true, status = 'Operational'
       WHERE ride_id = $1
       RETURNING *`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Ride not found" })
    }

    res.json({ message: "Ride restored to operational", ride: rows[0] })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
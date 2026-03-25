const express = require("express")
const router = express.Router()
const pool = require("../config/db")

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM rides")
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post("/", async (req, res) => {
  const { ride_name, capacity_per_cycle, min_height_in, location, status } = req.body

  const wait_time = (Math.floor(Math.random() * 12) + 1) * 5

  try {
    const { rows } = await pool.query(
      `INSERT INTO rides (ride_name, capacity_per_cycle, min_height_in, location, status, wait_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [ride_name, capacity_per_cycle, min_height_in, location, status, wait_time]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    await pool.query("DELETE FROM rides WHERE ride_id = $1", [id])
    res.status(200).json({ message: "Ride deleted" })
  } catch (err) {
    console.log("DB error: ", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
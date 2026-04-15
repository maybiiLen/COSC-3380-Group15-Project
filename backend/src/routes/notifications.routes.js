const { Router } = require("../lib/router")
const router = Router()
const pool = require("../config/db")
const verifyToken = require("../middleware/verifyToken")

// ─── GET notifications for the logged-in user ───
// Returns notifications matching user's role OR targeted to their user_id
router.get("/", verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM notifications
      WHERE (recipient_role = $1 OR recipient_user_id = $2 OR recipient_role = 'all')
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.role, req.user.id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET unread count ───
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) AS count FROM notifications
      WHERE (recipient_role = $1 OR recipient_user_id = $2 OR recipient_role = 'all')
        AND is_read = false
    `, [req.user.role, req.user.id])
    res.json({ count: parseInt(rows[0].count) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── PATCH mark a notification as read ───
router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = true WHERE notification_id = $1",
      [req.params.id]
    )
    res.json({ message: "Marked as read" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── PATCH mark all as read for this user ───
router.patch("/read-all", verifyToken, async (req, res) => {
  try {
    await pool.query(`
      UPDATE notifications SET is_read = true
      WHERE (recipient_role = $1 OR recipient_user_id = $2 OR recipient_role = 'all')
        AND is_read = false
    `, [req.user.role, req.user.id])
    res.json({ message: "All marked as read" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
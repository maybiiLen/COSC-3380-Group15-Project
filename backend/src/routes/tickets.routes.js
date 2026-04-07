const express = require("express")
const router = express.Router()
const pool = require("../config/db")
const verifyToken = require("../middleware/verifyToken")
const verifyRole = require("../middleware/verifyRole")

// ─── Ticket pricing config ───
const TICKET_PRICES = {
  "General Admission": { adult: 49, child: 35 },
  "Season Pass":       { adult: 149, child: 99 },
  "VIP Experience":    { adult: 89, child: 69 },
}

// ─── GET available ticket types (public) ───
router.get("/types", async (req, res) => {
  try {
    const types = Object.entries(TICKET_PRICES).map(([name, prices]) => ({
      name,
      adult_price: prices.adult,
      child_price: prices.child,
    }))
    res.json(types)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── Optional auth middleware ───
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]
  if (!token) { req.user = null; return next() }
  try {
    const jwt = require("jsonwebtoken")
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role, profileId: decoded.profileId ?? null }
  } catch { req.user = null }
  next()
}

// ─── POST purchase tickets (guest or logged-in) ───
// Accepts cart items, card details (last 4 stored), visit_date
router.post("/purchase", optionalAuth, async (req, res) => {
  const { items, card_last_four, cardholder_name, visit_date, guest_email } = req.body

  // items = [{ ticket_type, adult_qty, child_qty }]
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Cart is empty" })
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    let userId = req.user?.id || null
    let customerId = null

    if (userId) {
      const { rows } = await client.query("SELECT customer_id FROM customers WHERE user_id = $1", [userId])
      customerId = rows.length > 0 ? rows[0].customer_id : null
    }

    const purchases = []
    let orderTotal = 0

    for (const item of items) {
      const pricing = TICKET_PRICES[item.ticket_type]
      if (!pricing) {
        await client.query("ROLLBACK")
        return res.status(400).json({ message: `Invalid ticket type: ${item.ticket_type}` })
      }

      const adults = item.adult_qty || 0
      const children = item.child_qty || 0
      if (adults + children === 0) continue

      const total = (adults * pricing.adult) + (children * pricing.child)
      orderTotal += total

      const { rows } = await client.query(
        `INSERT INTO ticket_purchases
          (customer_id, user_id, ticket_type, adult_qty, child_qty,
           unit_price_adult, unit_price_child, total_price, visit_date,
           card_last_four, cardholder_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [customerId, userId, item.ticket_type, adults, children,
         pricing.adult, pricing.child, total, visit_date || null,
         card_last_four || null, cardholder_name || null]
      )
      purchases.push(rows[0])
    }

    await client.query("COMMIT")

    res.status(201).json({
      message: "Order placed successfully!",
      order_total: orderTotal,
      purchases,
    })
  } catch (err) {
    await client.query("ROLLBACK")
    console.log("Purchase error:", err.message)
    res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }
})

// ─── GET my purchases (requires auth) ───
router.get("/my-purchases", verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ticket_purchases WHERE user_id = $1 ORDER BY purchase_date DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET all purchases (manager/admin — drill-down report) ───
router.get("/all-purchases", verifyToken, verifyRole("manager", "admin"), async (req, res) => {
  const { ticket_type, start_date, end_date, format } = req.query

  let conditions = []
  let params = []
  let idx = 1

  if (ticket_type && ticket_type !== "") { conditions.push(`tp.ticket_type = $${idx++}`); params.push(ticket_type) }
  if (start_date && start_date !== "") { conditions.push(`tp.purchase_date >= $${idx++}`); params.push(start_date) }
  if (end_date && end_date !== "") { conditions.push(`tp.purchase_date <= $${idx++}`); params.push(end_date + "T23:59:59") }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

  try {
    // Detail rows
    const { rows: details } = await pool.query(`
      SELECT tp.purchase_id, tp.ticket_type,
        COALESCE(c.full_name, u.email, 'Guest') AS customer_name,
        tp.adult_qty, tp.child_qty, tp.unit_price_adult, tp.unit_price_child,
        tp.total_price, tp.visit_date, tp.purchase_date,
        tp.card_last_four, tp.cardholder_name
      FROM ticket_purchases tp
      LEFT JOIN customers c ON c.customer_id = tp.customer_id
      LEFT JOIN users u ON u.id = tp.user_id
      ${where} ORDER BY tp.purchase_date DESC
    `, params)

    // Summary by type
    const { rows: summary } = await pool.query(`
      SELECT tp.ticket_type,
        COUNT(tp.purchase_id) AS total_transactions,
        SUM(tp.adult_qty) AS total_adults, SUM(tp.child_qty) AS total_children,
        SUM(tp.adult_qty + tp.child_qty) AS total_tickets,
        SUM(tp.total_price) AS subtotal_revenue,
        ROUND(AVG(tp.total_price)::numeric, 2) AS avg_transaction
      FROM ticket_purchases tp ${where}
      GROUP BY tp.ticket_type ORDER BY subtotal_revenue DESC
    `, params)

    // Grand totals
    const { rows: totals } = await pool.query(`
      SELECT COUNT(tp.purchase_id) AS total_transactions,
        SUM(tp.adult_qty) AS total_adults, SUM(tp.child_qty) AS total_children,
        SUM(tp.adult_qty + tp.child_qty) AS total_tickets,
        SUM(tp.total_price) AS total_revenue,
        ROUND(AVG(tp.total_price)::numeric, 2) AS avg_transaction,
        COUNT(DISTINCT tp.user_id) AS unique_customers
      FROM ticket_purchases tp ${where}
    `, params)

    if (format === "csv") {
      const h = "Purchase ID,Customer,Type,Adults,Children,Total,Date\n"
      const r = details.map(d => `${d.purchase_id},"${d.customer_name}","${d.ticket_type}",${d.adult_qty},${d.child_qty},${d.total_price},${new Date(d.purchase_date).toLocaleDateString()}`).join("\n")
      res.setHeader("Content-Type", "text/csv")
      return res.send(h + r)
    }

    res.json({ details, summary, totals: totals[0] })
  } catch (err) {
    console.log("Report error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── POST seed sample purchases (for demo — call once) ───
router.post("/seed-demo", async (req, res) => {
  try {
    const { rows: existing } = await pool.query("SELECT COUNT(*) AS cnt FROM ticket_purchases")
    if (parseInt(existing[0].cnt) > 5) {
      return res.json({ message: "Demo data already exists" })
    }

    const samplePurchases = [
      ["General Admission", 2, 1, 49, 35, 133, "2026-04-01", "4242", "Maria Garcia"],
      ["Season Pass", 1, 0, 149, 99, 149, "2026-03-20", "1234", "James Wilson"],
      ["VIP Experience", 2, 2, 89, 69, 316, "2026-04-05", "5678", "Sarah Johnson"],
      ["General Admission", 1, 2, 49, 35, 119, "2026-03-28", "9012", "Michael Brown"],
      ["Season Pass", 2, 0, 149, 99, 298, "2026-03-15", "3456", "Emily Davis"],
      ["General Admission", 4, 0, 49, 35, 196, "2026-04-02", "7890", "Robert Martinez"],
      ["VIP Experience", 1, 1, 89, 69, 158, "2026-04-03", null, null],
      ["General Admission", 2, 3, 49, 35, 203, "2026-03-30", "2345", "Jennifer Lee"],
      ["Season Pass", 1, 1, 149, 99, 248, "2026-03-25", "6789", "David Anderson"],
      ["General Admission", 3, 0, 49, 35, 147, "2026-04-04", null, null],
      ["VIP Experience", 2, 0, 89, 69, 178, "2026-03-22", "0123", "Lisa Thomas"],
      ["Season Pass", 1, 0, 149, 99, 149, "2026-04-01", "4567", "Chris Taylor"],
    ]

    for (const p of samplePurchases) {
      await pool.query(
        `INSERT INTO ticket_purchases (ticket_type, adult_qty, child_qty, unit_price_adult, unit_price_child, total_price, visit_date, card_last_four, cardholder_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        p
      )
    }

    res.json({ message: "Seeded 12 sample ticket purchases" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
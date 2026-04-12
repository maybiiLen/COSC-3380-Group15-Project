const express = require("express")
const router = express.Router()
const pool = require("../config/db")
const verifyToken = require("../middleware/verifyToken")
const verifyRole = require("../middleware/verifyRole")

// ─── GET available ticket types from DATABASE (no hardcoding) ───
router.get("/types", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ticket_type_id, type_name AS name, base_price AS adult_price,
             COALESCE(child_price, ROUND(base_price * 0.7, 2)) AS child_price,
             ticket_category, fast_pass, description
      FROM ticket_types
      ORDER BY base_price ASC
    `)
    res.json(rows)
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
// Prices looked up from ticket_types table — never hardcoded
router.post("/purchase", optionalAuth, async (req, res) => {
  const { items, card_last_four, cardholder_name, visit_date, guest_email } = req.body

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

    // Load ALL ticket type pricing from the database
    const { rows: ticketTypes } = await client.query(
      "SELECT ticket_type_id, type_name, base_price, COALESCE(child_price, ROUND(base_price * 0.7, 2)) AS child_price FROM ticket_types"
    )
    const priceMap = {}
    for (const t of ticketTypes) {
      priceMap[t.type_name] = {
        id: t.ticket_type_id,
        adult: parseFloat(t.base_price),
        child: parseFloat(t.child_price),
      }
    }

    const purchases = []
    let orderTotal = 0

    for (const item of items) {
      const pricing = priceMap[item.ticket_type]
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
          (customer_id, user_id, ticket_type, ticket_type_id, adult_qty, child_qty,
           unit_price_adult, unit_price_child, total_price, visit_date,
           card_last_four, cardholder_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [customerId, userId, item.ticket_type, pricing.id, adults, children,
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
      `SELECT tp.*, tt.description AS type_description, tt.fast_pass
       FROM ticket_purchases tp
       LEFT JOIN ticket_types tt ON tt.ticket_type_id = tp.ticket_type_id
       WHERE tp.user_id = $1
       ORDER BY tp.purchase_date DESC`,
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

module.exports = router
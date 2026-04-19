const { Router } = require("../lib/router")
const router = Router()
const pool = require("../config/db")
const verifyToken = require("../middleware/verifyToken")

// ═══════════════════════════════════════════
// RESTAURANTS
// ═══════════════════════════════════════════
// ?all=true → show all (for staff/manager views)
// default  → only show non-decommissioned (for customer view)
router.get("/restaurants", async (req, res) => {
  try {
    const showAll = req.query.all === "true"
    const query = showAll
      ? "SELECT * FROM restaurant ORDER BY restaurant_id"
      : "SELECT * FROM restaurant WHERE decommissioned_at IS NULL ORDER BY restaurant_id"
    const { rows } = await pool.query(query)
    res.json(rows)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post("/restaurants", async (req, res) => {
  const { name, food_type, location, operational_status, description, image_url } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO restaurant (name, food_type, location, operational_status, total_sales, description, image_url)
       VALUES ($1, $2, $3, $4, 0, $5, $6) RETURNING *`,
      [name, food_type || null, location, operational_status ?? 1, description || null, image_url || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.put("/restaurants/:id", async (req, res) => {
  const { name, food_type, location, operational_status, description, image_url } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE restaurant SET name = COALESCE($1, name), food_type = COALESCE($2, food_type),
       location = COALESCE($3, location), operational_status = COALESCE($4, operational_status),
       description = COALESCE($5, description), image_url = COALESCE($6, image_url)
       WHERE restaurant_id = $7 RETURNING *`,
      [name, food_type, location, operational_status, description, image_url, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Soft delete — mark as decommissioned, preserve historical sales data
router.delete("/restaurants/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE restaurant
         SET operational_status = 0, decommissioned_at = NOW()
       WHERE restaurant_id = $1
       RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Restaurant not found" })
    res.json({ message: "Restaurant decommissioned (soft-deleted)", restaurant: rows[0] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Restore a decommissioned restaurant
router.patch("/restaurants/:id/restore", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE restaurant
         SET operational_status = 1, decommissioned_at = NULL
       WHERE restaurant_id = $1
       RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Restaurant not found" })
    res.json({ message: "Restaurant restored", restaurant: rows[0] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═══════════════════════════════════════════
// GIFT SHOPS
// ═══════════════════════════════════════════
router.get("/gift-shops", async (req, res) => {
  try {
    const showAll = req.query.all === "true"
    const query = showAll
      ? "SELECT * FROM gift_shop ORDER BY gift_shop_id"
      : "SELECT * FROM gift_shop WHERE decommissioned_at IS NULL ORDER BY gift_shop_id"
    const { rows } = await pool.query(query)
    res.json(rows)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post("/gift-shops", async (req, res) => {
  const { name, location, operational_status, description, image_url } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO gift_shop (name, location, operational_status, total_sales, description, image_url)
       VALUES ($1, $2, $3, 0, $4, $5) RETURNING *`,
      [name, location, operational_status ?? 1, description || null, image_url || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.put("/gift-shops/:id", async (req, res) => {
  const { name, location, operational_status, description, image_url } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE gift_shop SET name = COALESCE($1, name), location = COALESCE($2, location),
       operational_status = COALESCE($3, operational_status),
       description = COALESCE($4, description), image_url = COALESCE($5, image_url)
       WHERE gift_shop_id = $6 RETURNING *`,
      [name, location, operational_status, description, image_url, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Soft delete — mark as decommissioned, preserve historical sales data
router.delete("/gift-shops/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE gift_shop
         SET operational_status = 0, decommissioned_at = NOW()
       WHERE gift_shop_id = $1
       RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Gift shop not found" })
    res.json({ message: "Gift shop decommissioned (soft-deleted)", gift_shop: rows[0] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Restore a decommissioned gift shop
router.patch("/gift-shops/:id/restore", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE gift_shop
         SET operational_status = 1, decommissioned_at = NULL
       WHERE gift_shop_id = $1
       RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Gift shop not found" })
    res.json({ message: "Gift shop restored", gift_shop: rows[0] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═══════════════════════════════════════════
// GAMES
// ═══════════════════════════════════════════
router.get("/games", async (req, res) => {
  try {
    const showAll = req.query.all === "true"
    const query = showAll
      ? "SELECT * FROM game ORDER BY game_id"
      : "SELECT * FROM game WHERE decommissioned_at IS NULL ORDER BY game_id"
    const { rows } = await pool.query(query)
    res.json(rows)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post("/games", async (req, res) => {
  const { game_name, max_players, location, operational_status, description, image_url, prize_type } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO game (game_name, max_players, location, operational_status, total_sales, description, image_url, prize_type)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7) RETURNING *`,
      [game_name, max_players || 1, location, operational_status ?? 1, description || null, image_url || null, prize_type || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.put("/games/:id", async (req, res) => {
  const { game_name, max_players, location, operational_status, description, image_url, prize_type } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE game SET game_name = COALESCE($1, game_name), max_players = COALESCE($2, max_players),
       location = COALESCE($3, location), operational_status = COALESCE($4, operational_status),
       description = COALESCE($5, description), image_url = COALESCE($6, image_url),
       prize_type = COALESCE($7, prize_type)
       WHERE game_id = $8 RETURNING *`,
      [game_name, max_players, location, operational_status, description, image_url, prize_type, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Soft delete — mark as decommissioned, preserve historical sales data
router.delete("/games/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE game
         SET operational_status = 0, decommissioned_at = NOW()
       WHERE game_id = $1
       RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Game not found" })
    res.json({ message: "Game decommissioned (soft-deleted)", game: rows[0] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Restore a decommissioned game
router.patch("/games/:id/restore", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE game
         SET operational_status = 1, decommissioned_at = NULL
       WHERE game_id = $1
       RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Game not found" })
    res.json({ message: "Game restored", game: rows[0] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═══════════════════════════════════════════
// MERCHANDISE
// ═══════════════════════════════════════════
router.get("/merch", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM merch ORDER BY merch_id")
    res.json(rows)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post("/merch", async (req, res) => {
  const { merch_name, merch_category, wholesale_price, retail_price, game_award, sold_location, image_url, description } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO merch (merch_name, merch_category, wholesale_price, retail_price, game_award, sold_location, sold_status, image_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8) RETURNING *`,
      [merch_name, merch_category || 'General', wholesale_price || 0, retail_price || 0, game_award || false,
       sold_location || 'Main Gift Shop', image_url || null, description || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.put("/merch/:id", async (req, res) => {
  const { merch_name, merch_category, wholesale_price, retail_price, game_award, sold_location, sold_status, image_url, description } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE merch SET merch_name = COALESCE($1, merch_name), merch_category = COALESCE($2, merch_category),
       wholesale_price = COALESCE($3, wholesale_price), retail_price = COALESCE($4, retail_price),
       game_award = COALESCE($5, game_award), sold_location = COALESCE($6, sold_location),
       sold_status = COALESCE($7, sold_status),
       image_url = COALESCE($8, image_url),
       description = COALESCE($9, description)
       WHERE merch_id = $10 RETURNING *`,
      [merch_name, merch_category, wholesale_price, retail_price, game_award, sold_location, sold_status,
       image_url, description, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete("/merch/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM merch WHERE merch_id = $1", [req.params.id])
    res.json({ message: "Deleted" })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── MERCH PURCHASE HISTORY FOR LOGGED-IN USER ──────────────────
// Matches by the user's email (case-insensitive) so guest checkouts
// made under the same email are still linked.
router.get("/merch/my-purchases", verifyToken, async (req, res) => {
  try {
    const { rows: userRows } = await pool.query("SELECT email FROM users WHERE id = $1", [req.user.id])
    if (!userRows.length) return res.json([])
    const email = userRows[0].email

    const { rows } = await pool.query(
      `SELECT purchase_id, buyer_name, buyer_email, shipping_address,
              items, total_price, cardholder_name, card_last_four, purchase_date
         FROM merch_purchases
        WHERE LOWER(buyer_email) = LOWER($1)
        ORDER BY purchase_date DESC`,
      [email]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── MERCH ONLINE PURCHASE ──────────────────────────────────────
// POST /api/park-ops/merch/purchase
// Body: { buyer_name, buyer_email, shipping_address, items: [{merch_id, qty}],
//         cardholder_name, card_number }
// Server-computes total from the DB (never trusts client-side prices).
router.post("/merch/purchase", async (req, res) => {
  const { buyer_name, buyer_email, shipping_address, items, cardholder_name, card_number } = req.body
  if (!buyer_name || !buyer_email) return res.status(400).json({ message: "Buyer name and email are required" })
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Cart is empty" })
  if (!card_number || String(card_number).replace(/\s+/g, "").length < 13) {
    return res.status(400).json({ message: "A valid card number is required" })
  }

  try {
    // Pull authoritative prices + names for each item (ignore client-sent prices).
    const ids = items.map(i => Number(i.merch_id)).filter(Boolean)
    const qtyByMerchId = new Map(items.map(i => [Number(i.merch_id), Math.max(1, Number(i.qty || 1))]))
    if (ids.length === 0) return res.status(400).json({ message: "Cart has no valid items" })

    const { rows: catalog } = await pool.query(
      `SELECT merch_id, merch_name, retail_price, game_award
         FROM merch
        WHERE merch_id = ANY($1::int[])`,
      [ids]
    )
    if (catalog.length !== ids.length) return res.status(400).json({ message: "One or more items are no longer available" })

    const lineItems = []
    let total = 0
    for (const item of catalog) {
      if (item.game_award) {
        return res.status(400).json({ message: `"${item.merch_name}" is a game prize and cannot be purchased directly` })
      }
      const qty = qtyByMerchId.get(item.merch_id) || 1
      const unitPrice = Number(item.retail_price)
      const lineTotal = Number((unitPrice * qty).toFixed(2))
      total += lineTotal
      lineItems.push({
        merch_id: item.merch_id,
        merch_name: item.merch_name,
        qty,
        unit_price: unitPrice,
        line_total: lineTotal,
      })
    }
    total = Number(total.toFixed(2))

    // Match the buyer to a registered customer by email (optional link).
    const { rows: matched } = await pool.query(
      `SELECT customer_id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [buyer_email]
    )
    const customer_id = matched.length ? matched[0].customer_id : null

    const cardDigits = String(card_number).replace(/\s+/g, "")
    const cardLast4 = cardDigits.slice(-4)

    const { rows } = await pool.query(
      `INSERT INTO merch_purchases
         (customer_id, buyer_name, buyer_email, shipping_address, items,
          total_price, cardholder_name, card_last_four)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING purchase_id, total_price, purchase_date`,
      [customer_id, buyer_name, buyer_email, shipping_address || null,
       JSON.stringify(lineItems), total, cardholder_name || buyer_name, cardLast4]
    )

    res.status(201).json({ ...rows[0], items: lineItems })
  } catch (err) {
    console.error("Merch purchase error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ═══════════════════════════════════════════
// PARK CLOSURES
// ═══════════════════════════════════════════
router.get("/park-closures", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM park_closures WHERE archived_at IS NULL ORDER BY started_at DESC"
    )
    res.json(rows)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Create a closure — trg_park_closure_cascade cascades Operational → Closed
// on every ride in the zone.
router.post("/park-closures", async (req, res) => {
  const { zone, reason, closure_type } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO park_closures (zone, reason, closure_type, is_active)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [zone, reason, closure_type || 'Weather']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Deactivate a closure — trg_park_closure_cascade reopens rides in the zone
// (respecting trg_guard_ride_reopen, which keeps rides Closed if they still
// have pending Critical/High maintenance or another closure covers the zone).
router.patch("/park-closures/:id/deactivate", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE park_closures SET is_active = false, ended_at = NOW()
       WHERE closure_id = $1 RETURNING *`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: "Closure not found" })
    res.json(rows[0])
  } catch (err) {
    console.log("Deactivate error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// DELETE (archive) a closure. Soft-delete: row stays in the table for reports,
// but disappears from the admin list. Only resolved (is_active=false) closures
// can be archived — you can't hide an active emergency.
router.delete("/park-closures/:id", async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT is_active, archived_at FROM park_closures WHERE closure_id = $1",
      [req.params.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ message: "Closure not found" })
    }
    if (existing[0].archived_at) {
      return res.status(409).json({ message: "Closure is already archived" })
    }
    if (existing[0].is_active) {
      return res.status(400).json({
        message: "Lift the closure before archiving. Active closures can't be hidden."
      })
    }
    await pool.query(
      "UPDATE park_closures SET archived_at = NOW() WHERE closure_id = $1",
      [req.params.id]
    )
    res.json({ message: "Closure archived (hidden from list, preserved for reports)" })
  } catch (err) {
    console.log("Archive error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
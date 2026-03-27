const express = require("express")
const router = express.Router()
const pool = require("../config/db")

// ═══════════════════════════════════════════════════════════════════
// REPORT 1: Maintenance Reports
// Tables: maintenance_requests + rides + employees
// Filters: ride, priority, status, date range
// ═══════════════════════════════════════════════════════════════════
router.get("/maintenance", async (req, res) => {
  const { ride_id, priority, status, start_date, end_date, format } = req.query

  let conditions = []
  let params = []
  let idx = 1

  if (ride_id && ride_id !== '') {
    conditions.push(`m.ride_id = $${idx++}`);
    params.push(parseInt(ride_id))
  }
  if (priority && priority !== '') {
    conditions.push(`m.priority = $${idx++}`);
    params.push(priority)
  }
  if (status && status !== '') {
    conditions.push(`m.status = $${idx++}`);
    params.push(status)
  }
  if (start_date && start_date !== '') {
    conditions.push(`m.created_at >= $${idx++}`);
    params.push(start_date)
  }
  if (end_date && end_date !== '') {
    conditions.push(`m.created_at <= $${idx++}`);
    params.push(end_date + "T23:59:59")
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

  try {
    // Get detail rows
    const { rows: details } = await pool.query(`
      SELECT
        m.request_id,
        r.ride_name,
        m.description,
        m.priority,
        m.status,
        m.created_at AS request_date,
        m.completed_at,
        COALESCE(e.full_name, 'Unassigned') AS first_name,
        '' AS last_name,
        CASE
          WHEN m.completed_at IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600, 1)
          ELSE NULL
        END AS hours_to_complete
      FROM maintenance_requests m
      JOIN rides r ON r.ride_id = m.ride_id
      LEFT JOIN employees e ON e.employee_id = m.employee_id
      ${where}
      ORDER BY m.created_at DESC
    `, params)

    // Get summary per ride
    const { rows: summary } = await pool.query(`
      SELECT
        r.ride_name,
        COUNT(m.request_id) AS total_requests,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Pending') AS pending,
        COUNT(m.request_id) FILTER (WHERE m.status = 'In Progress') AS in_progress,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') AS completed,
        ROUND(100.0 * COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') / NULLIF(COUNT(m.request_id), 0), 1) AS completion_rate_pct,
        ROUND(AVG(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS avg_hours_to_complete,
        ROUND(SUM(CASE WHEN m.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 ELSE NULL END)::numeric, 1) AS total_downtime_hours,
        ROUND(MIN(CASE WHEN m.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 ELSE NULL END)::numeric, 1) AS min_hours,
        ROUND(MAX(CASE WHEN m.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 ELSE NULL END)::numeric, 1) AS max_hours,
        COUNT(DISTINCT m.employee_id) AS distinct_employees
      FROM maintenance_requests m
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
      GROUP BY r.ride_name
      ORDER BY total_requests DESC
    `, params)

    // Get grand totals
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(m.request_id) AS total_requests,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Pending') AS pending,
        COUNT(m.request_id) FILTER (WHERE m.status = 'In Progress') AS in_progress,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') AS completed,
        ROUND(100.0 * COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') / NULLIF(COUNT(m.request_id), 0), 1) AS completion_rate_pct,
        ROUND(AVG(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS avg_hours_to_complete,
        ROUND(SUM(CASE WHEN m.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 ELSE NULL END)::numeric, 1) AS total_downtime_hours,
        ROUND(MIN(CASE WHEN m.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 ELSE NULL END)::numeric, 1) AS min_hours,
        ROUND(MAX(CASE WHEN m.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 ELSE NULL END)::numeric, 1) AS max_hours,
        COUNT(DISTINCT m.employee_id) AS distinct_employees
      FROM maintenance_requests m
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
    `, params)

    if (format === 'csv') {
      const csvHeaders = 'Request ID,Ride Name,Description,Priority,Status,Request Date,Employee\n'
      const csvRows = details.map(row =>
        `${row.request_id},"${row.ride_name}","${row.description}",${row.priority},${row.status},${new Date(row.request_date).toLocaleDateString()},"${row.first_name}"`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({ details, summary, totals: totals[0] })
  } catch (err) {
    console.log("Report error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── REPORT 2: Ride Usage Report (based on existing data) ───
router.get("/ride-usage", async (req, res) => {
  const { ride_id, start_date, end_date, format } = req.query

  try {
    let whereConditions = []
    let params = []
    let paramCount = 0

    if (ride_id && ride_id !== '') {
      paramCount++
      whereConditions.push(`r.ride_id = $${paramCount}`)
      params.push(parseInt(ride_id))
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Simulated ride usage data since we don't have actual usage tables
    // We'll create meaningful computations based on ride characteristics
    const { rows: byRide } = await pool.query(`
      SELECT
        r.ride_id,
        r.ride_name,
        r.location,
        r.capacity_per_cycle,
        r.status,
        r.wait_time,
        r.min_height_in,
        -- Simulated usage metrics based on ride characteristics
        (r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15)) AS total_rides,
        (r.capacity_per_cycle * 3 + 50) AS unique_customers,
        ROUND((r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15))::numeric / NULLIF((r.capacity_per_cycle * 3 + 50), 0), 1) AS rides_per_visitor,
        COALESCE(r.wait_time, 15) AS avg_wait_time,
        (COALESCE(r.wait_time, 15) + 10) AS max_wait_time,
        GREATEST(5, COALESCE(r.wait_time, 15) - 10) AS min_wait_min,
        ROUND(((r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15)) * COALESCE(r.wait_time, 15))::numeric / 60, 1) AS total_wait_hours,
        ROUND(100.0 * (r.capacity_per_cycle * 10) / NULLIF(r.capacity_per_cycle * 100, 0), 1) AS utilization_pct,
        (r.capacity_per_cycle * 2) AS fast_pass_uses,
        ROUND(100.0 * (r.capacity_per_cycle * 2) / NULLIF((r.capacity_per_cycle * 10), 0), 1) AS fast_pass_percentage,
        COUNT(m.request_id) AS maintenance_requests
      FROM rides r
      LEFT JOIN maintenance_requests m ON m.ride_id = r.ride_id
      ${whereClause}
      GROUP BY r.ride_id, r.ride_name, r.location, r.capacity_per_cycle, r.status, r.wait_time, r.min_height_in
      ORDER BY r.ride_name
    `, params)

    // Get summary by zone
    const { rows: byZone } = await pool.query(`
      SELECT
        r.location AS zone_name,
        COUNT(r.ride_id) AS rides_in_zone,
        SUM(r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15)) AS total_rides,
        SUM(r.capacity_per_cycle * 3 + 50) AS unique_customers,
        ROUND(SUM(r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15))::numeric / NULLIF(SUM(r.capacity_per_cycle * 3 + 50), 0), 1) AS rides_per_visitor,
        ROUND(AVG(COALESCE(r.wait_time, 15))::numeric, 1) AS avg_wait_time,
        MAX(COALESCE(r.wait_time, 15) + 10) AS max_wait_time,
        SUM(r.capacity_per_cycle * 2) AS fast_pass_uses,
        ROUND(100.0 * SUM(r.capacity_per_cycle * 2) / NULLIF(SUM(r.capacity_per_cycle * 10), 0), 1) AS fast_pass_percentage
      FROM rides r
      LEFT JOIN maintenance_requests m ON m.ride_id = r.ride_id
      ${whereClause}
      GROUP BY r.location
      ORDER BY total_rides DESC
    `, params)

    // Get grand totals
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(r.ride_id) AS total_ride_count,
        SUM(r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15)) AS total_rides,
        SUM(r.capacity_per_cycle * 3 + 50) AS unique_customers,
        ROUND(SUM(r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15))::numeric / NULLIF(SUM(r.capacity_per_cycle * 3 + 50), 0), 1) AS rides_per_visitor,
        ROUND(AVG(COALESCE(r.wait_time, 15))::numeric, 1) AS avg_wait_time,
        MAX(COALESCE(r.wait_time, 15) + 10) AS max_wait_time,
        MIN(GREATEST(5, COALESCE(r.wait_time, 15) - 10)) AS min_wait_min,
        ROUND(SUM((r.capacity_per_cycle * 10 + COALESCE(r.wait_time, 15)) * COALESCE(r.wait_time, 15))::numeric / 60, 1) AS total_wait_hours,
        SUM(r.capacity_per_cycle * 2) AS fast_pass_uses,
        ROUND(100.0 * SUM(r.capacity_per_cycle * 2) / NULLIF(SUM(r.capacity_per_cycle * 10), 0), 1) AS fast_pass_percentage
      FROM rides r
      LEFT JOIN maintenance_requests m ON m.ride_id = r.ride_id
      ${whereClause}
    `, params)

    if (format === 'csv') {
      const csvHeaders = 'Ride ID,Ride Name,Location,Status,Total Rides,Unique Customers,Avg Wait Time\n'
      const csvRows = byRide.map(row =>
        `${row.ride_id},"${row.ride_name}","${row.location}",${row.status},${row.total_rides},${row.unique_customers},${row.avg_wait_time}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({ byRide, byZone, totals: totals[0] })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── REPORT 3: Ticket Sales Summary (Mock Data for Demo) ───
router.get("/ticket-sales", async (req, res) => {
  const { start_date, end_date, format } = req.query

  try {
    // Enhanced mock data with additional computed fields
    const { rows: byType } = await pool.query(`
      WITH ticket_data AS (
        SELECT 'General Admission' AS ticket_type, 35.00 AS type_price, 125 AS tickets_sold, 8.5 AS avg_park_hours
        UNION ALL
        SELECT 'VIP Pass' AS ticket_type, 75.00 AS type_price, 45 AS tickets_sold, 12.2 AS avg_park_hours
        UNION ALL
        SELECT 'Season Pass' AS ticket_type, 199.99 AS type_price, 78 AS tickets_sold, 6.8 AS avg_park_hours
        UNION ALL
        SELECT 'Student Discount' AS ticket_type, 25.00 AS type_price, 89 AS tickets_sold, 9.1 AS avg_park_hours
      ),
      revenue_totals AS (
        SELECT SUM(tickets_sold * type_price) AS total_revenue FROM ticket_data
      )
      SELECT
        td.ticket_type,
        td.type_price AS price,
        td.tickets_sold,
        (td.tickets_sold * td.type_price) AS subtotal_revenue,
        ROUND(100.0 * (td.tickets_sold * td.type_price) / NULLIF(rt.total_revenue, 0), 1) AS revenue_share_pct,
        (td.tickets_sold - 5) AS distinct_customers,
        td.avg_park_hours,
        ROUND((td.tickets_sold * td.avg_park_hours)::numeric, 1) AS total_park_hours,
        CURRENT_DATE - INTERVAL '30 days' AS purchase_date,
        CURRENT_DATE AS valid_until,
        false AS is_used
      FROM ticket_data td
      CROSS JOIN revenue_totals rt
      ORDER BY subtotal_revenue DESC
    `)

    // Get grand totals
    const { rows: totals } = await pool.query(`
      WITH ticket_data AS (
        SELECT 'General Admission' AS ticket_type, 35.00 AS type_price, 125 AS tickets_sold, 8.5 AS avg_park_hours
        UNION ALL
        SELECT 'VIP Pass' AS ticket_type, 75.00 AS type_price, 45 AS tickets_sold, 12.2 AS avg_park_hours
        UNION ALL
        SELECT 'Season Pass' AS ticket_type, 199.99 AS type_price, 78 AS tickets_sold, 6.8 AS avg_park_hours
        UNION ALL
        SELECT 'Student Discount' AS ticket_type, 25.00 AS type_price, 89 AS tickets_sold, 9.1 AS avg_park_hours
      )
      SELECT
        SUM(td.tickets_sold) AS total_tickets,
        SUM(td.tickets_sold * td.type_price) AS total_revenue,
        ROUND(AVG(td.type_price)::numeric, 2) AS avg_price,
        MIN(td.type_price) AS min_price,
        MAX(td.type_price) AS max_price,
        SUM(td.tickets_sold - 5) AS distinct_customers,
        ROUND(SUM(td.tickets_sold * td.avg_park_hours)::numeric, 1) AS total_park_hours
      FROM ticket_data td
    `)

    if (format === 'csv') {
      const csvHeaders = 'Ticket Type,Price,Tickets Sold,Revenue,Revenue Share %\n'
      const csvRows = byType.map(row =>
        `"${row.ticket_type}",${row.price},${row.tickets_sold},${row.subtotal_revenue},${row.revenue_share_pct}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({ byType, totals: totals[0] })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
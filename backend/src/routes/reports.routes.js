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
        COALESCE(e.full_name, 'Unassigned') AS assigned_to,
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
        `${row.request_id},"${row.ride_name}","${row.description}",${row.priority},${row.status},${new Date(row.request_date).toLocaleDateString()},"${row.assigned_to}"`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    // Raw table data for display
    const { rows: rawMaintenance } = await pool.query("SELECT request_id, ride_id, employee_id, description, priority, status, created_at, completed_at FROM maintenance_requests ORDER BY created_at DESC LIMIT 20")
    const { rows: rawRides } = await pool.query("SELECT ride_id, ride_name, location, status, capacity_per_cycle FROM rides ORDER BY ride_id LIMIT 20")
    const { rows: rawEmployees } = await pool.query("SELECT employee_id, full_name, email, role FROM employees ORDER BY employee_id LIMIT 20")

    res.json({
      details, summary, totals: totals[0],
      tables_used: ["maintenance_requests", "rides", "employees"],
      raw_tables: { maintenance_requests: rawMaintenance, rides: rawRides, employees: rawEmployees }
    })
  } catch (err) {
    console.log("Report error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── REPORT 2: Ride Usage Report (REAL data from ride_usage table) ───
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

    // Per-ride usage from the ride_usage table
    const { rows: byRide } = await pool.query(`
      SELECT
        r.ride_id,
        r.ride_name,
        r.location,
        r.capacity_per_cycle,
        r.status,
        r.wait_time,
        r.min_height_in,
        COUNT(ru.usage_id) AS total_rides,
        COUNT(DISTINCT ru.customer_id) AS unique_customers,
        ROUND(COUNT(ru.usage_id)::numeric / NULLIF(COUNT(DISTINCT ru.customer_id), 0), 1) AS rides_per_visitor,
        ROUND(AVG(ru.wait_time)::numeric, 1) AS avg_wait_time,
        MAX(ru.wait_time) AS max_wait_time,
        MIN(ru.wait_time) AS min_wait_min,
        ROUND(SUM(ru.wait_time)::numeric / 60, 1) AS total_wait_hours,
        ROUND(100.0 * COUNT(ru.usage_id) / NULLIF(r.capacity_per_cycle * 100, 0), 1) AS utilization_pct,
        COUNT(CASE WHEN ru.fast_pass = true THEN 1 END) AS fast_pass_uses,
        ROUND(100.0 * COUNT(CASE WHEN ru.fast_pass = true THEN 1 END) / NULLIF(COUNT(ru.usage_id), 0), 1) AS fast_pass_percentage,
        (SELECT COUNT(*) FROM maintenance_requests mr WHERE mr.ride_id = r.ride_id) AS maintenance_requests
      FROM rides r
      LEFT JOIN ride_usage ru ON ru.ride_id = r.ride_id
      ${whereClause}
      GROUP BY r.ride_id, r.ride_name, r.location, r.capacity_per_cycle, r.status, r.wait_time, r.min_height_in
      ORDER BY total_rides DESC
    `, params)

    // Summary by zone
    const { rows: byZone } = await pool.query(`
      SELECT
        r.location AS zone_name,
        COUNT(DISTINCT r.ride_id) AS rides_in_zone,
        COUNT(ru.usage_id) AS total_rides,
        COUNT(DISTINCT ru.customer_id) AS unique_customers,
        ROUND(COUNT(ru.usage_id)::numeric / NULLIF(COUNT(DISTINCT ru.customer_id), 0), 1) AS rides_per_visitor,
        ROUND(AVG(ru.wait_time)::numeric, 1) AS avg_wait_time,
        MAX(ru.wait_time) AS max_wait_time,
        COUNT(CASE WHEN ru.fast_pass = true THEN 1 END) AS fast_pass_uses,
        ROUND(100.0 * COUNT(CASE WHEN ru.fast_pass = true THEN 1 END) / NULLIF(COUNT(ru.usage_id), 0), 1) AS fast_pass_percentage
      FROM rides r
      LEFT JOIN ride_usage ru ON ru.ride_id = r.ride_id
      ${whereClause}
      GROUP BY r.location
      ORDER BY total_rides DESC
    `, params)

    // Grand totals
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(DISTINCT r.ride_id) AS total_ride_count,
        COUNT(ru.usage_id) AS total_rides,
        COUNT(DISTINCT ru.customer_id) AS unique_customers,
        ROUND(COUNT(ru.usage_id)::numeric / NULLIF(COUNT(DISTINCT ru.customer_id), 0), 1) AS rides_per_visitor,
        ROUND(AVG(ru.wait_time)::numeric, 1) AS avg_wait_time,
        MAX(ru.wait_time) AS max_wait_time,
        MIN(ru.wait_time) AS min_wait_min,
        ROUND(SUM(ru.wait_time)::numeric / 60, 1) AS total_wait_hours,
        COUNT(CASE WHEN ru.fast_pass = true THEN 1 END) AS fast_pass_uses,
        ROUND(100.0 * COUNT(CASE WHEN ru.fast_pass = true THEN 1 END) / NULLIF(COUNT(ru.usage_id), 0), 1) AS fast_pass_percentage
      FROM rides r
      LEFT JOIN ride_usage ru ON ru.ride_id = r.ride_id
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

    // Raw table data for display
    const { rows: rawRides } = await pool.query("SELECT ride_id, ride_name, location, status, capacity_per_cycle, wait_time FROM rides ORDER BY ride_id LIMIT 20")
    const { rows: rawRideUsage } = await pool.query("SELECT usage_id, ride_id, customer_id, visit_id, wait_time, fast_pass FROM ride_usage ORDER BY usage_id DESC LIMIT 20")
    const { rows: rawMaintenance } = await pool.query("SELECT request_id, ride_id, priority, status FROM maintenance_requests ORDER BY request_id DESC LIMIT 20")

    res.json({
      byRide, byZone, totals: totals[0],
      tables_used: ["rides", "ride_usage", "maintenance_requests"],
      raw_tables: { rides: rawRides, ride_usage: rawRideUsage, maintenance_requests: rawMaintenance }
    })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── REPORT 3: Ticket Sales (ticket_purchases + customers + ticket_types) ───
router.get("/ticket-sales", async (req, res) => {
  const { ticket_type, start_date, end_date, customer_name, format } = req.query

  let conditions = []
  let params = []
  let idx = 1

  if (ticket_type && ticket_type !== '') { conditions.push(`tp.ticket_type = $${idx++}`); params.push(ticket_type) }
  if (start_date && start_date !== '') { conditions.push(`tp.purchase_date >= $${idx++}`); params.push(start_date) }
  if (end_date && end_date !== '') { conditions.push(`tp.purchase_date <= $${idx++}`); params.push(end_date + "T23:59:59") }
  if (customer_name && customer_name !== '') { conditions.push(`LOWER(c.full_name) LIKE $${idx++}`); params.push(`%${customer_name.toLowerCase()}%`) }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

  try {
    // Detail rows — 3-table JOIN: ticket_purchases + customers + ticket_types
    const { rows: details } = await pool.query(`
      SELECT
        tp.purchase_id,
        tp.ticket_type,
        COALESCE(c.full_name, 'Guest') AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        tt.ticket_category,
        tt.fast_pass,
        tt.description AS type_description,
        tp.adult_qty,
        tp.child_qty,
        tp.unit_price_adult,
        tp.unit_price_child,
        tp.total_price,
        tp.visit_date,
        tp.purchase_date,
        tp.card_last_four
      FROM ticket_purchases tp
      LEFT JOIN customers c ON c.customer_id = tp.customer_id
      LEFT JOIN ticket_types tt ON tt.type_name = tp.ticket_type
      ${where}
      ORDER BY tp.purchase_date DESC
    `, params)

    // Summary by type
    const { rows: byType } = await pool.query(`
      SELECT
        tp.ticket_type,
        tt.ticket_category,
        tt.fast_pass,
        tp.unit_price_adult AS price,
        SUM(tp.adult_qty + tp.child_qty) AS tickets_sold,
        SUM(tp.total_price) AS subtotal_revenue,
        ROUND(100.0 * SUM(tp.total_price) / NULLIF((SELECT SUM(total_price) FROM ticket_purchases), 0), 1) AS revenue_share_pct,
        COUNT(DISTINCT c.customer_id) AS distinct_customers,
        COUNT(tp.purchase_id) AS total_transactions,
        ROUND(AVG(tp.total_price)::numeric, 2) AS avg_transaction
      FROM ticket_purchases tp
      LEFT JOIN customers c ON c.customer_id = tp.customer_id
      LEFT JOIN ticket_types tt ON tt.type_name = tp.ticket_type
      ${where}
      GROUP BY tp.ticket_type, tt.ticket_category, tt.fast_pass, tp.unit_price_adult
      ORDER BY subtotal_revenue DESC
    `, params)

    // Grand totals
    const { rows: totals } = await pool.query(`
      SELECT
        SUM(tp.adult_qty + tp.child_qty) AS total_tickets,
        SUM(tp.total_price) AS total_revenue,
        ROUND(AVG(tp.total_price)::numeric, 2) AS avg_price,
        COUNT(DISTINCT c.customer_id) AS distinct_customers,
        COUNT(tp.purchase_id) AS total_transactions
      FROM ticket_purchases tp
      LEFT JOIN customers c ON c.customer_id = tp.customer_id
      ${where}
    `, params)

    // Raw table data for display
    const { rows: rawTicketPurchases } = await pool.query("SELECT purchase_id, customer_id, ticket_type, adult_qty, child_qty, total_price, visit_date, purchase_date FROM ticket_purchases ORDER BY purchase_date DESC LIMIT 20")
    const { rows: rawCustomers } = await pool.query("SELECT customer_id, full_name, email, phone FROM customers ORDER BY customer_id LIMIT 20")
    const { rows: rawTicketTypes } = await pool.query("SELECT ticket_type_id, type_name, base_price, ticket_category, fast_pass FROM ticket_types ORDER BY ticket_type_id")

    if (format === 'csv') {
      const csvHeaders = 'Purchase ID,Customer,Type,Category,Fast Pass,Adults,Children,Total,Date\n'
      const csvRows = details.map(row =>
        `${row.purchase_id},"${row.customer_name}","${row.ticket_type}","${row.ticket_category || ''}",${row.fast_pass || false},${row.adult_qty},${row.child_qty},${row.total_price},${new Date(row.purchase_date).toLocaleDateString()}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({
      details,
      byType,
      totals: totals[0],
      tables_used: ["ticket_purchases", "customers", "ticket_types"],
      raw_tables: { ticket_purchases: rawTicketPurchases, customers: rawCustomers, ticket_types: rawTicketTypes }
    })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── REPORT 4: Employee Activity (employees + maintenance_requests + rides) ───
router.get("/employee-activity", async (req, res) => {
  const { employee_id, start_date, end_date, priority, format } = req.query

  let conditions = []
  let params = []
  let idx = 1

  if (employee_id && employee_id !== '') { conditions.push(`e.employee_id = $${idx++}`); params.push(parseInt(employee_id)) }
  if (start_date && start_date !== '') { conditions.push(`m.created_at >= $${idx++}`); params.push(start_date) }
  if (end_date && end_date !== '') { conditions.push(`m.created_at <= $${idx++}`); params.push(end_date + "T23:59:59") }
  if (priority && priority !== '') { conditions.push(`m.priority = $${idx++}`); params.push(priority) }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

  try {
    // Detail rows — 3-table JOIN: employees + maintenance_requests + rides
    const { rows: details } = await pool.query(`
      SELECT
        e.employee_id,
        e.full_name AS employee_name,
        e.email AS employee_email,
        e.role AS employee_role,
        e.hourly_rate,
        r.ride_id,
        r.ride_name,
        r.location AS ride_zone,
        m.request_id,
        m.description AS task_description,
        m.priority,
        m.status,
        m.created_at AS assigned_date,
        m.completed_at,
        CASE
          WHEN m.completed_at IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600, 1)
          ELSE NULL
        END AS hours_to_complete
      FROM employees e
      JOIN maintenance_requests m ON m.employee_id = e.employee_id
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
      ORDER BY m.created_at DESC
    `, params)

    // Summary per employee
    const { rows: summary } = await pool.query(`
      SELECT
        e.employee_id,
        e.full_name AS employee_name,
        e.role AS employee_role,
        COUNT(m.request_id) AS total_tasks,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') AS completed_tasks,
        COUNT(m.request_id) FILTER (WHERE m.status = 'In Progress') AS in_progress_tasks,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Pending') AS pending_tasks,
        ROUND(100.0 * COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') / NULLIF(COUNT(m.request_id), 0), 1) AS completion_rate,
        ROUND(AVG(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS avg_hours_to_complete,
        COUNT(DISTINCT r.ride_id) AS rides_serviced
      FROM employees e
      JOIN maintenance_requests m ON m.employee_id = e.employee_id
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
      GROUP BY e.employee_id, e.full_name, e.role
      ORDER BY total_tasks DESC
    `, params)

    // Grand totals
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(DISTINCT e.employee_id) AS total_employees,
        COUNT(m.request_id) AS total_tasks,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') AS completed,
        COUNT(m.request_id) FILTER (WHERE m.status = 'In Progress') AS in_progress,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Pending') AS pending,
        ROUND(100.0 * COUNT(m.request_id) FILTER (WHERE m.status = 'Completed') / NULLIF(COUNT(m.request_id), 0), 1) AS completion_rate,
        ROUND(AVG(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS avg_hours,
        COUNT(DISTINCT r.ride_id) AS rides_serviced
      FROM employees e
      JOIN maintenance_requests m ON m.employee_id = e.employee_id
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
    `, params)

    // Raw table data for display
    const { rows: rawEmployees } = await pool.query("SELECT employee_id, full_name, email, role, hourly_rate FROM employees ORDER BY employee_id LIMIT 20")
    const { rows: rawMaintenance } = await pool.query("SELECT request_id, ride_id, employee_id, description, priority, status, created_at, completed_at FROM maintenance_requests ORDER BY created_at DESC LIMIT 20")
    const { rows: rawRides } = await pool.query("SELECT ride_id, ride_name, location, status FROM rides ORDER BY ride_id LIMIT 20")

    if (format === 'csv') {
      const csvHeaders = 'Employee,Role,Ride,Task,Priority,Status,Assigned,Completed,Hours\n'
      const csvRows = details.map(row =>
        `"${row.employee_name}","${row.employee_role}","${row.ride_name}","${row.task_description}","${row.priority}","${row.status}",${new Date(row.assigned_date).toLocaleDateString()},${row.completed_at ? new Date(row.completed_at).toLocaleDateString() : ''},${row.hours_to_complete || ''}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({
      details,
      summary,
      totals: totals[0],
      tables_used: ["employees", "maintenance_requests", "rides"],
      raw_tables: { employees: rawEmployees, maintenance_requests: rawMaintenance, rides: rawRides }
    })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
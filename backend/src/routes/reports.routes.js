const { Router } = require("../lib/router")
const router = Router()
const pool = require("../config/db")

// ═══════════════════════════════════════════════════════════════════
// REPORT 1: Maintenance Reports
// Tables: maintenance_requests + rides + employees
// Filters: ride, priority, status, date range
// ═══════════════════════════════════════════════════════════════════
router.get("/maintenance", async (req, res) => {
  const { ride_id, employee_id, priority, status, start_date, end_date, format } = req.query

  let conditions = []
  let params = []
  let idx = 1

  if (ride_id && ride_id !== '') {
    conditions.push(`m.ride_id = $${idx++}`);
    params.push(parseInt(ride_id))
  }
  if (employee_id && employee_id !== '') {
    conditions.push(`m.employee_id = $${idx++}`);
    params.push(parseInt(employee_id))
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
    // Get detail rows — 5-table JOIN: maintenance_requests + rides + employees + park_closures + notifications
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
        END AS hours_to_complete,
        pc.closure_type,
        pc.reason AS closure_reason,
        CASE WHEN pc.closure_id IS NOT NULL THEN true ELSE false END AS zone_was_closed,
        (SELECT COUNT(*) FROM notifications n
         WHERE n.related_table = 'maintenance_requests'
         AND n.related_id = m.request_id) AS alerts_sent,
        (SELECT COUNT(*) FROM notifications n
         WHERE n.related_table = 'maintenance_requests'
         AND n.related_id = m.request_id
         AND n.type = 'maintenance_critical') AS manager_alerts
      FROM maintenance_requests m
      JOIN rides r ON r.ride_id = m.ride_id
      LEFT JOIN employees e ON e.employee_id = m.employee_id
      LEFT JOIN LATERAL (
        SELECT pc2.closure_id, pc2.closure_type, pc2.reason
        FROM park_closures pc2
        WHERE pc2.zone = r.location
          AND pc2.started_at <= COALESCE(m.completed_at, NOW())
          AND COALESCE(pc2.ended_at, NOW()) >= m.created_at
        ORDER BY pc2.started_at DESC
        LIMIT 1
      ) pc ON true
      ${where}
      ORDER BY m.created_at DESC
    `, params)

    // Get summary per ride — 5-table JOIN
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
        COUNT(DISTINCT m.employee_id) AS distinct_employees,
        COUNT(m.request_id) FILTER (WHERE pc.closure_id IS NOT NULL) AS closure_related,
        SUM((SELECT COUNT(*) FROM notifications n2
             WHERE n2.related_table = 'maintenance_requests'
             AND n2.related_id = m.request_id)) AS total_alerts
      FROM maintenance_requests m
      JOIN rides r ON r.ride_id = m.ride_id
      LEFT JOIN LATERAL (
        SELECT pc2.closure_id
        FROM park_closures pc2
        WHERE pc2.zone = r.location
          AND pc2.started_at <= COALESCE(m.completed_at, NOW())
          AND COALESCE(pc2.ended_at, NOW()) >= m.created_at
        ORDER BY pc2.started_at DESC
        LIMIT 1
      ) pc ON true
      ${where}
      GROUP BY r.ride_name
      ORDER BY total_requests DESC
    `, params)

    // Get grand totals — 5-table JOIN
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
        COUNT(DISTINCT m.employee_id) AS distinct_employees,
        COUNT(m.request_id) FILTER (WHERE pc.closure_id IS NOT NULL) AS closure_related,
        SUM((SELECT COUNT(*) FROM notifications n2
             WHERE n2.related_table = 'maintenance_requests'
             AND n2.related_id = m.request_id)) AS total_alerts
      FROM maintenance_requests m
      JOIN rides r ON r.ride_id = m.ride_id
      LEFT JOIN LATERAL (
        SELECT pc2.closure_id
        FROM park_closures pc2
        WHERE pc2.zone = r.location
          AND pc2.started_at <= COALESCE(m.completed_at, NOW())
          AND COALESCE(pc2.ended_at, NOW()) >= m.created_at
        ORDER BY pc2.started_at DESC
        LIMIT 1
      ) pc ON true
      ${where}
    `, params)

    if (format === 'csv') {
      const csvHeaders = 'Request ID,Ride Name,Description,Priority,Status,Assigned To,Request Date,Completed At,Hours to Complete,Zone Closed,Closure Type,Alerts Sent\n'
      const csvRows = details.map(row =>
        `${row.request_id},"${row.ride_name}","${row.description}",${row.priority},${row.status},"${row.assigned_to}",${new Date(row.request_date).toLocaleDateString()},${row.completed_at ? new Date(row.completed_at).toLocaleDateString() : ''},${row.hours_to_complete || ''},${row.zone_was_closed ? 'Yes' : 'No'},"${row.closure_type || ''}",${row.alerts_sent}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({
      details, summary, totals: totals[0],
      tables_used: ["maintenance_requests", "rides", "employees", "park_closures", "notifications"]
    })
  } catch (err) {
    console.log("Report error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── REPORT 2: Ticket Sales (ticket_purchases + customers + ticket_types) ───
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
        COALESCE(tp.buyer_name, c.full_name, tp.cardholder_name, 'Guest') AS customer_name,
        COALESCE(tp.buyer_email, c.email, '') AS customer_email,
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
        ROUND(100.0 * SUM(tp.total_price) / NULLIF((SELECT SUM(total_price) FROM ticket_purchases), 0), 1) AS revenue_share_pct,
        ROUND(AVG(tp.total_price)::numeric, 2) AS avg_price,
        COUNT(DISTINCT c.customer_id) AS distinct_customers,
        COUNT(tp.purchase_id) AS total_transactions
      FROM ticket_purchases tp
      LEFT JOIN customers c ON c.customer_id = tp.customer_id
      ${where}
    `, params)

    if (format === 'csv') {
      const csvHeaders = 'Purchase ID,Customer,Email,Phone,Type,Category,Fast Pass,Adults,Children,Adult Price,Child Price,Total,Visit Date,Purchased\n'
      const csvRows = details.map(row =>
        `${row.purchase_id},"${row.customer_name}","${row.customer_email || ''}","${row.customer_phone || ''}","${row.ticket_type}","${row.ticket_category || ''}",${row.fast_pass || false},${row.adult_qty},${row.child_qty},${row.unit_price_adult},${row.unit_price_child},${row.total_price},${row.visit_date || ''},${new Date(row.purchase_date).toLocaleDateString()}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({
      details,
      byType,
      totals: totals[0],
      tables_used: ["ticket_purchases", "customers", "ticket_types"]
    })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════
// REPORT 3: Ride Operations Report
// Tables: ride_dispatches + rides + operator_assignments + employees + dispatch_rejections
// Filters: ride, operator (employee_id), date range
// Measures throughput (guests served, dispatches, cycle time), operator performance,
//   and dispatch-rejection rate (safety interlocks, height checks, etc.)
// ═══════════════════════════════════════════════════════════════════
router.get("/ride-operations", async (req, res) => {
  const { ride_id, employee_id, start_date, end_date, format } = req.query

  let conditions = []
  let params = []
  let idx = 1

  if (ride_id && ride_id !== '') { conditions.push(`d.ride_id = $${idx++}`); params.push(parseInt(ride_id)) }
  if (employee_id && employee_id !== '') { conditions.push(`d.operator_id = $${idx++}`); params.push(parseInt(employee_id)) }
  if (start_date && start_date !== '') { conditions.push(`d.dispatched_at >= $${idx++}`); params.push(start_date) }
  if (end_date && end_date !== '') { conditions.push(`d.dispatched_at <= $${idx++}`); params.push(end_date + "T23:59:59") }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

  // Rejection filter uses attempted_at + ride_id + operator_id fields
  let rejConditions = []
  let rejParams = []
  let rIdx = 1
  if (ride_id && ride_id !== '') { rejConditions.push(`dr.ride_id = $${rIdx++}`); rejParams.push(parseInt(ride_id)) }
  if (employee_id && employee_id !== '') { rejConditions.push(`dr.operator_id = $${rIdx++}`); rejParams.push(parseInt(employee_id)) }
  if (start_date && start_date !== '') { rejConditions.push(`dr.attempted_at >= $${rIdx++}`); rejParams.push(start_date) }
  if (end_date && end_date !== '') { rejConditions.push(`dr.attempted_at <= $${rIdx++}`); rejParams.push(end_date + "T23:59:59") }
  const rejWhere = rejConditions.length > 0 ? "WHERE " + rejConditions.join(" AND ") : ""

  try {
    // Detail rows — 4-table JOIN: ride_dispatches + rides + employees + operator_assignments
    const { rows: details } = await pool.query(`
      SELECT
        d.dispatch_id,
        d.dispatched_at,
        r.ride_name,
        r.location AS ride_zone,
        e.full_name AS operator_name,
        e.role AS operator_role,
        d.guest_count,
        d.cycle_duration_s,
        ROUND((d.cycle_duration_s / 60.0)::numeric, 2) AS cycle_duration_min,
        d.dispatch_notes,
        oa.started_at AS shift_started,
        oa.ended_at AS shift_ended
      FROM ride_dispatches d
      JOIN rides r ON r.ride_id = d.ride_id
      JOIN employees e ON e.employee_id = d.operator_id
      LEFT JOIN LATERAL (
        SELECT oa2.started_at, oa2.ended_at
        FROM operator_assignments oa2
        WHERE oa2.employee_id = d.operator_id
          AND oa2.ride_id = d.ride_id
          AND oa2.started_at <= d.dispatched_at
          AND (oa2.ended_at IS NULL OR oa2.ended_at >= d.dispatched_at)
        ORDER BY oa2.started_at DESC
        LIMIT 1
      ) oa ON true
      ${where}
      ORDER BY d.dispatched_at DESC
    `, params)

    // Summary per ride — throughput + rejection rate
    const { rows: summary } = await pool.query(`
      SELECT
        r.ride_name,
        r.location AS ride_zone,
        COUNT(d.dispatch_id) AS total_dispatches,
        COALESCE(SUM(d.guest_count), 0) AS total_guests_served,
        ROUND(AVG(d.guest_count)::numeric, 2) AS avg_guests_per_dispatch,
        ROUND(AVG(d.cycle_duration_s)::numeric, 1) AS avg_cycle_seconds,
        ROUND(MIN(d.cycle_duration_s)::numeric, 1) AS min_cycle_seconds,
        ROUND(MAX(d.cycle_duration_s)::numeric, 1) AS max_cycle_seconds,
        ROUND((SUM(d.cycle_duration_s) / 3600.0)::numeric, 2) AS total_operating_hours,
        COUNT(DISTINCT d.operator_id) AS distinct_operators,
        (SELECT COUNT(*) FROM dispatch_rejections dr WHERE dr.ride_id = r.ride_id
          ${start_date ? `AND dr.attempted_at >= '${start_date}'` : ''}
          ${end_date ? `AND dr.attempted_at <= '${end_date}T23:59:59'` : ''}
        ) AS rejection_count,
        ROUND(100.0 * (SELECT COUNT(*) FROM dispatch_rejections dr WHERE dr.ride_id = r.ride_id
          ${start_date ? `AND dr.attempted_at >= '${start_date}'` : ''}
          ${end_date ? `AND dr.attempted_at <= '${end_date}T23:59:59'` : ''}
        )::numeric / NULLIF(COUNT(d.dispatch_id) + (SELECT COUNT(*) FROM dispatch_rejections dr WHERE dr.ride_id = r.ride_id
          ${start_date ? `AND dr.attempted_at >= '${start_date}'` : ''}
          ${end_date ? `AND dr.attempted_at <= '${end_date}T23:59:59'` : ''}
        ), 0), 1) AS rejection_rate_pct
      FROM ride_dispatches d
      JOIN rides r ON r.ride_id = d.ride_id
      ${where}
      GROUP BY r.ride_id, r.ride_name, r.location
      ORDER BY total_guests_served DESC
    `, params)

    // Summary per operator — who ran the most
    const { rows: operatorSummary } = await pool.query(`
      SELECT
        e.full_name AS operator_name,
        e.role AS operator_role,
        COUNT(d.dispatch_id) AS dispatches_run,
        COALESCE(SUM(d.guest_count), 0) AS total_guests_served,
        ROUND(AVG(d.guest_count)::numeric, 2) AS avg_guests_per_dispatch,
        ROUND((SUM(d.cycle_duration_s) / 3600.0)::numeric, 2) AS total_operating_hours,
        COUNT(DISTINCT d.ride_id) AS distinct_rides_operated
      FROM ride_dispatches d
      JOIN employees e ON e.employee_id = d.operator_id
      ${where}
      GROUP BY e.employee_id, e.full_name, e.role
      ORDER BY dispatches_run DESC
    `, params)

    // Grand totals + rejection totals
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(d.dispatch_id) AS total_dispatches,
        COALESCE(SUM(d.guest_count), 0) AS total_guests_served,
        ROUND(AVG(d.guest_count)::numeric, 2) AS avg_guests_per_dispatch,
        ROUND(AVG(d.cycle_duration_s)::numeric, 1) AS avg_cycle_seconds,
        ROUND((SUM(d.cycle_duration_s) / 3600.0)::numeric, 2) AS total_operating_hours,
        COUNT(DISTINCT d.operator_id) AS distinct_operators,
        COUNT(DISTINCT d.ride_id) AS distinct_rides
      FROM ride_dispatches d
      ${where}
    `, params)

    const { rows: rejections } = await pool.query(`
      SELECT
        COUNT(*) AS total_rejections,
        COUNT(DISTINCT rejection_code) AS distinct_codes
      FROM dispatch_rejections dr
      ${rejWhere}
    `, rejParams)

    const totalsCombined = {
      ...totals[0],
      total_rejections: rejections[0]?.total_rejections ?? 0,
      rejection_rate_pct: totals[0].total_dispatches
        ? Math.round(1000 * Number(rejections[0]?.total_rejections ?? 0) /
          (Number(totals[0].total_dispatches) + Number(rejections[0]?.total_rejections ?? 0))) / 10
        : 0
    }

    if (format === 'csv') {
      const csvHeaders = 'Dispatch ID,Dispatched At,Ride,Zone,Operator,Role,Guests,Cycle (s),Cycle (min),Notes\n'
      const csvRows = details.map(row =>
        `${row.dispatch_id},${new Date(row.dispatched_at).toISOString()},"${row.ride_name}","${row.ride_zone}","${row.operator_name}","${row.operator_role}",${row.guest_count},${row.cycle_duration_s || ''},${row.cycle_duration_min || ''},"${(row.dispatch_notes || '').replace(/"/g, '""')}"`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({
      details,
      summary,
      operatorSummary,
      totals: totalsCombined,
      tables_used: ["ride_dispatches", "rides", "employees", "operator_assignments", "dispatch_rejections"]
    })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
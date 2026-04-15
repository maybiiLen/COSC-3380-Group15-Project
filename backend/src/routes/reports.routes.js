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
    // NEW: labor_cost (hours × hourly_rate), elapsed_hours for in-progress tasks
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
        END AS hours_to_complete,
        CASE
          WHEN m.status = 'In Progress'
          THEN ROUND(EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 3600, 1)
          ELSE NULL
        END AS elapsed_hours,
        CASE
          WHEN m.completed_at IS NOT NULL AND e.hourly_rate IS NOT NULL
          THEN ROUND((EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 * e.hourly_rate)::numeric, 2)
          ELSE NULL
        END AS labor_cost
      FROM employees e
      JOIN maintenance_requests m ON m.employee_id = e.employee_id
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
      ORDER BY m.created_at DESC
    `, params)

    // Summary per employee
    // NEW: hourly_rate, total_labor_cost, total_hours, workload_vs_avg
    const { rows: summary } = await pool.query(`
      SELECT
        e.employee_id,
        e.full_name AS employee_name,
        e.role AS employee_role,
        e.hourly_rate,
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
        ROUND(SUM(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS total_hours_worked,
        ROUND(SUM(
          CASE WHEN m.completed_at IS NOT NULL AND e.hourly_rate IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 * e.hourly_rate
          ELSE NULL END
        )::numeric, 2) AS total_labor_cost,
        COUNT(DISTINCT r.ride_id) AS rides_serviced,
        ROUND(COUNT(m.request_id)::numeric / NULLIF(
          (SELECT AVG(task_count) FROM (
            SELECT COUNT(*) AS task_count FROM maintenance_requests WHERE employee_id IS NOT NULL GROUP BY employee_id
          ) sub), 0), 2) AS workload_ratio
      FROM employees e
      JOIN maintenance_requests m ON m.employee_id = e.employee_id
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
      GROUP BY e.employee_id, e.full_name, e.role, e.hourly_rate
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
        ROUND(SUM(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS total_hours_worked,
        ROUND(SUM(
          CASE WHEN m.completed_at IS NOT NULL AND e.hourly_rate IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600 * e.hourly_rate
          ELSE NULL END
        )::numeric, 2) AS total_labor_cost,
        COUNT(DISTINCT r.ride_id) AS rides_serviced
      FROM employees e
      JOIN maintenance_requests m ON m.employee_id = e.employee_id
      JOIN rides r ON r.ride_id = m.ride_id
      ${where}
    `, params)

    if (format === 'csv') {
      const csvHeaders = 'Employee,Role,Hourly Rate,Ride,Zone,Task,Priority,Status,Assigned Date,Completed At,Hours to Complete,Elapsed Hours,Labor Cost\n'
      const csvRows = details.map(row =>
        `"${row.employee_name}","${row.employee_role}",${row.hourly_rate || ''},"${row.ride_name}","${row.ride_zone}","${row.task_description}","${row.priority}","${row.status}",${new Date(row.assigned_date).toLocaleDateString()},${row.completed_at ? new Date(row.completed_at).toLocaleDateString() : ''},${row.hours_to_complete || ''},${row.elapsed_hours || ''},${row.labor_cost || ''}`
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.send(csvHeaders + csvRows)
      return
    }

    res.json({
      details,
      summary,
      totals: totals[0],
      tables_used: ["employees", "maintenance_requests", "rides"]
    })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
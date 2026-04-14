const express = require("express")
const router = express.Router()
const pool = require("../config/db")

// ─── GET all maintenance requests (joined with ride + employee names) ───
// DATA QUERY 1: JOIN maintenance_requests with rides and employees
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        m.request_id,
        m.ride_id,
        r.ride_name,
        r.status       AS ride_status,
        m.employee_id,
        e.full_name     AS employee_name,
        m.description,
        m.priority,
        m.status,
        m.created_at,
        m.completed_at
      FROM maintenance_requests m
      JOIN rides r       ON r.ride_id = m.ride_id
      LEFT JOIN employees e ON e.employee_id = m.employee_id
      ORDER BY m.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET maintenance history for a specific ride ───
// DATA QUERY 2: Filter by ride with employee info + time tracking
router.get("/ride/:rideId", async (req, res) => {
  const { rideId } = req.params
  try {
    const { rows } = await pool.query(`
      SELECT
        m.request_id,
        m.description,
        m.priority,
        m.status,
        e.full_name     AS assigned_to,
        m.created_at,
        m.completed_at,
        CASE
          WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL
        END AS hours_to_complete
      FROM maintenance_requests m
      LEFT JOIN employees e ON e.employee_id = m.employee_id
      WHERE m.ride_id = $1
      ORDER BY m.created_at DESC
    `, [rideId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET maintenance summary report (count per ride grouped by status) ───
// DATA QUERY 3: Aggregate query with GROUP BY and JOIN
router.get("/report/summary", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.ride_id,
        r.ride_name,
        r.status AS current_ride_status,
        COUNT(m.request_id)                                          AS total_requests,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Pending')      AS pending,
        COUNT(m.request_id) FILTER (WHERE m.status = 'In Progress')  AS in_progress,
        COUNT(m.request_id) FILTER (WHERE m.status = 'Completed')    AS completed,
        ROUND(AVG(
          CASE WHEN m.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600
          ELSE NULL END
        )::numeric, 1) AS avg_hours_to_complete
      FROM rides r
      LEFT JOIN maintenance_requests m ON m.ride_id = r.ride_id
      GROUP BY r.ride_id, r.ride_name, r.status
      HAVING COUNT(m.request_id) > 0
      ORDER BY total_requests DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST create a new maintenance request ───
router.post("/", async (req, res) => {
  const { ride_id, employee_id, description, priority, status } = req.body

  try {
    const { rows } = await pool.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ride_id, employee_id || null, description, priority || "Medium", status || "Pending"]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── PUT update a maintenance request (status, priority, description) ───
router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { status, priority, description, employee_id } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE maintenance_requests
       SET status      = COALESCE($1, status),
           priority    = COALESCE($2, priority),
           description = COALESCE($3, description),
           employee_id = COALESCE($4, employee_id)
       WHERE request_id = $5
       RETURNING *`,
      [status, priority, description, employee_id || null, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Maintenance request not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── DELETE a maintenance request ───
router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      "DELETE FROM maintenance_requests WHERE request_id = $1 RETURNING *",
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: "Maintenance request not found" })
    }

    res.json({ message: "Maintenance request deleted" })
  } catch (err) {
    console.log("DB error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /escalate — Run time-based priority escalation (manual) ───
// Calls fn_escalate_stale_priorities with configurable thresholds (default 10s for demo)
// Triggers cascade: escalation → Trigger 1 (ride status) → Trigger 2 (notifications)
router.post("/escalate", async (req, res) => {
  const { threshold_seconds = 10 } = req.body
  try {
    const { rows } = await pool.query(
      `SELECT * FROM fn_escalate_stale_priorities($1, $1, $1)`,
      [threshold_seconds]
    )
    res.json({
      escalated: rows,
      count: rows.length,
      message: rows.length > 0
        ? `${rows.length} request(s) escalated`
        : "No requests needed escalation"
    })
  } catch (err) {
    console.log("Escalation error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════
// AUTO-ESCALATION SCHEDULER (simulates pg_cron at sub-minute intervals)
// ═══════════════════════════════════════════════════════════════════
// pg_cron's minimum interval is 1 minute. For demo purposes, this
// backend scheduler runs every N seconds (default 10). It calls the
// same fn_escalate_stale_priorities function that pg_cron would call
// in production. Each escalation fires through the existing trigger
// cascade: Trigger 1 (ride status) → Trigger 2 (manager alerts).
// ═══════════════════════════════════════════════════════════════════
let escalationTimer = null
let escalationLog = []

async function runAutoEscalation(thresholdSeconds) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM fn_escalate_stale_priorities($1, $1, $1)`,
      [thresholdSeconds]
    )
    const entry = {
      ran_at: new Date().toISOString(),
      escalated: rows,
      count: rows.length,
    }
    escalationLog.push(entry)
    if (escalationLog.length > 50) escalationLog.shift()
    if (rows.length > 0) {
      console.log(`[Auto-Escalation] ${rows.length} request(s) escalated:`,
        rows.map(r => `#${r.request_id} ${r.old_priority}→${r.new_priority}`).join(", "))
    }
  } catch (err) {
    console.log("[Auto-Escalation] Error:", err.message)
  }
}

// POST /escalate/auto-start — Start the automatic escalation scheduler
router.post("/escalate/auto-start", (req, res) => {
  const { interval_seconds = 10, threshold_seconds = 10 } = req.body

  if (escalationTimer) {
    return res.json({ running: true, message: "Auto-escalation is already running" })
  }

  escalationLog = []
  escalationTimer = setInterval(() => runAutoEscalation(threshold_seconds), interval_seconds * 1000)
  // Run once immediately
  runAutoEscalation(threshold_seconds)

  console.log(`[Auto-Escalation] Started — checking every ${interval_seconds}s with ${threshold_seconds}s threshold`)
  res.json({
    running: true,
    interval_seconds,
    threshold_seconds,
    message: `Auto-escalation started — checking every ${interval_seconds}s`
  })
})

// POST /escalate/auto-stop — Stop the automatic escalation scheduler
router.post("/escalate/auto-stop", (req, res) => {
  if (escalationTimer) {
    clearInterval(escalationTimer)
    escalationTimer = null
    console.log("[Auto-Escalation] Stopped")
  }
  res.json({ running: false, message: "Auto-escalation stopped", log: escalationLog })
})

// GET /escalate/auto-status — Check if auto-escalation is running + recent log
router.get("/escalate/auto-status", (req, res) => {
  res.json({
    running: !!escalationTimer,
    log: escalationLog,
  })
})

// ═══════════════════════════════════════════════════════════════════
// pg_cron MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════
// These endpoints manage the pg_cron scheduled job in the Neon
// database. pg_cron runs inside PostgreSQL itself — no external
// scheduler needed. Minimum interval is 1 minute.
//
// The job calls fn_escalate_stale_priorities() with production
// thresholds (3 days = 259200 seconds). For demo, the thresholds
// can be overridden when scheduling (e.g., 10 seconds).
// ═══════════════════════════════════════════════════════════════════

// POST /escalate/cron-start — Schedule pg_cron job
router.post("/escalate/cron-start", async (req, res) => {
  const { threshold_seconds = 10 } = req.body
  try {
    // Remove existing job if any
    await pool.query(`
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'escalate-stale-maintenance'
    `).catch(() => {})

    // Schedule new job — runs every 1 minute
    const { rows } = await pool.query(`
      SELECT cron.schedule(
        'escalate-stale-maintenance',
        '* * * * *',
        $1
      ) AS jobid
    `, [`SELECT * FROM fn_escalate_stale_priorities(${parseInt(threshold_seconds)}, ${parseInt(threshold_seconds)}, ${parseInt(threshold_seconds)})`])

    console.log(`[pg_cron] Scheduled job — every 1 min with ${threshold_seconds}s threshold`)
    res.json({
      running: true,
      jobid: rows[0]?.jobid,
      schedule: "* * * * *",
      threshold_seconds,
      message: `pg_cron job scheduled — runs every 1 minute with ${threshold_seconds}s threshold`
    })
  } catch (err) {
    console.log("[pg_cron] Schedule error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// POST /escalate/cron-stop — Unschedule pg_cron job
router.post("/escalate/cron-stop", async (req, res) => {
  try {
    await pool.query(`
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'escalate-stale-maintenance'
    `)
    console.log("[pg_cron] Job unscheduled")
    res.json({ running: false, message: "pg_cron job stopped" })
  } catch (err) {
    console.log("[pg_cron] Unschedule error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// GET /escalate/cron-status — Check pg_cron job status + recent run history
router.get("/escalate/cron-status", async (req, res) => {
  try {
    // Get job info
    const { rows: jobs } = await pool.query(`
      SELECT jobid, jobname, schedule, active
      FROM cron.job
      WHERE jobname = 'escalate-stale-maintenance'
    `)

    // Get recent run history
    const { rows: history } = await pool.query(`
      SELECT runid, job_id, status, return_message,
             start_time, end_time
      FROM cron.job_run_details
      WHERE job_id IN (
        SELECT jobid FROM cron.job WHERE jobname = 'escalate-stale-maintenance'
      )
      ORDER BY start_time DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }))

    res.json({
      running: jobs.length > 0 && jobs[0].active,
      job: jobs[0] || null,
      history,
    })
  } catch (err) {
    // pg_cron extension might not be available
    res.json({ running: false, job: null, history: [], error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════
// DISPATCH SAFETY ENVELOPE — Demo Endpoints
// ═══════════════════════════════════════════════════════════════════

// GET /dispatch/setup — Seed safety config on rides + insert a weather reading
// so the dispatch trigger has data to check against
router.get("/dispatch/setup", async (req, res) => {
  try {
    // Set safety envelope on all rides that don't have it yet
    await pool.query(`
      UPDATE rides SET
        max_cycles_per_hour = COALESCE(max_cycles_per_hour, 20),
        max_wind_mph = COALESCE(max_wind_mph, 35.00),
        min_lightning_miles = COALESCE(min_lightning_miles, 10.00),
        min_temp_f = COALESCE(min_temp_f, 35.00),
        max_temp_f = COALESCE(max_temp_f, 105.00),
        inspection_cycle_interval = COALESCE(inspection_cycle_interval, 1000),
        cycles_since_inspection = COALESCE(cycles_since_inspection, 0)
    `)

    // Get rides with their safety config
    const { rows: rides } = await pool.query(`
      SELECT ride_id, ride_name, status, is_operational,
             max_cycles_per_hour, max_wind_mph, min_lightning_miles,
             min_temp_f, max_temp_f, inspection_cycle_interval,
             cycles_since_inspection, min_height_in
      FROM rides ORDER BY ride_id
    `)

    // Get latest weather
    const { rows: weather } = await pool.query(`
      SELECT * FROM weather_readings ORDER BY recorded_at DESC LIMIT 1
    `)

    // Get active operator assignments
    const { rows: operators } = await pool.query(`
      SELECT oa.*, e.full_name FROM operator_assignments oa
      JOIN employees e ON e.employee_id = oa.employee_id
      WHERE oa.ended_at IS NULL
      ORDER BY oa.assignment_id DESC
    `)

    // Get recent dispatches
    const { rows: dispatches } = await pool.query(`
      SELECT d.*, r.ride_name, e.full_name AS operator_name
      FROM ride_dispatches d
      JOIN rides r ON r.ride_id = d.ride_id
      JOIN employees e ON e.employee_id = d.operator_id
      ORDER BY d.dispatched_at DESC LIMIT 10
    `)

    // Get recent rejections
    const { rows: rejections } = await pool.query(`
      SELECT dr.*, r.ride_name FROM dispatch_rejections dr
      JOIN rides r ON r.ride_id = dr.ride_id
      ORDER BY dr.attempted_at DESC LIMIT 10
    `)

    res.json({ rides, weather: weather[0] || null, operators, dispatches, rejections })
  } catch (err) {
    console.log("Dispatch setup error:", err.message)
    res.status(500).json({ message: err.message })
  }
})

// POST /dispatch/weather — Insert or update current weather reading
router.post("/dispatch/weather", async (req, res) => {
  const { wind_speed_mph, lightning_miles, temperature_f, precipitation } = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO weather_readings (wind_speed_mph, lightning_miles, temperature_f, precipitation)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [wind_speed_mph || 5, lightning_miles || 50, temperature_f || 75, precipitation || 'None'])
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /dispatch/assign-operator — Assign an employee to a ride as operator
router.post("/dispatch/assign-operator", async (req, res) => {
  const { employee_id, ride_id } = req.body
  try {
    // End any existing assignment for this operator on this ride
    await pool.query(`
      UPDATE operator_assignments SET ended_at = NOW()
      WHERE employee_id = $1 AND ride_id = $2 AND ended_at IS NULL
    `, [employee_id, ride_id])

    const { rows } = await pool.query(`
      INSERT INTO operator_assignments (employee_id, ride_id)
      VALUES ($1, $2) RETURNING *
    `, [employee_id, ride_id])
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /dispatch/attempt — Try to dispatch a ride (fires the trigger!)
router.post("/dispatch/attempt", async (req, res) => {
  const { ride_id, operator_id, guest_count } = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO ride_dispatches (ride_id, operator_id, guest_count)
      VALUES ($1, $2, $3) RETURNING *
    `, [ride_id, operator_id, guest_count || 1])
    res.json({ success: true, dispatch: rows[0], message: "Dispatch approved — all 7 safety gates passed" })
  } catch (err) {
    // The trigger raises an exception on rejection — parse it
    const match = err.message.match(/Dispatch rejected: (\S+) — (.+)/)
    const rejection_code = match ? match[1] : 'UNKNOWN'
    const rejection_detail = match ? match[2] : err.message

    // Get the logged rejection for full context
    const { rows: rejections } = await pool.query(`
      SELECT * FROM dispatch_rejections
      WHERE ride_id = $1
      ORDER BY attempted_at DESC LIMIT 1
    `, [ride_id]).catch(() => ({ rows: [] }))

    res.status(409).json({
      success: false,
      rejection_code,
      rejection_detail,
      context: rejections[0]?.context_data || null,
      message: `Dispatch BLOCKED: ${rejection_detail}`
    })
  }
})

// GET /dispatch/rejections — Get recent rejection log
router.get("/dispatch/rejections", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT dr.*, r.ride_name, e.full_name AS operator_name
      FROM dispatch_rejections dr
      JOIN rides r ON r.ride_id = dr.ride_id
      LEFT JOIN employees e ON e.employee_id = dr.operator_id
      ORDER BY dr.attempted_at DESC LIMIT 20
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════
// EVENT ROUTING — Monitoring Endpoints
// ═══════════════════════════════════════════════════════════════════

// GET /event-routing/status — Full dashboard data for the event routing panel
router.get("/event-routing/status", async (req, res) => {
  try {
    const [incidents, sms, emails, interlocks] = await Promise.all([
      pool.query(`
        SELECT it.*, r.ride_name
        FROM incident_tracking it
        JOIN rides r ON r.ride_id = it.ride_id
        ORDER BY it.created_at DESC LIMIT 20
      `),
      pool.query(`
        SELECT * FROM sms_queue ORDER BY queued_at DESC LIMIT 20
      `),
      pool.query(`
        SELECT * FROM email_queue ORDER BY queued_at DESC LIMIT 20
      `),
      pool.query(`
        SELECT ri.*, r1.ride_name AS ride_name, r2.ride_name AS blocking_ride_name
        FROM ride_interlocks ri
        JOIN rides r1 ON r1.ride_id = ri.ride_id
        JOIN rides r2 ON r2.ride_id = ri.blocking_ride_id
        ORDER BY ri.interlock_id
      `)
    ])
    res.json({
      incidents: incidents.rows,
      sms_queue: sms.rows,
      email_queue: emails.rows,
      interlocks: interlocks.rows,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /event-routing/clear — Clear all queues (for demo reset)
router.post("/event-routing/clear", async (req, res) => {
  try {
    await Promise.all([
      pool.query("DELETE FROM sms_queue"),
      pool.query("DELETE FROM email_queue"),
      pool.query("DELETE FROM incident_tracking"),
    ])
    res.json({ message: "All event routing queues cleared" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
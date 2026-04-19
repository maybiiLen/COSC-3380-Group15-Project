/**
 * Trigger + cascade logic test
 * ─────────────────────────────
 * Runs inside a single transaction and ROLLS BACK at the end, so nothing
 * persists to the DB. Exercises all three triggers:
 *
 *   1. trg_route_maintenance_event        → notifications + auto-close ride
 *   2. trg_guard_ride_reopen              → blocks reopen (maintenance OR zone)
 *   3. trg_guard_employee_deactivation    → blocks deactivate with open work
 *   4. trg_park_closure_cascade           → cascades zone closure to rides
 *
 * Run from backend/ :
 *   node test/triggers-test.js
 */

require("dotenv").config()
const pool = require("../src/config/db")

let passed = 0
let failed = 0

function pass(label) { passed++; console.log(`  ✅ ${label}`) }
function fail(label, detail) { failed++; console.log(`  ❌ ${label}\n     ${detail}`) }

async function tryQuery(client, sql, params) {
  try {
    return { ok: true, result: await client.query(sql, params) }
  } catch (err) {
    return { ok: false, error: err }
  }
}

async function run() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // ── Preflight: confirm all expected triggers exist ──────────────
    console.log("\n▶ Preflight: trigger presence")
    const { rows: trgs } = await client.query(
      `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
       AND tgname IN ('trg_route_maintenance_event', 'trg_guard_ride_reopen',
                      'trg_guard_employee_deactivation', 'trg_park_closure_cascade')
       ORDER BY tgname`
    )
    const names = trgs.map(r => r.tgname)
    for (const t of ['trg_guard_employee_deactivation', 'trg_guard_ride_reopen',
                     'trg_park_closure_cascade', 'trg_route_maintenance_event']) {
      if (names.includes(t)) pass(`${t} present`)
      else fail(`${t} missing`, "Have you run `npm run migrate` after the last changes?")
    }
    if (failed > 0) throw new Error("Preflight failed — stop here, run migration first.")

    // ── Pick a ride + manager to test with ──────────────────────────
    const { rows: rides } = await client.query(
      `SELECT ride_id, ride_name, location FROM rides
       WHERE is_operational = true AND status = 'Operational' LIMIT 1`
    )
    if (!rides.length) throw new Error("No Operational ride available to test.")
    const ride = rides[0]
    console.log(`\n▶ Using ride #${ride.ride_id} "${ride.ride_name}" (zone: ${ride.location})`)

    const { rows: mgrs } = await client.query(
      `SELECT employee_id FROM employees WHERE role = 'manager' AND is_active = true LIMIT 1`
    )
    const managerId = mgrs.length ? mgrs[0].employee_id : null

    // ══════════════════════════════════════════════════════════════════
    // TEST 1 — Critical maintenance closes the ride + sends notification
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 1 — Critical maintenance cascade")
    await client.query(
      `INSERT INTO maintenance_requests (ride_id, description, priority, status, employee_id)
       VALUES ($1, '[TEST] Broken harness sensor', 'Critical', 'Pending', NULL)`,
      [ride.ride_id]
    )
    const { rows: after1 } = await client.query(
      `SELECT status FROM rides WHERE ride_id = $1`, [ride.ride_id]
    )
    if (after1[0].status === "Closed") pass("Ride auto-closed on Critical request")
    else fail("Ride did NOT auto-close", `Expected 'Closed', got '${after1[0].status}'`)

    const { rows: notifs1 } = await client.query(
      `SELECT COUNT(*)::int AS n FROM notifications
       WHERE related_table = 'maintenance_requests'
         AND type = 'critical_alert'`
    )
    if (notifs1[0].n > 0) pass(`Notification sent (${notifs1[0].n} critical_alert row(s))`)
    else fail("No critical_alert notification created", "fn_route_maintenance_event didn't branch")

    // ══════════════════════════════════════════════════════════════════
    // TEST 2 — Can't manually reopen a ride with pending Critical work
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 2 — Reopen blocked by maintenance guard")
    const reopenAttempt = await tryQuery(client,
      `UPDATE rides SET status = 'Operational' WHERE ride_id = $1`, [ride.ride_id]
    )
    if (!reopenAttempt.ok && /RR001|Critical/.test(reopenAttempt.error.message)) {
      pass(`Guard rejected reopen: "${reopenAttempt.error.message.slice(0, 80)}…"`)
    } else if (reopenAttempt.ok) {
      fail("Guard did NOT reject reopen", "Ride flipped to Operational with pending Critical work")
    } else {
      fail("Rejected but with unexpected error", reopenAttempt.error.message)
    }
    // The failed UPDATE poisons the transaction, so clear to a fresh subtransaction
    await client.query("ROLLBACK")
    await client.query("BEGIN")
    // Re-stage: ride closed, critical request open
    await client.query(
      `INSERT INTO maintenance_requests (ride_id, description, priority, status, employee_id)
       VALUES ($1, '[TEST] Reopen-block stage', 'Critical', 'Pending', NULL)`,
      [ride.ride_id]
    )

    // ══════════════════════════════════════════════════════════════════
    // TEST 3 — Complete the maintenance → reopen works
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 3 — Reopen allowed after maintenance completed")
    await client.query(
      `UPDATE maintenance_requests SET status = 'Completed'
       WHERE ride_id = $1 AND status != 'Completed'`, [ride.ride_id]
    )
    const reopenOk = await tryQuery(client,
      `UPDATE rides SET status = 'Operational' WHERE ride_id = $1`, [ride.ride_id]
    )
    if (reopenOk.ok) pass("Reopen succeeded once blockers cleared")
    else fail("Reopen still blocked", reopenOk.error.message)

    // ══════════════════════════════════════════════════════════════════
    // TEST 4 — Zone closure cascade closes rides in the zone
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 4 — Park closure cascade (INSERT)")
    // Count Operational rides in zone *before* the closure
    const { rows: beforeZone } = await client.query(
      `SELECT COUNT(*)::int AS n FROM rides
       WHERE location = $1 AND status = 'Operational' AND is_operational = true`,
      [ride.location]
    )
    const { rows: newClosure } = await client.query(
      `INSERT INTO park_closures (zone, reason, closure_type, is_active)
       VALUES ($1, '[TEST] weather', 'Weather', true) RETURNING closure_id`,
      [ride.location]
    )
    const closureId = newClosure[0].closure_id
    const { rows: afterZone } = await client.query(
      `SELECT COUNT(*)::int AS n FROM rides
       WHERE location = $1 AND status = 'Operational' AND is_operational = true`,
      [ride.location]
    )
    if (afterZone[0].n === 0 && beforeZone[0].n > 0) {
      pass(`Closed all ${beforeZone[0].n} Operational ride(s) in zone ${ride.location}`)
    } else if (beforeZone[0].n === 0) {
      pass("(No Operational rides in zone to cascade — trivially passed)")
    } else {
      fail("Cascade did NOT close all rides",
           `${afterZone[0].n} rides still Operational after closure`)
    }

    // ══════════════════════════════════════════════════════════════════
    // TEST 5 — Reopen blocked by active zone closure
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 5 — Reopen blocked by active zone closure")
    const reopenInClosed = await tryQuery(client,
      `UPDATE rides SET status = 'Operational' WHERE ride_id = $1`, [ride.ride_id]
    )
    if (!reopenInClosed.ok && /RR002|zone/.test(reopenInClosed.error.message)) {
      pass(`Guard rejected reopen: "${reopenInClosed.error.message.slice(0, 80)}…"`)
    } else if (reopenInClosed.ok) {
      fail("Guard did NOT reject reopen", "Ride reopened while zone closure was active")
    } else {
      fail("Rejected but not for zone reason", reopenInClosed.error.message)
    }
    await client.query("ROLLBACK")
    await client.query("BEGIN")

    // ══════════════════════════════════════════════════════════════════
    // TEST 6 — Deactivate closure → rides reopen (unless blocked)
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 6 — Lifting closure reopens rides")
    // Re-stage a closure
    const { rows: c2 } = await client.query(
      `INSERT INTO park_closures (zone, reason, closure_type, is_active)
       VALUES ($1, '[TEST] stage-6', 'Weather', true) RETURNING closure_id`,
      [ride.location]
    )
    // Add a maintenance-blocked peer ride (optional) — if another ride in zone
    // exists with pending critical, it should STAY closed after lift.
    const { rows: peers } = await client.query(
      `SELECT ride_id FROM rides
       WHERE location = $1 AND ride_id <> $2 AND is_operational = true LIMIT 1`,
      [ride.location, ride.ride_id]
    )
    let peerId = null
    if (peers.length) {
      peerId = peers[0].ride_id
      await client.query(
        `INSERT INTO maintenance_requests (ride_id, description, priority, status)
         VALUES ($1, '[TEST] peer blocker', 'Critical', 'Pending')`,
        [peerId]
      )
    }
    // Lift
    await client.query(
      `UPDATE park_closures SET is_active = false, ended_at = NOW() WHERE closure_id = $1`,
      [c2[0].closure_id]
    )
    const { rows: target } = await client.query(
      `SELECT status FROM rides WHERE ride_id = $1`, [ride.ride_id]
    )
    if (target[0].status === "Operational") pass("Test ride reopened after lift")
    else fail("Test ride did not reopen", `status='${target[0].status}'`)

    if (peerId) {
      const { rows: peerStatus } = await client.query(
        `SELECT status FROM rides WHERE ride_id = $1`, [peerId]
      )
      if (peerStatus[0].status === "Closed") {
        pass("Peer ride with pending Critical maintenance stayed Closed (guard enforced)")
      } else {
        fail("Peer ride reopened despite pending Critical maintenance",
             `status='${peerStatus[0].status}'`)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // TEST 7 — Employee deactivation guard
    // ══════════════════════════════════════════════════════════════════
    console.log("\n▶ Test 7 — Employee deactivation guard")
    if (!managerId) {
      console.log("  ⚠️  Skipped — no manager employee available")
    } else {
      // Give the manager an open task
      await client.query(
        `INSERT INTO maintenance_requests (ride_id, description, priority, status, employee_id)
         VALUES ($1, '[TEST] open task', 'Medium', 'Pending', $2)`,
        [ride.ride_id, managerId]
      )
      const deactivate = await tryQuery(client,
        `UPDATE employees SET is_active = false WHERE employee_id = $1`, [managerId]
      )
      if (!deactivate.ok && /ED001|ED002|open maintenance|assigned/.test(deactivate.error.message)) {
        pass(`Guard rejected deactivation: "${deactivate.error.message.slice(0, 80)}…"`)
      } else if (deactivate.ok) {
        fail("Guard did NOT reject deactivation", "Employee deactivated with open work")
      } else {
        fail("Rejected but with unexpected error", deactivate.error.message)
      }
    }

    // ── Wrap up ─────────────────────────────────────────────────────
    await client.query("ROLLBACK")
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  ${passed} passed · ${failed} failed`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    process.exit(failed > 0 ? 1 : 0)
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}
    console.error("\n✗ Test harness error:", err.message)
    process.exit(1)
  } finally {
    client.release()
  }
}

run()

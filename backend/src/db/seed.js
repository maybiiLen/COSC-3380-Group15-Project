require("dotenv").config();
const pool = require("../config/db");

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── RIDES (keep existing, add more) ──
    await client.query(`
      INSERT INTO rides (ride_name, capacity_per_cycle, min_height_in, location, status, wait_time)
      VALUES
        ('Cougar Express',      32, 48, 'Zone A', 'Operational',  25),
        ('Thunder Canyon',      24, 54, 'Zone B', 'Operational',  40),
        ('Sky Screamer',        16, 60, 'Zone A', 'Operational',  55),
        ('Wild River Rapids',   20, 42, 'Zone C', 'Operational',  30),
        ('Galactic Spinner',    28, 36, 'Zone B', 'Maintenance',  0),
        ('Mini Coaster',        40, 0,  'Zone D', 'Operational',  15),
        ('Ferris Wheel',        48, 0,  'Zone D', 'Operational',  10),
        ('Haunted Mansion',     12, 48, 'Zone C', 'Operational',  35),
        ('Bumper Cars',         30, 36, 'Zone D', 'Operational',  20),
        ('Drop Tower',          8,  54, 'Zone A', 'Closed',       0)
      ON CONFLICT DO NOTHING
    `);

    // ── TICKET TYPES ──
    await client.query(`
      INSERT INTO ticket_types (type_name, type_price)
      VALUES
        ('General Admission',  49.99),
        ('Fast Pass',          89.99),
        ('Child (Under 12)',   29.99),
        ('Senior (65+)',       34.99),
        ('Season Pass',       199.99),
        ('VIP Experience',    149.99)
      ON CONFLICT DO NOTHING
    `);

    // ── CUSTOMERS ──
    await client.query(`
      INSERT INTO customers (full_name, email, phone, date_of_birth)
      VALUES
        ('Maria Garcia',     'maria.garcia@email.com',     8325551001, '1990-05-14'),
        ('James Wilson',     'james.wilson@email.com',     7135552002, '1985-11-22'),
        ('Sarah Johnson',   'sarah.johnson@email.com',    2815553003, '1998-03-08'),
        ('Michael Brown',   'michael.brown@email.com',    8325554004, '1975-07-30'),
        ('Emily Davis',     'emily.davis@email.com',      7135555005, '2001-12-15'),
        ('Robert Martinez', 'robert.martinez@email.com',  2815556006, '1992-09-03'),
        ('Jennifer Lee',    'jennifer.lee@email.com',     8325557007, '1988-01-25'),
        ('David Anderson',  'david.anderson@email.com',   7135558008, '2005-06-11'),
        ('Lisa Thomas',     'lisa.thomas@email.com',      2815559009, '1995-04-19'),
        ('Chris Taylor',    'chris.taylor@email.com',     8325550010, '2008-08-07')
      ON CONFLICT DO NOTHING
    `);

    // ── EMPLOYEES ──
    await client.query(`
      INSERT INTO employees (full_name, email, role, hourly_rate)
      VALUES
        ('John Smith',       'john.smith@cougarride.com',      'manager',  28.00),
        ('Ana Rodriguez',    'ana.rodriguez@cougarride.com',   'staff',    18.50),
        ('Kevin Park',       'kevin.park@cougarride.com',      'staff',    17.00),
        ('Diana Chen',       'diana.chen@cougarride.com',      'staff',    18.50),
        ('Marcus Jones',     'marcus.jones@cougarride.com',    'manager',  26.00),
        ('Priya Patel',      'priya.patel@cougarride.com',     'staff',    17.50),
        ('Tyler Adams',      'tyler.adams@cougarride.com',     'staff',    16.50),
        ('Rachel Green',     'rachel.green@cougarride.com',    'staff',    18.00)
      ON CONFLICT DO NOTHING
    `);

    // ── Get IDs for FK references ──
    const { rows: rideRows } = await client.query("SELECT ride_id, ride_name FROM rides ORDER BY ride_id");
    const { rows: custRows } = await client.query("SELECT customer_id FROM customers ORDER BY customer_id");
    const { rows: ttRows } = await client.query("SELECT ticket_type_id, type_name FROM ticket_types ORDER BY ticket_type_id");
    const { rows: empRows } = await client.query("SELECT employee_id FROM employees ORDER BY employee_id");

    if (rideRows.length === 0 || custRows.length === 0 || ttRows.length === 0) {
      throw new Error("Base tables are empty — cannot seed dependent tables");
    }

    // ── TICKETS (one per customer, various types) ──
    const ticketTypeAssignments = [0, 1, 2, 0, 5, 3, 4, 2, 1, 0]; // index into ttRows
    for (let i = 0; i < custRows.length; i++) {
      const ttIndex = ticketTypeAssignments[i] < ttRows.length ? ticketTypeAssignments[i] : 0;
      await client.query(
        "INSERT INTO tickets (customer_id, ticket_type_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [custRows[i].customer_id, ttRows[ttIndex].ticket_type_id]
      );
    }

    const { rows: ticketRows } = await client.query("SELECT ticket_id, customer_id FROM tickets ORDER BY ticket_id");

    // ── VISITS (one per ticket) ──
    const visitDates = [
      ['2026-03-10 09:00', '2026-03-10 18:30'],
      ['2026-03-12 10:15', '2026-03-12 20:00'],
      ['2026-03-14 08:30', '2026-03-14 17:45'],
      ['2026-03-15 11:00', '2026-03-15 19:15'],
      ['2026-03-17 09:45', '2026-03-17 21:00'],
      ['2026-03-18 10:00', '2026-03-18 16:30'],
      ['2026-03-20 08:00', '2026-03-20 20:45'],
      ['2026-03-21 12:00', '2026-03-21 18:00'],
      ['2026-03-23 09:30', '2026-03-23 19:30'],
      ['2026-03-25 10:00', '2026-03-25 17:00'],
    ];
    for (let i = 0; i < ticketRows.length && i < visitDates.length; i++) {
      await client.query(
        "INSERT INTO visits (customer_id, ticket_id, entry_time, exit_time) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [ticketRows[i].customer_id, ticketRows[i].ticket_id, visitDates[i][0], visitDates[i][1]]
      );
    }

    const { rows: visitRows } = await client.query("SELECT visit_id, customer_id FROM visits ORDER BY visit_id");

    // ── RIDE USAGE (multiple rides per visit) ──
    const usageData = [];
    for (let v = 0; v < visitRows.length; v++) {
      // Each visitor rides 3-6 rides
      const numRides = 3 + Math.floor(Math.random() * 4);
      const usedRides = new Set();
      for (let r = 0; r < numRides && r < rideRows.length; r++) {
        let rideIdx;
        do { rideIdx = Math.floor(Math.random() * rideRows.length); } while (usedRides.has(rideIdx));
        usedRides.add(rideIdx);
        const waitTime = (Math.floor(Math.random() * 12) + 1) * 5;
        const fastPass = Math.random() < 0.25;
        usageData.push([
          rideRows[rideIdx].ride_id,
          visitRows[v].customer_id,
          visitRows[v].visit_id,
          waitTime,
          fastPass
        ]);
      }
    }
    for (const u of usageData) {
      await client.query(
        "INSERT INTO ride_usage (ride_id, customer_id, visit_id, wait_time, fast_pass) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
        u
      );
    }

    // ── STRIPE (payments for tickets) ──
    for (let i = 0; i < ticketRows.length; i++) {
      const ttIndex = ticketTypeAssignments[i] < ttRows.length ? ticketTypeAssignments[i] : 0;
      await client.query(
        "INSERT INTO stripe (customer_id, payment_amount, payment_date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [
          ticketRows[i].customer_id,
          ttRows[ttIndex].type_price || 49.99,
          visitDates[i] ? visitDates[i][0].split(' ')[1] : '10:00:00'
        ]
      );
    }

    // ── MAINTENANCE REQUESTS (add more variety) ──
    const maintenanceData = [
      [rideRows[1]?.ride_id, empRows[0]?.employee_id, 'Annual safety inspection — hydraulic system check', 'High', 'Completed'],
      [rideRows[2]?.ride_id, empRows[1]?.employee_id, 'Loose bolt detected on track segment B3', 'Critical', 'In Progress'],
      [rideRows[4]?.ride_id, empRows[2]?.employee_id, 'Motor overheating during peak hours', 'High', 'In Progress'],
      [rideRows[0]?.ride_id, empRows[3]?.employee_id, 'Routine lubrication of chain mechanism', 'Low', 'Completed'],
      [rideRows[6]?.ride_id, empRows[1]?.employee_id, 'LED lighting replacement on gondolas', 'Medium', 'Pending'],
      [rideRows[3]?.ride_id, empRows[4]?.employee_id, 'Water pump malfunction — reduced flow rate', 'High', 'Pending'],
      [rideRows[7]?.ride_id, empRows[5]?.employee_id, 'Animatronic figure stuck in scene 4', 'Medium', 'Completed'],
      [rideRows[9]?.ride_id, empRows[0]?.employee_id, 'Structural fatigue assessment required', 'Critical', 'In Progress'],
      [rideRows[1]?.ride_id, empRows[2]?.employee_id, 'Restraint harness sensor calibration', 'High', 'Completed'],
      [rideRows[5]?.ride_id, empRows[6]?.employee_id, 'Repaint and cosmetic touch-up', 'Low', 'Pending'],
    ];
    for (const m of maintenanceData) {
      if (m[0] && m[1]) {
        await client.query(
          "INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status) VALUES ($1, $2, $3, $4, $5)",
          m
        );
      }
    }

    await client.query("COMMIT");
    console.log("\nSeed complete! Data inserted into:");
    console.log("  - rides, customers, employees");
    console.log("  - ticket_types, tickets, visits");
    console.log("  - ride_usage, stripe");
    console.log("  - maintenance_requests");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
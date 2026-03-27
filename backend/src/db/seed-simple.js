require("dotenv").config();
const pool = require("../config/db");

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Clear existing data (optional - be careful!)
    // await client.query("DELETE FROM maintenance_requests");
    // await client.query("DELETE FROM rides WHERE ride_id > 1"); // Keep first ride

    // ── ADD MORE RIDES ──
    await client.query(`
      INSERT INTO rides (ride_name, capacity_per_cycle, min_height_in, location, status, wait_time)
      VALUES
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

    // Get ride and employee IDs for maintenance requests
    const { rows: rideRows } = await client.query("SELECT ride_id, ride_name FROM rides ORDER BY ride_id");
    const { rows: empRows } = await client.query("SELECT employee_id FROM employees ORDER BY employee_id LIMIT 5");

    // ── ADD MAINTENANCE REQUESTS ──
    if (empRows.length > 0 && rideRows.length > 0) {
      const maintenanceData = [
        [rideRows[1]?.ride_id, empRows[0]?.employee_id, 'Annual safety inspection — hydraulic system check', 'High', 'Completed'],
        [rideRows[2]?.ride_id, empRows[1]?.employee_id, 'Loose bolt detected on track segment B3', 'Critical', 'In Progress'],
        [rideRows[4]?.ride_id, empRows[2]?.employee_id, 'Motor overheating during peak hours', 'High', 'In Progress'],
        [rideRows[0]?.ride_id, empRows[0]?.employee_id, 'Routine lubrication of chain mechanism', 'Low', 'Completed'],
        [rideRows[6]?.ride_id, empRows[1]?.employee_id, 'LED lighting replacement on gondolas', 'Medium', 'Pending'],
        [rideRows[3]?.ride_id, empRows[2]?.employee_id, 'Water pump malfunction — reduced flow rate', 'High', 'Pending'],
      ];

      for (const m of maintenanceData) {
        if (m[0] && m[1]) {
          try {
            await client.query(
              "INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status) VALUES ($1, $2, $3, $4, $5)",
              m
            );
          } catch (err) {
            console.log(`Skipping maintenance request: ${err.message}`);
          }
        }
      }
    }

    await client.query("COMMIT");
    console.log("\nSimple seed complete! Data inserted into:");
    console.log("  - rides (additional rides added)");
    console.log("  - maintenance_requests (sample data added)");

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
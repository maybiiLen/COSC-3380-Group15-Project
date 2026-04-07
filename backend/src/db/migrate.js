require("dotenv").config();
const pool = require("../config/db");

const migrations = [
  {
    name: "001_create_users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          VARCHAR(50) NOT NULL DEFAULT 'staff',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: "002_create_refresh_tokens",
    sql: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          SERIAL PRIMARY KEY,
        family_id   UUID NOT NULL,
        token_hash  TEXT NOT NULL UNIQUE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        used        BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
    `,
  },
  {
    name: "003_add_user_id_to_customers",
    sql: `
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    `,
  },
  {
    name: "004_add_user_id_to_employees",
    sql: `
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
    `,
  },
  {
    name: "005_customers_phone_to_bigint",
    sql: `ALTER TABLE customers ALTER COLUMN phone TYPE BIGINT;`,
  },
  {
    name: "006_widen_customers_varchar_columns",
    sql: `
      ALTER TABLE customers ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE customers ALTER COLUMN full_name TYPE VARCHAR(255);
    `,
  },
  {
    name: "007_widen_employees_varchar_columns",
    sql: `
      ALTER TABLE employees ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE employees ALTER COLUMN full_name TYPE VARCHAR(255);
    `,
  },
  {
    name: "008_create_maintenance_requests",
    sql: `
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        request_id    SERIAL PRIMARY KEY,
        ride_id       INTEGER NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
        employee_id   INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
        description   TEXT NOT NULL,
        priority      VARCHAR(20) NOT NULL DEFAULT 'Medium'
                      CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
        status        VARCHAR(20) NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending', 'In Progress', 'Completed')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at  TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_maintenance_ride_id ON maintenance_requests(ride_id);
      CREATE INDEX IF NOT EXISTS idx_maintenance_status  ON maintenance_requests(status);
    `,
  },
  {
    name: "009_trigger_ride_status_on_maintenance",
    sql: `
      -- TRIGGER 1: Auto-update ride status based on maintenance request status
      -- When a maintenance request is set to 'In Progress', the ride goes to 'Maintenance'
      -- When all maintenance requests for a ride are 'Completed', the ride goes back to 'Operational'
      CREATE OR REPLACE FUNCTION fn_update_ride_status_on_maintenance()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'In Progress' THEN
          UPDATE rides SET status = 'Maintenance' WHERE ride_id = NEW.ride_id;
        ELSIF NEW.status = 'Completed' THEN
          -- Only set ride back to Operational if no other active requests exist
          IF NOT EXISTS (
            SELECT 1 FROM maintenance_requests
            WHERE ride_id = NEW.ride_id
              AND status IN ('Pending', 'In Progress')
              AND request_id != NEW.request_id
          ) THEN
            UPDATE rides SET status = 'Operational' WHERE ride_id = NEW.ride_id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_ride_status_on_maintenance
      AFTER INSERT OR UPDATE OF status ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_update_ride_status_on_maintenance();
    `,
  },
  {
    name: "010_trigger_auto_completed_at",
    sql: `
      -- TRIGGER 2: Auto-set completed_at timestamp when status changes to 'Completed'
      -- Also clears completed_at if status is changed back from 'Completed'
      CREATE OR REPLACE FUNCTION fn_auto_set_completed_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'Completed' AND (OLD IS NULL OR OLD.status != 'Completed') THEN
          NEW.completed_at = NOW();
        ELSIF NEW.status != 'Completed' THEN
          NEW.completed_at = NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_auto_completed_at
      BEFORE INSERT OR UPDATE OF status ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_auto_set_completed_at();
    `,
  },
  {
    name: "011_add_is_operational_to_rides",
    sql: `
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_operational BOOLEAN NOT NULL DEFAULT true;
      -- Mark rides with status 'Closed' as non-operational
      UPDATE rides SET is_operational = false WHERE status = 'Closed';
    `,
  },
  {
    name: "012_create_ticket_purchases",
    sql: `
      CREATE TABLE IF NOT EXISTS ticket_purchases (
        purchase_id    SERIAL PRIMARY KEY,
        customer_id    INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
        user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ticket_type    VARCHAR(50) NOT NULL,
        adult_qty      INTEGER NOT NULL DEFAULT 0,
        child_qty      INTEGER NOT NULL DEFAULT 0,
        unit_price_adult  NUMERIC(10,2) NOT NULL,
        unit_price_child  NUMERIC(10,2) NOT NULL,
        total_price    NUMERIC(10,2) NOT NULL,
        visit_date     DATE,
        purchase_date  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_purchases_user_id ON ticket_purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_purchases_customer_id ON ticket_purchases(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_purchases_date ON ticket_purchases(purchase_date);
    `,
  },
  {
    name: "013_add_card_details_to_purchases",
    sql: `
      ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS card_last_four VARCHAR(4);
      ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS cardholder_name VARCHAR(255);
    `,
  },
];

const run = async () => {
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        run_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const migration of migrations) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE name = $1",
        [migration.name]
      );

      if (rows.length > 0) {
        console.log(`  skipped  ${migration.name}`);
        continue;
      }

      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [migration.name]);
      await client.query("COMMIT");
      console.log(`  applied  ${migration.name}`);
    }

    console.log("\nMigrations complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
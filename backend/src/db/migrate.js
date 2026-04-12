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
  {
    name: "014_drop_old_simple_triggers",
    sql: `
      -- Drop the old simple triggers to replace with complex ones
      DROP TRIGGER IF EXISTS trg_ride_status_on_maintenance ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_auto_completed_at ON maintenance_requests;
      DROP FUNCTION IF EXISTS fn_update_ride_status_on_maintenance();
      DROP FUNCTION IF EXISTS fn_auto_set_completed_at();
    `,
  },
  {
    name: "015_create_notifications_table",
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id   SERIAL PRIMARY KEY,
        recipient_role    VARCHAR(20),
        recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type              VARCHAR(50) NOT NULL,
        title             VARCHAR(255) NOT NULL,
        message           TEXT NOT NULL,
        related_table     VARCHAR(50),
        related_id        INTEGER,
        is_read           BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(recipient_role);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(recipient_user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
    `,
  },
  {
    name: "016_ensure_park_closures_schema",
    sql: `
      -- Ensure park_closures has the columns we need for Trigger 3
      -- If the table already exists with different columns, add what's missing
      CREATE TABLE IF NOT EXISTS park_closures (
        closure_id    SERIAL PRIMARY KEY,
        zone          VARCHAR(50) NOT NULL,
        reason        TEXT NOT NULL,
        closure_type  VARCHAR(30) NOT NULL DEFAULT 'Weather'
                      CHECK (closure_type IN ('Weather', 'Emergency', 'Safety', 'Maintenance', 'Event')),
        is_active     BOOLEAN NOT NULL DEFAULT true,
        started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at      TIMESTAMPTZ
      );
    `,
  },
  {
    name: "017_trigger_maintenance_safety_cascade",
    sql: `
      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 1: MAINTENANCE SAFETY CASCADE
      -- ═══════════════════════════════════════════════════════════════════
      -- Business constraint: A ride's operational status is governed by its
      -- maintenance state. This trigger enforces:
      --   1. When ANY maintenance request is created or goes 'In Progress',
      --      the ride MUST be set to 'Maintenance' status
      --   2. When a request is marked 'Completed', the ride can ONLY return
      --      to 'Operational' if ALL requests for that ride are resolved
      --   3. Critical priority requests immediately set the ride status AND
      --      set is_operational = false (hard safety lockout)
      --   4. completed_at timestamp is auto-managed (set on completion,
      --      cleared if status reverts)
      --
      -- ECA Model:
      --   Event:     BEFORE INSERT OR UPDATE OF status, priority ON maintenance_requests
      --   Condition: Check NEW.status and NEW.priority values
      --   Action:    UPDATE rides status/is_operational, SET completed_at
      --
      -- Tables affected: maintenance_requests (source), rides (target)
      -- SQL features: subquery with NOT EXISTS, CASE logic, OLD vs NEW comparison
      -- ═══════════════════════════════════════════════════════════════════

      CREATE OR REPLACE FUNCTION fn_maintenance_safety_cascade()
      RETURNS TRIGGER AS $$
      DECLARE
        v_ride_name    VARCHAR(255);
        v_open_count   INTEGER;
      BEGIN
        -- Auto-manage completed_at timestamp (replaces old Trigger 2)
        IF NEW.status = 'Completed' AND (OLD IS NULL OR OLD.status != 'Completed') THEN
          NEW.completed_at = NOW();
        ELSIF NEW.status != 'Completed' THEN
          NEW.completed_at = NULL;
        END IF;

        -- Get the ride name for context
        SELECT ride_name INTO v_ride_name FROM rides WHERE ride_id = NEW.ride_id;

        -- RULE 1: Critical priority — immediate safety lockout
        -- A critical request means the ride is UNSAFE — lock it down completely
        IF NEW.priority = 'Critical' AND NEW.status != 'Completed' THEN
          UPDATE rides
          SET status = 'Closed', is_operational = false
          WHERE ride_id = NEW.ride_id;
          RETURN NEW;
        END IF;

        -- RULE 2: Request goes to 'In Progress' — ride enters maintenance
        IF NEW.status = 'In Progress' THEN
          UPDATE rides
          SET status = 'Maintenance'
          WHERE ride_id = NEW.ride_id;

        -- RULE 3: Request completed — check if ALL requests are resolved
        ELSIF NEW.status = 'Completed' THEN
          -- Count remaining open requests for this ride (excluding current one)
          SELECT COUNT(*) INTO v_open_count
          FROM maintenance_requests
          WHERE ride_id = NEW.ride_id
            AND status IN ('Pending', 'In Progress')
            AND request_id != NEW.request_id;

          -- Also check if any remaining CRITICAL requests exist (even if Pending)
          IF v_open_count = 0 THEN
            -- No open requests — safe to restore the ride
            UPDATE rides
            SET status = 'Operational', is_operational = true
            WHERE ride_id = NEW.ride_id;
          ELSIF NOT EXISTS (
            SELECT 1 FROM maintenance_requests
            WHERE ride_id = NEW.ride_id
              AND priority = 'Critical'
              AND status != 'Completed'
              AND request_id != NEW.request_id
          ) THEN
            -- Open requests exist but none are Critical — set to Maintenance (not Closed)
            UPDATE rides
            SET status = 'Maintenance', is_operational = true
            WHERE ride_id = NEW.ride_id;
          END IF;

        -- RULE 4: New request created with 'Pending' status on an Operational ride
        ELSIF TG_OP = 'INSERT' AND NEW.status = 'Pending' AND NEW.priority IN ('High', 'Critical') THEN
          UPDATE rides
          SET status = 'Maintenance'
          WHERE ride_id = NEW.ride_id AND status = 'Operational';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_maintenance_safety_cascade
      BEFORE INSERT OR UPDATE OF status, priority ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_maintenance_safety_cascade();
    `,
  },
  {
    name: "018_trigger_notify_on_maintenance_event",
    sql: `
      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 2: NOTIFICATION ON MAINTENANCE EVENTS
      -- ═══════════════════════════════════════════════════════════════════
      -- Business constraint: Different maintenance severity levels require
      -- different operational responses. The right people must be notified
      -- at the right time:
      --   - Critical/High priority → managers must be alerted immediately
      --   - Ride back to Operational → staff need to know to reopen the ride
      --   - Task assigned to employee → that employee needs to know
      --
      -- ECA Model:
      --   Event:     AFTER INSERT OR UPDATE ON maintenance_requests
      --   Condition: Check priority level, status change, employee assignment
      --   Action:    INSERT into notifications table with targeted recipients
      --
      -- Tables read: maintenance_requests (source), rides (JOIN), employees (JOIN)
      -- Table written: notifications (target)
      -- SQL features: 3-table JOIN, conditional branching, OLD vs NEW detection,
      --               role-based targeting, multiple INSERT paths
      -- ═══════════════════════════════════════════════════════════════════

      CREATE OR REPLACE FUNCTION fn_notify_on_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_ride_name     VARCHAR(255);
        v_employee_name VARCHAR(255);
        v_employee_uid  INTEGER;
      BEGIN
        -- Get the ride name
        SELECT ride_name INTO v_ride_name
        FROM rides WHERE ride_id = NEW.ride_id;

        -- Get assigned employee info if exists
        IF NEW.employee_id IS NOT NULL THEN
          SELECT e.full_name, e.user_id INTO v_employee_name, v_employee_uid
          FROM employees e WHERE e.employee_id = NEW.employee_id;
        END IF;

        -- ── SCENARIO 1: Critical or High priority request created/escalated ──
        -- Notify all managers immediately
        IF (TG_OP = 'INSERT' AND NEW.priority IN ('Critical', 'High'))
           OR (TG_OP = 'UPDATE' AND NEW.priority IN ('Critical', 'High')
               AND (OLD.priority IS NULL OR OLD.priority NOT IN ('Critical', 'High'))) THEN
          INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
          VALUES (
            'manager',
            'maintenance_critical',
            CASE NEW.priority
              WHEN 'Critical' THEN '🚨 CRITICAL: ' || v_ride_name || ' — Immediate Action Required'
              ELSE '⚠️ HIGH PRIORITY: ' || v_ride_name || ' — Maintenance Needed'
            END,
            'A ' || NEW.priority || ' priority maintenance request has been filed for ' || v_ride_name || ': ' || NEW.description,
            'maintenance_requests',
            NEW.request_id
          );
        END IF;

        -- ── SCENARIO 2: Maintenance completed and ride is back to Operational ──
        -- Notify all staff so they can reopen the ride to guests
        IF TG_OP = 'UPDATE' AND NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
          -- Check if the ride is now Operational (set by Trigger 1)
          IF EXISTS (
            SELECT 1 FROM rides
            WHERE ride_id = NEW.ride_id AND status = 'Operational'
          ) THEN
            INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
            VALUES (
              'staff',
              'ride_reopened',
              '✅ ' || v_ride_name || ' is Back in Operation',
              v_ride_name || ' has been cleared after maintenance and is now open for guests.' ||
              CASE WHEN v_employee_name IS NOT NULL
                THEN ' Cleared by ' || v_employee_name || '.'
                ELSE ''
              END,
              'rides',
              NEW.ride_id
            );
          END IF;
        END IF;

        -- ── SCENARIO 3: Task assigned or reassigned to an employee ──
        -- Notify the specific employee
        IF NEW.employee_id IS NOT NULL AND v_employee_uid IS NOT NULL
           AND (TG_OP = 'INSERT'
                OR (TG_OP = 'UPDATE' AND (OLD.employee_id IS NULL OR OLD.employee_id != NEW.employee_id))) THEN
          INSERT INTO notifications (recipient_role, recipient_user_id, type, title, message, related_table, related_id)
          VALUES (
            'staff',
            v_employee_uid,
            'maintenance_assigned',
            '🔧 New Task: ' || v_ride_name,
            'You have been assigned to a ' || NEW.priority || ' priority maintenance task on ' || v_ride_name || ': ' || NEW.description,
            'maintenance_requests',
            NEW.request_id
          );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_notify_on_maintenance_event
      AFTER INSERT OR UPDATE ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_notify_on_maintenance_event();
    `,
  },
  {
    name: "019_trigger_park_closure_cascade",
    sql: `
      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 3: PARK CLOSURE CASCADE
      -- ═══════════════════════════════════════════════════════════════════
      -- Business constraint: When a park zone is closed (weather, emergency,
      -- safety), ALL rides in that zone must be automatically shut down.
      -- No ride in a closed zone should remain operational. When the closure
      -- ends, rides are restored to Operational.
      --
      -- ECA Model:
      --   Event:     AFTER INSERT OR UPDATE OF is_active ON park_closures
      --   Condition: Check if closure is being activated or deactivated
      --   Action:    UPDATE all rides in the zone, INSERT notifications
      --
      -- Tables read: park_closures (source), rides (target + read for names)
      -- Tables written: rides (bulk UPDATE), notifications (INSERT)
      -- SQL features: bulk UPDATE with WHERE zone match, cursor-like loop via
      --               record variable, conditional INSERT, zone-based cascade,
      --               active/inactive toggle logic
      -- ═══════════════════════════════════════════════════════════════════

      CREATE OR REPLACE FUNCTION fn_park_closure_cascade()
      RETURNS TRIGGER AS $$
      DECLARE
        v_affected_count INTEGER;
        v_ride_record    RECORD;
      BEGIN
        -- ── ZONE CLOSURE ACTIVATED ──
        IF NEW.is_active = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active = false)) THEN
          -- Close ALL rides in this zone
          UPDATE rides
          SET status = 'Closed', is_operational = false
          WHERE location = NEW.zone AND status != 'Closed';

          GET DIAGNOSTICS v_affected_count = ROW_COUNT;

          -- Notify managers about the zone closure
          INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
          VALUES (
            'manager',
            'park_closure',
            '🚫 Zone Closure: ' || NEW.zone || ' — ' || NEW.closure_type,
            NEW.zone || ' has been closed due to ' || LOWER(NEW.closure_type) || ': ' || NEW.reason ||
            '. ' || v_affected_count || ' ride(s) have been automatically shut down.',
            'park_closures',
            NEW.closure_id
          );

          -- Notify staff about each affected ride
          FOR v_ride_record IN
            SELECT ride_id, ride_name FROM rides WHERE location = NEW.zone
          LOOP
            INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
            VALUES (
              'staff',
              'ride_closed_zone',
              '⛔ ' || v_ride_record.ride_name || ' — Closed (Zone Closure)',
              v_ride_record.ride_name || ' has been shut down due to a ' || LOWER(NEW.closure_type) ||
              ' closure in ' || NEW.zone || '. Do not allow guests on this ride until further notice.',
              'rides',
              v_ride_record.ride_id
            );
          END LOOP;

        -- ── ZONE CLOSURE DEACTIVATED ──
        ELSIF TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN
          -- Set ended_at timestamp
          NEW.ended_at = NOW();

          -- Restore rides in this zone ONLY if they have no open maintenance requests
          FOR v_ride_record IN
            SELECT r.ride_id, r.ride_name FROM rides r
            WHERE r.location = NEW.zone AND r.status = 'Closed'
          LOOP
            -- Check if this ride has any open maintenance
            IF NOT EXISTS (
              SELECT 1 FROM maintenance_requests
              WHERE ride_id = v_ride_record.ride_id
                AND status IN ('Pending', 'In Progress')
            ) THEN
              UPDATE rides
              SET status = 'Operational', is_operational = true
              WHERE ride_id = v_ride_record.ride_id;
            ELSE
              -- Ride has open maintenance — set to Maintenance, not Operational
              UPDATE rides
              SET status = 'Maintenance', is_operational = true
              WHERE ride_id = v_ride_record.ride_id;
            END IF;
          END LOOP;

          -- Notify staff that the zone is reopening
          INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
          VALUES (
            'staff',
            'zone_reopened',
            '✅ Zone Reopened: ' || NEW.zone,
            NEW.zone || ' closure has been lifted. Rides without pending maintenance have been restored to Operational. Please verify each ride before admitting guests.',
            'park_closures',
            NEW.closure_id
          );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Note: BEFORE trigger so we can modify NEW.ended_at
      CREATE TRIGGER trg_park_closure_cascade
      BEFORE INSERT OR UPDATE OF is_active ON park_closures
      FOR EACH ROW
      EXECUTE FUNCTION fn_park_closure_cascade();
    `,
  },
  {
    name: "020_schema_align_rides",
    sql: `
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS total_visits INT DEFAULT 0;
    `,
  },
  {
    name: "021_schema_align_employees",
    sql: `
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS ride_id INT REFERENCES rides(ride_id) ON DELETE SET NULL;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start TIME;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_end TIME;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE DEFAULT CURRENT_DATE;
    `,
  },
  {
    name: "022_schema_align_customers",
    sql: `
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `,
  },
  {
    name: "023_schema_align_ticket_types",
    sql: `
      ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS ticket_category VARCHAR(50);
      ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS fast_pass BOOLEAN DEFAULT false;
      ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS description VARCHAR(255);
      ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS child_price NUMERIC(10,2);

      UPDATE ticket_types SET ticket_category = 'standard', fast_pass = false,
        description = 'Full-day access to all rides and attractions', child_price = 35.00
      WHERE type_name = 'General Admission' AND ticket_category IS NULL;

      UPDATE ticket_types SET ticket_category = 'premium', fast_pass = true,
        description = 'Skip-the-line access on all rides plus reserved seating', child_price = 69.00
      WHERE type_name = 'Fast Pass' AND ticket_category IS NULL;

      UPDATE ticket_types SET ticket_category = 'discount', fast_pass = false,
        description = 'Discounted entry for children under 12', child_price = 29.99
      WHERE type_name LIKE '%Child%' AND ticket_category IS NULL;

      UPDATE ticket_types SET ticket_category = 'discount', fast_pass = false,
        description = 'Discounted entry for seniors 65 and over', child_price = 34.99
      WHERE type_name LIKE '%Senior%' AND ticket_category IS NULL;

      UPDATE ticket_types SET ticket_category = 'premium', fast_pass = false,
        description = 'Unlimited visits through the end of the season plus 10% off food and merch', child_price = 99.00
      WHERE type_name = 'Season Pass' AND ticket_category IS NULL;

      UPDATE ticket_types SET ticket_category = 'vip', fast_pass = true,
        description = 'VIP skip-the-line access, reserved seating, and complimentary meal voucher', child_price = 99.00
      WHERE type_name = 'VIP Experience' AND ticket_category IS NULL;
    `,
  },
  {
    name: "024_schema_align_tickets",
    sql: `
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP DEFAULT NOW();
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS use_date TIMESTAMP;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS expiration_date DATE;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_child BOOLEAN DEFAULT false;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_elderly BOOLEAN DEFAULT false;
    `,
  },
  {
    name: "025_schema_align_ride_usage",
    sql: `
      ALTER TABLE ride_usage ADD COLUMN IF NOT EXISTS ride_time TIMESTAMP DEFAULT NOW();
    `,
  },
  {
    name: "026_schema_align_stripe",
    sql: `
      ALTER TABLE stripe ADD COLUMN IF NOT EXISTS payment_status INT DEFAULT 1;
      ALTER TABLE stripe ADD COLUMN IF NOT EXISTS stripe_invoice_id INT;
    `,
  },
  {
    name: "027_schema_align_ticket_purchases_fk",
    sql: `
      ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS ticket_type_id INT REFERENCES ticket_types(ticket_type_id) ON DELETE SET NULL;
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
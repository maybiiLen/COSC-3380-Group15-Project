require("dotenv").config();
const pool = require("../config/db");

const migrations = [
  // ═══════════════════════════════════════════════════════════════
  // SECTION 0: CLEANUP — DROP OLD TRIGGERS & STALE MIGRATIONS
  // ═══════════════════════════════════════════════════════════════

  {
    name: "000_cleanup_old_triggers",
    sql: `
      -- Drop old triggers (safe even if they don't exist)
      DROP TRIGGER IF EXISTS trg_auto_completed_at            ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_ride_status_on_maintenance   ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_maintenance_safety_cascade   ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_notify_on_maintenance_event  ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_park_closure_cascade         ON park_closures;
      DROP TRIGGER IF EXISTS trg_park_closure_after           ON park_closures;
      DROP TRIGGER IF EXISTS trg_park_closure_before          ON park_closures;
      DROP TRIGGER IF EXISTS trg_enforce_ticket_purchase_policy ON ticket_purchases;

      -- Drop old functions
      DROP FUNCTION IF EXISTS fn_auto_set_completed_at();
      DROP FUNCTION IF EXISTS fn_update_ride_status_on_maintenance();
      DROP FUNCTION IF EXISTS fn_maintenance_safety_cascade();
      DROP FUNCTION IF EXISTS fn_notify_on_maintenance_event();
      DROP FUNCTION IF EXISTS fn_park_closure_cascade();
      DROP FUNCTION IF EXISTS fn_park_closure_after();
      DROP FUNCTION IF EXISTS fn_park_closure_before();
      DROP FUNCTION IF EXISTS fn_enforce_ticket_purchase_policy();

      -- Drop old dead tables
      DROP TABLE IF EXISTS ride_usage;
      DROP TABLE IF EXISTS visits;
      DROP TABLE IF EXISTS tickets;
      DROP TABLE IF EXISTS stripe;

      -- Clear old migration entries so the new ones run cleanly
      DELETE FROM _migrations WHERE name NOT LIKE '000_%';
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: CORE TABLES
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: SCHEMA ADDITIONS TO PRE-EXISTING TABLES
  // (rides, employees, customers, ticket_types, restaurant,
  //  gift_shop, game, merch are created by Neon seed)
  // ═══════════════════════════════════════════════════════════════

  {
    name: "003_extend_customers",
    sql: `
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE customers ALTER COLUMN phone TYPE BIGINT;
      ALTER TABLE customers ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE customers ALTER COLUMN full_name TYPE VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    `,
  },
  {
    name: "004_extend_employees",
    sql: `
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS ride_id INT REFERENCES rides(ride_id) ON DELETE SET NULL;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start TIME;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_end TIME;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE employees ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE employees ALTER COLUMN full_name TYPE VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
    `,
  },
  {
    name: "005_extend_rides",
    sql: `
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_operational BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS total_visits INT DEFAULT 0;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_type VARCHAR(50);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS thrill_level VARCHAR(20);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS max_cycles_per_hour INTEGER;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS max_wind_mph NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS min_lightning_miles NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS min_temp_f NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS max_temp_f NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS inspection_cycle_interval INTEGER;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS cycles_since_inspection INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ;

      UPDATE rides SET is_operational = false WHERE status = 'Closed';
    `,
  },
  {
    name: "006_extend_ticket_types",
    sql: `
      ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS type_name VARCHAR(100);
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
    name: "007_extend_park_entities",
    sql: `
      ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS image_url TEXT;

      ALTER TABLE gift_shop ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE gift_shop ADD COLUMN IF NOT EXISTS image_url TEXT;

      ALTER TABLE game ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE game ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE game ADD COLUMN IF NOT EXISTS prize_type VARCHAR(100);
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: APPLICATION TABLES
  // ═══════════════════════════════════════════════════════════════

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
    name: "009_create_ticket_purchases",
    sql: `
      CREATE TABLE IF NOT EXISTS ticket_purchases (
        purchase_id       SERIAL PRIMARY KEY,
        customer_id       INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
        user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ticket_type       VARCHAR(50) NOT NULL,
        ticket_type_id    INT REFERENCES ticket_types(ticket_type_id) ON DELETE SET NULL,
        adult_qty         INTEGER NOT NULL DEFAULT 0,
        child_qty         INTEGER NOT NULL DEFAULT 0,
        unit_price_adult  NUMERIC(10,2) NOT NULL,
        unit_price_child  NUMERIC(10,2) NOT NULL,
        total_price       NUMERIC(10,2) NOT NULL,
        visit_date        DATE,
        purchase_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        card_last_four    VARCHAR(4),
        cardholder_name   VARCHAR(255),
        buyer_name        VARCHAR(255),
        buyer_email       VARCHAR(255)
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_purchases_user_id ON ticket_purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_purchases_customer_id ON ticket_purchases(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_purchases_date ON ticket_purchases(purchase_date);
    `,
  },
  {
    name: "010_create_notifications",
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
    name: "011_create_park_closures",
    sql: `
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

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: DISPATCH SAFETY TABLES
  // ═══════════════════════════════════════════════════════════════

  {
    name: "012_create_dispatch_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS ride_dispatches (
        dispatch_id       SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        operator_id       INTEGER NOT NULL REFERENCES employees(employee_id),
        dispatched_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        cycle_duration_s  INTEGER,
        guest_count       INTEGER NOT NULL,
        dispatch_notes    TEXT
      );

      CREATE TABLE IF NOT EXISTS weather_readings (
        reading_id        SERIAL PRIMARY KEY,
        recorded_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        wind_speed_mph    NUMERIC(5,2),
        lightning_miles   NUMERIC(5,2),
        temperature_f     NUMERIC(5,2),
        precipitation     VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS operator_assignments (
        assignment_id     SERIAL PRIMARY KEY,
        employee_id       INTEGER NOT NULL REFERENCES employees(employee_id),
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        started_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at          TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dispatch_rejections (
        rejection_id      SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        operator_id       INTEGER REFERENCES employees(employee_id),
        attempted_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        rejection_code    VARCHAR(50) NOT NULL,
        rejection_detail  TEXT NOT NULL,
        context_data      JSONB
      );

      CREATE TABLE IF NOT EXISTS ride_interlocks (
        interlock_id      SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        blocking_ride_id  INTEGER NOT NULL REFERENCES rides(ride_id),
        block_reason      TEXT,
        CONSTRAINT chk_no_self_interlock CHECK (ride_id != blocking_ride_id)
      );
    `,
  },


  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: HELPER FUNCTION
  // ═══════════════════════════════════════════════════════════════

  {
    name: "014_create_notification_helper",
    sql: `
      CREATE OR REPLACE FUNCTION fn_create_notification(
        p_role          VARCHAR,
        p_user_id       INTEGER,
        p_type          VARCHAR,
        p_title         VARCHAR,
        p_message       TEXT,
        p_related_table VARCHAR,
        p_related_id    INTEGER
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO notifications (
          recipient_role, recipient_user_id, type, title, message,
          related_table, related_id
        )
        VALUES (
          p_role, p_user_id, p_type, p_title, p_message,
          p_related_table, p_related_id
        );
      END;
      $$ LANGUAGE plpgsql;
    `,
  },


  // ═══════════════════════════════════════════════════════════════
  // SECTION 8: TRIGGER 2 — RIDE REOPEN GUARD (pure safety lock)
  // ═══════════════════════════════════════════════════════════════
  // BEFORE UPDATE ON rides
  //
  // Semantic constraint: a ride cannot be returned to "Operational"
  // status while it still has unresolved Critical or High priority
  // maintenance requests. The rule spans rides ↔ maintenance_requests
  // and cannot be expressed as a CHECK constraint (cross-table).
  //
  // Pure safety-lock pattern: the trigger only rejects via
  // RAISE EXCEPTION. It does not write audit rows, mutate
  // counters, or touch any other table.
  //
  // Tables read:    rides, maintenance_requests
  // Tables written: none
  // ═══════════════════════════════════════════════════════════════

  {
    name: "022_trigger_guard_ride_reopen",
    sql: `
      CREATE OR REPLACE FUNCTION fn_guard_ride_reopen()
      RETURNS TRIGGER AS $$
      DECLARE
        v_open_blocking INTEGER;
        v_zone_closed   INTEGER;
      BEGIN
        -- Only fire when the ride transitions back to Operational
        IF NEW.status = 'Operational' AND OLD.status IS DISTINCT FROM 'Operational' THEN

          -- RULE 1: block reopen if the ride's zone has an active park closure
          SELECT COUNT(*) INTO v_zone_closed
            FROM park_closures
           WHERE zone = NEW.location
             AND is_active = true;

          IF v_zone_closed > 0 THEN
            RAISE EXCEPTION 'Cannot reopen ride % — zone % is currently closed',
                            NEW.ride_name, NEW.location
              USING ERRCODE = 'RR002',
                    HINT    = 'Lift the zone closure before reopening rides in this zone';
          END IF;

          -- RULE 2: block reopen if unresolved Critical/High maintenance exists
          SELECT COUNT(*) INTO v_open_blocking
            FROM maintenance_requests
           WHERE ride_id = NEW.ride_id
             AND priority IN ('Critical', 'High')
             AND status != 'Completed';

          IF v_open_blocking > 0 THEN
            RAISE EXCEPTION 'Cannot reopen ride % — % unresolved Critical/High maintenance request(s)',
                            NEW.ride_name, v_open_blocking
              USING ERRCODE = 'RR001',
                    HINT    = 'Complete the blocking maintenance requests before reopening';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_guard_ride_reopen ON rides;
      CREATE TRIGGER trg_guard_ride_reopen
      BEFORE UPDATE ON rides
      FOR EACH ROW
      EXECUTE FUNCTION fn_guard_ride_reopen();
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 8b: TRIGGER 3 — EMPLOYEE DEACTIVATION GUARD (pure safety lock)
  // ═══════════════════════════════════════════════════════════════
  // BEFORE UPDATE ON employees
  //
  // Semantic constraint: an employee cannot be marked inactive
  // while they still have (a) active operator assignments or
  // (b) open maintenance tasks assigned to them. Both rules
  // span multiple tables and cannot be expressed as CHECK
  // constraints.
  //
  // Pure safety-lock pattern: the trigger only rejects via
  // RAISE EXCEPTION. It does not write audit rows, mutate
  // counters, or touch any other table.
  //
  // Tables read:    employees, operator_assignments, maintenance_requests
  // Tables written: none
  // ═══════════════════════════════════════════════════════════════

  {
    name: "023_trigger_guard_employee_deactivation",
    sql: `
      CREATE OR REPLACE FUNCTION fn_guard_employee_deactivation()
      RETURNS TRIGGER AS $$
      DECLARE
        v_active_assignments INTEGER;
        v_open_tasks         INTEGER;
      BEGIN
        -- Only fire when the employee transitions to inactive
        IF NEW.is_active = false AND OLD.is_active = true THEN

          -- Semantic rule 1: no lingering operator assignments
          SELECT COUNT(*) INTO v_active_assignments
            FROM operator_assignments
           WHERE employee_id = NEW.employee_id
             AND ended_at IS NULL;

          IF v_active_assignments > 0 THEN
            RAISE EXCEPTION 'Cannot deactivate % — still assigned as operator on % ride(s)',
                            NEW.full_name, v_active_assignments
              USING ERRCODE = 'ED001',
                    HINT    = 'End their ride assignments before deactivating';
          END IF;

          -- Semantic rule 2: no open maintenance tasks
          SELECT COUNT(*) INTO v_open_tasks
            FROM maintenance_requests
           WHERE employee_id = NEW.employee_id
             AND status != 'Completed';

          IF v_open_tasks > 0 THEN
            RAISE EXCEPTION 'Cannot deactivate % — still has % open maintenance task(s)',
                            NEW.full_name, v_open_tasks
              USING ERRCODE = 'ED002',
                    HINT    = 'Reassign or complete their open tasks before deactivating';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_guard_employee_deactivation ON employees;
      CREATE TRIGGER trg_guard_employee_deactivation
      BEFORE UPDATE ON employees
      FOR EACH ROW
      EXECUTE FUNCTION fn_guard_employee_deactivation();
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 8c: CLEANUP — DROP LEGACY DISPATCH ENVELOPE TRIGGER
  // ═══════════════════════════════════════════════════════════════
  // The dispatch envelope trigger was replaced by the two pure
  // safety-lock triggers above. The underlying tables
  // (ride_dispatches, dispatch_rejections) are preserved for
  // the ride-operations report.
  // ═══════════════════════════════════════════════════════════════

  {
    name: "024_drop_dispatch_envelope_trigger",
    sql: `
      DROP TRIGGER IF EXISTS trg_enforce_dispatch_envelope ON ride_dispatches;
      DROP FUNCTION IF EXISTS fn_enforce_dispatch_envelope() CASCADE;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 9: SCHEDULED FUNCTION (not a trigger)
  // ═══════════════════════════════════════════════════════════════

  {
    name: "017_escalation_function",
    sql: `
      CREATE OR REPLACE FUNCTION fn_escalate_stale_priorities(
        p_low_to_medium_seconds    INTEGER DEFAULT 259200,
        p_medium_to_high_seconds   INTEGER DEFAULT 259200,
        p_high_to_critical_seconds INTEGER DEFAULT 259200
      ) RETURNS TABLE (
        request_id    INTEGER,
        old_priority  VARCHAR,
        new_priority  VARCHAR,
        age_seconds   INTEGER
      ) AS $$
      DECLARE
        rec RECORD;
        v_new_priority VARCHAR;
        v_age INTEGER;
      BEGIN
        FOR rec IN
          SELECT m.request_id, m.priority, m.created_at
          FROM maintenance_requests m
          WHERE m.status IN ('Pending', 'In Progress')
            AND m.priority IN ('Low', 'Medium', 'High')
          ORDER BY m.request_id
        LOOP
          v_age := EXTRACT(EPOCH FROM (NOW() - rec.created_at))::INTEGER;
          v_new_priority := NULL;

          IF rec.priority = 'Low' AND v_age >= p_low_to_medium_seconds THEN
            v_new_priority := 'Medium';
          ELSIF rec.priority = 'Medium' AND v_age >= p_medium_to_high_seconds THEN
            v_new_priority := 'High';
          ELSIF rec.priority = 'High' AND v_age >= p_high_to_critical_seconds THEN
            v_new_priority := 'Critical';
          END IF;

          IF v_new_priority IS NOT NULL THEN
            UPDATE maintenance_requests
               SET priority = v_new_priority
             WHERE maintenance_requests.request_id = rec.request_id;

            request_id   := rec.request_id;
            old_priority := rec.priority;
            new_priority := v_new_priority;
            age_seconds  := v_age;
            RETURN NEXT;
          END IF;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 10: SEED DATA
  // ═══════════════════════════════════════════════════════════════

  {
    name: "018_seed_interlocks_and_phones",
    sql: `
      -- Seed ride interlocks with realistic relationships
      INSERT INTO ride_interlocks (ride_id, blocking_ride_id, block_reason)
      SELECT r1.ride_id, r2.ride_id, 'shared_evacuation_path'
        FROM rides r1
        JOIN rides r2 ON r1.location = r2.location
                     AND r1.ride_id < r2.ride_id
       WHERE r1.location IS NOT NULL
       LIMIT 3
      ON CONFLICT DO NOTHING;

      -- Give all employees phone numbers for SMS demo
      UPDATE employees SET phone = '555-01' || LPAD(employee_id::TEXT, 2, '0')
       WHERE phone IS NULL;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 11: VENUE SOFT-DELETE SUPPORT
  // ═══════════════════════════════════════════════════════════════
  // Mirror the rides decommissioning pattern for restaurant, gift_shop,
  // and game. A non-null decommissioned_at marks the record as removed
  // from customer views while preserving historical sales data.

  {
    name: "019_add_decommissioned_at_to_venues",
    sql: `
      ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ;
      ALTER TABLE gift_shop  ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ;
      ALTER TABLE game       ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 12: REPLACE MAINTENANCE TRIGGER — DASHBOARD-ONLY
  // ═══════════════════════════════════════════════════════════════
  // Drops SMS fan-out. Role-differentiated in-app notifications:
  //   - MANAGER receives the full maintenance request details
  //     (priority, ride, description, assigned staff, incident info)
  //   - ASSIGNED STAFF receives a task-assignment notification with
  //     the manager's name ("You've been assigned X by Srinath")

  {
    name: "020_maintenance_trigger_dashboard_only",
    sql: `
      CREATE OR REPLACE FUNCTION fn_route_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_event_class        VARCHAR(50);
        v_ride               rides%ROWTYPE;
        v_assigned_employee  employees%ROWTYPE;
        v_recent_critical    INTEGER;
        v_on_call_manager    RECORD;
        v_interlocked_ride   RECORD;
        v_manager_label      TEXT;
        v_pattern_window     INTERVAL := INTERVAL '7 days';
        v_pattern_threshold  INTEGER  := 3;
      BEGIN
        -- PHASE 1: EVENT CLASSIFICATION
        IF TG_OP = 'INSERT' AND NEW.priority = 'Critical' THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'INSERT' AND NEW.priority = 'High' THEN
          v_event_class := 'HIGH_ALERT';
        ELSIF TG_OP = 'INSERT' AND NEW.priority IN ('Low', 'Medium') THEN
          v_event_class := 'NEW_REQUEST';
        ELSIF TG_OP = 'UPDATE' AND NEW.priority = 'Critical'
              AND (OLD.priority IS NULL OR OLD.priority != 'Critical') THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'UPDATE' AND NEW.priority = 'High'
              AND (OLD.priority IS NULL OR OLD.priority NOT IN ('Critical', 'High')) THEN
          v_event_class := 'HIGH_ALERT';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'Completed'
              AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
          v_event_class := 'COMPLETION';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'In Progress'
              AND (OLD.status IS NULL OR OLD.status != 'In Progress') THEN
          v_event_class := 'STATUS_PROGRESSION';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NOT NULL
              AND NEW.employee_id IS NOT NULL
              AND OLD.employee_id != NEW.employee_id THEN
          v_event_class := 'REASSIGNMENT';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NULL
              AND NEW.employee_id IS NOT NULL THEN
          v_event_class := 'ASSIGNMENT';
        ELSE
          RETURN NEW;
        END IF;

        -- PHASE 2: LOAD CONTEXT (cross-table lookups)
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NEW.employee_id IS NOT NULL THEN
          SELECT * INTO v_assigned_employee
            FROM employees WHERE employee_id = NEW.employee_id;
        END IF;

        SELECT employee_id, full_name, email, user_id
          INTO v_on_call_manager
          FROM employees
         WHERE role = 'manager'
           AND is_active = true
         ORDER BY employee_id
         LIMIT 1;

        v_manager_label := COALESCE(v_on_call_manager.full_name, 'management');

        -- PHASE 3: PATTERN DETECTION (cross-row temporal query)
        IF v_event_class = 'CRITICAL_ESCALATION' THEN
          SELECT COUNT(*) INTO v_recent_critical
            FROM maintenance_requests
           WHERE ride_id = NEW.ride_id
             AND priority = 'Critical'
             AND created_at >= NOW() - v_pattern_window
             AND request_id != NEW.request_id;

          IF v_recent_critical >= (v_pattern_threshold - 1) THEN
            v_event_class := 'REPEATED_FAILURE';
          END IF;
        END IF;

        -- PHASE 3b: AUTO-CLOSE the ride when an urgent maintenance request lands.
        -- Only touches Operational rides — leaves Maintenance/Closed/Decommissioned alone.
        IF v_event_class IN ('CRITICAL_ESCALATION', 'HIGH_ALERT', 'REPEATED_FAILURE') THEN
          UPDATE rides
             SET status = 'Closed'
           WHERE ride_id = NEW.ride_id
             AND status = 'Operational';
        END IF;

        -- PHASE 4: BRANCH BY EVENT CLASS (notifications + any remaining side effects)

        IF v_event_class = 'NEW_REQUEST' THEN
          -- MANAGER: full maintenance request details
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'maintenance_new',
            format('New Maintenance Request: %s', v_ride.ride_name),
            format('Priority: %s | Ride: %s | Details: %s | Assigned to: %s',
                   NEW.priority, v_ride.ride_name, NEW.description,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );

          -- STAFF (if assigned): task assignment with manager name
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task Assigned: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s by %s. Details: %s',
                     NEW.priority, v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'CRITICAL_ESCALATION' THEN
          -- MANAGER: full critical details
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'critical_alert',
            format('CRITICAL: %s', v_ride.ride_name),
            format('Priority: Critical | Ride: %s | Details: %s | Assigned to: %s',
                   v_ride.ride_name, NEW.description,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );

          -- ASSIGNED STAFF: urgent assignment with manager name
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'critical_alert',
              format('CRITICAL TASK: %s', v_ride.ride_name),
              format('You have been assigned a CRITICAL task on %s by %s. Immediate attention required. Details: %s',
                     v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'HIGH_ALERT' THEN
          -- MANAGER: full high-priority details
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'high_alert',
            format('HIGH PRIORITY: %s', v_ride.ride_name),
            format('Priority: High | Ride: %s | Details: %s | Assigned to: %s',
                   v_ride.ride_name, NEW.description,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );

          -- ASSIGNED STAFF
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'high_alert',
              format('HIGH PRIORITY TASK: %s', v_ride.ride_name),
              format('You have been assigned a High priority task on %s by %s. Details: %s',
                     v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REPEATED_FAILURE' THEN
          -- MANAGER: reliability alert with pattern context
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'repeated_failure_alert',
            format('REPEATED FAILURE: %s', v_ride.ride_name),
            format('%s has had %s Critical failures in the last 7 days. Underlying reliability investigation required. Latest: %s',
                   v_ride.ride_name, v_recent_critical + 1, NEW.description),
            'maintenance_requests', NEW.request_id
          );

          -- ASSIGNED STAFF
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'repeated_failure_alert',
              format('URGENT TASK: %s', v_ride.ride_name),
              format('You have been assigned an urgent task on %s by %s. This ride has had %s Critical failures in the last 7 days. Details: %s',
                     v_ride.ride_name, v_manager_label, v_recent_critical + 1, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'ASSIGNMENT' THEN
          -- STAFF: task assignment with manager name
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task Assigned: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s by %s. Details: %s',
                     NEW.priority, v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          ELSE
            PERFORM fn_create_notification(
              'manager', v_on_call_manager.user_id, 'assignment_unreachable',
              format('Unreachable assignment: %s', v_ride.ride_name),
              format('Task assigned to %s but they have no active user account.',
                     COALESCE(v_assigned_employee.full_name, 'unknown employee')),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REASSIGNMENT' THEN
          -- OLD STAFF: notify task moved away
          PERFORM fn_create_notification(
            'staff',
            (SELECT user_id FROM employees WHERE employee_id = OLD.employee_id),
            'task_reassigned_from',
            format('Task transferred: %s', v_ride.ride_name),
            format('Your task on %s has been reassigned to another technician by %s.',
                   v_ride.ride_name, v_manager_label),
            'maintenance_requests', NEW.request_id
          );

          -- NEW STAFF: notify task moved to them
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_reassigned_to',
              format('Transferred Task: %s', v_ride.ride_name),
              format('A %s priority task on %s has been transferred to you by %s. Details: %s',
                     NEW.priority, v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

          -- MANAGER: confirm reassignment
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'reassignment_confirmed',
            format('Reassigned: %s', v_ride.ride_name),
            format('Request #%s on %s has been reassigned to %s.',
                   NEW.request_id, v_ride.ride_name,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );

        ELSIF v_event_class = 'STATUS_PROGRESSION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'work_started',
            format('Work started: %s', v_ride.ride_name),
            format('%s has begun work on %s (Request #%s)',
                   COALESCE(v_assigned_employee.full_name, 'A technician'),
                   v_ride.ride_name, NEW.request_id),
            'maintenance_requests', NEW.request_id
          );

        ELSIF v_event_class = 'COMPLETION' THEN
          IF EXISTS (SELECT 1 FROM rides WHERE ride_id = NEW.ride_id AND status = 'Operational') THEN
            PERFORM fn_create_notification(
              'staff', NULL, 'ride_reopened',
              format('%s is Back in Operation', v_ride.ride_name),
              format('%s has been cleared and is now open for guests.%s',
                     v_ride.ride_name,
                     CASE WHEN v_assigned_employee.full_name IS NOT NULL
                          THEN format(' Cleared by %s.', v_assigned_employee.full_name)
                          ELSE '' END),
              'rides', NEW.ride_id
            );
          ELSE
            PERFORM fn_create_notification(
              'manager', v_on_call_manager.user_id, 'partial_completion',
              format('Partial completion: %s', v_ride.ride_name),
              format('Request #%s completed, but ride still has pending work.',
                     NEW.request_id),
              'maintenance_requests', NEW.request_id
            );
          END IF;
        END IF;

        -- PHASE 5: CROSS-RIDE INTERLOCK COORDINATION
        IF v_event_class IN ('CRITICAL_ESCALATION', 'REPEATED_FAILURE') THEN
          FOR v_interlocked_ride IN
            SELECT r.ride_id, r.ride_name
              FROM ride_interlocks ri
              JOIN rides r ON r.ride_id = ri.blocking_ride_id
             WHERE ri.ride_id = NEW.ride_id
          LOOP
            PERFORM fn_create_notification(
              'staff', NULL, 'interlock_advisory',
              format('Advisory: %s is down', v_ride.ride_name),
              format('%s is experiencing a critical issue. Because %s is interlocked, ' ||
                     'expect possible impacts to guest flow or evacuation routing.',
                     v_ride.ride_name, v_interlocked_ride.ride_name),
              'rides', v_interlocked_ride.ride_id
            );
          END LOOP;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_route_maintenance_event ON maintenance_requests;
      CREATE TRIGGER trg_route_maintenance_event
      AFTER INSERT OR UPDATE ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_route_maintenance_event();
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 9b: TRIGGER — PARK CLOSURE CASCADE
  // ═══════════════════════════════════════════════════════════════
  // AFTER INSERT OR UPDATE on park_closures
  //
  // When a new closure becomes active, close every Operational ride in
  // that zone. When a closure is deactivated and no other active closure
  // covers the zone, reopen Closed rides — the guard trigger
  // (trg_guard_ride_reopen) still enforces maintenance rules per ride,
  // so rides with pending Critical/High work stay Closed.
  //
  // The per-ride BEGIN/EXCEPTION block catches guard rejections so one
  // blocked ride doesn't abort the cascade for the rest.
  //
  // Tables read:    park_closures, rides
  // Tables written: rides
  // ═══════════════════════════════════════════════════════════════

  {
    name: "024_trigger_park_closure_cascade",
    sql: `
      CREATE OR REPLACE FUNCTION fn_park_closure_cascade()
      RETURNS TRIGGER AS $$
      DECLARE
        v_r            RECORD;
        v_other_active INTEGER;
      BEGIN
        -- NEW ACTIVE CLOSURE: cascade-close Operational rides in the zone.
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
          UPDATE rides
             SET status = 'Closed'
           WHERE location = NEW.zone
             AND status = 'Operational'
             AND is_operational = true;
        END IF;

        -- CLOSURE DEACTIVATED: try to reopen rides if no other active
        -- closure still covers the zone.
        IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
          SELECT COUNT(*) INTO v_other_active
            FROM park_closures
           WHERE zone = NEW.zone
             AND is_active = true
             AND closure_id <> NEW.closure_id;

          IF v_other_active = 0 THEN
            FOR v_r IN
              SELECT ride_id FROM rides
               WHERE location = NEW.zone
                 AND status = 'Closed'
                 AND is_operational = true
            LOOP
              BEGIN
                UPDATE rides SET status = 'Operational' WHERE ride_id = v_r.ride_id;
              EXCEPTION WHEN OTHERS THEN
                -- trg_guard_ride_reopen rejected this ride (e.g. pending
                -- Critical/High maintenance). Leave it Closed and continue.
                NULL;
              END;
            END LOOP;
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_park_closure_cascade ON park_closures;
      CREATE TRIGGER trg_park_closure_cascade
      AFTER INSERT OR UPDATE ON park_closures
      FOR EACH ROW
      EXECUTE FUNCTION fn_park_closure_cascade();
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 10: CLEANUP — DROP MONITOR/POLICY ARTIFACTS
  // ═══════════════════════════════════════════════════════════════
  // Removes tables and artifacts from the legacy event routing and
  // ticket policy enforcement monitors. The core notification trigger
  // (fn_route_maintenance_event) no longer references these tables.
  // Safe on fresh DBs (uses IF EXISTS).
  // ═══════════════════════════════════════════════════════════════

  {
    name: "021_drop_monitor_artifacts",
    sql: `
      DROP TABLE IF EXISTS incident_tracking CASCADE;
      DROP TABLE IF EXISTS email_queue CASCADE;
      DROP TABLE IF EXISTS sms_queue CASCADE;
      DROP TABLE IF EXISTS policy_config CASCADE;
      DROP TABLE IF EXISTS sales_rejections CASCADE;

      DROP TRIGGER IF EXISTS trg_enforce_ticket_purchase_policy ON ticket_purchases;
      DROP FUNCTION IF EXISTS fn_enforce_ticket_purchase_policy() CASCADE;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 11: MERCH ONLINE PURCHASES
  // ═══════════════════════════════════════════════════════════════
  // One row per online merch order. Items are stored as JSONB so we
  // don't need a separate line-items table for an MVP checkout flow.
  // customer_id is nullable to support guest checkout (like
  // ticket_purchases uses buyer_name / buyer_email).
  // ═══════════════════════════════════════════════════════════════

  {
    name: "025_create_merch_purchases",
    sql: `
      CREATE TABLE IF NOT EXISTS merch_purchases (
        purchase_id      SERIAL PRIMARY KEY,
        customer_id      INTEGER REFERENCES customers(customer_id),
        buyer_name       VARCHAR(255) NOT NULL,
        buyer_email      VARCHAR(255) NOT NULL,
        shipping_address TEXT,
        items            JSONB NOT NULL,
        total_price      NUMERIC(10, 2) NOT NULL,
        cardholder_name  VARCHAR(255),
        card_last_four   VARCHAR(4),
        purchase_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_merch_purchases_customer ON merch_purchases (customer_id);
      CREATE INDEX IF NOT EXISTS idx_merch_purchases_date     ON merch_purchases (purchase_date);
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 12: MERCH PRESENTATION COLUMNS
  // ═══════════════════════════════════════════════════════════════
  // Adds image + description so merch can render like a real product
  // on the customer-facing shop and in the admin table thumbnail.
  // ═══════════════════════════════════════════════════════════════
  {
    name: "026_add_merch_presentation_columns",
    sql: `
      ALTER TABLE merch ADD COLUMN IF NOT EXISTS image_url   TEXT;
      ALTER TABLE merch ADD COLUMN IF NOT EXISTS description TEXT;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 13: DROP UNUSED ride_dispatch_queue
  // ═══════════════════════════════════════════════════════════════
  // The ride_dispatch_queue table was created in migration 012 as a
  // placeholder for a guest queue feature that was never implemented.
  // No route, service, trigger, or view references it. Safe to drop.
  // ═══════════════════════════════════════════════════════════════
  {
    name: "027_drop_ride_dispatch_queue",
    sql: `
      DROP TABLE IF EXISTS ride_dispatch_queue;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 14: COMPLETION AUTO-REOPEN
  // ═══════════════════════════════════════════════════════════════
  // Fixes the symmetry bug in fn_route_maintenance_event:
  // Phase 3b auto-CLOSES the ride when a Critical/High maintenance
  // request is inserted, but there was no corresponding auto-OPEN
  // when the last blocker is completed. As a result, rides stayed
  // Closed even after every request was marked Completed, and the
  // COMPLETION branch always fired "partial_completion."
  //
  // Now: on COMPLETION, if there are no other open Critical/High
  // maintenance requests on this ride AND no active park closure
  // for the ride's zone, the ride is reopened. The existing
  // notification logic then fires "ride_reopened" as intended.
  // ═══════════════════════════════════════════════════════════════
  {
    name: "028_completion_auto_reopen",
    sql: `
      CREATE OR REPLACE FUNCTION fn_route_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_event_class        VARCHAR(50);
        v_ride               rides%ROWTYPE;
        v_assigned_employee  employees%ROWTYPE;
        v_recent_critical    INTEGER;
        v_on_call_manager    RECORD;
        v_interlocked_ride   RECORD;
        v_manager_label      TEXT;
        v_pattern_window     INTERVAL := INTERVAL '7 days';
        v_pattern_threshold  INTEGER  := 3;
      BEGIN
        -- PHASE 1: EVENT CLASSIFICATION
        IF TG_OP = 'INSERT' AND NEW.priority = 'Critical' THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'INSERT' AND NEW.priority = 'High' THEN
          v_event_class := 'HIGH_ALERT';
        ELSIF TG_OP = 'INSERT' AND NEW.priority IN ('Low', 'Medium') THEN
          v_event_class := 'NEW_REQUEST';
        ELSIF TG_OP = 'UPDATE' AND NEW.priority = 'Critical'
              AND (OLD.priority IS NULL OR OLD.priority != 'Critical') THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'UPDATE' AND NEW.priority = 'High'
              AND (OLD.priority IS NULL OR OLD.priority NOT IN ('Critical', 'High')) THEN
          v_event_class := 'HIGH_ALERT';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'Completed'
              AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
          v_event_class := 'COMPLETION';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'In Progress'
              AND (OLD.status IS NULL OR OLD.status != 'In Progress') THEN
          v_event_class := 'STATUS_PROGRESSION';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NOT NULL
              AND NEW.employee_id IS NOT NULL
              AND OLD.employee_id != NEW.employee_id THEN
          v_event_class := 'REASSIGNMENT';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NULL
              AND NEW.employee_id IS NOT NULL THEN
          v_event_class := 'ASSIGNMENT';
        ELSE
          RETURN NEW;
        END IF;

        -- PHASE 2: LOAD CONTEXT
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NEW.employee_id IS NOT NULL THEN
          SELECT * INTO v_assigned_employee
            FROM employees WHERE employee_id = NEW.employee_id;
        END IF;

        SELECT employee_id, full_name, email, user_id
          INTO v_on_call_manager
          FROM employees
         WHERE role = 'manager'
           AND is_active = true
         ORDER BY employee_id
         LIMIT 1;

        v_manager_label := COALESCE(v_on_call_manager.full_name, 'management');

        -- PHASE 3: PATTERN DETECTION
        IF v_event_class = 'CRITICAL_ESCALATION' THEN
          SELECT COUNT(*) INTO v_recent_critical
            FROM maintenance_requests
           WHERE ride_id = NEW.ride_id
             AND priority = 'Critical'
             AND created_at >= NOW() - v_pattern_window
             AND request_id != NEW.request_id;

          IF v_recent_critical >= (v_pattern_threshold - 1) THEN
            v_event_class := 'REPEATED_FAILURE';
          END IF;
        END IF;

        -- PHASE 3b: AUTO-CLOSE on urgent insert
        IF v_event_class IN ('CRITICAL_ESCALATION', 'HIGH_ALERT', 'REPEATED_FAILURE') THEN
          UPDATE rides
             SET status = 'Closed'
           WHERE ride_id = NEW.ride_id
             AND status = 'Operational';
        END IF;

        -- PHASE 3c: AUTO-REOPEN on last blocker cleared
        -- When a maintenance request is completed, check if anything else is
        -- still blocking the ride. If not, flip it back to Operational.
        IF v_event_class = 'COMPLETION' THEN
          IF NOT EXISTS (
              SELECT 1 FROM maintenance_requests mr
               WHERE mr.ride_id = NEW.ride_id
                 AND mr.request_id != NEW.request_id
                 AND mr.status IN ('Pending', 'In Progress')
                 AND mr.priority IN ('Critical', 'High')
            )
             AND NOT EXISTS (
               SELECT 1 FROM park_closures pc
                 JOIN rides r2 ON r2.location = pc.zone
                WHERE r2.ride_id = NEW.ride_id
                  AND pc.is_active = true
                  AND pc.ended_at IS NULL
             )
          THEN
            UPDATE rides
               SET status = 'Operational'
             WHERE ride_id = NEW.ride_id
               AND status = 'Closed';
          END IF;
        END IF;

        -- PHASE 4: BRANCH BY EVENT CLASS
        IF v_event_class = 'NEW_REQUEST' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'maintenance_new',
            format('New Maintenance Request: %s', v_ride.ride_name),
            format('Priority: %s | Ride: %s | Details: %s | Assigned to: %s',
                   NEW.priority, v_ride.ride_name, NEW.description,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task Assigned: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s by %s. Details: %s',
                     NEW.priority, v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'CRITICAL_ESCALATION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'critical_alert',
            format('CRITICAL: %s', v_ride.ride_name),
            format('Priority: Critical | Ride: %s | Details: %s | Assigned to: %s',
                   v_ride.ride_name, NEW.description,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'critical_alert',
              format('CRITICAL TASK: %s', v_ride.ride_name),
              format('You have been assigned a CRITICAL task on %s by %s. Immediate attention required. Details: %s',
                     v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'HIGH_ALERT' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'high_alert',
            format('HIGH PRIORITY: %s', v_ride.ride_name),
            format('Priority: High | Ride: %s | Details: %s | Assigned to: %s',
                   v_ride.ride_name, NEW.description,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'high_alert',
              format('HIGH PRIORITY TASK: %s', v_ride.ride_name),
              format('You have been assigned a High priority task on %s by %s. Details: %s',
                     v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REPEATED_FAILURE' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'repeated_failure_alert',
            format('REPEATED FAILURE: %s', v_ride.ride_name),
            format('%s has had %s Critical failures in the last 7 days. Underlying reliability investigation required. Latest: %s',
                   v_ride.ride_name, v_recent_critical + 1, NEW.description),
            'maintenance_requests', NEW.request_id
          );
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'repeated_failure_alert',
              format('URGENT TASK: %s', v_ride.ride_name),
              format('You have been assigned an urgent task on %s by %s. This ride has had %s Critical failures in the last 7 days. Details: %s',
                     v_ride.ride_name, v_manager_label, v_recent_critical + 1, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'ASSIGNMENT' THEN
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task Assigned: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s by %s. Details: %s',
                     NEW.priority, v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          ELSE
            PERFORM fn_create_notification(
              'manager', v_on_call_manager.user_id, 'assignment_unreachable',
              format('Unreachable assignment: %s', v_ride.ride_name),
              format('Task assigned to %s but they have no active user account.',
                     COALESCE(v_assigned_employee.full_name, 'unknown employee')),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REASSIGNMENT' THEN
          PERFORM fn_create_notification(
            'staff',
            (SELECT user_id FROM employees WHERE employee_id = OLD.employee_id),
            'task_reassigned_from',
            format('Task transferred: %s', v_ride.ride_name),
            format('Your task on %s has been reassigned to another technician by %s.',
                   v_ride.ride_name, v_manager_label),
            'maintenance_requests', NEW.request_id
          );
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_reassigned_to',
              format('Transferred Task: %s', v_ride.ride_name),
              format('A %s priority task on %s has been transferred to you by %s. Details: %s',
                     NEW.priority, v_ride.ride_name, v_manager_label, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'reassignment_confirmed',
            format('Reassigned: %s', v_ride.ride_name),
            format('Request #%s on %s has been reassigned to %s.',
                   NEW.request_id, v_ride.ride_name,
                   COALESCE(v_assigned_employee.full_name, 'unassigned')),
            'maintenance_requests', NEW.request_id
          );

        ELSIF v_event_class = 'STATUS_PROGRESSION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'work_started',
            format('Work started: %s', v_ride.ride_name),
            format('%s has begun work on %s (Request #%s)',
                   COALESCE(v_assigned_employee.full_name, 'A technician'),
                   v_ride.ride_name, NEW.request_id),
            'maintenance_requests', NEW.request_id
          );

        ELSIF v_event_class = 'COMPLETION' THEN
          -- Re-check the ride status AFTER the auto-reopen in Phase 3c.
          IF EXISTS (SELECT 1 FROM rides WHERE ride_id = NEW.ride_id AND status = 'Operational') THEN
            PERFORM fn_create_notification(
              'staff', NULL, 'ride_reopened',
              format('%s is Back in Operation', v_ride.ride_name),
              format('%s has been cleared and is now open for guests.%s',
                     v_ride.ride_name,
                     CASE WHEN v_assigned_employee.full_name IS NOT NULL
                          THEN format(' Cleared by %s.', v_assigned_employee.full_name)
                          ELSE '' END),
              'rides', NEW.ride_id
            );
          ELSE
            PERFORM fn_create_notification(
              'manager', v_on_call_manager.user_id, 'partial_completion',
              format('Partial completion: %s', v_ride.ride_name),
              format('Request #%s completed, but ride still has pending work or an active zone closure.',
                     NEW.request_id),
              'maintenance_requests', NEW.request_id
            );
          END IF;
        END IF;

        -- PHASE 5: CROSS-RIDE INTERLOCK COORDINATION
        IF v_event_class IN ('CRITICAL_ESCALATION', 'REPEATED_FAILURE') THEN
          FOR v_interlocked_ride IN
            SELECT r.ride_id, r.ride_name
              FROM ride_interlocks ri
              JOIN rides r ON r.ride_id = ri.blocking_ride_id
             WHERE ri.ride_id = NEW.ride_id
          LOOP
            PERFORM fn_create_notification(
              'staff', NULL, 'interlock_advisory',
              format('Advisory: %s is down', v_ride.ride_name),
              format('%s is experiencing a critical issue. Because %s is interlocked, ' ||
                     'expect possible impacts to guest flow or evacuation routing.',
                     v_ride.ride_name, v_interlocked_ride.ride_name),
              'rides', v_interlocked_ride.ride_id
            );
          END LOOP;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECTION 15: SOFT-DELETE FOR MAINTENANCE REQUESTS
  // ═══════════════════════════════════════════════════════════════
  // Adds archived_at so completed maintenance requests can be hidden
  // from the admin/ride views without losing historical data. Reports
  // still read every row (including archived) so analytics stay
  // accurate. Admin list views filter WHERE archived_at IS NULL.
  // ═══════════════════════════════════════════════════════════════
  {
    name: "029_maintenance_archived_at",
    sql: `
      ALTER TABLE maintenance_requests
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_maint_requests_archived_at
        ON maintenance_requests (archived_at);
    `,
  },
];

const run = async () => {
  const client = await pool.connect();

  try {
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

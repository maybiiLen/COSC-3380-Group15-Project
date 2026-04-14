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
  {
    name: "028_add_description_image_to_rides",
    sql: `
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_type VARCHAR(50);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS thrill_level VARCHAR(20);
    `,
  },
  {
    name: "029_add_description_image_to_restaurant",
    sql: `
      ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS image_url TEXT;
    `,
  },
  {
    name: "030_add_description_image_to_gift_shop",
    sql: `
      ALTER TABLE gift_shop ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE gift_shop ADD COLUMN IF NOT EXISTS image_url TEXT;
    `,
  },
  {
    name: "031_add_description_image_to_game",
    sql: `
      ALTER TABLE game ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE game ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE game ADD COLUMN IF NOT EXISTS prize_type VARCHAR(100);
    `,
  },
  {
    name: "032_add_type_name_to_ticket_types",
    sql: `
      ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS type_name VARCHAR(100);
    `,
  },
  {
    name: "033_fix_park_closure_trigger",
    sql: `
      -- Fix: split into BEFORE (for ended_at) and AFTER (for notifications with closure_id)
      DROP TRIGGER IF EXISTS trg_park_closure_cascade ON park_closures;
      DROP FUNCTION IF EXISTS fn_park_closure_cascade();

      -- BEFORE trigger: only handles ended_at timestamp
      CREATE OR REPLACE FUNCTION fn_park_closure_before()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN
          NEW.ended_at = NOW();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_park_closure_before
      BEFORE UPDATE OF is_active ON park_closures
      FOR EACH ROW
      EXECUTE FUNCTION fn_park_closure_before();

      -- AFTER trigger: handles ride updates and notifications (closure_id is available)
      CREATE OR REPLACE FUNCTION fn_park_closure_after()
      RETURNS TRIGGER AS $$
      DECLARE
        v_affected_count INTEGER;
        v_ride_record    RECORD;
      BEGIN
        -- ZONE CLOSURE ACTIVATED
        IF NEW.is_active = true AND (TG_OP = 'INSERT'
           OR (TG_OP = 'UPDATE' AND OLD.is_active = false)) THEN

          UPDATE rides
          SET status = 'Closed', is_operational = false
          WHERE location = NEW.zone AND status != 'Closed';

          GET DIAGNOSTICS v_affected_count = ROW_COUNT;

          INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
          VALUES (
            'manager', 'park_closure',
            'Zone Closure: ' || NEW.zone || ' — ' || NEW.closure_type,
            NEW.zone || ' closed due to ' || LOWER(NEW.closure_type) || ': ' || NEW.reason || '. ' || v_affected_count || ' ride(s) shut down.',
            'park_closures', NEW.closure_id
          );

          FOR v_ride_record IN SELECT ride_id, ride_name FROM rides WHERE location = NEW.zone LOOP
            INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
            VALUES ('staff', 'ride_closed_zone', v_ride_record.ride_name || ' — Closed (Zone Closure)',
              v_ride_record.ride_name || ' shut down due to ' || LOWER(NEW.closure_type) || ' closure in ' || NEW.zone || '.',
              'rides', v_ride_record.ride_id);
          END LOOP;

        -- ZONE CLOSURE DEACTIVATED
        ELSIF TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN
          FOR v_ride_record IN SELECT r.ride_id, r.ride_name FROM rides r WHERE r.location = NEW.zone AND r.status = 'Closed' LOOP
            IF NOT EXISTS (SELECT 1 FROM maintenance_requests WHERE ride_id = v_ride_record.ride_id AND status IN ('Pending', 'In Progress')) THEN
              UPDATE rides SET status = 'Operational', is_operational = true WHERE ride_id = v_ride_record.ride_id;
            ELSE
              UPDATE rides SET status = 'Maintenance', is_operational = true WHERE ride_id = v_ride_record.ride_id;
            END IF;
          END LOOP;

          INSERT INTO notifications (recipient_role, type, title, message, related_table, related_id)
          VALUES ('staff', 'zone_reopened', 'Zone Reopened: ' || NEW.zone,
            NEW.zone || ' closure lifted. Rides without pending maintenance restored.',
            'park_closures', NEW.closure_id);
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_park_closure_after
      AFTER INSERT OR UPDATE OF is_active ON park_closures
      FOR EACH ROW
      EXECUTE FUNCTION fn_park_closure_after();
    `,
  },
  {
    name: "034_refactor_triggers_with_helper",
    sql: `
      -- ═══════════════════════════════════════════════════════════════════
      -- Drop all previous trigger versions before replacing them
      -- ═══════════════════════════════════════════════════════════════════
      DROP TRIGGER IF EXISTS trg_maintenance_safety_cascade ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_notify_on_maintenance_event ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_ride_status_on_maintenance ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_auto_completed_at ON maintenance_requests;
      DROP TRIGGER IF EXISTS trg_park_closure_before ON park_closures;
      DROP TRIGGER IF EXISTS trg_park_closure_after ON park_closures;
      DROP TRIGGER IF EXISTS trg_park_closure_cascade ON park_closures;

      DROP FUNCTION IF EXISTS fn_maintenance_safety_cascade();
      DROP FUNCTION IF EXISTS fn_notify_on_maintenance_event();
      DROP FUNCTION IF EXISTS fn_park_closure_cascade();
      DROP FUNCTION IF EXISTS fn_park_closure_before();
      DROP FUNCTION IF EXISTS fn_park_closure_after();
      DROP FUNCTION IF EXISTS fn_update_ride_status_on_maintenance();
      DROP FUNCTION IF EXISTS fn_auto_set_completed_at();
      DROP FUNCTION IF EXISTS fn_create_notification(VARCHAR,INTEGER,VARCHAR,VARCHAR,TEXT,VARCHAR,INTEGER);

      -- ═══════════════════════════════════════════════════════════════════
      -- HELPER: Reusable notification insert
      -- ═══════════════════════════════════════════════════════════════════
      -- Used by Trigger 2 and Trigger 3 to avoid repeating the same INSERT
      -- statement. Centralizing this means any future change to the
      -- notifications schema only needs to update one function.
      -- ═══════════════════════════════════════════════════════════════════
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

      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 1: MAINTENANCE SAFETY CASCADE (BEFORE)
      -- ═══════════════════════════════════════════════════════════════════
      -- Business constraint: A ride's operational status must stay consistent
      -- with its maintenance state. This trigger enforces:
      --   1. Critical priority → immediate hard safety lockout (Closed + offline)
      --   2. In Progress status → ride enters Maintenance
      --   3. Completed status → recompute ride status from remaining open work,
      --      with a Critical-priority override that preserves hard lockout
      --   4. New High/Critical Pending request on an Operational ride →
      --      ride enters Maintenance (runs on INSERT and on priority escalation)
      --
      -- Also auto-manages NEW.completed_at (only possible in a BEFORE trigger).
      --
      -- ECA Model:
      --   Event:     BEFORE INSERT OR UPDATE OF status, priority ON maintenance_requests
      --   Condition: Check NEW.status and NEW.priority against open request state
      --   Action:    Modify NEW.completed_at, UPDATE rides status/is_operational
      --
      -- Tables affected: maintenance_requests (source), rides (target)
      -- SQL features: NEW modification, NOT EXISTS subquery, CASE-like branching,
      --               OLD vs NEW comparison via IS DISTINCT FROM
      -- ═══════════════════════════════════════════════════════════════════
      CREATE OR REPLACE FUNCTION fn_maintenance_safety_cascade()
      RETURNS TRIGGER AS $$
      DECLARE
        v_ride_name  VARCHAR(255);
        v_open_count INTEGER;
      BEGIN
        -- Auto-manage completed_at timestamp (only possible in BEFORE trigger)
        IF NEW.status = 'Completed' AND (OLD IS NULL OR OLD.status != 'Completed') THEN
          NEW.completed_at := NOW();
        ELSIF NEW.status != 'Completed' THEN
          NEW.completed_at := NULL;
        END IF;

        SELECT ride_name INTO v_ride_name FROM rides WHERE ride_id = NEW.ride_id;

        -- RULE 1: Critical priority — immediate hard lockout
        IF NEW.priority = 'Critical' AND NEW.status != 'Completed' THEN
          UPDATE rides
             SET status = 'Closed', is_operational = false
           WHERE ride_id = NEW.ride_id;
          RETURN NEW;
        END IF;

        -- RULE 2: Request goes to In Progress — ride enters Maintenance
        IF NEW.status = 'In Progress' THEN
          UPDATE rides
             SET status = 'Maintenance'
           WHERE ride_id = NEW.ride_id;

        -- RULE 3: Request completed — recompute ride status from remaining work
        ELSIF NEW.status = 'Completed' THEN
          SELECT COUNT(*) INTO v_open_count
            FROM maintenance_requests
           WHERE ride_id = NEW.ride_id
             AND status IN ('Pending', 'In Progress')
             AND request_id != NEW.request_id;

          IF v_open_count = 0 THEN
            UPDATE rides
               SET status = 'Operational', is_operational = true
             WHERE ride_id = NEW.ride_id;

          ELSIF EXISTS (
            SELECT 1 FROM maintenance_requests
             WHERE ride_id = NEW.ride_id
               AND priority = 'Critical'
               AND status != 'Completed'
               AND request_id != NEW.request_id
          ) THEN
            UPDATE rides
               SET status = 'Closed', is_operational = false
             WHERE ride_id = NEW.ride_id;

          ELSE
            UPDATE rides
               SET status = 'Maintenance', is_operational = true
             WHERE ride_id = NEW.ride_id;
          END IF;

        -- RULE 4: High/Critical Pending on Operational ride
        ELSIF NEW.status = 'Pending' AND NEW.priority IN ('High', 'Critical')
              AND (TG_OP = 'INSERT' OR OLD.priority IS DISTINCT FROM NEW.priority) THEN
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

      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 2: NOTIFICATION ON MAINTENANCE EVENTS (AFTER)
      -- ═══════════════════════════════════════════════════════════════════
      -- Business constraint: Different maintenance severity levels require
      -- different operational responses. Runs AFTER so it sees the rides
      -- table state already updated by Trigger 1.
      --   - Critical/High priority created or escalated → managers alerted
      --   - Maintenance completed and ride back to Operational → staff alerted
      --   - Task assigned to employee with user account → employee notified
      --   - Task assigned to employee WITHOUT user account → managers alerted
      --     (fallback so no assignment silently drops)
      --
      -- ECA Model:
      --   Event:     AFTER INSERT OR UPDATE ON maintenance_requests
      --   Condition: Priority level, status transition, assignment change
      --   Action:    INSERT into notifications via fn_create_notification helper
      --
      -- Tables read: maintenance_requests (source), rides + employees (JOIN)
      -- Table written: notifications (target, via helper)
      -- SQL features: multi-table lookup, OLD vs NEW detection, conditional
      --               branching, fallback path for missing user account
      -- ═══════════════════════════════════════════════════════════════════
      CREATE OR REPLACE FUNCTION fn_notify_on_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_ride_name     VARCHAR(255);
        v_employee_name VARCHAR(255);
        v_employee_uid  INTEGER;
      BEGIN
        SELECT ride_name INTO v_ride_name
          FROM rides WHERE ride_id = NEW.ride_id;

        IF NEW.employee_id IS NOT NULL THEN
          SELECT e.full_name, e.user_id
            INTO v_employee_name, v_employee_uid
            FROM employees e WHERE e.employee_id = NEW.employee_id;
        END IF;

        -- SCENARIO 1: Critical/High priority created or escalated
        IF (TG_OP = 'INSERT' AND NEW.priority IN ('Critical', 'High'))
           OR (TG_OP = 'UPDATE' AND NEW.priority IN ('Critical', 'High')
               AND (OLD.priority IS NULL OR OLD.priority NOT IN ('Critical', 'High'))) THEN
          PERFORM fn_create_notification(
            'manager', NULL, 'maintenance_critical',
            CASE NEW.priority
              WHEN 'Critical' THEN '🚨 CRITICAL: ' || v_ride_name || ' — Immediate Action Required'
              ELSE '⚠️ HIGH PRIORITY: ' || v_ride_name || ' — Maintenance Needed'
            END,
            'A ' || NEW.priority || ' priority maintenance request has been filed for '
              || v_ride_name || ': ' || NEW.description,
            'maintenance_requests', NEW.request_id
          );
        END IF;

        -- SCENARIO 2: Maintenance completed, ride now Operational
        IF TG_OP = 'UPDATE' AND NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
          IF EXISTS (
            SELECT 1 FROM rides WHERE ride_id = NEW.ride_id AND status = 'Operational'
          ) THEN
            PERFORM fn_create_notification(
              'staff', NULL, 'ride_reopened',
              '✅ ' || v_ride_name || ' is Back in Operation',
              v_ride_name || ' has been cleared after maintenance and is now open for guests.'
                || CASE WHEN v_employee_name IS NOT NULL
                        THEN ' Cleared by ' || v_employee_name || '.'
                        ELSE '' END,
              'rides', NEW.ride_id
            );
          END IF;
        END IF;

        -- SCENARIO 3: Task assigned or reassigned
        IF NEW.employee_id IS NOT NULL
           AND (TG_OP = 'INSERT'
                OR (TG_OP = 'UPDATE' AND (OLD.employee_id IS NULL OR OLD.employee_id != NEW.employee_id))) THEN

          IF v_employee_uid IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_employee_uid, 'maintenance_assigned',
              '🔧 New Task: ' || v_ride_name,
              'You have been assigned to a ' || NEW.priority
                || ' priority maintenance task on ' || v_ride_name || ': ' || NEW.description,
              'maintenance_requests', NEW.request_id
            );
          ELSE
            PERFORM fn_create_notification(
              'manager', NULL, 'maintenance_assigned_unreachable',
              '⚠️ Assignment to Unreachable Employee: ' || v_ride_name,
              'Task assigned to ' || COALESCE(v_employee_name, 'employee ID ' || NEW.employee_id)
                || ' but they have no active user account. Manual notification required.',
              'maintenance_requests', NEW.request_id
            );
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_notify_on_maintenance_event
      AFTER INSERT OR UPDATE ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_notify_on_maintenance_event();

      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 3: PARK CLOSURE CASCADE (BEFORE)
      -- ═══════════════════════════════════════════════════════════════════
      -- Business constraint: When a park zone is closed (weather, emergency,
      -- safety), ALL rides in that zone must be automatically shut down.
      -- When the closure ends, rides are restored based on their own
      -- maintenance state — with the rule that any ride with pending
      -- CRITICAL maintenance work remains on hard lockout (Closed +
      -- is_operational = false), consistent with Trigger 1's priority
      -- hierarchy. Rides with non-critical pending work return to
      -- Maintenance. Rides with no open work return to Operational.
      --
      -- ECA Model:
      --   Event:     BEFORE INSERT OR UPDATE OF is_active ON park_closures
      --   Condition: Closure activation or deactivation
      --   Action:    Bulk UPDATE rides, per-ride restore logic, cascade
      --              notifications via helper
      --
      -- Tables read: park_closures (source), rides (JOIN), maintenance_requests
      -- Tables written: rides (bulk UPDATE), notifications (via helper)
      -- SQL features: bulk UPDATE with CTE + FOR UPDATE lock ordering,
      --               RECORD loop variable, NOT EXISTS / EXISTS subqueries,
      --               ROW_COUNT diagnostics, NEW modification for ended_at,
      --               CONTINUE for Critical-priority preservation
      -- ═══════════════════════════════════════════════════════════════════
      CREATE OR REPLACE FUNCTION fn_park_closure_cascade()
      RETURNS TRIGGER AS $$
      DECLARE
        v_affected_count INTEGER;
        v_ride_record    RECORD;
      BEGIN
        -- ZONE CLOSURE ACTIVATED
        IF NEW.is_active = true
           AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active = false)) THEN

          WITH to_close AS (
            SELECT ride_id FROM rides
             WHERE location = NEW.zone AND status != 'Closed'
             ORDER BY ride_id
             FOR UPDATE
          )
          UPDATE rides
             SET status = 'Closed', is_operational = false
           WHERE ride_id IN (SELECT ride_id FROM to_close);

          GET DIAGNOSTICS v_affected_count = ROW_COUNT;

          PERFORM fn_create_notification(
            'manager', NULL, 'park_closure',
            '🚫 Zone Closure: ' || NEW.zone || ' — ' || NEW.closure_type,
            NEW.zone || ' has been closed due to ' || LOWER(NEW.closure_type) || ': ' || NEW.reason
              || '. ' || v_affected_count || ' ride(s) have been automatically shut down.',
            'park_closures', NEW.closure_id
          );

          FOR v_ride_record IN
            SELECT ride_id, ride_name FROM rides
             WHERE location = NEW.zone
             ORDER BY ride_id
          LOOP
            PERFORM fn_create_notification(
              'staff', NULL, 'ride_closed_zone',
              '⛔ ' || v_ride_record.ride_name || ' — Closed (Zone Closure)',
              v_ride_record.ride_name || ' has been shut down due to a ' || LOWER(NEW.closure_type)
                || ' closure in ' || NEW.zone || '. Do not allow guests on this ride until further notice.',
              'rides', v_ride_record.ride_id
            );
          END LOOP;

        -- ZONE CLOSURE DEACTIVATED
        ELSIF TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN
          NEW.ended_at := NOW();

          FOR v_ride_record IN
            SELECT r.ride_id, r.ride_name FROM rides r
             WHERE r.location = NEW.zone AND r.status = 'Closed'
             ORDER BY r.ride_id
          LOOP
            IF EXISTS (
              SELECT 1 FROM maintenance_requests
               WHERE ride_id = v_ride_record.ride_id
                 AND priority = 'Critical'
                 AND status != 'Completed'
            ) THEN
              CONTINUE;

            ELSIF NOT EXISTS (
              SELECT 1 FROM maintenance_requests
               WHERE ride_id = v_ride_record.ride_id
                 AND status IN ('Pending', 'In Progress')
            ) THEN
              UPDATE rides
                 SET status = 'Operational', is_operational = true
               WHERE ride_id = v_ride_record.ride_id;

            ELSE
              UPDATE rides
                 SET status = 'Maintenance', is_operational = true
               WHERE ride_id = v_ride_record.ride_id;
            END IF;
          END LOOP;

          PERFORM fn_create_notification(
            'staff', NULL, 'zone_reopened',
            '✅ Zone Reopened: ' || NEW.zone,
            NEW.zone || ' closure has been lifted. Rides without pending maintenance have been restored to Operational. Rides with pending Critical work remain on safety lockout. Please verify each ride before admitting guests.',
            'park_closures', NEW.closure_id
          );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_park_closure_cascade
      BEFORE INSERT OR UPDATE OF is_active ON park_closures
      FOR EACH ROW
      EXECUTE FUNCTION fn_park_closure_cascade();
    `,
  },
  {
    name: "035_time_based_priority_escalation",
    sql: `
      -- ═══════════════════════════════════════════════════════════════════
      -- SCHEDULED FUNCTION: Time-based Priority Escalation
      -- ═══════════════════════════════════════════════════════════════════
      -- Business rule: Maintenance requests that sit unaddressed get more
      -- urgent over time. A Low-priority request ignored for 3 days should
      -- become Medium; Medium ignored for 3 more should become High; High
      -- ignored for 3 more should become Critical. This prevents tickets
      -- from being silently forgotten and enforces operational SLAs.
      --
      -- This function is designed to be called on a schedule or manually.
      -- When it escalates a priority, the UPDATE triggers Trigger 1
      -- (Rule 4 picks up the change and updates ride status) and
      -- Trigger 2 (Scenario 1 fires Critical/High alerts to managers).
      -- Full cascade reuse — no new notification code needed.
      --
      -- Parameters are configurable in seconds. For demo: use 10s.
      -- For production: use 259200 (3 days).
      -- ═══════════════════════════════════════════════════════════════════
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
      BEGIN
        -- Escalate Low → Medium
        RETURN QUERY
        WITH escalated AS (
          UPDATE maintenance_requests m
             SET priority = 'Medium'
           WHERE m.priority = 'Low'
             AND m.status IN ('Pending', 'In Progress')
             AND EXTRACT(EPOCH FROM (NOW() - m.created_at)) >= p_low_to_medium_seconds
          RETURNING m.request_id, 'Low'::VARCHAR AS old_p, 'Medium'::VARCHAR AS new_p,
                    EXTRACT(EPOCH FROM (NOW() - m.created_at))::INTEGER AS age
        )
        SELECT escalated.request_id, escalated.old_p, escalated.new_p, escalated.age
          FROM escalated;

        -- Escalate Medium → High
        RETURN QUERY
        WITH escalated AS (
          UPDATE maintenance_requests m
             SET priority = 'High'
           WHERE m.priority = 'Medium'
             AND m.status IN ('Pending', 'In Progress')
             AND EXTRACT(EPOCH FROM (NOW() - m.created_at)) >= p_medium_to_high_seconds
          RETURNING m.request_id, 'Medium'::VARCHAR AS old_p, 'High'::VARCHAR AS new_p,
                    EXTRACT(EPOCH FROM (NOW() - m.created_at))::INTEGER AS age
        )
        SELECT escalated.request_id, escalated.old_p, escalated.new_p, escalated.age
          FROM escalated;

        -- Escalate High → Critical
        RETURN QUERY
        WITH escalated AS (
          UPDATE maintenance_requests m
             SET priority = 'Critical'
           WHERE m.priority = 'High'
             AND m.status IN ('Pending', 'In Progress')
             AND EXTRACT(EPOCH FROM (NOW() - m.created_at)) >= p_high_to_critical_seconds
          RETURNING m.request_id, 'High'::VARCHAR AS old_p, 'Critical'::VARCHAR AS new_p,
                    EXTRACT(EPOCH FROM (NOW() - m.created_at))::INTEGER AS age
        )
        SELECT escalated.request_id, escalated.old_p, escalated.new_p, escalated.age
          FROM escalated;
      END;
      $$ LANGUAGE plpgsql;
    `,
  },
  {
    name: "036_fix_escalation_one_level_and_pgcron",
    sql: `
      -- ═══════════════════════════════════════════════════════════════════
      -- FIX: Escalate only ONE level per invocation
      -- ═══════════════════════════════════════════════════════════════════
      -- The previous version ran all 3 steps sequentially in one call,
      -- so a Low request jumped straight to Critical. This version uses
      -- a loop approach to move each request up exactly one priority
      -- tier per call. Multiple calls are needed to reach Critical —
      -- which is exactly the behavior we want for the demo
      -- (Low → Medium → High → Critical over 3 separate invocations).
      --
      -- Each UPDATE still fires Trigger 1 (ride status cascade) and
      -- Trigger 2 (manager notifications) via the existing trigger chain.
      -- ═══════════════════════════════════════════════════════════════════
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

      -- pg_cron must be enabled via the Neon dashboard or in the postgres
      -- database directly. The backend API endpoints handle scheduling
      -- the cron job at runtime via cron.schedule().
    `,
  },
  {
    name: "037_fix_escalation_function_reapply",
    sql: `
      -- Migration 036 was already recorded but the DB still has the broken
      -- CTE-based version. This re-applies the corrected FOR LOOP version.
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
  {
    name: "038_dispatch_safety_envelope",
    sql: `
      -- ═══════════════════════════════════════════════════════════════
      -- Supporting tables for the Ride Dispatch Safety Envelope
      -- ═══════════════════════════════════════════════════════════════

      -- Every actual ride dispatch (cycle run)
      CREATE TABLE IF NOT EXISTS ride_dispatches (
        dispatch_id       SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        operator_id       INTEGER NOT NULL REFERENCES employees(employee_id),
        dispatched_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        cycle_duration_s  INTEGER,
        guest_count       INTEGER NOT NULL,
        dispatch_notes    TEXT
      );

      -- Continuous weather readings
      CREATE TABLE IF NOT EXISTS weather_readings (
        reading_id        SERIAL PRIMARY KEY,
        recorded_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        wind_speed_mph    NUMERIC(5,2),
        lightning_miles   NUMERIC(5,2),
        temperature_f     NUMERIC(5,2),
        precipitation     VARCHAR(20)
      );

      -- Ride-specific safety envelope columns
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS max_cycles_per_hour      INTEGER;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS max_wind_mph             NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS min_lightning_miles       NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS min_temp_f               NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS max_temp_f               NUMERIC(5,2);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS inspection_cycle_interval INTEGER;
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS cycles_since_inspection  INTEGER NOT NULL DEFAULT 0;

      -- Operator shift tracking
      CREATE TABLE IF NOT EXISTS operator_assignments (
        assignment_id     SERIAL PRIMARY KEY,
        employee_id       INTEGER NOT NULL REFERENCES employees(employee_id),
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        started_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at          TIMESTAMP
      );

      -- Guests loaded onto the next cycle (cleared on dispatch)
      CREATE TABLE IF NOT EXISTS ride_dispatch_queue (
        queue_id          SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        customer_id       INTEGER NOT NULL REFERENCES customers(customer_id),
        measured_height_in NUMERIC(4,1) NOT NULL,
        accessibility_flag VARCHAR(50),
        loaded_at         TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Structured dispatch rejection log
      CREATE TABLE IF NOT EXISTS dispatch_rejections (
        rejection_id      SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        operator_id       INTEGER REFERENCES employees(employee_id),
        attempted_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        rejection_code    VARCHAR(50) NOT NULL,
        rejection_detail  TEXT NOT NULL,
        context_data      JSONB
      );

      -- Cross-ride safety interlocks
      CREATE TABLE IF NOT EXISTS ride_interlocks (
        interlock_id      SERIAL PRIMARY KEY,
        ride_id           INTEGER NOT NULL REFERENCES rides(ride_id),
        blocking_ride_id  INTEGER NOT NULL REFERENCES rides(ride_id),
        block_reason      TEXT
      );

      -- ═══════════════════════════════════════════════════════════════
      -- TRIGGER: RIDE DISPATCH SAFETY ENVELOPE ENFORCEMENT
      -- ═══════════════════════════════════════════════════════════════
      -- 7-gate safety check on BEFORE INSERT ON ride_dispatches.
      -- Gates evaluated in cheap-to-expensive order:
      --   1. Ride status + Critical maintenance
      --   2. Inspection cycle threshold
      --   3. Rolling 60-min throughput
      --   4. Operator consecutive-hours limit (4 hr max)
      --   5. Weather envelope (wind, lightning, temperature)
      --   6. Guest height compliance
      --   7. Cross-ride interlock check
      -- On success: increments cycle counter, clears dispatch queue.
      -- On failure: logs structured rejection + raises exception.
      -- ═══════════════════════════════════════════════════════════════

      CREATE OR REPLACE FUNCTION fn_enforce_dispatch_envelope()
      RETURNS TRIGGER AS $$
      DECLARE
        v_ride               rides%ROWTYPE;
        v_rolling_count      INTEGER;
        v_operator_hours     NUMERIC;
        v_latest_weather     weather_readings%ROWTYPE;
        v_bad_height_count   INTEGER;
        v_interlock_blocked  BOOLEAN;
        v_context            JSONB;
        v_rejection_code     VARCHAR(50);
        v_rejection_detail   TEXT;
      BEGIN
        -- Load ride config once
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Ride % does not exist', NEW.ride_id
            USING ERRCODE = 'RD001';
        END IF;

        -- GATE 1: Ride status + Critical maintenance interlock
        IF v_ride.status != 'Operational' OR v_ride.is_operational = false THEN
          v_rejection_code := 'RIDE_NOT_OPERATIONAL';
          v_rejection_detail := format('Ride %s is in status %s', v_ride.ride_name, v_ride.status);

        ELSIF EXISTS (
          SELECT 1 FROM maintenance_requests
           WHERE ride_id = NEW.ride_id
             AND priority = 'Critical'
             AND status != 'Completed'
        ) THEN
          v_rejection_code := 'CRITICAL_MAINTENANCE_PENDING';
          v_rejection_detail := format('Ride %s has pending Critical maintenance', v_ride.ride_name);

        ELSE
          -- GATE 2: Inspection cycle interlock
          IF v_ride.inspection_cycle_interval IS NOT NULL
             AND v_ride.cycles_since_inspection >= v_ride.inspection_cycle_interval THEN
            v_rejection_code := 'INSPECTION_DUE';
            v_rejection_detail := format(
              'Ride %s has run %s cycles since last inspection (limit: %s)',
              v_ride.ride_name, v_ride.cycles_since_inspection, v_ride.inspection_cycle_interval
            );
          END IF;

          -- GATE 3: Rolling 60-minute throughput
          IF v_rejection_code IS NULL THEN
            SELECT COUNT(*) INTO v_rolling_count
              FROM ride_dispatches
             WHERE ride_id = NEW.ride_id
               AND dispatched_at >= NOW() - INTERVAL '1 hour';

            IF v_ride.max_cycles_per_hour IS NOT NULL
               AND v_rolling_count >= v_ride.max_cycles_per_hour THEN
              v_rejection_code := 'THROUGHPUT_LIMIT';
              v_rejection_detail := format(
                'Ride %s has dispatched %s cycles in the last hour (max: %s)',
                v_ride.ride_name, v_rolling_count, v_ride.max_cycles_per_hour
              );
            END IF;
          END IF;

          -- GATE 4: Operator consecutive-hours limit
          IF v_rejection_code IS NULL THEN
            SELECT EXTRACT(EPOCH FROM (NOW() - MIN(started_at))) / 3600
              INTO v_operator_hours
              FROM operator_assignments
             WHERE employee_id = NEW.operator_id
               AND ride_id = NEW.ride_id
               AND ended_at IS NULL;

            IF v_operator_hours IS NOT NULL AND v_operator_hours >= 4 THEN
              v_rejection_code := 'OPERATOR_FATIGUE';
              v_rejection_detail := format(
                'Operator %s has been on ride %s for %.1f hours (max: 4)',
                NEW.operator_id, v_ride.ride_name, v_operator_hours
              );
            END IF;
          END IF;

          -- GATE 5: Weather envelope
          IF v_rejection_code IS NULL THEN
            SELECT * INTO v_latest_weather
              FROM weather_readings
             ORDER BY recorded_at DESC
             LIMIT 1;

            IF v_latest_weather.reading_id IS NOT NULL THEN
              IF v_ride.max_wind_mph IS NOT NULL
                 AND v_latest_weather.wind_speed_mph > v_ride.max_wind_mph THEN
                v_rejection_code := 'WEATHER_WIND';
                v_rejection_detail := format(
                  'Wind %.1f mph exceeds ride max of %.1f mph',
                  v_latest_weather.wind_speed_mph, v_ride.max_wind_mph
                );
              ELSIF v_ride.min_lightning_miles IS NOT NULL
                 AND v_latest_weather.lightning_miles < v_ride.min_lightning_miles THEN
                v_rejection_code := 'WEATHER_LIGHTNING';
                v_rejection_detail := format(
                  'Lightning detected %.1f miles away (min safe: %.1f)',
                  v_latest_weather.lightning_miles, v_ride.min_lightning_miles
                );
              ELSIF v_ride.min_temp_f IS NOT NULL AND v_ride.max_temp_f IS NOT NULL
                 AND (v_latest_weather.temperature_f < v_ride.min_temp_f
                      OR v_latest_weather.temperature_f > v_ride.max_temp_f) THEN
                v_rejection_code := 'WEATHER_TEMPERATURE';
                v_rejection_detail := format(
                  'Temperature %.1f°F outside ride envelope [%.1f, %.1f]',
                  v_latest_weather.temperature_f, v_ride.min_temp_f, v_ride.max_temp_f
                );
              END IF;
            END IF;
          END IF;

          -- GATE 6: Guest height compliance
          IF v_rejection_code IS NULL THEN
            SELECT COUNT(*) INTO v_bad_height_count
              FROM ride_dispatch_queue
             WHERE ride_id = NEW.ride_id
               AND measured_height_in < v_ride.min_height_in;

            IF v_bad_height_count > 0 THEN
              v_rejection_code := 'HEIGHT_VIOLATION';
              v_rejection_detail := format(
                '%s guest(s) in queue below min height of %s inches',
                v_bad_height_count, v_ride.min_height_in
              );
            END IF;
          END IF;

          -- GATE 7: Cross-ride interlock
          IF v_rejection_code IS NULL THEN
            SELECT EXISTS (
              SELECT 1
                FROM ride_interlocks ri
                JOIN rides sibling ON sibling.ride_id = ri.blocking_ride_id
               WHERE ri.ride_id = NEW.ride_id
                 AND (
                   sibling.status = 'Closed'
                   OR sibling.is_operational = false
                   OR EXISTS (
                     SELECT 1 FROM maintenance_requests mr
                      WHERE mr.ride_id = ri.blocking_ride_id
                        AND mr.priority = 'Critical'
                        AND mr.status != 'Completed'
                   )
                 )
            ) INTO v_interlock_blocked;

            IF v_interlock_blocked THEN
              v_rejection_code := 'INTERLOCK_BLOCKED';
              v_rejection_detail := format(
                'Dispatch blocked by interlocked sibling ride on %s', v_ride.ride_name
              );
            END IF;
          END IF;
        END IF;

        -- ── REJECTION PATH ──
        IF v_rejection_code IS NOT NULL THEN
          v_context := jsonb_build_object(
            'ride_id', NEW.ride_id,
            'ride_name', v_ride.ride_name,
            'ride_status', v_ride.status,
            'cycles_since_inspection', v_ride.cycles_since_inspection,
            'rolling_hour_count', v_rolling_count,
            'operator_hours', v_operator_hours,
            'wind_mph', v_latest_weather.wind_speed_mph,
            'lightning_miles', v_latest_weather.lightning_miles,
            'temperature_f', v_latest_weather.temperature_f,
            'rejection_code', v_rejection_code
          );

          INSERT INTO dispatch_rejections (
            ride_id, operator_id, rejection_code, rejection_detail, context_data
          )
          VALUES (
            NEW.ride_id, NEW.operator_id, v_rejection_code, v_rejection_detail, v_context
          );

          RAISE EXCEPTION 'Dispatch rejected: % — %', v_rejection_code, v_rejection_detail
            USING ERRCODE = 'RD002',
                  DETAIL  = v_context::TEXT,
                  HINT    = 'Resolve the blocking condition before retrying dispatch';
        END IF;

        -- ── ALL GATES PASSED — allow dispatch ──
        UPDATE rides
           SET cycles_since_inspection = cycles_since_inspection + 1
         WHERE ride_id = NEW.ride_id;

        DELETE FROM ride_dispatch_queue WHERE ride_id = NEW.ride_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Attach to ride_dispatches
      DROP TRIGGER IF EXISTS trg_enforce_dispatch_envelope ON ride_dispatches;
      CREATE TRIGGER trg_enforce_dispatch_envelope
      BEFORE INSERT ON ride_dispatches
      FOR EACH ROW
      EXECUTE FUNCTION fn_enforce_dispatch_envelope();
    `,
  },
  {
    name: "039_fix_dispatch_format_specifiers",
    sql: `
      CREATE OR REPLACE FUNCTION fn_enforce_dispatch_envelope()
      RETURNS TRIGGER AS $$
      DECLARE
        v_ride               rides%ROWTYPE;
        v_rolling_count      INTEGER;
        v_operator_hours     NUMERIC;
        v_latest_weather     weather_readings%ROWTYPE;
        v_bad_height_count   INTEGER;
        v_interlock_blocked  BOOLEAN;
        v_context            JSONB;
        v_rejection_code     VARCHAR(50);
        v_rejection_detail   TEXT;
      BEGIN
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Ride % does not exist', NEW.ride_id
            USING ERRCODE = 'RD001';
        END IF;

        -- GATE 1: Ride status + Critical maintenance
        IF v_ride.status != 'Operational' OR v_ride.is_operational = false THEN
          v_rejection_code := 'RIDE_NOT_OPERATIONAL';
          v_rejection_detail := format('Ride %s is in status %s', v_ride.ride_name, v_ride.status);

        ELSIF EXISTS (
          SELECT 1 FROM maintenance_requests
           WHERE ride_id = NEW.ride_id AND priority = 'Critical' AND status != 'Completed'
        ) THEN
          v_rejection_code := 'CRITICAL_MAINTENANCE_PENDING';
          v_rejection_detail := format('Ride %s has pending Critical maintenance', v_ride.ride_name);

        ELSE
          -- GATE 2: Inspection cycle interlock
          IF v_ride.inspection_cycle_interval IS NOT NULL
             AND v_ride.cycles_since_inspection >= v_ride.inspection_cycle_interval THEN
            v_rejection_code := 'INSPECTION_DUE';
            v_rejection_detail := format(
              'Ride %s has run %s cycles since last inspection (limit: %s)',
              v_ride.ride_name, v_ride.cycles_since_inspection, v_ride.inspection_cycle_interval
            );
          END IF;

          -- GATE 3: Rolling 60-minute throughput
          IF v_rejection_code IS NULL THEN
            SELECT COUNT(*) INTO v_rolling_count
              FROM ride_dispatches
             WHERE ride_id = NEW.ride_id
               AND dispatched_at >= NOW() - INTERVAL '1 hour';

            IF v_ride.max_cycles_per_hour IS NOT NULL
               AND v_rolling_count >= v_ride.max_cycles_per_hour THEN
              v_rejection_code := 'THROUGHPUT_LIMIT';
              v_rejection_detail := format(
                'Ride %s has dispatched %s cycles in the last hour (max: %s)',
                v_ride.ride_name, v_rolling_count, v_ride.max_cycles_per_hour
              );
            END IF;
          END IF;

          -- GATE 4: Operator consecutive-hours limit
          IF v_rejection_code IS NULL THEN
            SELECT EXTRACT(EPOCH FROM (NOW() - MIN(started_at))) / 3600
              INTO v_operator_hours
              FROM operator_assignments
             WHERE employee_id = NEW.operator_id
               AND ride_id = NEW.ride_id
               AND ended_at IS NULL;

            IF v_operator_hours IS NOT NULL AND v_operator_hours >= 4 THEN
              v_rejection_code := 'OPERATOR_FATIGUE';
              v_rejection_detail := format(
                'Operator %s has been on ride %s for %s hours (max: 4)',
                NEW.operator_id, v_ride.ride_name, ROUND(v_operator_hours, 1)
              );
            END IF;
          END IF;

          -- GATE 5: Weather envelope
          IF v_rejection_code IS NULL THEN
            SELECT * INTO v_latest_weather
              FROM weather_readings
             ORDER BY recorded_at DESC
             LIMIT 1;

            IF v_latest_weather.reading_id IS NOT NULL THEN
              IF v_ride.max_wind_mph IS NOT NULL
                 AND v_latest_weather.wind_speed_mph > v_ride.max_wind_mph THEN
                v_rejection_code := 'WEATHER_WIND';
                v_rejection_detail := format(
                  'Wind %s mph exceeds ride max of %s mph',
                  ROUND(v_latest_weather.wind_speed_mph, 1), ROUND(v_ride.max_wind_mph, 1)
                );
              ELSIF v_ride.min_lightning_miles IS NOT NULL
                 AND v_latest_weather.lightning_miles < v_ride.min_lightning_miles THEN
                v_rejection_code := 'WEATHER_LIGHTNING';
                v_rejection_detail := format(
                  'Lightning detected %s miles away (min safe: %s)',
                  ROUND(v_latest_weather.lightning_miles, 1), ROUND(v_ride.min_lightning_miles, 1)
                );
              ELSIF v_ride.min_temp_f IS NOT NULL AND v_ride.max_temp_f IS NOT NULL
                 AND (v_latest_weather.temperature_f < v_ride.min_temp_f
                      OR v_latest_weather.temperature_f > v_ride.max_temp_f) THEN
                v_rejection_code := 'WEATHER_TEMPERATURE';
                v_rejection_detail := format(
                  'Temperature %s F outside ride envelope [%s, %s]',
                  ROUND(v_latest_weather.temperature_f, 1), ROUND(v_ride.min_temp_f, 1), ROUND(v_ride.max_temp_f, 1)
                );
              END IF;
            END IF;
          END IF;

          -- GATE 6: Guest height compliance
          IF v_rejection_code IS NULL THEN
            SELECT COUNT(*) INTO v_bad_height_count
              FROM ride_dispatch_queue
             WHERE ride_id = NEW.ride_id
               AND measured_height_in < v_ride.min_height_in;

            IF v_bad_height_count > 0 THEN
              v_rejection_code := 'HEIGHT_VIOLATION';
              v_rejection_detail := format(
                '%s guest(s) in queue below min height of %s inches',
                v_bad_height_count, v_ride.min_height_in
              );
            END IF;
          END IF;

          -- GATE 7: Cross-ride interlock
          IF v_rejection_code IS NULL THEN
            SELECT EXISTS (
              SELECT 1
                FROM ride_interlocks ri
                JOIN rides sibling ON sibling.ride_id = ri.blocking_ride_id
               WHERE ri.ride_id = NEW.ride_id
                 AND (
                   sibling.status = 'Closed'
                   OR sibling.is_operational = false
                   OR EXISTS (
                     SELECT 1 FROM maintenance_requests mr
                      WHERE mr.ride_id = ri.blocking_ride_id
                        AND mr.priority = 'Critical'
                        AND mr.status != 'Completed'
                   )
                 )
            ) INTO v_interlock_blocked;

            IF v_interlock_blocked THEN
              v_rejection_code := 'INTERLOCK_BLOCKED';
              v_rejection_detail := format(
                'Dispatch blocked by interlocked sibling ride on %s', v_ride.ride_name
              );
            END IF;
          END IF;
        END IF;

        -- REJECTION PATH
        IF v_rejection_code IS NOT NULL THEN
          v_context := jsonb_build_object(
            'ride_id', NEW.ride_id,
            'ride_name', v_ride.ride_name,
            'ride_status', v_ride.status,
            'cycles_since_inspection', v_ride.cycles_since_inspection,
            'rolling_hour_count', v_rolling_count,
            'operator_hours', v_operator_hours,
            'wind_mph', v_latest_weather.wind_speed_mph,
            'lightning_miles', v_latest_weather.lightning_miles,
            'temperature_f', v_latest_weather.temperature_f,
            'rejection_code', v_rejection_code
          );

          INSERT INTO dispatch_rejections (
            ride_id, operator_id, rejection_code, rejection_detail, context_data
          )
          VALUES (
            NEW.ride_id, NEW.operator_id, v_rejection_code, v_rejection_detail, v_context
          );

          RAISE EXCEPTION 'Dispatch rejected: % — %', v_rejection_code, v_rejection_detail
            USING ERRCODE = 'RD002',
                  DETAIL  = v_context::TEXT,
                  HINT    = 'Resolve the blocking condition before retrying dispatch';
        END IF;

        -- ALL GATES PASSED
        UPDATE rides
           SET cycles_since_inspection = cycles_since_inspection + 1
         WHERE ride_id = NEW.ride_id;

        DELETE FROM ride_dispatch_queue WHERE ride_id = NEW.ride_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `,
  },
  {
    name: "040_intelligent_event_routing_trigger",
    sql: `
      -- ═══════════════════════════════════════════════════════════════
      -- Pre-requisites: add missing columns to employees
      -- ═══════════════════════════════════════════════════════════════
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

      -- ═══════════════════════════════════════════════════════════════
      -- Drop old Trigger 2 (simple notification) and dispatch trigger
      -- ═══════════════════════════════════════════════════════════════
      DROP TRIGGER IF EXISTS trg_notify_on_maintenance_event ON maintenance_requests;
      DROP FUNCTION IF EXISTS fn_notify_on_maintenance_event();

      DROP TRIGGER IF EXISTS trg_enforce_dispatch_envelope ON ride_dispatches;
      DROP FUNCTION IF EXISTS fn_enforce_dispatch_envelope();

      -- ═══════════════════════════════════════════════════════════════
      -- New supporting tables
      -- ═══════════════════════════════════════════════════════════════

      CREATE TABLE IF NOT EXISTS incident_tracking (
        incident_id            SERIAL PRIMARY KEY,
        ride_id                INTEGER NOT NULL REFERENCES rides(ride_id),
        triggering_request_id  INTEGER NOT NULL,
        severity               VARCHAR(20) NOT NULL,
        incident_status        VARCHAR(20) NOT NULL DEFAULT 'active',
        related_request_ids    INTEGER[] NOT NULL,
        event_count            INTEGER NOT NULL DEFAULT 1,
        created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
        last_event_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at            TIMESTAMP,
        acknowledged_by        INTEGER REFERENCES employees(employee_id),
        acknowledged_at        TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_incident_tracking_active
        ON incident_tracking(ride_id, incident_status)
        WHERE incident_status = 'active';

      CREATE TABLE IF NOT EXISTS sms_queue (
        sms_id              SERIAL PRIMARY KEY,
        recipient_phone     VARCHAR(20) NOT NULL,
        recipient_name      VARCHAR(255),
        message_body        TEXT NOT NULL,
        priority            VARCHAR(20) NOT NULL DEFAULT 'normal',
        status              VARCHAR(20) NOT NULL DEFAULT 'queued',
        related_request_id  INTEGER,
        queued_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at             TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_queue (
        email_id            SERIAL PRIMARY KEY,
        recipient_email     VARCHAR(255) NOT NULL,
        subject             VARCHAR(500) NOT NULL,
        body                TEXT NOT NULL,
        priority            VARCHAR(20) NOT NULL DEFAULT 'normal',
        status              VARCHAR(20) NOT NULL DEFAULT 'queued',
        related_request_id  INTEGER,
        queued_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at             TIMESTAMP
      );

      -- Add self-interlock constraint if ride_interlocks exists
      -- (table was created in migration 038)
      DO $do$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_no_self_interlock'
        ) THEN
          ALTER TABLE ride_interlocks
            ADD CONSTRAINT chk_no_self_interlock CHECK (ride_id != blocking_ride_id);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $do$;

      -- ═══════════════════════════════════════════════════════════════
      -- Seed ride interlocks with realistic relationships
      -- ═══════════════════════════════════════════════════════════════
      INSERT INTO ride_interlocks (ride_id, blocking_ride_id, block_reason)
      SELECT r1.ride_id, r2.ride_id, 'shared_evacuation_path'
        FROM rides r1
        JOIN rides r2 ON r1.location = r2.location
                     AND r1.ride_id < r2.ride_id
       WHERE r1.location IS NOT NULL
       LIMIT 3
      ON CONFLICT DO NOTHING;

      -- Seed some phone numbers on manager employees
      UPDATE employees SET phone = '555-0100'
       WHERE role = 'manager' AND phone IS NULL
         AND employee_id = (SELECT MIN(employee_id) FROM employees WHERE role = 'manager');

      -- ═══════════════════════════════════════════════════════════════
      -- TRIGGER 2 (REVAMPED): INTELLIGENT EVENT ROUTING & NOTIFICATION FAN-OUT
      -- ═══════════════════════════════════════════════════════════════
      CREATE OR REPLACE FUNCTION fn_route_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_event_class        VARCHAR(50);
        v_ride               rides%ROWTYPE;
        v_assigned_employee  employees%ROWTYPE;
        v_recent_critical    INTEGER;
        v_existing_incident  RECORD;
        v_on_call_manager    RECORD;
        v_interlocked_ride   RECORD;
        v_dedup_window       INTERVAL := INTERVAL '10 minutes';
        v_pattern_window     INTERVAL := INTERVAL '7 days';
        v_pattern_threshold  INTEGER  := 3;
        v_context            JSONB;
      BEGIN
        -- PHASE 1: EVENT CLASSIFICATION
        IF TG_OP = 'INSERT' AND NEW.priority = 'Critical' THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'UPDATE' AND NEW.priority = 'Critical'
              AND (OLD.priority IS NULL OR OLD.priority != 'Critical') THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'Completed'
              AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
          v_event_class := 'COMPLETION';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'In Progress'
              AND (OLD.status IS NULL OR OLD.status != 'In Progress') THEN
          v_event_class := 'STATUS_PROGRESSION';
        ELSIF NEW.employee_id IS NOT NULL
              AND (TG_OP = 'INSERT' OR OLD.employee_id IS NULL) THEN
          v_event_class := 'ASSIGNMENT';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NOT NULL
              AND NEW.employee_id IS NOT NULL
              AND OLD.employee_id != NEW.employee_id THEN
          v_event_class := 'REASSIGNMENT';
        ELSE
          RETURN NEW;
        END IF;

        -- PHASE 2: LOAD CONTEXT
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NEW.employee_id IS NOT NULL THEN
          SELECT * INTO v_assigned_employee
            FROM employees WHERE employee_id = NEW.employee_id;
        END IF;

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

        -- PHASE 4: DEDUPLICATION
        IF v_event_class IN ('CRITICAL_ESCALATION', 'REPEATED_FAILURE') THEN
          SELECT * INTO v_existing_incident
            FROM incident_tracking
           WHERE ride_id = NEW.ride_id
             AND incident_status = 'active'
             AND created_at >= NOW() - v_dedup_window
           ORDER BY created_at DESC
           LIMIT 1;

          IF FOUND THEN
            UPDATE incident_tracking
               SET related_request_ids = array_append(related_request_ids, NEW.request_id),
                   last_event_at = NOW(),
                   event_count = event_count + 1
             WHERE incident_id = v_existing_incident.incident_id;

            PERFORM fn_create_notification(
              'manager', NULL, 'incident_update',
              format('Update on %s incident', v_ride.ride_name),
              format('Additional %s-priority event on active incident: %s',
                     NEW.priority, NEW.description),
              'maintenance_requests', NEW.request_id
            );

            RETURN NEW;
          END IF;

          INSERT INTO incident_tracking (
            ride_id, triggering_request_id, severity, incident_status,
            related_request_ids, event_count, created_at, last_event_at
          )
          VALUES (
            NEW.ride_id, NEW.request_id,
            CASE WHEN v_event_class = 'REPEATED_FAILURE' THEN 'severe' ELSE 'critical' END,
            'active', ARRAY[NEW.request_id], 1, NOW(), NOW()
          );
        END IF;

        -- PHASE 5: DYNAMIC RECIPIENT RESOLUTION
        SELECT employee_id, full_name, email, user_id, phone
          INTO v_on_call_manager
          FROM employees
         WHERE role = 'manager'
           AND is_active = true
         ORDER BY employee_id
         LIMIT 1;

        -- PHASE 6: BRANCH BY EVENT CLASS

        IF v_event_class = 'CRITICAL_ESCALATION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'critical_alert',
            format('CRITICAL: %s', v_ride.ride_name),
            format('Critical maintenance filed for %s: %s',
                   v_ride.ride_name, NEW.description),
            'maintenance_requests', NEW.request_id
          );

          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('CRITICAL: %s needs immediate attention. Request #%s',
                        v_ride.ride_name, NEW.request_id),
                 'high', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND phone IS NOT NULL;

        ELSIF v_event_class = 'REPEATED_FAILURE' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'repeated_failure_alert',
            format('REPEATED FAILURE: %s', v_ride.ride_name),
            format('%s has now had %s Critical failures in the last 7 days. ' ||
                   'Underlying reliability investigation required.',
                   v_ride.ride_name, v_recent_critical + 1),
            'maintenance_requests', NEW.request_id
          );

          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('REPEATED FAILURE: %s has %s Criticals this week. Escalation required.',
                        v_ride.ride_name, v_recent_critical + 1),
                 'highest', NEW.request_id
            FROM employees
           WHERE role IN ('manager') AND is_active = true AND phone IS NOT NULL;

          INSERT INTO email_queue (recipient_email, subject, body, priority, related_request_id)
          SELECT email,
                 format('[REPEATED FAILURE] %s — Reliability Review Required', v_ride.ride_name),
                 format('Ride %s has had %s Critical maintenance events in the past 7 days, ' ||
                        'exceeding the reliability threshold. Most recent event: %s. ' ||
                        'This incident has been flagged for engineering review.',
                        v_ride.ride_name, v_recent_critical + 1, NEW.description),
                 'high', NEW.request_id
            FROM employees
           WHERE role IN ('manager') AND is_active = true AND email IS NOT NULL;

        ELSIF v_event_class = 'ASSIGNMENT' THEN
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s: %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
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
            format('Your task on %s has been reassigned to another technician.',
                   v_ride.ride_name),
            'maintenance_requests', NEW.request_id
          );

          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_reassigned_to',
              format('Transferred Task: %s', v_ride.ride_name),
              format('A %s priority task on %s has been transferred to you: %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'STATUS_PROGRESSION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'work_started',
            format('Work started: %s', v_ride.ride_name),
            format('%s has begun work on %s',
                   COALESCE(v_assigned_employee.full_name, 'A technician'), v_ride.ride_name),
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

            UPDATE incident_tracking
               SET incident_status = 'resolved', resolved_at = NOW()
             WHERE ride_id = NEW.ride_id AND incident_status = 'active';
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

        -- PHASE 7: CROSS-RIDE INTERLOCK COORDINATION
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

      CREATE TRIGGER trg_route_maintenance_event
      AFTER INSERT OR UPDATE ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_route_maintenance_event();
    `,
  },
  {
    name: "041_sms_to_assigned_employee",
    sql: `
      CREATE OR REPLACE FUNCTION fn_route_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_event_class        VARCHAR(50);
        v_ride               rides%ROWTYPE;
        v_assigned_employee  employees%ROWTYPE;
        v_recent_critical    INTEGER;
        v_existing_incident  RECORD;
        v_on_call_manager    RECORD;
        v_interlocked_ride   RECORD;
        v_dedup_window       INTERVAL := INTERVAL '10 minutes';
        v_pattern_window     INTERVAL := INTERVAL '7 days';
        v_pattern_threshold  INTEGER  := 3;
      BEGIN
        -- PHASE 1: EVENT CLASSIFICATION
        IF TG_OP = 'INSERT' AND NEW.priority = 'Critical' THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'UPDATE' AND NEW.priority = 'Critical'
              AND (OLD.priority IS NULL OR OLD.priority != 'Critical') THEN
          v_event_class := 'CRITICAL_ESCALATION';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'Completed'
              AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
          v_event_class := 'COMPLETION';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'In Progress'
              AND (OLD.status IS NULL OR OLD.status != 'In Progress') THEN
          v_event_class := 'STATUS_PROGRESSION';
        ELSIF NEW.employee_id IS NOT NULL
              AND (TG_OP = 'INSERT' OR OLD.employee_id IS NULL) THEN
          v_event_class := 'ASSIGNMENT';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NOT NULL
              AND NEW.employee_id IS NOT NULL
              AND OLD.employee_id != NEW.employee_id THEN
          v_event_class := 'REASSIGNMENT';
        ELSE
          RETURN NEW;
        END IF;

        -- PHASE 2: LOAD CONTEXT
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NEW.employee_id IS NOT NULL THEN
          SELECT * INTO v_assigned_employee
            FROM employees WHERE employee_id = NEW.employee_id;
        END IF;

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

        -- PHASE 4: DEDUPLICATION
        IF v_event_class IN ('CRITICAL_ESCALATION', 'REPEATED_FAILURE') THEN
          SELECT * INTO v_existing_incident
            FROM incident_tracking
           WHERE ride_id = NEW.ride_id
             AND incident_status = 'active'
             AND created_at >= NOW() - v_dedup_window
           ORDER BY created_at DESC
           LIMIT 1;

          IF FOUND THEN
            UPDATE incident_tracking
               SET related_request_ids = array_append(related_request_ids, NEW.request_id),
                   last_event_at = NOW(),
                   event_count = event_count + 1
             WHERE incident_id = v_existing_incident.incident_id;

            PERFORM fn_create_notification(
              'manager', NULL, 'incident_update',
              format('Update on %s incident', v_ride.ride_name),
              format('Additional %s-priority event on active incident: %s',
                     NEW.priority, NEW.description),
              'maintenance_requests', NEW.request_id
            );

            RETURN NEW;
          END IF;

          INSERT INTO incident_tracking (
            ride_id, triggering_request_id, severity, incident_status,
            related_request_ids, event_count, created_at, last_event_at
          )
          VALUES (
            NEW.ride_id, NEW.request_id,
            CASE WHEN v_event_class = 'REPEATED_FAILURE' THEN 'severe' ELSE 'critical' END,
            'active', ARRAY[NEW.request_id], 1, NOW(), NOW()
          );
        END IF;

        -- PHASE 5: DYNAMIC RECIPIENT RESOLUTION
        SELECT employee_id, full_name, email, user_id, phone
          INTO v_on_call_manager
          FROM employees
         WHERE role = 'manager'
           AND is_active = true
         ORDER BY employee_id
         LIMIT 1;

        -- PHASE 6: BRANCH BY EVENT CLASS

        IF v_event_class = 'CRITICAL_ESCALATION' THEN
          -- In-app to manager
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'critical_alert',
            format('CRITICAL: %s', v_ride.ride_name),
            format('Critical maintenance filed for %s: %s',
                   v_ride.ride_name, NEW.description),
            'maintenance_requests', NEW.request_id
          );

          -- SMS to all managers
          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('CRITICAL: %s needs immediate attention. Request #%s',
                        v_ride.ride_name, NEW.request_id),
                 'high', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND phone IS NOT NULL;

          -- SMS to assigned employee (if any)
          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('URGENT: Your assigned ride %s has a Critical issue. Request #%s: %s',
                     v_ride.ride_name, NEW.request_id, NEW.description),
              'high', NEW.request_id
            );
          END IF;

          -- In-app to assigned employee
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'critical_alert',
              format('CRITICAL: %s — Your Assigned Ride', v_ride.ride_name),
              format('A Critical maintenance event has been filed for %s: %s',
                     v_ride.ride_name, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REPEATED_FAILURE' THEN
          -- In-app to manager
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'repeated_failure_alert',
            format('REPEATED FAILURE: %s', v_ride.ride_name),
            format('%s has now had %s Critical failures in the last 7 days. ' ||
                   'Underlying reliability investigation required.',
                   v_ride.ride_name, v_recent_critical + 1),
            'maintenance_requests', NEW.request_id
          );

          -- SMS to managers
          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('REPEATED FAILURE: %s has %s Criticals this week. Escalation required.',
                        v_ride.ride_name, v_recent_critical + 1),
                 'highest', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND phone IS NOT NULL;

          -- SMS to assigned employee
          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('ALERT: %s has repeated Critical failures. %s Criticals this week. Immediate review needed.',
                     v_ride.ride_name, v_recent_critical + 1),
              'highest', NEW.request_id
            );
          END IF;

          -- Email to managers
          INSERT INTO email_queue (recipient_email, subject, body, priority, related_request_id)
          SELECT email,
                 format('[REPEATED FAILURE] %s — Reliability Review Required', v_ride.ride_name),
                 format('Ride %s has had %s Critical maintenance events in the past 7 days, ' ||
                        'exceeding the reliability threshold. Most recent event: %s. ' ||
                        'This incident has been flagged for engineering review.',
                        v_ride.ride_name, v_recent_critical + 1, NEW.description),
                 'high', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND email IS NOT NULL;

          -- Email to assigned employee
          IF v_assigned_employee.email IS NOT NULL THEN
            INSERT INTO email_queue (recipient_email, subject, body, priority, related_request_id)
            VALUES (
              v_assigned_employee.email,
              format('[REPEATED FAILURE] %s — Your Assigned Ride', v_ride.ride_name),
              format('Ride %s (your assigned ride) has had %s Critical maintenance events in 7 days. ' ||
                     'Latest: %s. Please coordinate with management on next steps.',
                     v_ride.ride_name, v_recent_critical + 1, NEW.description),
              'high', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'ASSIGNMENT' THEN
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s: %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
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

          -- SMS to assigned employee on assignment
          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('New task assigned: %s priority on %s. %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              CASE WHEN NEW.priority IN ('Critical', 'High') THEN 'high' ELSE 'normal' END,
              NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REASSIGNMENT' THEN
          -- Notify old employee
          PERFORM fn_create_notification(
            'staff',
            (SELECT user_id FROM employees WHERE employee_id = OLD.employee_id),
            'task_reassigned_from',
            format('Task transferred: %s', v_ride.ride_name),
            format('Your task on %s has been reassigned to another technician.',
                   v_ride.ride_name),
            'maintenance_requests', NEW.request_id
          );

          -- SMS to old employee
          IF EXISTS (SELECT 1 FROM employees WHERE employee_id = OLD.employee_id AND phone IS NOT NULL) THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            SELECT phone, full_name,
                   format('Your task on %s has been reassigned to another technician.',
                          v_ride.ride_name),
                   'normal', NEW.request_id
              FROM employees WHERE employee_id = OLD.employee_id;
          END IF;

          -- Notify new employee
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_reassigned_to',
              format('Transferred Task: %s', v_ride.ride_name),
              format('A %s priority task on %s has been transferred to you: %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

          -- SMS to new employee
          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('Task transferred to you: %s priority on %s. %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              CASE WHEN NEW.priority IN ('Critical', 'High') THEN 'high' ELSE 'normal' END,
              NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'STATUS_PROGRESSION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'work_started',
            format('Work started: %s', v_ride.ride_name),
            format('%s has begun work on %s',
                   COALESCE(v_assigned_employee.full_name, 'A technician'), v_ride.ride_name),
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

            UPDATE incident_tracking
               SET incident_status = 'resolved', resolved_at = NOW()
             WHERE ride_id = NEW.ride_id AND incident_status = 'active';
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

        -- PHASE 7: CROSS-RIDE INTERLOCK COORDINATION
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
  {
    name: "042_seed_employee_phones",
    sql: `
      -- Give all employees phone numbers so SMS fan-out is visible in demos
      UPDATE employees SET phone = '555-01' || LPAD(employee_id::TEXT, 2, '0')
       WHERE phone IS NULL;
    `,
  },
  {
    name: "043_manager_sms_on_high_critical",
    sql: `
      CREATE OR REPLACE FUNCTION fn_route_maintenance_event()
      RETURNS TRIGGER AS $$
      DECLARE
        v_event_class        VARCHAR(50);
        v_ride               rides%ROWTYPE;
        v_assigned_employee  employees%ROWTYPE;
        v_recent_critical    INTEGER;
        v_existing_incident  RECORD;
        v_on_call_manager    RECORD;
        v_interlocked_ride   RECORD;
        v_dedup_window       INTERVAL := INTERVAL '10 minutes';
        v_pattern_window     INTERVAL := INTERVAL '7 days';
        v_pattern_threshold  INTEGER  := 3;
      BEGIN
        -- PHASE 1: EVENT CLASSIFICATION
        -- High and Critical both route to managers
        IF TG_OP = 'INSERT' AND NEW.priority IN ('Critical', 'High') THEN
          v_event_class := CASE WHEN NEW.priority = 'Critical' THEN 'CRITICAL_ESCALATION' ELSE 'HIGH_ALERT' END;
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
        ELSIF NEW.employee_id IS NOT NULL
              AND (TG_OP = 'INSERT' OR OLD.employee_id IS NULL) THEN
          v_event_class := 'ASSIGNMENT';
        ELSIF TG_OP = 'UPDATE' AND OLD.employee_id IS NOT NULL
              AND NEW.employee_id IS NOT NULL
              AND OLD.employee_id != NEW.employee_id THEN
          v_event_class := 'REASSIGNMENT';
        ELSE
          RETURN NEW;
        END IF;

        -- PHASE 2: LOAD CONTEXT
        SELECT * INTO v_ride FROM rides WHERE ride_id = NEW.ride_id;

        IF NEW.employee_id IS NOT NULL THEN
          SELECT * INTO v_assigned_employee
            FROM employees WHERE employee_id = NEW.employee_id;
        END IF;

        -- PHASE 3: PATTERN DETECTION (Critical only)
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

        -- PHASE 4: DEDUPLICATION (Critical/Repeated only)
        IF v_event_class IN ('CRITICAL_ESCALATION', 'REPEATED_FAILURE') THEN
          SELECT * INTO v_existing_incident
            FROM incident_tracking
           WHERE ride_id = NEW.ride_id
             AND incident_status = 'active'
             AND created_at >= NOW() - v_dedup_window
           ORDER BY created_at DESC
           LIMIT 1;

          IF FOUND THEN
            UPDATE incident_tracking
               SET related_request_ids = array_append(related_request_ids, NEW.request_id),
                   last_event_at = NOW(),
                   event_count = event_count + 1
             WHERE incident_id = v_existing_incident.incident_id;

            PERFORM fn_create_notification(
              'manager', NULL, 'incident_update',
              format('Update on %s incident', v_ride.ride_name),
              format('Additional %s-priority event on active incident: %s',
                     NEW.priority, NEW.description),
              'maintenance_requests', NEW.request_id
            );

            RETURN NEW;
          END IF;

          INSERT INTO incident_tracking (
            ride_id, triggering_request_id, severity, incident_status,
            related_request_ids, event_count, created_at, last_event_at
          )
          VALUES (
            NEW.ride_id, NEW.request_id,
            CASE WHEN v_event_class = 'REPEATED_FAILURE' THEN 'severe' ELSE 'critical' END,
            'active', ARRAY[NEW.request_id], 1, NOW(), NOW()
          );
        END IF;

        -- PHASE 5: DYNAMIC RECIPIENT RESOLUTION
        SELECT employee_id, full_name, email, user_id, phone
          INTO v_on_call_manager
          FROM employees
         WHERE role = 'manager'
           AND is_active = true
         ORDER BY employee_id
         LIMIT 1;

        -- PHASE 6: BRANCH BY EVENT CLASS

        IF v_event_class = 'CRITICAL_ESCALATION' THEN
          -- In-app to manager
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'critical_alert',
            format('CRITICAL: %s', v_ride.ride_name),
            format('Critical maintenance filed for %s: %s',
                   v_ride.ride_name, NEW.description),
            'maintenance_requests', NEW.request_id
          );

          -- SMS to ALL managers (regardless of assignment)
          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('CRITICAL: %s needs immediate attention. Request #%s: %s',
                        v_ride.ride_name, NEW.request_id, NEW.description),
                 'high', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND phone IS NOT NULL;

          -- SMS to assigned employee (if any)
          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('URGENT: Your assigned ride %s has a Critical issue. Request #%s: %s',
                     v_ride.ride_name, NEW.request_id, NEW.description),
              'high', NEW.request_id
            );
          END IF;

          -- In-app to assigned employee
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'critical_alert',
              format('CRITICAL: %s — Your Assigned Ride', v_ride.ride_name),
              format('A Critical maintenance event has been filed for %s: %s',
                     v_ride.ride_name, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'HIGH_ALERT' THEN
          -- In-app to manager
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'high_alert',
            format('HIGH PRIORITY: %s', v_ride.ride_name),
            format('High priority maintenance filed for %s: %s',
                   v_ride.ride_name, NEW.description),
            'maintenance_requests', NEW.request_id
          );

          -- SMS to ALL managers
          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('HIGH PRIORITY: %s — Request #%s: %s',
                        v_ride.ride_name, NEW.request_id, NEW.description),
                 'high', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND phone IS NOT NULL;

          -- In-app to assigned employee (if any)
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'high_alert',
              format('HIGH PRIORITY: %s — Your Assigned Ride', v_ride.ride_name),
              format('A High priority maintenance request has been filed for %s: %s',
                     v_ride.ride_name, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REPEATED_FAILURE' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'repeated_failure_alert',
            format('REPEATED FAILURE: %s', v_ride.ride_name),
            format('%s has now had %s Critical failures in the last 7 days. ' ||
                   'Underlying reliability investigation required.',
                   v_ride.ride_name, v_recent_critical + 1),
            'maintenance_requests', NEW.request_id
          );

          INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
          SELECT phone, full_name,
                 format('REPEATED FAILURE: %s has %s Criticals this week. Escalation required.',
                        v_ride.ride_name, v_recent_critical + 1),
                 'highest', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND phone IS NOT NULL;

          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('ALERT: %s has repeated Critical failures. %s Criticals this week.',
                     v_ride.ride_name, v_recent_critical + 1),
              'highest', NEW.request_id
            );
          END IF;

          INSERT INTO email_queue (recipient_email, subject, body, priority, related_request_id)
          SELECT email,
                 format('[REPEATED FAILURE] %s — Reliability Review Required', v_ride.ride_name),
                 format('Ride %s has had %s Critical maintenance events in the past 7 days. ' ||
                        'Most recent event: %s. Flagged for engineering review.',
                        v_ride.ride_name, v_recent_critical + 1, NEW.description),
                 'high', NEW.request_id
            FROM employees
           WHERE role = 'manager' AND is_active = true AND email IS NOT NULL;

        ELSIF v_event_class = 'ASSIGNMENT' THEN
          -- Assigned employee gets notified
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_assigned',
              format('New Task: %s', v_ride.ride_name),
              format('You have been assigned a %s priority task on %s: %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
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

          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('New task assigned: %s priority on %s. %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              CASE WHEN NEW.priority IN ('Critical', 'High') THEN 'high' ELSE 'normal' END,
              NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'REASSIGNMENT' THEN
          PERFORM fn_create_notification(
            'staff',
            (SELECT user_id FROM employees WHERE employee_id = OLD.employee_id),
            'task_reassigned_from',
            format('Task transferred: %s', v_ride.ride_name),
            format('Your task on %s has been reassigned to another technician.',
                   v_ride.ride_name),
            'maintenance_requests', NEW.request_id
          );

          IF EXISTS (SELECT 1 FROM employees WHERE employee_id = OLD.employee_id AND phone IS NOT NULL) THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            SELECT phone, full_name,
                   format('Your task on %s has been reassigned to another technician.',
                          v_ride.ride_name),
                   'normal', NEW.request_id
              FROM employees WHERE employee_id = OLD.employee_id;
          END IF;

          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'task_reassigned_to',
              format('Transferred Task: %s', v_ride.ride_name),
              format('A %s priority task on %s has been transferred to you: %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              'maintenance_requests', NEW.request_id
            );
          END IF;

          IF v_assigned_employee.phone IS NOT NULL THEN
            INSERT INTO sms_queue (recipient_phone, recipient_name, message_body, priority, related_request_id)
            VALUES (
              v_assigned_employee.phone, v_assigned_employee.full_name,
              format('Task transferred to you: %s priority on %s. %s',
                     NEW.priority, v_ride.ride_name, NEW.description),
              CASE WHEN NEW.priority IN ('Critical', 'High') THEN 'high' ELSE 'normal' END,
              NEW.request_id
            );
          END IF;

        ELSIF v_event_class = 'STATUS_PROGRESSION' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'work_started',
            format('Work started: %s', v_ride.ride_name),
            format('%s has begun work on %s',
                   COALESCE(v_assigned_employee.full_name, 'A technician'), v_ride.ride_name),
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

            UPDATE incident_tracking
               SET incident_status = 'resolved', resolved_at = NOW()
             WHERE ride_id = NEW.ride_id AND incident_status = 'active';
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

        -- PHASE 7: CROSS-RIDE INTERLOCK COORDINATION
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
  {
    name: "044_ticket_purchase_policy_trigger",
    sql: `
      -- Supporting table: policy_config (key-value config store)
      CREATE TABLE IF NOT EXISTS policy_config (
        key    VARCHAR(100) PRIMARY KEY,
        value  INTEGER NOT NULL,
        label  TEXT
      );

      INSERT INTO policy_config (key, value, label) VALUES
        ('purchase_rate_limit_24h', 10, 'Max purchases per customer in 24 hours'),
        ('purchase_max_qty_per_txn', 20, 'Max total tickets per single transaction')
      ON CONFLICT (key) DO NOTHING;

      -- Supporting table: sales_rejections (rejection audit log)
      CREATE TABLE IF NOT EXISTS sales_rejections (
        rejection_id    SERIAL PRIMARY KEY,
        customer_id     INTEGER,
        ticket_type     VARCHAR(100),
        rejection_code  VARCHAR(50) NOT NULL,
        rejection_detail TEXT,
        context_data    JSONB,
        rejected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ═══════════════════════════════════════════════════════════════════
      -- TRIGGER 2: Ticket Purchase Policy Enforcement
      -- ═══════════════════════════════════════════════════════════════════
      -- Type:    BEFORE INSERT on ticket_purchases
      -- Purpose: 6-gate policy enforcement — anti-fraud, anti-scalping,
      --          pricing integrity, and availability validation
      -- Tables:  ticket_purchases, customers, park_closures, policy_config,
      --          sales_rejections (audit log)
      -- Pattern: Flag-based rejection (v_rejection_code IS NULL guard)
      -- ═══════════════════════════════════════════════════════════════════

      CREATE OR REPLACE FUNCTION fn_enforce_ticket_purchase_policy()
      RETURNS TRIGGER AS $$
      DECLARE
        v_customer          customers%ROWTYPE;
        v_rate_limit        INTEGER;
        v_max_qty           INTEGER;
        v_recent_count      INTEGER;
        v_computed_total    NUMERIC(10,2);
        v_total_qty         INTEGER;
        v_park_closed       BOOLEAN;
        v_rejection_code    VARCHAR(50) := NULL;
        v_rejection_detail  TEXT := NULL;
        v_context           JSONB;
      BEGIN
        -- Load config values once
        SELECT value INTO v_rate_limit FROM policy_config WHERE key = 'purchase_rate_limit_24h';
        SELECT value INTO v_max_qty    FROM policy_config WHERE key = 'purchase_max_qty_per_txn';

        -- ── GATE 1: Visit date validity (CHEAP) ──
        IF NEW.visit_date IS NULL OR NEW.visit_date < CURRENT_DATE THEN
          v_rejection_code := 'VISIT_DATE_INVALID';
          v_rejection_detail := format(
            'Visit date %s must be today or in the future',
            COALESCE(NEW.visit_date::TEXT, 'NULL')
          );
        END IF;

        -- ── GATE 2: Quantity sanity (CHEAP) ──
        IF v_rejection_code IS NULL THEN
          v_total_qty := COALESCE(NEW.adult_qty, 0) + COALESCE(NEW.child_qty, 0);

          IF v_total_qty <= 0 THEN
            v_rejection_code := 'INVALID_QUANTITY';
            v_rejection_detail := 'Transaction must include at least one adult or child ticket';
          ELSIF v_total_qty > v_max_qty THEN
            v_rejection_code := 'QUANTITY_EXCEEDED';
            v_rejection_detail := format(
              'Transaction quantity %s exceeds per-transaction maximum of %s',
              v_total_qty, v_max_qty
            );
          END IF;
        END IF;

        -- ── GATE 3: Price integrity (CHEAP, pure arithmetic) ──
        IF v_rejection_code IS NULL THEN
          v_computed_total :=
            (COALESCE(NEW.adult_qty, 0) * COALESCE(NEW.unit_price_adult, 0)) +
            (COALESCE(NEW.child_qty, 0) * COALESCE(NEW.unit_price_child, 0));

          IF ABS(COALESCE(NEW.total_price, 0) - v_computed_total) > 0.01 THEN
            v_rejection_code := 'PRICE_MISMATCH';
            v_rejection_detail := format(
              'Client total $%s does not match computed total $%s',
              NEW.total_price, v_computed_total
            );
          END IF;
        END IF;

        -- ── GATE 4: Customer must exist (MEDIUM) ──
        IF v_rejection_code IS NULL AND NEW.customer_id IS NOT NULL THEN
          SELECT * INTO v_customer FROM customers WHERE customer_id = NEW.customer_id;

          IF NOT FOUND THEN
            v_rejection_code := 'CUSTOMER_NOT_FOUND';
            v_rejection_detail := format('Customer ID %s does not exist', NEW.customer_id);
          END IF;
        END IF;

        -- ── GATE 5: Park-wide closure on visit date (MEDIUM) ──
        IF v_rejection_code IS NULL THEN
          SELECT EXISTS (
            SELECT 1 FROM park_closures pc
             WHERE pc.is_active = true
               AND NEW.visit_date BETWEEN pc.started_at::DATE
                                      AND COALESCE(pc.ended_at::DATE, pc.started_at::DATE + INTERVAL '365 days')
               AND pc.zone IN ('ALL', 'PARK_WIDE', 'Park-Wide')
          ) INTO v_park_closed;

          IF v_park_closed THEN
            v_rejection_code := 'PARK_CLOSED_VISIT_DATE';
            v_rejection_detail := format(
              'Park is closed on %s; ticket cannot be sold for that date',
              NEW.visit_date
            );
          END IF;
        END IF;

        -- ── GATE 6: Rolling 24-hour purchase rate limit (EXPENSIVE) ──
        IF v_rejection_code IS NULL AND NEW.customer_id IS NOT NULL THEN
          SELECT COUNT(*) INTO v_recent_count
            FROM ticket_purchases
           WHERE customer_id = NEW.customer_id
             AND purchase_date >= NOW() - INTERVAL '24 hours';

          IF v_recent_count >= v_rate_limit THEN
            v_rejection_code := 'RATE_LIMIT_EXCEEDED';
            v_rejection_detail := format(
              'Customer has made %s purchases in the last 24 hours (limit: %s)',
              v_recent_count, v_rate_limit
            );
          END IF;
        END IF;

        -- ─────────────────────────────────────────────────────────────────
        -- ALL GATES PASSED — allow the INSERT
        -- ─────────────────────────────────────────────────────────────────
        IF v_rejection_code IS NULL THEN
          RETURN NEW;
        END IF;

        -- ─────────────────────────────────────────────────────────────────
        -- REJECTION PATH — log with JSONB context, raise structured error
        -- ─────────────────────────────────────────────────────────────────
        v_context := jsonb_build_object(
          'customer_id',    NEW.customer_id,
          'ticket_type',    NEW.ticket_type,
          'adult_qty',      NEW.adult_qty,
          'child_qty',      NEW.child_qty,
          'total_price',    NEW.total_price,
          'computed_total', v_computed_total,
          'visit_date',     NEW.visit_date,
          'recent_count',   v_recent_count,
          'rate_limit',     v_rate_limit,
          'rejection_code', v_rejection_code
        );

        INSERT INTO sales_rejections (
          customer_id, ticket_type, rejection_code, rejection_detail, context_data
        )
        VALUES (
          NEW.customer_id, NEW.ticket_type, v_rejection_code, v_rejection_detail, v_context
        );

        RAISE EXCEPTION 'Ticket purchase rejected: % — %', v_rejection_code, v_rejection_detail
          USING ERRCODE = 'TP001',
                DETAIL  = v_context::TEXT,
                HINT    = 'Resolve the blocking condition before retrying the purchase';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_enforce_ticket_purchase_policy
      BEFORE INSERT ON ticket_purchases
      FOR EACH ROW
      EXECUTE FUNCTION fn_enforce_ticket_purchase_policy();
    `,
  },
  {
    name: "045_add_buyer_name_email_to_ticket_purchases",
    sql: `
      ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);
      ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(255);
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
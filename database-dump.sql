--
-- PostgreSQL database dump
--


-- Dumped from database version 17.8 (a48d9ca)
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: fn_create_notification(character varying, integer, character varying, character varying, text, character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_create_notification(p_role character varying, p_user_id integer, p_type character varying, p_title character varying, p_message text, p_related_table character varying, p_related_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: fn_escalate_stale_priorities(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_escalate_stale_priorities(p_low_to_medium_seconds integer DEFAULT 259200, p_medium_to_high_seconds integer DEFAULT 259200, p_high_to_critical_seconds integer DEFAULT 259200) RETURNS TABLE(request_id integer, old_priority character varying, new_priority character varying, age_seconds integer)
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: fn_guard_employee_deactivation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_guard_employee_deactivation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: fn_guard_ride_reopen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_guard_ride_reopen() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: fn_park_closure_cascade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_park_closure_cascade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
        v_r                RECORD;
        v_other_active     INTEGER;
        v_affected_rides   INTEGER;
        v_reopened_count   INTEGER;
        v_on_call_manager  RECORD;
      BEGIN
        -- Find on-call manager (same pattern as maintenance routing)
        SELECT employee_id, full_name, user_id
          INTO v_on_call_manager
          FROM employees
         WHERE role = 'manager' AND is_active = true
         ORDER BY employee_id
         LIMIT 1;

        -- NEW ACTIVE CLOSURE: cascade-close Operational rides in the zone.
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
          UPDATE rides
             SET status = 'Closed'
           WHERE location = NEW.zone
             AND status = 'Operational'
             AND is_operational = true;

          GET DIAGNOSTICS v_affected_rides = ROW_COUNT;

          -- Manager notification (targeted)
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'zone_closure_opened',
            format('Zone Closure: %s', NEW.zone),
            format('%s closed (%s). %s ride(s) auto-closed. Reason: %s',
                   NEW.zone, NEW.closure_type, v_affected_rides, COALESCE(NEW.reason, 'No reason provided')),
            'park_closures', NEW.closure_id
          );

          -- Staff broadcast
          PERFORM fn_create_notification(
            'staff', NULL, 'zone_closure_opened',
            format('%s is now closed', NEW.zone),
            format('%s has been closed (%s). Reason: %s. Affected rides: %s.',
                   NEW.zone, NEW.closure_type, COALESCE(NEW.reason, 'No reason provided'), v_affected_rides),
            'park_closures', NEW.closure_id
          );
        END IF;

        -- CLOSURE DEACTIVATED: try to reopen rides if no other active
        -- closure still covers the zone.
        IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
          SELECT COUNT(*) INTO v_other_active
            FROM park_closures
           WHERE zone = NEW.zone
             AND is_active = true
             AND closure_id <> NEW.closure_id;

          v_reopened_count := 0;

          IF v_other_active = 0 THEN
            FOR v_r IN
              SELECT ride_id FROM rides
               WHERE location = NEW.zone
                 AND status = 'Closed'
                 AND is_operational = true
            LOOP
              BEGIN
                UPDATE rides SET status = 'Operational' WHERE ride_id = v_r.ride_id;
                v_reopened_count := v_reopened_count + 1;
              EXCEPTION WHEN OTHERS THEN
                -- trg_guard_ride_reopen rejected this ride (e.g. pending
                -- Critical/High maintenance). Leave it Closed and continue.
                NULL;
              END;
            END LOOP;
          END IF;

          -- Manager notification (targeted)
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'zone_closure_lifted',
            format('Zone Reopened: %s', NEW.zone),
            CASE
              WHEN v_other_active > 0 THEN
                format('Closure #%s on %s lifted, but %s other active closure(s) remain — no rides reopened.',
                       NEW.closure_id, NEW.zone, v_other_active)
              ELSE
                format('Closure #%s on %s lifted. %s ride(s) reopened automatically.',
                       NEW.closure_id, NEW.zone, v_reopened_count)
            END,
            'park_closures', NEW.closure_id
          );

          -- Staff broadcast
          PERFORM fn_create_notification(
            'staff', NULL, 'zone_closure_lifted',
            format('%s is back open', NEW.zone),
            CASE
              WHEN v_other_active > 0 THEN
                format('One closure on %s lifted, but other closures still active.', NEW.zone)
              ELSE
                format('%s is reopened. %s ride(s) returned to operation.', NEW.zone, v_reopened_count)
            END,
            'park_closures', NEW.closure_id
          );
        END IF;

        RETURN NEW;
      END;
      $$;


--
-- Name: fn_route_maintenance_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_route_maintenance_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
        -- Reopen check runs BEFORE COMPLETION / STATUS_PROGRESSION so that
        -- Completed → anything-else is caught here.
        ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Completed'
              AND NEW.status IS DISTINCT FROM 'Completed' THEN
          v_event_class := 'REQUEST_REOPENED';
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

        -- PHASE 3b: AUTO-CLOSE on urgent insert OR urgent reopen
        IF v_event_class IN ('CRITICAL_ESCALATION', 'HIGH_ALERT', 'REPEATED_FAILURE')
           OR (v_event_class = 'REQUEST_REOPENED' AND NEW.priority IN ('Critical', 'High'))
        THEN
          UPDATE rides
             SET status = 'Closed'
           WHERE ride_id = NEW.ride_id
             AND status = 'Operational';
        END IF;

        -- PHASE 3c: AUTO-REOPEN on last blocker cleared
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

        ELSIF v_event_class = 'REQUEST_REOPENED' THEN
          PERFORM fn_create_notification(
            'manager', v_on_call_manager.user_id, 'request_reopened',
            format('Request Reopened: %s', v_ride.ride_name),
            format('Request #%s on %s was moved from Completed back to %s.%s Details: %s',
                   NEW.request_id, v_ride.ride_name, NEW.status,
                   CASE WHEN NEW.priority IN ('Critical', 'High')
                        THEN format(' Ride re-closed due to %s priority.', NEW.priority)
                        ELSE '' END,
                   NEW.description),
            'maintenance_requests', NEW.request_id
          );
          IF v_assigned_employee.user_id IS NOT NULL THEN
            PERFORM fn_create_notification(
              'staff', v_assigned_employee.user_id, 'request_reopened',
              format('Task Reopened: %s', v_ride.ride_name),
              format('Request #%s on %s has been reopened by %s. Status is now %s. Details: %s',
                     NEW.request_id, v_ride.ride_name, v_manager_label, NEW.status, NEW.description),
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
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    customer_id integer NOT NULL,
    email character varying(255),
    full_name character varying(255),
    date_of_birth date,
    phone bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer
);


--
-- Name: customers_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_customer_id_seq OWNED BY public.customers.customer_id;


--
-- Name: dispatch_rejections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_rejections (
    rejection_id integer NOT NULL,
    ride_id integer NOT NULL,
    operator_id integer,
    attempted_at timestamp without time zone DEFAULT now() NOT NULL,
    rejection_code character varying(50) NOT NULL,
    rejection_detail text NOT NULL,
    context_data jsonb
);


--
-- Name: dispatch_rejections_rejection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispatch_rejections_rejection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispatch_rejections_rejection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispatch_rejections_rejection_id_seq OWNED BY public.dispatch_rejections.rejection_id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    employee_id integer NOT NULL,
    full_name character varying(255),
    email character varying(255),
    role character varying(100),
    ride_id integer,
    shift_start time without time zone,
    shift_end time without time zone,
    hourly_rate numeric(10,2),
    hire_date date,
    restaurant_id integer,
    gift_shop_id integer,
    user_id integer,
    phone character varying(20),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: employees_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_employee_id_seq OWNED BY public.employees.employee_id;


--
-- Name: game; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game (
    game_id integer NOT NULL,
    game_name character varying(255),
    max_players integer,
    operational_status integer,
    location character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_sales numeric(10,2),
    description text,
    image_url text,
    prize_type character varying(100),
    decommissioned_at timestamp with time zone
);


--
-- Name: game_game_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.game ALTER COLUMN game_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.game_game_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gift_shop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_shop (
    gift_shop_id integer NOT NULL,
    operational_status integer,
    name character varying(255),
    location character varying(255),
    total_sales numeric(10,2),
    open_time time without time zone,
    close_time time without time zone,
    description text,
    image_url text,
    decommissioned_at timestamp with time zone
);


--
-- Name: gift_shop_gift_shop_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.gift_shop ALTER COLUMN gift_shop_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.gift_shop_gift_shop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_requests (
    request_id integer NOT NULL,
    ride_id integer NOT NULL,
    employee_id integer,
    description text NOT NULL,
    priority character varying(20) DEFAULT 'Medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    archived_at timestamp with time zone,
    CONSTRAINT maintenance_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['Low'::character varying, 'Medium'::character varying, 'High'::character varying, 'Critical'::character varying])::text[]))),
    CONSTRAINT maintenance_requests_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'In Progress'::character varying, 'Completed'::character varying])::text[])))
);


--
-- Name: maintenance_requests_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_requests_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_requests_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_requests_request_id_seq OWNED BY public.maintenance_requests.request_id;


--
-- Name: merch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.merch (
    merch_id integer NOT NULL,
    merch_name character varying(50),
    merch_category character varying(30),
    wholesale_price numeric(10,2),
    retail_price numeric(10,2),
    game_award boolean,
    sold_location character varying(255),
    sold_status integer,
    image_url text,
    description text
);


--
-- Name: merch_merch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.merch ALTER COLUMN merch_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.merch_merch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: merch_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.merch_purchases (
    purchase_id integer NOT NULL,
    customer_id integer,
    buyer_name character varying(255) NOT NULL,
    buyer_email character varying(255) NOT NULL,
    shipping_address text,
    items jsonb NOT NULL,
    total_price numeric(10,2) NOT NULL,
    cardholder_name character varying(255),
    card_last_four character varying(4),
    purchase_date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: merch_purchases_purchase_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.merch_purchases_purchase_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: merch_purchases_purchase_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.merch_purchases_purchase_id_seq OWNED BY public.merch_purchases.purchase_id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    notification_id integer NOT NULL,
    recipient_role character varying(20),
    recipient_user_id integer,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    related_table character varying(50),
    related_id integer,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_notification_id_seq OWNED BY public.notifications.notification_id;


--
-- Name: operator_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operator_assignments (
    assignment_id integer NOT NULL,
    employee_id integer NOT NULL,
    ride_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    ended_at timestamp without time zone
);


--
-- Name: operator_assignments_assignment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operator_assignments_assignment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operator_assignments_assignment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operator_assignments_assignment_id_seq OWNED BY public.operator_assignments.assignment_id;


--
-- Name: park_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.park_closures (
    closure_id integer NOT NULL,
    closure_date date DEFAULT CURRENT_DATE,
    start_time time without time zone DEFAULT now(),
    end_time time without time zone,
    reason character varying(250),
    affected_areas text,
    zone character varying(50),
    closure_type character varying(30) DEFAULT 'Weather'::character varying,
    is_active boolean DEFAULT true,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    archived_at timestamp with time zone
);


--
-- Name: park_closures_closure_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.park_closures ALTER COLUMN closure_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.park_closures_closure_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    family_id uuid NOT NULL,
    token_hash text NOT NULL,
    user_id integer NOT NULL,
    used boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: restaurant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant (
    restaurant_id integer NOT NULL,
    operational_status integer,
    name character varying(255),
    food_type character varying(255),
    location character varying(255),
    total_sales numeric(10,2),
    open_time time without time zone,
    close_time time without time zone,
    description text,
    image_url text,
    decommissioned_at timestamp with time zone
);


--
-- Name: restaurant_restaurant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.restaurant ALTER COLUMN restaurant_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.restaurant_restaurant_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ride_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_dispatches (
    dispatch_id integer NOT NULL,
    ride_id integer NOT NULL,
    operator_id integer NOT NULL,
    dispatched_at timestamp without time zone DEFAULT now() NOT NULL,
    cycle_duration_s integer,
    guest_count integer NOT NULL,
    dispatch_notes text
);


--
-- Name: ride_dispatches_dispatch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ride_dispatches_dispatch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ride_dispatches_dispatch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ride_dispatches_dispatch_id_seq OWNED BY public.ride_dispatches.dispatch_id;


--
-- Name: ride_interlocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_interlocks (
    interlock_id integer NOT NULL,
    ride_id integer NOT NULL,
    blocking_ride_id integer NOT NULL,
    block_reason text,
    CONSTRAINT chk_no_self_interlock CHECK ((ride_id <> blocking_ride_id))
);


--
-- Name: ride_interlocks_interlock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ride_interlocks_interlock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ride_interlocks_interlock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ride_interlocks_interlock_id_seq OWNED BY public.ride_interlocks.interlock_id;


--
-- Name: rides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rides (
    ride_id integer NOT NULL,
    ride_name character varying(100) NOT NULL,
    capacity_per_cycle integer NOT NULL,
    min_height_in integer,
    location character varying(50),
    status character varying(25) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    wait_time integer,
    is_operational boolean DEFAULT true NOT NULL,
    total_visits integer DEFAULT 0,
    description text,
    image_url text,
    ride_type character varying(50),
    thrill_level character varying(20),
    max_cycles_per_hour integer,
    max_wind_mph numeric(5,2),
    min_lightning_miles numeric(5,2),
    min_temp_f numeric(5,2),
    max_temp_f numeric(5,2),
    inspection_cycle_interval integer,
    cycles_since_inspection integer DEFAULT 0 NOT NULL,
    decommissioned_at timestamp with time zone
);


--
-- Name: rides_ride_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rides ALTER COLUMN ride_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rides_ride_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ticket_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_purchases (
    purchase_id integer NOT NULL,
    customer_id integer,
    user_id integer,
    ticket_type character varying(50) NOT NULL,
    adult_qty integer DEFAULT 0 NOT NULL,
    child_qty integer DEFAULT 0 NOT NULL,
    unit_price_adult numeric(10,2) NOT NULL,
    unit_price_child numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    visit_date date,
    purchase_date timestamp with time zone DEFAULT now() NOT NULL,
    card_last_four character varying(4),
    cardholder_name character varying(255),
    ticket_type_id integer,
    buyer_name character varying(255),
    buyer_email character varying(255)
);


--
-- Name: ticket_purchases_purchase_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_purchases_purchase_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_purchases_purchase_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_purchases_purchase_id_seq OWNED BY public.ticket_purchases.purchase_id;


--
-- Name: ticket_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_types (
    ticket_type_id integer NOT NULL,
    type_name character varying(50),
    base_price numeric(10,2),
    description text,
    ticket_category character varying(50),
    fast_pass boolean DEFAULT false,
    child_price numeric(10,2)
);


--
-- Name: ticket_types_ticket_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ticket_types ALTER COLUMN ticket_type_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ticket_types_ticket_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'staff'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: weather_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_readings (
    reading_id integer NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    wind_speed_mph numeric(5,2),
    lightning_miles numeric(5,2),
    temperature_f numeric(5,2),
    precipitation character varying(20)
);


--
-- Name: weather_readings_reading_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weather_readings_reading_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weather_readings_reading_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weather_readings_reading_id_seq OWNED BY public.weather_readings.reading_id;


--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: customers customer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN customer_id SET DEFAULT nextval('public.customers_customer_id_seq'::regclass);


--
-- Name: dispatch_rejections rejection_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_rejections ALTER COLUMN rejection_id SET DEFAULT nextval('public.dispatch_rejections_rejection_id_seq'::regclass);


--
-- Name: employees employee_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN employee_id SET DEFAULT nextval('public.employees_employee_id_seq'::regclass);


--
-- Name: maintenance_requests request_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests ALTER COLUMN request_id SET DEFAULT nextval('public.maintenance_requests_request_id_seq'::regclass);


--
-- Name: merch_purchases purchase_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merch_purchases ALTER COLUMN purchase_id SET DEFAULT nextval('public.merch_purchases_purchase_id_seq'::regclass);


--
-- Name: notifications notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN notification_id SET DEFAULT nextval('public.notifications_notification_id_seq'::regclass);


--
-- Name: operator_assignments assignment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_assignments ALTER COLUMN assignment_id SET DEFAULT nextval('public.operator_assignments_assignment_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: ride_dispatches dispatch_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_dispatches ALTER COLUMN dispatch_id SET DEFAULT nextval('public.ride_dispatches_dispatch_id_seq'::regclass);


--
-- Name: ride_interlocks interlock_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_interlocks ALTER COLUMN interlock_id SET DEFAULT nextval('public.ride_interlocks_interlock_id_seq'::regclass);


--
-- Name: ticket_purchases purchase_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases ALTER COLUMN purchase_id SET DEFAULT nextval('public.ticket_purchases_purchase_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: weather_readings reading_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_readings ALTER COLUMN reading_id SET DEFAULT nextval('public.weather_readings_reading_id_seq'::regclass);


--
-- Data for Name: _migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._migrations VALUES (46, '000_cleanup_old_triggers', '2026-04-18 06:52:22.909671+00');
INSERT INTO public._migrations VALUES (47, '001_create_users', '2026-04-18 06:52:23.418397+00');
INSERT INTO public._migrations VALUES (48, '002_create_refresh_tokens', '2026-04-18 06:52:23.841369+00');
INSERT INTO public._migrations VALUES (49, '003_extend_customers', '2026-04-18 06:52:24.245762+00');
INSERT INTO public._migrations VALUES (50, '004_extend_employees', '2026-04-18 06:52:24.739874+00');
INSERT INTO public._migrations VALUES (51, '005_extend_rides', '2026-04-18 06:52:25.215775+00');
INSERT INTO public._migrations VALUES (52, '006_extend_ticket_types', '2026-04-18 06:52:25.971037+00');
INSERT INTO public._migrations VALUES (53, '007_extend_park_entities', '2026-04-18 06:52:26.669768+00');
INSERT INTO public._migrations VALUES (54, '008_create_maintenance_requests', '2026-04-18 06:52:27.402959+00');
INSERT INTO public._migrations VALUES (55, '009_create_ticket_purchases', '2026-04-18 06:52:28.015737+00');
INSERT INTO public._migrations VALUES (56, '010_create_notifications', '2026-04-18 06:52:28.636819+00');
INSERT INTO public._migrations VALUES (57, '011_create_park_closures', '2026-04-18 06:52:29.054709+00');
INSERT INTO public._migrations VALUES (58, '012_create_dispatch_tables', '2026-04-18 06:52:29.472746+00');
INSERT INTO public._migrations VALUES (59, '013_create_event_routing_tables', '2026-04-18 06:52:29.895675+00');
INSERT INTO public._migrations VALUES (60, '014_create_notification_helper', '2026-04-18 06:52:30.319155+00');
INSERT INTO public._migrations VALUES (61, '015_trigger_route_maintenance_event', '2026-04-18 06:53:27.408912+00');
INSERT INTO public._migrations VALUES (62, '016_trigger_enforce_dispatch_envelope', '2026-04-18 06:53:27.880174+00');
INSERT INTO public._migrations VALUES (63, '017_escalation_function', '2026-04-18 06:53:28.305866+00');
INSERT INTO public._migrations VALUES (64, '018_seed_interlocks_and_phones', '2026-04-18 06:53:28.696335+00');
INSERT INTO public._migrations VALUES (65, '019_add_decommissioned_at_to_venues', '2026-04-18 06:53:29.110172+00');
INSERT INTO public._migrations VALUES (68, '023_trigger_guard_employee_deactivation', '2026-04-18 08:59:23.144033+00');
INSERT INTO public._migrations VALUES (69, '024_drop_dispatch_envelope_trigger', '2026-04-18 08:59:23.593724+00');
INSERT INTO public._migrations VALUES (70, '021_drop_monitor_artifacts', '2026-04-18 08:59:24.442761+00');
INSERT INTO public._migrations VALUES (72, '024_trigger_park_closure_cascade', '2026-04-18 12:04:23.226289+00');
INSERT INTO public._migrations VALUES (73, '022_trigger_guard_ride_reopen', '2026-04-18 12:06:08.191496+00');
INSERT INTO public._migrations VALUES (74, '020_maintenance_trigger_dashboard_only', '2026-04-18 12:06:09.109952+00');
INSERT INTO public._migrations VALUES (75, '025_create_merch_purchases', '2026-04-18 12:31:53.228232+00');
INSERT INTO public._migrations VALUES (76, '026_add_merch_presentation_columns', '2026-04-18 12:57:28.833214+00');
INSERT INTO public._migrations VALUES (77, '027_drop_ride_dispatch_queue', '2026-04-19 04:32:35.309025+00');
INSERT INTO public._migrations VALUES (78, '028_completion_auto_reopen', '2026-04-19 05:27:17.745556+00');
INSERT INTO public._migrations VALUES (79, '029_maintenance_archived_at', '2026-04-19 05:38:49.682359+00');
INSERT INTO public._migrations VALUES (80, '030_park_closure_notifications_and_archive', '2026-04-19 05:49:05.525157+00');
INSERT INTO public._migrations VALUES (81, '031_request_reopened_event', '2026-04-19 07:37:53.275712+00');


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customers VALUES (1, 'maria.garcia@email.com', 'Maria Garcia', '1990-05-14', 8325551001, '2026-04-18 09:07:00.533903', 5);
INSERT INTO public.customers VALUES (2, 'james.wilson@email.com', 'James Wilson', '1985-11-22', 7135552002, '2026-04-18 09:07:00.910198', 6);
INSERT INTO public.customers VALUES (3, 'sarah.johnson@email.com', 'Sarah Johnson', '1998-03-08', 2815553003, '2026-04-18 09:07:01.071736', 7);
INSERT INTO public.customers VALUES (4, 'david.lee@email.com', 'David Lee', '1992-07-19', 8325554004, '2026-04-18 09:07:01.252521', 8);
INSERT INTO public.customers VALUES (5, 'emily.chen@email.com', 'Emily Chen', '2001-12-30', 7135555005, '2026-04-18 09:07:01.404757', 9);
INSERT INTO public.customers VALUES (6, 'customer6@email.com', 'Olivia Brown', '1970-07-20', 8325556001, '2026-04-18 09:17:32.905974', 10);
INSERT INTO public.customers VALUES (7, 'customer7@email.com', 'Liam Taylor', '1971-02-05', 8325556002, '2026-04-18 09:17:32.905974', 11);
INSERT INTO public.customers VALUES (8, 'customer8@email.com', 'Ava Anderson', '1971-08-24', 8325556003, '2026-04-18 09:17:32.905974', 12);
INSERT INTO public.customers VALUES (9, 'customer9@email.com', 'Noah Thomas', '1972-03-11', 8325556004, '2026-04-18 09:17:32.905974', 13);
INSERT INTO public.customers VALUES (10, 'customer10@email.com', 'Sophia Jackson', '1972-09-27', 8325556005, '2026-04-18 09:17:32.905974', 14);
INSERT INTO public.customers VALUES (11, 'customer11@email.com', 'Mason White', '1973-04-15', 8325556006, '2026-04-18 09:17:32.905974', 15);
INSERT INTO public.customers VALUES (12, 'customer12@email.com', 'Isabella Harris', '1973-11-01', 8325556007, '2026-04-18 09:17:32.905974', 16);
INSERT INTO public.customers VALUES (13, 'customer13@email.com', 'Lucas Martin', '1974-05-20', 8325556008, '2026-04-18 09:17:32.905974', 17);
INSERT INTO public.customers VALUES (14, 'customer14@email.com', 'Mia Thompson', '1974-12-06', 8325556009, '2026-04-18 09:17:32.905974', 18);
INSERT INTO public.customers VALUES (15, 'customer15@email.com', 'Ethan Moore', '1975-06-24', 8325556010, '2026-04-18 09:17:32.905974', 19);
INSERT INTO public.customers VALUES (16, 'customer16@email.com', 'Charlotte Young', '1976-01-10', 8325556011, '2026-04-18 09:17:32.905974', 20);
INSERT INTO public.customers VALUES (17, 'customer17@email.com', 'Logan King', '1976-07-28', 8325556012, '2026-04-18 09:17:32.905974', 21);
INSERT INTO public.customers VALUES (18, 'customer18@email.com', 'Amelia Wright', '1977-02-13', 8325556013, '2026-04-18 09:17:32.905974', 22);
INSERT INTO public.customers VALUES (19, 'customer19@email.com', 'Jackson Scott', '1977-09-01', 8325556014, '2026-04-18 09:17:32.905974', 23);
INSERT INTO public.customers VALUES (20, 'customer20@email.com', 'Harper Green', '1978-03-20', 8325556015, '2026-04-18 09:17:32.905974', 24);
INSERT INTO public.customers VALUES (21, 'customer21@email.com', 'Aiden Baker', '1978-10-06', 8325556016, '2026-04-18 09:17:32.905974', 25);
INSERT INTO public.customers VALUES (22, 'customer22@email.com', 'Evelyn Adams', '1979-04-24', 8325556017, '2026-04-18 09:17:32.905974', 26);
INSERT INTO public.customers VALUES (23, 'customer23@email.com', 'Elijah Nelson', '1979-11-10', 8325556018, '2026-04-18 09:17:32.905974', 27);
INSERT INTO public.customers VALUES (24, 'customer24@email.com', 'Abigail Hill', '1980-05-28', 8325556019, '2026-04-18 09:17:32.905974', 28);
INSERT INTO public.customers VALUES (25, 'customer25@email.com', 'Carter Ramirez', '1980-12-14', 8325556020, '2026-04-18 09:17:32.905974', 29);
INSERT INTO public.customers VALUES (26, 'customer26@email.com', 'Zoe Campbell', '1981-07-02', 8325556021, '2026-04-18 09:17:32.905974', 30);
INSERT INTO public.customers VALUES (27, 'customer27@email.com', 'Grayson Mitchell', '1982-01-18', 8325556022, '2026-04-18 09:17:32.905974', 31);
INSERT INTO public.customers VALUES (28, 'customer28@email.com', 'Scarlett Roberts', '1982-08-06', 8325556023, '2026-04-18 09:17:32.905974', 32);
INSERT INTO public.customers VALUES (29, 'customer29@email.com', 'Sebastian Perez', '1983-02-22', 8325556024, '2026-04-18 09:17:32.905974', 33);
INSERT INTO public.customers VALUES (30, 'customer30@email.com', 'Victoria Phillips', '1983-09-10', 8325556025, '2026-04-18 09:17:32.905974', 34);


--
-- Data for Name: dispatch_rejections; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.dispatch_rejections VALUES (34, 42, 4, '2026-04-04 04:55:03.195337', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (35, 42, 4, '2026-03-27 03:55:03.423895', 'INTERLOCK_OPEN', 'Lap-bar sensor reported open during pre-check', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (36, 42, 4, '2026-04-11 12:55:03.639895', 'OPERATOR_UNCERT', 'Operator certification lapsed on this ride', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (37, 42, 4, '2026-03-25 15:55:03.859693', 'OPERATOR_UNCERT', 'Operator certification lapsed on this ride', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (38, 42, 4, '2026-04-03 16:55:04.102748', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (39, 42, 4, '2026-04-06 01:55:04.348922', 'CAPACITY_EXCEED', 'Guest count exceeds ride capacity', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (40, 43, 4, '2026-04-04 09:55:06.38907', 'INTERLOCK_OPEN', 'Lap-bar sensor reported open during pre-check', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (41, 43, 1, '2026-03-20 12:55:06.619473', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (42, 43, 9, '2026-04-17 17:55:06.853783', 'HEIGHT_FAIL', 'Guest below minimum height requirement', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (43, 43, 4, '2026-03-21 11:55:07.095568', 'HEIGHT_FAIL', 'Guest below minimum height requirement', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (44, 43, 9, '2026-03-30 02:55:07.334221', 'CAPACITY_EXCEED', 'Guest count exceeds ride capacity', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (45, 43, 4, '2026-04-11 16:55:07.558391', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (46, 44, 9, '2026-03-25 12:55:08.453988', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (47, 44, 9, '2026-03-26 11:55:08.686545', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (48, 44, 9, '2026-03-23 07:55:08.916244', 'INTERLOCK_OPEN', 'Lap-bar sensor reported open during pre-check', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (49, 44, 9, '2026-04-01 04:55:09.126721', 'INTERLOCK_OPEN', 'Lap-bar sensor reported open during pre-check', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (50, 45, 7, '2026-04-04 07:55:11.130145', 'WEATHER_WIND', 'Wind speed above operating envelope', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (51, 46, 9, '2026-04-05 01:55:13.179112', 'OPERATOR_UNCERT', 'Operator certification lapsed on this ride', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (52, 46, 9, '2026-04-08 06:55:13.40065', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (53, 46, 9, '2026-04-15 05:55:13.633105', 'WEATHER_WIND', 'Wind speed above operating envelope', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (54, 46, 9, '2026-03-29 14:55:13.870946', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (55, 46, 9, '2026-03-26 14:55:14.095478', 'CAPACITY_EXCEED', 'Guest count exceeds ride capacity', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (56, 46, 9, '2026-04-03 21:55:14.338819', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (57, 47, 9, '2026-04-12 00:55:17.280232', 'INTERLOCK_OPEN', 'Lap-bar sensor reported open during pre-check', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (58, 47, 10, '2026-04-16 10:55:17.512302', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (59, 47, 9, '2026-04-08 06:55:17.741106', 'INTERLOCK_OPEN', 'Lap-bar sensor reported open during pre-check', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (60, 47, 10, '2026-04-12 02:55:17.970092', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (61, 50, 10, '2026-04-16 22:55:25.738906', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (62, 50, 10, '2026-04-11 06:55:26.011866', 'OPERATOR_UNCERT', 'Operator certification lapsed on this ride', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (63, 50, 9, '2026-03-22 12:55:26.272767', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (64, 50, 10, '2026-04-06 20:55:26.529359', 'WEATHER_WIND', 'Wind speed above operating envelope', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (65, 50, 10, '2026-04-15 04:55:26.767433', 'CAPACITY_EXCEED', 'Guest count exceeds ride capacity', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (66, 50, 10, '2026-03-25 01:55:26.979068', 'HEIGHT_FAIL', 'Guest below minimum height requirement', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (67, 51, 5, '2026-04-07 20:55:29.287024', 'WEATHER_WIND', 'Wind speed above operating envelope', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (68, 51, 5, '2026-03-23 03:55:29.520427', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (69, 51, 5, '2026-04-19 01:55:29.749338', 'WEATHER_WIND', 'Wind speed above operating envelope', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (70, 51, 5, '2026-04-01 18:55:29.979035', 'WEATHER_WIND', 'Wind speed above operating envelope', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (71, 51, 5, '2026-04-10 14:55:30.202864', 'MAINT_HOLD', 'Maintenance hold active — awaiting inspection', '{"auto_seeded": true}');
INSERT INTO public.dispatch_rejections VALUES (72, 51, 5, '2026-04-18 11:55:30.343359', 'WEATHER_LIGHTNING', 'Lightning detected within 10 miles', '{"auto_seeded": true}');


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.employees VALUES (1, 'Alex Rivera', 'alex.rivera@cougarride.com', 'admin', NULL, NULL, NULL, 35.00, NULL, NULL, NULL, 1, NULL, true);
INSERT INTO public.employees VALUES (2, 'Srinath Satuluri', 'srinath.satuluri@cougarride.com', 'manager', NULL, NULL, NULL, 28.00, NULL, NULL, NULL, 2, NULL, true);
INSERT INTO public.employees VALUES (3, 'Melanie Cura', 'melanie.cura@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, NULL, NULL, NULL, 3, NULL, true);
INSERT INTO public.employees VALUES (4, 'Nicholaus Mayes', 'nicholaus.mayes@cougarride.com', 'staff', NULL, NULL, NULL, 18.00, NULL, NULL, NULL, 4, NULL, true);
INSERT INTO public.employees VALUES (5, 'Marcus Hill', 'marcus.hill@cougarride.com', 'staff', NULL, NULL, NULL, 17.50, '2022-02-15', NULL, NULL, 35, NULL, true);
INSERT INTO public.employees VALUES (6, 'Priya Patel', 'priya.patel@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2022-04-01', NULL, NULL, 36, NULL, true);
INSERT INTO public.employees VALUES (7, 'Jordan Kim', 'jordan.kim@cougarride.com', 'staff', NULL, NULL, NULL, 19.50, '2022-05-16', NULL, NULL, 37, NULL, true);
INSERT INTO public.employees VALUES (8, 'Taylor Reed', 'taylor.reed@cougarride.com', 'staff', NULL, NULL, NULL, 16.50, '2022-06-30', NULL, NULL, 38, NULL, true);
INSERT INTO public.employees VALUES (9, 'Chris Nguyen', 'chris.nguyen@cougarride.com', 'staff', NULL, NULL, NULL, 17.50, '2022-08-14', NULL, NULL, 39, NULL, false);
INSERT INTO public.employees VALUES (10, 'Samantha Cruz', 'samantha.cruz@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2022-09-28', NULL, NULL, 40, NULL, true);
INSERT INTO public.employees VALUES (11, 'Devon Martinez', 'devon.martinez@cougarride.com', 'manager', NULL, NULL, NULL, 30.00, '2022-11-12', NULL, NULL, 41, NULL, true);
INSERT INTO public.employees VALUES (12, 'Aisha Robinson', 'aisha.robinson@cougarride.com', 'staff', NULL, NULL, NULL, 16.50, '2022-12-27', NULL, NULL, 42, NULL, true);
INSERT INTO public.employees VALUES (13, 'Benjamin Foster', 'benjamin.foster@cougarride.com', 'staff', NULL, NULL, NULL, 17.50, '2023-02-10', NULL, NULL, 43, NULL, true);
INSERT INTO public.employees VALUES (14, 'Rachel Sanchez', 'rachel.sanchez@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2023-03-27', NULL, NULL, 44, NULL, false);
INSERT INTO public.employees VALUES (15, 'Kyle Bennett', 'kyle.bennett@cougarride.com', 'staff', NULL, NULL, NULL, 19.50, '2023-05-11', NULL, NULL, 45, NULL, true);
INSERT INTO public.employees VALUES (16, 'Natalie Brooks', 'natalie.brooks@cougarride.com', 'staff', NULL, NULL, NULL, 16.50, '2023-06-25', NULL, NULL, 46, NULL, true);
INSERT INTO public.employees VALUES (17, 'Omar Haddad', 'omar.haddad@cougarride.com', 'manager', NULL, NULL, NULL, 31.00, '2023-08-09', NULL, NULL, 47, NULL, true);
INSERT INTO public.employees VALUES (18, 'Leah Morris', 'leah.morris@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2023-09-23', NULL, NULL, 48, NULL, true);
INSERT INTO public.employees VALUES (19, 'Trevor Wallace', 'trevor.wallace@cougarride.com', 'staff', NULL, NULL, NULL, 19.50, '2023-11-07', NULL, NULL, 49, NULL, false);
INSERT INTO public.employees VALUES (20, 'Yuki Tanaka', 'yuki.tanaka@cougarride.com', 'staff', NULL, NULL, NULL, 16.50, '2023-12-22', NULL, NULL, 50, NULL, true);
INSERT INTO public.employees VALUES (21, 'Isabel Ortiz', 'isabel.ortiz@cougarride.com', 'staff', NULL, NULL, NULL, 17.50, '2024-02-05', NULL, NULL, 51, NULL, true);
INSERT INTO public.employees VALUES (22, 'Derek Chen', 'derek.chen@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2024-03-21', NULL, NULL, 52, NULL, true);
INSERT INTO public.employees VALUES (23, 'Sienna Reyes', 'sienna.reyes@cougarride.com', 'staff', NULL, NULL, NULL, 19.50, '2024-05-05', NULL, NULL, 53, NULL, true);
INSERT INTO public.employees VALUES (24, 'Oscar Beltran', 'oscar.beltran@cougarride.com', 'staff', NULL, NULL, NULL, 16.50, '2024-06-19', NULL, NULL, 54, NULL, false);
INSERT INTO public.employees VALUES (25, 'Hannah Park', 'hannah.park@cougarride.com', 'manager', NULL, NULL, NULL, 29.00, '2024-08-03', NULL, NULL, 55, NULL, true);
INSERT INTO public.employees VALUES (26, 'Jon Lindqvist', 'jon.lindqvist@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2024-09-17', NULL, NULL, 56, NULL, true);
INSERT INTO public.employees VALUES (27, 'Rosa Delgado', 'rosa.delgado@cougarride.com', 'staff', NULL, NULL, NULL, 19.50, '2024-11-01', NULL, NULL, 57, NULL, true);
INSERT INTO public.employees VALUES (28, 'Preston Walsh', 'preston.walsh@cougarride.com', 'staff', NULL, NULL, NULL, 16.50, '2024-12-16', NULL, NULL, 58, NULL, true);
INSERT INTO public.employees VALUES (29, 'Camila Vargas', 'camila.vargas@cougarride.com', 'staff', NULL, NULL, NULL, 17.50, '2025-01-30', NULL, NULL, 59, NULL, false);
INSERT INTO public.employees VALUES (30, 'Ian Kowalski', 'ian.kowalski@cougarride.com', 'staff', NULL, NULL, NULL, 18.50, '2025-03-16', NULL, NULL, 60, NULL, true);


--
-- Data for Name: game; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.game OVERRIDING SYSTEM VALUE VALUES (27, 'Ring Toss', 4, 1, 'Zone A', '2026-04-18 09:07:02.79124', 3200.00, 'Toss rings onto bottles to win! Land three in a row for the grand prize.', '/rides/bumper-cars.jpg', 'Giant Stuffed Bear', NULL);
INSERT INTO public.game OVERRIDING SYSTEM VALUE VALUES (28, 'Balloon Darts', 2, 1, 'Zone B', '2026-04-18 09:07:02.79124', 2800.00, 'Pop balloons with darts to reveal your prize. Every throw is a winner!', 'https://images.unsplash.com/photo-1527168027773-0cc890c4f42e?w=800', 'Goldfish in Bag', NULL);
INSERT INTO public.game OVERRIDING SYSTEM VALUE VALUES (29, 'Water Gun Race', 6, 1, 'Zone C', '2026-04-18 09:07:02.79124', 4100.00, 'Race against friends by shooting water at your target. First to the top wins!', 'https://images.unsplash.com/photo-1504309092620-4d0ec726efa4?w=800', 'Plush Toy', NULL);
INSERT INTO public.game OVERRIDING SYSTEM VALUE VALUES (30, 'Basketball Shoot', 2, 1, 'Zone D', '2026-04-18 09:07:02.79124', 1900.00, 'Sink baskets from the three-point line. Three in a row wins the grand prize!', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800', 'Sports Jersey', NULL);
INSERT INTO public.game OVERRIDING SYSTEM VALUE VALUES (31, 'Whack-a-Mole', 1, 0, 'Zone A', '2026-04-18 09:07:02.79124', 0.00, 'Classic arcade fun! Whack as many moles as you can in 60 seconds.', 'https://images.unsplash.com/photo-1511882150382-421056c89033?w=800', 'Mini Plush', NULL);


--
-- Data for Name: gift_shop; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.gift_shop OVERRIDING SYSTEM VALUE VALUES (16, 1, 'Main Street Gifts', 'Zone A', 18900.00, NULL, NULL, 'The flagship CougarRide gift shop with the widest selection of apparel, souvenirs, and collectibles.', 'https://images.unsplash.com/photo-1513267048331-5611cad62e41?w=800', NULL);
INSERT INTO public.gift_shop OVERRIDING SYSTEM VALUE VALUES (17, 1, 'Coaster Corner Store', 'Zone B', 7600.00, NULL, NULL, 'Coaster-themed merchandise, ride photos, and exclusive Zone B souvenirs.', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800', NULL);
INSERT INTO public.gift_shop OVERRIDING SYSTEM VALUE VALUES (18, 1, 'Splash Zone Souvenirs', 'Zone C', 5400.00, NULL, NULL, 'Ponchos, towels, waterproof phone cases, and water ride memorabilia.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', NULL);


--
-- Data for Name: maintenance_requests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.maintenance_requests VALUES (28, 44, 28, 'Safety harness mechanism sticky', 'High', 'Completed', '2025-11-08 09:17:32.905974+00', '2026-04-19 07:26:48.803586+00', NULL);
INSERT INTO public.maintenance_requests VALUES (4, 46, 4, 'Hydraulic cylinder leak on main arm', 'Critical', 'Completed', '2026-04-16 09:07:03.209296+00', '2026-04-19 07:27:33.026415+00', NULL);
INSERT INTO public.maintenance_requests VALUES (6, 44, 4, 'Structural crack detected on support beam — ride unsafe', 'Critical', 'In Progress', '2026-04-18 06:07:03.389517+00', NULL, NULL);
INSERT INTO public.maintenance_requests VALUES (5, 49, 3, 'Animatronic malfunction in Room 3', 'High', 'Completed', '2026-04-17 09:07:03.302057+00', '2026-04-19 07:43:01.318779+00', NULL);
INSERT INTO public.maintenance_requests VALUES (10, 46, 6, 'Gear train lubrication cycle overdue', 'Medium', 'Completed', '2026-03-14 09:17:32.905974+00', '2026-04-19 05:48:50.429172+00', NULL);
INSERT INTO public.maintenance_requests VALUES (40, 42, 11, 'jammed gears', 'Critical', 'Completed', '2026-04-19 05:12:31.224102+00', '2026-04-19 05:21:06.468058+00', '2026-04-19 05:40:56.13396+00');
INSERT INTO public.maintenance_requests VALUES (31, 42, 6, 'testing alerts', 'Medium', 'Completed', '2026-04-18 09:24:08.388772+00', '2026-04-19 05:21:37.911434+00', '2026-04-19 05:40:58.969263+00');
INSERT INTO public.maintenance_requests VALUES (3, 48, 3, 'LED lighting replacement on wheel spokes', 'Low', 'Completed', '2026-04-11 09:07:03.119777+00', '2026-04-11 11:24:03.119777+00', '2026-04-19 05:41:01.921992+00');
INSERT INTO public.maintenance_requests VALUES (2, 45, 4, 'Water pump seal replacement', 'High', 'Completed', '2026-04-08 09:07:03.043204+00', '2026-04-08 20:29:03.043204+00', '2026-04-19 05:41:05.00922+00');
INSERT INTO public.maintenance_requests VALUES (7, 43, 3, 'Seatbelt webbing inspection flagged wear', 'Low', 'Completed', '2026-04-04 09:17:32.905974+00', '2026-04-04 14:28:32.905974+00', '2026-04-19 05:41:07.33183+00');
INSERT INTO public.maintenance_requests VALUES (1, 42, 3, 'Routine brake inspection — pads replaced', 'Medium', 'Completed', '2026-04-04 09:07:02.956458+00', '2026-04-05 08:47:02.956458+00', '2026-04-19 05:41:09.646381+00');
INSERT INTO public.maintenance_requests VALUES (8, 44, 4, 'Cooling fan grinding noise', 'Low', 'Completed', '2026-03-28 09:17:32.905974+00', '2026-03-28 15:54:32.905974+00', '2026-04-19 05:41:11.911264+00');
INSERT INTO public.maintenance_requests VALUES (9, 45, 5, 'Sensor calibration drift', 'Medium', 'Completed', '2026-03-21 09:17:32.905974+00', '2026-03-22 07:59:32.905974+00', '2026-04-19 05:41:13.99517+00');
INSERT INTO public.maintenance_requests VALUES (12, 48, 8, 'Coaster car windshield crack', 'High', 'Completed', '2026-02-28 09:17:32.905974+00', '2026-02-28 18:12:32.905974+00', '2026-04-19 05:41:16.509027+00');
INSERT INTO public.maintenance_requests VALUES (13, 49, 10, 'Control PC rebooting unexpectedly', 'High', 'Completed', '2026-02-21 09:17:32.905974+00', '2026-02-21 10:47:32.905974+00', '2026-04-19 05:41:18.657544+00');
INSERT INTO public.maintenance_requests VALUES (14, 50, 11, 'Pneumatic gate line leak', 'Low', 'Completed', '2026-02-14 09:17:32.905974+00', '2026-02-14 22:51:32.905974+00', '2026-04-19 05:41:21.517037+00');
INSERT INTO public.maintenance_requests VALUES (15, 51, 12, 'Audio system fail in queue line', 'Low', 'Completed', '2026-02-07 09:17:32.905974+00', '2026-02-07 23:38:32.905974+00', '2026-04-19 05:41:24.122133+00');
INSERT INTO public.maintenance_requests VALUES (16, 42, 13, 'Chain lift motor bearing', 'Low', 'Completed', '2026-01-31 09:17:32.905974+00', '2026-04-19 05:22:14.298497+00', '2026-04-19 05:41:27.059437+00');
INSERT INTO public.maintenance_requests VALUES (18, 44, 16, 'Ride photo camera lens crack', 'Medium', 'Completed', '2026-01-17 09:17:32.905974+00', '2026-01-18 02:56:32.905974+00', '2026-04-19 05:41:29.432868+00');
INSERT INTO public.maintenance_requests VALUES (19, 45, 17, 'Electrical grounding check on lift hill', 'Medium', 'Completed', '2026-01-10 09:17:32.905974+00', '2026-01-11 04:31:32.905974+00', '2026-04-19 05:41:31.522555+00');
INSERT INTO public.maintenance_requests VALUES (20, 46, 18, 'Queue line fan replacement', 'High', 'Completed', '2026-01-03 09:17:32.905974+00', '2026-01-03 12:37:32.905974+00', '2026-04-19 05:41:33.48737+00');
INSERT INTO public.maintenance_requests VALUES (21, 47, 20, 'Operator booth A/C repair', 'High', 'Completed', '2025-12-27 09:17:32.905974+00', '2025-12-27 15:50:32.905974+00', '2026-04-19 05:41:35.505647+00');
INSERT INTO public.maintenance_requests VALUES (24, 50, 23, 'Ride car upholstery tear', 'Low', 'Completed', '2025-12-06 09:17:32.905974+00', '2025-12-06 16:04:32.905974+00', '2026-04-19 05:41:38.254971+00');
INSERT INTO public.maintenance_requests VALUES (25, 51, 25, 'Splashdown basin drain blockage', 'Medium', 'Completed', '2025-11-29 09:17:32.905974+00', '2025-11-29 14:32:32.905974+00', '2026-04-19 05:41:41.328007+00');
INSERT INTO public.maintenance_requests VALUES (26, 42, 26, 'E-stop button quarterly test', 'Medium', 'Completed', '2025-11-22 09:17:32.905974+00', '2025-11-23 00:44:32.905974+00', '2026-04-19 05:41:43.661117+00');
INSERT INTO public.maintenance_requests VALUES (27, 43, 27, 'Track switch alignment spec drift', 'Medium', 'Completed', '2025-11-15 09:17:32.905974+00', '2025-11-15 22:19:32.905974+00', '2026-04-19 05:41:46.002319+00');
INSERT INTO public.maintenance_requests VALUES (29, 45, 30, 'Exit gate auto-open delay', 'Critical', 'Completed', '2025-11-01 09:17:32.905974+00', '2026-04-19 05:33:29.49228+00', '2026-04-19 05:41:48.460857+00');
INSERT INTO public.maintenance_requests VALUES (30, 46, 2, 'Signage post straightening after storm', 'Low', 'Completed', '2025-10-25 09:17:32.905974+00', '2025-10-25 18:19:32.905974+00', '2026-04-19 05:41:51.493058+00');
INSERT INTO public.maintenance_requests VALUES (22, 48, 21, 'Park bench adjacent retightening', 'Low', 'Completed', '2025-12-20 09:17:32.905974+00', '2026-04-19 05:43:00.587629+00', NULL);
INSERT INTO public.maintenance_requests VALUES (23, 49, 22, 'Loading zone lighting flicker', 'Low', 'Completed', '2025-12-13 09:17:32.905974+00', '2026-04-19 05:43:10.137599+00', NULL);
INSERT INTO public.maintenance_requests VALUES (17, 43, 15, 'Station handrail loose bolts', 'Medium', 'Completed', '2026-01-24 09:17:32.905974+00', '2026-04-19 05:43:19.606543+00', NULL);
INSERT INTO public.maintenance_requests VALUES (11, 47, 7, 'Guide rail paint touch-up', 'Medium', 'Completed', '2026-03-07 09:17:32.905974+00', '2026-04-19 05:43:28.276279+00', NULL);


--
-- Data for Name: merch; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (41, 'CougarRide T-Shirt', 'Apparel', 8.00, 24.99, false, 'Main Street Gifts', 1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80', 'Soft cotton tee featuring the iconic CougarRide logo. Worn by staff and superfans alike.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (42, 'Plush Cougar Mascot', 'Toys', 5.00, 19.99, false, 'Main Street Gifts', 1, 'https://images.unsplash.com/photo-1563396983906-b3795482a59a?auto=format&fit=crop&w=800&q=80', 'Cuddly plush version of our park mascot — perfect souvenir for kids of all ages.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (43, 'Shot Glass Set', 'Souvenirs', 3.00, 12.99, false, 'Coaster Corner Store', 1, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80', 'Set of four collectible shot glasses, each etched with a different CougarRide attraction.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (44, 'Park Map Poster', 'Souvenirs', 1.50, 7.99, false, 'Splash Zone Souvenirs', 1, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80', 'Vintage-style illustrated map of the park — great for framing.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (45, 'Giant Stuffed Bear', 'Toys', 12.00, 0.00, true, 'Ring Toss', 1, 'https://images.unsplash.com/photo-1559454403-b8fb88521f19?auto=format&fit=crop&w=800&q=80', 'Three-foot plush bear — the grand prize at the Midway. Available as a game award only.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (46, 'Goldfish in Bag', 'Prizes', 2.00, 0.00, true, 'Balloon Darts', 1, 'https://images.unsplash.com/photo-1520302519878-3fe22c0ff8d9?auto=format&fit=crop&w=800&q=80', 'Classic carnival prize. Comes in a water-filled bag. Not sold separately.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (47, 'CougarRide Hoodie', 'Apparel', 15.00, 44.99, false, 'Main Street Gifts', 1, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80', 'Heavyweight fleece hoodie with embroidered CougarRide crest. Toasty on cool summer nights.');
INSERT INTO public.merch OVERRIDING SYSTEM VALUE VALUES (48, 'Keychain Collection', 'Souvenirs', 1.00, 8.99, false, 'Coaster Corner Store', 1, 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80', 'Pack of six enameled keychains — one for each major coaster in the park.');


--
-- Data for Name: merch_purchases; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications VALUES (153, 'manager', 2, 'zone_closure_opened', 'Zone Closure: Zone A', 'Zone A closed (Weather). 2 ride(s) auto-closed. Reason: wind spped too high', 'park_closures', 95, true, '2026-04-19 07:43:41.458469+00');
INSERT INTO public.notifications VALUES (155, 'manager', 2, 'zone_closure_lifted', 'Zone Reopened: Zone A', 'Closure #95 on Zone A lifted. 2 ride(s) reopened automatically.', 'park_closures', 95, true, '2026-04-19 07:44:12.316949+00');


--
-- Data for Name: operator_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.operator_assignments VALUES (63, 4, 42, '2026-03-30 04:55:00.886576', NULL);
INSERT INTO public.operator_assignments VALUES (64, 4, 43, '2026-04-17 04:55:04.561339', NULL);
INSERT INTO public.operator_assignments VALUES (65, 1, 43, '2026-04-18 04:55:04.785551', NULL);
INSERT INTO public.operator_assignments VALUES (66, 9, 43, '2026-04-11 04:55:05.023797', NULL);
INSERT INTO public.operator_assignments VALUES (67, 9, 44, '2026-04-16 04:55:07.783682', NULL);
INSERT INTO public.operator_assignments VALUES (68, 2, 45, '2026-04-11 04:55:09.365965', NULL);
INSERT INTO public.operator_assignments VALUES (69, 7, 45, '2026-04-12 04:55:09.602985', NULL);
INSERT INTO public.operator_assignments VALUES (70, 5, 45, '2026-04-04 04:55:09.833421', NULL);
INSERT INTO public.operator_assignments VALUES (71, 9, 46, '2026-04-08 04:55:11.34049', NULL);
INSERT INTO public.operator_assignments VALUES (72, 9, 47, '2026-03-22 04:55:14.560845', NULL);
INSERT INTO public.operator_assignments VALUES (73, 10, 47, '2026-04-08 04:55:14.785238', NULL);
INSERT INTO public.operator_assignments VALUES (74, 3, 48, '2026-04-04 04:55:18.193719', NULL);
INSERT INTO public.operator_assignments VALUES (75, 6, 48, '2026-03-20 04:55:18.41474', NULL);
INSERT INTO public.operator_assignments VALUES (76, 3, 49, '2026-04-01 04:55:20.698689', NULL);
INSERT INTO public.operator_assignments VALUES (77, 10, 50, '2026-04-04 04:55:23.682181', NULL);
INSERT INTO public.operator_assignments VALUES (78, 7, 50, '2026-03-30 04:55:23.911609', NULL);
INSERT INTO public.operator_assignments VALUES (79, 9, 50, '2026-04-03 04:55:24.148967', NULL);
INSERT INTO public.operator_assignments VALUES (80, 5, 51, '2026-03-28 04:55:27.211658', NULL);


--
-- Data for Name: park_closures; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (72, '2026-04-18', '09:10:35.576664', NULL, 'Thunderstorm', NULL, 'Zone C', 'Event', false, '2026-04-03 09:10:35.576664+00', '2026-04-03 11:10:35.576664+00', '2026-04-19 07:23:16.116391+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (86, '2026-04-18', '09:10:35.576664', NULL, 'Ice on pathways', NULL, 'Zone B', 'Safety', false, '2026-03-20 09:10:35.576664+00', '2026-04-18 11:22:00.996105+00', NULL);
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (94, '2026-04-19', '05:45:30.240946', NULL, 'weather closure', NULL, 'Zone B', 'Weather', false, '2026-04-19 05:45:30.240946+00', '2026-04-19 07:23:23.537113+00', '2026-04-19 07:24:15.220361+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (95, '2026-04-19', '07:43:41.458469', NULL, 'wind spped too high', NULL, 'Zone A', 'Weather', false, '2026-04-19 07:43:41.458469+00', '2026-04-19 07:44:12.316949+00', NULL);
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (89, '2026-04-18', '11:31:51.521754', NULL, 'testing', NULL, 'Zone A', 'Weather', false, '2026-04-18 11:31:51.521754+00', '2026-04-18 11:44:36.962058+00', '2026-04-19 07:21:42.782415+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (88, '2026-04-18', '11:22:15.099393', NULL, 'testing', NULL, 'Zone A', 'Emergency', false, '2026-04-18 11:22:15.099393+00', '2026-04-18 11:31:32.890716+00', '2026-04-19 07:21:45.525245+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (58, '2026-04-18', '09:10:35.576664', NULL, 'Scheduled maintenance window', NULL, 'Zone C', 'Event', false, '2026-04-17 09:10:35.576664+00', '2026-04-17 11:10:35.576664+00', '2026-04-19 07:21:47.972981+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (59, '2026-04-18', '09:10:35.576664', NULL, 'Lightning within 10 miles', NULL, 'Zone C', 'Maintenance', false, '2026-04-16 09:10:35.576664+00', '2026-04-16 11:10:35.576664+00', '2026-04-19 07:21:50.660346+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (60, '2026-04-18', '09:10:35.576664', NULL, 'Lightning within 10 miles', NULL, 'Zone A', 'Event', false, '2026-04-15 09:10:35.576664+00', '2026-04-15 11:10:35.576664+00', '2026-04-19 07:21:52.820364+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (61, '2026-04-18', '09:10:35.576664', NULL, 'Lightning within 10 miles', NULL, 'Zone A', 'Maintenance', false, '2026-04-14 09:10:35.576664+00', '2026-04-14 11:10:35.576664+00', '2026-04-19 07:21:55.162146+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (62, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone D', 'Safety', false, '2026-04-13 09:10:35.576664+00', '2026-04-13 11:10:35.576664+00', '2026-04-19 07:21:57.426126+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (63, '2026-04-18', '09:10:35.576664', NULL, 'Emergency evacuation drill', NULL, 'Zone D', 'Safety', false, '2026-04-12 09:10:35.576664+00', '2026-04-12 11:10:35.576664+00', '2026-04-19 07:21:59.795241+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (64, '2026-04-18', '09:10:35.576664', NULL, 'Scheduled maintenance window', NULL, 'Zone B', 'Safety', false, '2026-04-11 09:10:35.576664+00', '2026-04-11 11:10:35.576664+00', '2026-04-19 07:22:01.812066+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (65, '2026-04-18', '09:10:35.576664', NULL, 'Emergency evacuation drill', NULL, 'Zone C', 'Maintenance', false, '2026-04-10 09:10:35.576664+00', '2026-04-10 11:10:35.576664+00', '2026-04-19 07:22:04.412511+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (66, '2026-04-18', '09:10:35.576664', NULL, 'High winds', NULL, 'Zone D', 'Maintenance', false, '2026-04-09 09:10:35.576664+00', '2026-04-09 11:10:35.576664+00', '2026-04-19 07:22:06.656657+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (67, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone B', 'Event', false, '2026-04-08 09:10:35.576664+00', '2026-04-08 11:10:35.576664+00', '2026-04-19 07:22:09.214491+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (68, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone A', 'Safety', false, '2026-04-07 09:10:35.576664+00', '2026-04-07 11:10:35.576664+00', '2026-04-19 07:22:12.768255+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (69, '2026-04-18', '09:10:35.576664', NULL, 'Emergency evacuation drill', NULL, 'Zone C', 'Weather', false, '2026-04-06 09:10:35.576664+00', '2026-04-06 11:10:35.576664+00', '2026-04-19 07:22:14.955611+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (70, '2026-04-18', '09:10:35.576664', NULL, 'Ice on pathways', NULL, 'Zone B', 'Weather', false, '2026-04-05 09:10:35.576664+00', '2026-04-05 11:10:35.576664+00', '2026-04-19 07:22:17.266279+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (71, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone D', 'Weather', false, '2026-04-04 09:10:35.576664+00', '2026-04-04 11:10:35.576664+00', '2026-04-19 07:22:21.353978+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (87, '2026-04-18', '09:10:35.576664', NULL, 'Scheduled maintenance window', NULL, 'Zone D', 'Safety', false, '2026-03-19 09:10:35.576664+00', '2026-04-18 11:22:01.853973+00', '2026-04-19 07:22:24.24164+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (83, '2026-04-18', '09:10:35.576664', NULL, 'Ice on pathways', NULL, 'Zone C', 'Weather', false, '2026-03-23 09:10:35.576664+00', '2026-03-23 11:10:35.576664+00', '2026-04-19 07:22:28.816036+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (77, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone C', 'Maintenance', false, '2026-03-29 09:10:35.576664+00', '2026-03-29 11:10:35.576664+00', '2026-04-19 07:22:31.076303+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (79, '2026-04-18', '09:10:35.576664', NULL, 'Lightning within 10 miles', NULL, 'Zone C', 'Emergency', false, '2026-03-27 09:10:35.576664+00', '2026-03-27 11:10:35.576664+00', '2026-04-19 07:22:33.640812+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (82, '2026-04-18', '09:10:35.576664', NULL, 'Lightning within 10 miles', NULL, 'Zone D', 'Event', false, '2026-03-24 09:10:35.576664+00', '2026-03-24 11:10:35.576664+00', '2026-04-19 07:22:36.673755+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (81, '2026-04-18', '09:10:35.576664', NULL, 'Thunderstorm', NULL, 'Zone B', 'Safety', false, '2026-03-25 09:10:35.576664+00', '2026-03-25 11:10:35.576664+00', '2026-04-19 07:22:38.755525+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (78, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone B', 'Event', false, '2026-03-28 09:10:35.576664+00', '2026-03-28 11:10:35.576664+00', '2026-04-19 07:22:40.672262+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (85, '2026-04-18', '09:10:35.576664', NULL, 'Emergency evacuation drill', NULL, 'Zone C', 'Safety', false, '2026-03-21 09:10:35.576664+00', '2026-04-18 11:22:00.04764+00', '2026-04-19 07:22:46.072452+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (84, '2026-04-18', '09:10:35.576664', NULL, 'High winds', NULL, 'Zone C', 'Weather', false, '2026-03-22 09:10:35.576664+00', '2026-03-22 11:10:35.576664+00', '2026-04-19 07:22:50.15527+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (75, '2026-04-18', '09:10:35.576664', NULL, 'Emergency evacuation drill', NULL, 'Zone C', 'Emergency', false, '2026-03-31 09:10:35.576664+00', '2026-03-31 11:10:35.576664+00', '2026-04-19 07:22:56.98246+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (76, '2026-04-18', '09:10:35.576664', NULL, 'High winds', NULL, 'Zone A', 'Maintenance', false, '2026-03-30 09:10:35.576664+00', '2026-03-30 11:10:35.576664+00', '2026-04-19 07:23:02.569298+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (73, '2026-04-18', '09:10:35.576664', NULL, 'High winds', NULL, 'Zone B', 'Maintenance', false, '2026-04-02 09:10:35.576664+00', '2026-04-02 11:10:35.576664+00', '2026-04-19 07:23:10.074952+00');
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (74, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone C', 'Weather', false, '2026-04-01 09:10:35.576664+00', '2026-04-01 11:10:35.576664+00', NULL);
INSERT INTO public.park_closures OVERRIDING SYSTEM VALUE VALUES (80, '2026-04-18', '09:10:35.576664', NULL, 'Unsafe heat index', NULL, 'Zone A', 'Maintenance', false, '2026-03-26 09:10:35.576664+00', '2026-03-26 11:10:35.576664+00', NULL);


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.refresh_tokens VALUES (165, '9b519df8-7569-472d-a978-9f2c509afa9c', '492f09b1a30b5fdf5d325aba52d56840bde38f3f8eb9abd6dc0e7cf941a75e16', 2, false, '2026-04-25 09:20:16.699+00', '2026-04-18 09:20:16.698652+00');
INSERT INTO public.refresh_tokens VALUES (166, '36739d54-29f9-41aa-a1e9-8e4acb19266f', '2a169c07aab12af0869cab71c818a9ddba3faf256cf072f3e0b4d3a426aff8e9', 2, false, '2026-04-25 10:42:57.244+00', '2026-04-18 10:42:56.925163+00');
INSERT INTO public.refresh_tokens VALUES (167, 'c60d46c8-539e-4e4b-8c2d-dc38d7e9086a', '888a9aa9b0992b3a032700bc4efc1e38fa143ec13e9e483b2570ba12232bdaac', 2, false, '2026-04-26 05:20:10.039+00', '2026-04-19 05:20:10.106888+00');
INSERT INTO public.refresh_tokens VALUES (168, '52e046d3-e971-488f-9970-7acff7f4d576', '2e12e3522f7f6a8571bd4beeaa8c340152255694bd0d6e2df3139c14138112dd', 2, false, '2026-04-26 05:36:05.384+00', '2026-04-19 05:36:05.387177+00');
INSERT INTO public.refresh_tokens VALUES (169, 'c33f1ded-5851-4072-92fc-3c0d6a4832ec', 'd58307ee6ec0a9bd234458caa8ad2a151b50cc72f7c7862de56c1e6c4a8c6e8a', 2, false, '2026-04-26 07:21:19.28+00', '2026-04-19 07:21:19.281297+00');
INSERT INTO public.refresh_tokens VALUES (170, '8c634e1d-a441-4153-951b-894c350badfc', '008cd8d71203d28e3e66ec6cfa8c8f61b3fe639ffa12f96317b0a56bf24aa19f', 2, false, '2026-04-26 07:38:55.855+00', '2026-04-19 07:38:55.855785+00');
INSERT INTO public.refresh_tokens VALUES (171, '0f2697b9-96be-425f-b6ba-22bfc272d69a', 'b625491b4441d5848e741d705f450b3121267969c5a978b7bbf4850f969ef265', 2, false, '2026-04-26 07:54:42.039+00', '2026-04-19 07:54:42.042532+00');
INSERT INTO public.refresh_tokens VALUES (172, 'a69307e8-4320-41cf-939b-ca5f84be476d', 'f9919edce9250085464d5ef1d440b18b894610ac6b59e88b1b9a94b7cc2dc395', 2, false, '2026-04-26 07:55:43.328+00', '2026-04-19 07:55:43.33105+00');
INSERT INTO public.refresh_tokens VALUES (173, 'ad1eb811-68c6-4a4c-a230-4713aa7fa991', '9c6d31f80c2219702165385b440e9bdc8d88fc0ad78317d365cee094b58e31bf', 3, false, '2026-04-26 07:56:25.636+00', '2026-04-19 07:56:25.63873+00');


--
-- Data for Name: restaurant; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.restaurant OVERRIDING SYSTEM VALUE VALUES (28, 1, 'Cougar Grill', 'American', 'Zone A', 12450.00, NULL, NULL, 'Classic American burgers, fries, and shakes. Outdoor seating with views of Thrill Alley.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800', NULL);
INSERT INTO public.restaurant OVERRIDING SYSTEM VALUE VALUES (29, 1, 'Panda Express', 'Asian', 'Zone B', 9800.00, NULL, NULL, 'Quick-serve Asian favorites including orange chicken, fried rice, and lo mein.', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800', NULL);
INSERT INTO public.restaurant OVERRIDING SYSTEM VALUE VALUES (30, 1, 'Pizza Planet', 'Italian', 'Zone C', 15200.00, NULL, NULL, 'Wood-fired pizzas, pasta, and garlic bread. Our most popular dining spot!', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', NULL);
INSERT INTO public.restaurant OVERRIDING SYSTEM VALUE VALUES (31, 1, 'Snack Shack', 'Snacks & Drinks', 'Zone D', 6300.00, NULL, NULL, 'Popcorn, pretzels, cotton candy, and refreshing drinks to keep you going.', 'https://images.unsplash.com/photo-1578946956088-940c3b502864?w=800', NULL);
INSERT INTO public.restaurant OVERRIDING SYSTEM VALUE VALUES (32, 0, 'The BBQ Pit', 'BBQ', 'Zone A', 0.00, NULL, NULL, 'Slow-smoked brisket, ribs, and pulled pork. Currently closed for renovation.', 'https://images.unsplash.com/photo-1529193591184-b1d58069ecf0?w=800', NULL);


--
-- Data for Name: ride_dispatches; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ride_dispatches VALUES (36, 42, 4, '2026-03-30 07:55:01.144408', 120, 8, NULL);
INSERT INTO public.ride_dispatches VALUES (37, 42, 4, '2026-04-10 05:55:01.378864', 145, 21, NULL);
INSERT INTO public.ride_dispatches VALUES (38, 42, 4, '2026-04-16 12:55:01.599088', 234, 8, NULL);
INSERT INTO public.ride_dispatches VALUES (39, 42, 4, '2026-04-10 22:55:01.828627', 239, 31, NULL);
INSERT INTO public.ride_dispatches VALUES (40, 42, 4, '2026-04-02 20:55:02.054469', 124, 18, NULL);
INSERT INTO public.ride_dispatches VALUES (41, 42, 4, '2026-03-25 00:55:02.290841', 153, 17, NULL);
INSERT INTO public.ride_dispatches VALUES (42, 42, 4, '2026-04-14 01:55:02.522021', 221, 8, NULL);
INSERT INTO public.ride_dispatches VALUES (43, 42, 4, '2026-03-24 02:55:02.748748', 195, 26, NULL);
INSERT INTO public.ride_dispatches VALUES (44, 42, 4, '2026-03-20 12:55:02.970137', 184, 28, NULL);
INSERT INTO public.ride_dispatches VALUES (45, 43, 9, '2026-04-02 08:55:05.248968', 155, 16, NULL);
INSERT INTO public.ride_dispatches VALUES (46, 43, 1, '2026-03-21 23:55:05.47256', 176, 16, NULL);
INSERT INTO public.ride_dispatches VALUES (47, 43, 4, '2026-04-09 06:55:05.703039', 154, 24, NULL);
INSERT INTO public.ride_dispatches VALUES (48, 43, 9, '2026-04-15 17:55:05.913373', 153, 6, NULL);
INSERT INTO public.ride_dispatches VALUES (49, 43, 9, '2026-03-24 01:55:06.146664', 104, 31, NULL);
INSERT INTO public.ride_dispatches VALUES (50, 44, 9, '2026-03-22 17:55:08.016486', 240, 28, NULL);
INSERT INTO public.ride_dispatches VALUES (51, 44, 9, '2026-04-10 08:55:08.235045', 108, 7, NULL);
INSERT INTO public.ride_dispatches VALUES (52, 45, 2, '2026-03-20 20:55:10.044421', 227, 9, NULL);
INSERT INTO public.ride_dispatches VALUES (53, 45, 2, '2026-03-24 23:55:10.263894', 115, 31, NULL);
INSERT INTO public.ride_dispatches VALUES (54, 45, 7, '2026-03-23 08:55:10.473092', 136, 14, NULL);
INSERT INTO public.ride_dispatches VALUES (55, 45, 2, '2026-04-04 12:55:10.698331', 185, 23, NULL);
INSERT INTO public.ride_dispatches VALUES (56, 45, 5, '2026-04-16 19:55:10.912918', 157, 13, NULL);
INSERT INTO public.ride_dispatches VALUES (57, 46, 9, '2026-04-07 11:55:11.565373', 131, 15, NULL);
INSERT INTO public.ride_dispatches VALUES (58, 46, 9, '2026-04-01 15:55:11.803536', 160, 19, NULL);
INSERT INTO public.ride_dispatches VALUES (59, 46, 9, '2026-03-22 06:55:12.050613', 164, 23, NULL);
INSERT INTO public.ride_dispatches VALUES (60, 46, 9, '2026-04-09 10:55:12.285322', 190, 32, NULL);
INSERT INTO public.ride_dispatches VALUES (61, 46, 9, '2026-04-09 05:55:12.504213', 210, 25, NULL);
INSERT INTO public.ride_dispatches VALUES (62, 46, 9, '2026-04-18 17:55:12.738592', 210, 11, NULL);
INSERT INTO public.ride_dispatches VALUES (63, 46, 9, '2026-03-26 15:55:12.963102', 185, 19, NULL);
INSERT INTO public.ride_dispatches VALUES (64, 47, 9, '2026-04-05 10:55:15.01497', 190, 16, NULL);
INSERT INTO public.ride_dispatches VALUES (65, 47, 10, '2026-03-30 04:55:15.258082', 109, 7, NULL);
INSERT INTO public.ride_dispatches VALUES (66, 47, 10, '2026-04-07 09:55:15.482424', 197, 31, NULL);
INSERT INTO public.ride_dispatches VALUES (67, 47, 9, '2026-03-21 15:55:15.72528', 147, 19, NULL);
INSERT INTO public.ride_dispatches VALUES (68, 47, 9, '2026-03-20 17:55:15.940412', 130, 21, NULL);
INSERT INTO public.ride_dispatches VALUES (69, 47, 10, '2026-04-10 13:55:16.170142', 136, 18, NULL);
INSERT INTO public.ride_dispatches VALUES (70, 47, 10, '2026-03-30 16:55:16.389392', 116, 21, NULL);
INSERT INTO public.ride_dispatches VALUES (71, 47, 9, '2026-03-22 10:55:16.60622', 229, 17, NULL);
INSERT INTO public.ride_dispatches VALUES (72, 47, 10, '2026-03-26 22:55:16.839925', 102, 29, NULL);
INSERT INTO public.ride_dispatches VALUES (73, 47, 9, '2026-04-18 12:55:17.059779', 148, 23, NULL);
INSERT INTO public.ride_dispatches VALUES (74, 48, 3, '2026-04-12 08:55:18.639695', 209, 15, NULL);
INSERT INTO public.ride_dispatches VALUES (75, 48, 3, '2026-04-12 19:55:18.867074', 129, 22, NULL);
INSERT INTO public.ride_dispatches VALUES (76, 48, 3, '2026-04-16 18:55:19.113276', 185, 12, NULL);
INSERT INTO public.ride_dispatches VALUES (77, 48, 3, '2026-04-17 11:55:19.351957', 231, 9, NULL);
INSERT INTO public.ride_dispatches VALUES (78, 48, 3, '2026-03-28 21:55:19.565743', 213, 16, NULL);
INSERT INTO public.ride_dispatches VALUES (79, 48, 6, '2026-04-16 06:55:19.789776', 174, 21, NULL);
INSERT INTO public.ride_dispatches VALUES (80, 48, 3, '2026-04-10 18:55:20.005789', 187, 9, NULL);
INSERT INTO public.ride_dispatches VALUES (81, 48, 3, '2026-04-17 14:55:20.23008', 122, 31, NULL);
INSERT INTO public.ride_dispatches VALUES (82, 48, 6, '2026-03-29 02:55:20.468035', 101, 24, NULL);
INSERT INTO public.ride_dispatches VALUES (83, 49, 3, '2026-04-05 09:55:20.940047', 112, 12, NULL);
INSERT INTO public.ride_dispatches VALUES (84, 49, 3, '2026-04-04 01:55:21.157177', 231, 29, NULL);
INSERT INTO public.ride_dispatches VALUES (85, 49, 3, '2026-04-09 18:55:21.394224', 240, 7, NULL);
INSERT INTO public.ride_dispatches VALUES (86, 49, 3, '2026-03-28 15:55:21.628332', 236, 17, NULL);
INSERT INTO public.ride_dispatches VALUES (87, 49, 3, '2026-04-18 02:55:21.858049', 175, 32, NULL);
INSERT INTO public.ride_dispatches VALUES (88, 49, 3, '2026-04-11 14:55:22.075001', 147, 30, NULL);
INSERT INTO public.ride_dispatches VALUES (89, 49, 3, '2026-03-24 12:55:22.329372', 227, 10, NULL);
INSERT INTO public.ride_dispatches VALUES (90, 49, 3, '2026-04-01 17:55:22.531536', 214, 12, NULL);
INSERT INTO public.ride_dispatches VALUES (91, 49, 3, '2026-04-01 04:55:22.760624', 217, 32, NULL);
INSERT INTO public.ride_dispatches VALUES (92, 49, 3, '2026-04-10 02:55:22.989349', 113, 30, NULL);
INSERT INTO public.ride_dispatches VALUES (93, 49, 3, '2026-04-17 05:55:23.206157', 179, 10, NULL);
INSERT INTO public.ride_dispatches VALUES (94, 49, 3, '2026-04-16 04:55:23.448547', 192, 15, NULL);
INSERT INTO public.ride_dispatches VALUES (95, 50, 7, '2026-03-31 08:55:24.399434', 177, 8, NULL);
INSERT INTO public.ride_dispatches VALUES (96, 50, 9, '2026-04-02 23:55:24.619452', 149, 14, NULL);
INSERT INTO public.ride_dispatches VALUES (97, 50, 7, '2026-03-28 02:55:24.867008', 110, 16, NULL);
INSERT INTO public.ride_dispatches VALUES (98, 50, 7, '2026-03-26 12:55:25.212124', 135, 6, NULL);
INSERT INTO public.ride_dispatches VALUES (99, 50, 7, '2026-04-16 22:55:25.45518', 117, 14, NULL);
INSERT INTO public.ride_dispatches VALUES (100, 51, 5, '2026-04-02 10:55:27.436814', 232, 30, NULL);
INSERT INTO public.ride_dispatches VALUES (101, 51, 5, '2026-03-21 18:55:27.663286', 125, 13, NULL);
INSERT INTO public.ride_dispatches VALUES (102, 51, 5, '2026-04-18 06:55:27.890931', 206, 13, NULL);
INSERT INTO public.ride_dispatches VALUES (103, 51, 5, '2026-04-18 19:55:28.12083', 223, 28, NULL);
INSERT INTO public.ride_dispatches VALUES (104, 51, 5, '2026-04-01 21:55:28.352594', 124, 26, NULL);
INSERT INTO public.ride_dispatches VALUES (105, 51, 5, '2026-04-14 05:55:28.571845', 152, 23, NULL);
INSERT INTO public.ride_dispatches VALUES (106, 51, 5, '2026-04-03 11:55:28.805995', 146, 26, NULL);
INSERT INTO public.ride_dispatches VALUES (107, 51, 5, '2026-03-25 10:55:29.049116', 151, 6, NULL);


--
-- Data for Name: ride_interlocks; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ride_interlocks VALUES (7, 42, 43, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (8, 42, 46, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (9, 42, 49, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (10, 43, 42, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (11, 43, 45, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (12, 43, 48, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (13, 43, 51, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (14, 44, 47, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (15, 44, 50, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (16, 45, 43, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (17, 45, 46, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (18, 45, 49, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (19, 46, 42, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (20, 46, 45, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (21, 46, 48, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (22, 46, 51, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (23, 47, 44, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (24, 47, 50, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (25, 48, 43, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (26, 48, 46, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (27, 48, 49, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (28, 49, 42, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (29, 49, 45, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (30, 49, 48, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (31, 49, 51, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (32, 50, 44, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (33, 50, 47, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (34, 51, 43, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (35, 51, 46, 'Shared power circuit / adjacent zone interlock');
INSERT INTO public.ride_interlocks VALUES (36, 51, 49, 'Shared power circuit / adjacent zone interlock');


--
-- Data for Name: rides; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (43, 'Thunder Canyon', 24, 54, 'Zone B', 'Operational', '2026-04-18 09:04:01.517471', 40, true, 0, 'A wild mine train adventure through rugged canyon terrain with sudden drops and dark tunnels.', '/rides/thunder-canyon.jpg', 'Roller Coaster', 'High', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (46, 'Galactic Spinner', 28, 36, 'Zone B', 'Operational', '2026-04-18 09:04:01.517471', 0, true, 0, 'A cosmic spinning ride under neon lights. Each pod spins independently as you orbit the galaxy.', '/rides/galactic-spinner.jpg', 'Thrill Ride', 'Moderate', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (49, 'Haunted Mansion', 12, 48, 'Zone C', 'Operational', '2026-04-18 09:04:01.517471', 35, true, 0, 'Enter if you dare. This dark ride takes you through 13 rooms of ghostly encounters.', '/rides/haunted-mansion.jpg', 'Dark Ride', 'Moderate', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (44, 'Sky Screamer', 16, 60, 'Zone A', 'Closed', '2026-04-18 09:04:01.517471', 55, true, 0, 'Soar 200 feet above the park on this extreme swing ride with panoramic views and heart-pounding free-fall moments.', '/rides/sky-screamer.jpg', 'Thrill Ride', 'Extreme', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (47, 'Mini Coaster', 40, 0, 'Zone D', 'Operational', '2026-04-18 09:04:01.517471', 15, true, 0, 'A dragon-themed family coaster with gentle hills and playful turns. Perfect for young adventurers.', '/rides/mini-coaster.jpg', 'Family Ride', 'Family', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (48, 'Ferris Wheel', 48, 0, 'Zone D', 'Operational', '2026-04-18 09:04:01.517471', 10, true, 0, 'Take in the glittering skyline from our illuminated Ferris wheel — the perfect ride for a sunset view.', '/rides/ferris-wheel.jpg', 'Family Ride', 'Family', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (50, 'Bumper Cars', 30, 36, 'Zone D', 'Operational', '2026-04-18 09:04:01.517471', 20, true, 0, 'Classic fun for all ages. Bump, dodge, and crash your way through our neon-lit arena.', '/rides/bumper-cars.jpg', 'Family Ride', 'Family', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (42, 'Cougar Express', 32, 48, 'Zone A', 'Operational', '2026-04-18 09:04:01.517471', 25, true, 0, 'Our signature steel coaster with sweeping drops, high-speed turns, and stunning mountain views. Not for the faint of heart.', '/rides/cougar-express.jpg', 'Roller Coaster', 'Extreme', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (51, 'Drop Tower', 8, 54, 'Zone A', 'Operational', '2026-04-18 09:04:01.517471', 0, true, 0, 'Plunge from dizzying heights in a heart-stopping free-fall. Hold on tight!', '/rides/drop-tower.jpg', 'Thrill Ride', 'Extreme', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);
INSERT INTO public.rides OVERRIDING SYSTEM VALUE VALUES (45, 'Wild River Rapids', 20, 42, 'Zone C', 'Operational', '2026-04-18 09:04:01.517471', 30, true, 0, 'Grab your crew and brave the rapids — you will get soaked on this whitewater rafting adventure.', '/rides/wild-river-rapids.jpg', 'Water Ride', 'Moderate', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL);


--
-- Data for Name: ticket_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ticket_purchases VALUES (1, 1, 5, 'General Admission', 2, 1, 49.00, 35.00, 133.00, '2026-04-01', '2026-04-10 09:07:01.491164+00', '4242', 'Maria Garcia', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (2, 2, 6, 'Season Pass', 1, 0, 149.00, 99.00, 149.00, '2026-03-20', '2026-03-29 09:07:01.585373+00', '1234', 'James Wilson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (3, 3, 7, 'VIP Experience', 2, 2, 89.00, 69.00, 316.00, '2026-04-05', '2026-04-14 09:07:01.67866+00', '5678', 'Sarah Johnson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (4, 4, 8, 'General Admission', 1, 2, 49.00, 35.00, 119.00, '2026-03-28', '2026-04-06 09:07:01.764007+00', '9012', 'David Lee', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (5, 5, 9, 'Season Pass', 2, 0, 149.00, 99.00, 298.00, '2026-03-15', '2026-03-24 09:07:01.84022+00', '3456', 'Emily Chen', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (6, 1, 5, 'General Admission', 4, 0, 49.00, 35.00, 196.00, '2026-04-02', '2026-04-11 09:07:01.925496+00', '7890', 'Maria Garcia', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (7, 2, 6, 'VIP Experience', 1, 1, 89.00, 69.00, 158.00, '2026-04-03', '2026-04-12 09:07:02.006215+00', '2345', 'James Wilson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (8, 3, 7, 'General Admission', 2, 3, 49.00, 35.00, 203.00, '2026-03-30', '2026-04-08 09:07:02.089352+00', '6789', 'Sarah Johnson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (9, 4, 8, 'Season Pass', 1, 1, 149.00, 99.00, 248.00, '2026-03-25', '2026-04-03 09:07:02.1837+00', '0123', 'David Lee', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (10, 5, 9, 'General Admission', 3, 0, 49.00, 35.00, 147.00, '2026-04-04', '2026-04-13 09:07:02.289025+00', '4567', 'Emily Chen', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (11, 1, 5, 'VIP Experience', 2, 0, 89.00, 69.00, 178.00, '2026-03-22', '2026-03-31 09:07:02.38333+00', '8901', 'Maria Garcia', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (12, 2, 6, 'General Admission', 1, 0, 49.00, 35.00, 49.00, '2026-04-08', '2026-04-17 09:07:02.483584+00', '3456', 'James Wilson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (13, 2, 6, 'Season Pass', 2, 1, 149.00, 99.00, 397.00, '2026-03-11', '2026-03-11 09:17:32.905974+00', '1234', 'James Wilson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (14, 3, 7, 'VIP Experience', 3, 2, 89.00, 69.00, 405.00, '2026-02-21', '2026-02-21 09:17:32.905974+00', '2468', 'Sarah Johnson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (15, 4, 8, 'General Admission', 4, 0, 49.00, 35.00, 196.00, '2026-02-03', '2026-02-03 09:17:32.905974+00', '3702', 'David Lee', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (16, 5, 9, 'Season Pass', 1, 1, 149.00, 99.00, 248.00, '2026-01-16', '2026-01-16 09:17:32.905974+00', '4936', 'Emily Chen', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (17, 6, 10, 'VIP Experience', 2, 2, 89.00, 69.00, 316.00, '2025-12-29', '2025-12-29 09:17:32.905974+00', '6170', 'Olivia Brown', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (18, 7, 11, 'General Admission', 3, 0, 49.00, 35.00, 147.00, '2025-12-11', '2025-12-11 09:17:32.905974+00', '7404', 'Liam Taylor', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (19, 8, 12, 'Season Pass', 4, 1, 149.00, 99.00, 695.00, '2025-11-23', '2025-11-23 09:17:32.905974+00', '8638', 'Ava Anderson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (20, 9, 13, 'VIP Experience', 1, 2, 89.00, 69.00, 227.00, '2025-11-05', '2025-11-05 09:17:32.905974+00', '9872', 'Noah Thomas', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (21, 10, 14, 'General Admission', 2, 0, 49.00, 35.00, 98.00, '2025-10-18', '2025-10-18 09:17:32.905974+00', '1106', 'Sophia Jackson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (22, 11, 15, 'Season Pass', 3, 1, 149.00, 99.00, 546.00, '2025-09-30', '2025-09-30 09:17:32.905974+00', '2340', 'Mason White', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (23, 12, 16, 'VIP Experience', 4, 2, 89.00, 69.00, 494.00, '2025-09-12', '2025-09-12 09:17:32.905974+00', '3574', 'Isabella Harris', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (24, 13, 17, 'General Admission', 1, 0, 49.00, 35.00, 49.00, '2025-08-25', '2025-08-25 09:17:32.905974+00', '4808', 'Lucas Martin', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (25, 14, 18, 'Season Pass', 2, 1, 149.00, 99.00, 397.00, '2025-08-07', '2025-08-07 09:17:32.905974+00', '6042', 'Mia Thompson', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (26, 15, 19, 'VIP Experience', 3, 2, 89.00, 69.00, 405.00, '2025-07-20', '2025-07-20 09:17:32.905974+00', '7276', 'Ethan Moore', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (27, 16, 20, 'General Admission', 4, 0, 49.00, 35.00, 196.00, '2025-07-02', '2025-07-02 09:17:32.905974+00', '8510', 'Charlotte Young', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (28, 17, 21, 'Season Pass', 1, 1, 149.00, 99.00, 248.00, '2025-06-14', '2025-06-14 09:17:32.905974+00', '9744', 'Logan King', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (29, 18, 22, 'VIP Experience', 2, 2, 89.00, 69.00, 316.00, '2025-05-27', '2025-05-27 09:17:32.905974+00', '0978', 'Amelia Wright', NULL, NULL, NULL);
INSERT INTO public.ticket_purchases VALUES (30, 19, 23, 'General Admission', 3, 0, 49.00, 35.00, 147.00, '2025-05-09', '2025-05-09 09:17:32.905974+00', '2212', 'Jackson Scott', NULL, NULL, NULL);


--
-- Data for Name: ticket_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ticket_types OVERRIDING SYSTEM VALUE VALUES (1, 'General Admission', 49.00, 'Full-day access to all rides and attractions', 'standard', false, 35.00);
INSERT INTO public.ticket_types OVERRIDING SYSTEM VALUE VALUES (2, 'Season Pass', 149.00, 'Unlimited visits through the end of the season plus 10% off food and merch', 'premium', false, 99.00);
INSERT INTO public.ticket_types OVERRIDING SYSTEM VALUE VALUES (3, 'VIP Experience', 89.00, 'VIP skip-the-line access, reserved seating, and complimentary meal voucher', 'vip', true, 69.00);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (10, 'customer6@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (11, 'customer7@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (12, 'customer8@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (13, 'customer9@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (14, 'customer10@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (15, 'customer11@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (16, 'customer12@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (17, 'customer13@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (18, 'customer14@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (19, 'customer15@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (20, 'customer16@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (21, 'customer17@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (22, 'customer18@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (23, 'customer19@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (24, 'customer20@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (25, 'customer21@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (26, 'customer22@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (27, 'customer23@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (28, 'customer24@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (29, 'customer25@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (30, 'customer26@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (31, 'customer27@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (32, 'customer28@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (33, 'customer29@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (34, 'customer30@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (35, 'marcus.hill@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (36, 'priya.patel@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (37, 'jordan.kim@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (38, 'taylor.reed@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (39, 'chris.nguyen@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (40, 'samantha.cruz@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (41, 'devon.martinez@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'manager', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (42, 'aisha.robinson@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (43, 'benjamin.foster@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (44, 'rachel.sanchez@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (45, 'kyle.bennett@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (46, 'natalie.brooks@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (47, 'omar.haddad@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'manager', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (48, 'leah.morris@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (49, 'trevor.wallace@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (50, 'yuki.tanaka@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (51, 'isabel.ortiz@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (52, 'derek.chen@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (53, 'sienna.reyes@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (54, 'oscar.beltran@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (55, 'hannah.park@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'manager', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (56, 'jon.lindqvist@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (57, 'rosa.delgado@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (58, 'preston.walsh@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (59, 'camila.vargas@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');
INSERT INTO public.users VALUES (1, 'alex.rivera@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'admin', '2026-04-18 09:06:59.773975+00');
INSERT INTO public.users VALUES (2, 'srinath.satuluri@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'manager', '2026-04-18 09:06:59.943112+00');
INSERT INTO public.users VALUES (3, 'melanie.cura@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:07:00.11089+00');
INSERT INTO public.users VALUES (4, 'nicholaus.mayes@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:07:00.275777+00');
INSERT INTO public.users VALUES (5, 'maria.garcia@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:07:00.434571+00');
INSERT INTO public.users VALUES (6, 'james.wilson@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:07:00.649208+00');
INSERT INTO public.users VALUES (7, 'sarah.johnson@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:07:00.991164+00');
INSERT INTO public.users VALUES (8, 'david.lee@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:07:01.152092+00');
INSERT INTO public.users VALUES (9, 'emily.chen@email.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'customer', '2026-04-18 09:07:01.329072+00');
INSERT INTO public.users VALUES (60, 'ian.kowalski@cougarride.com', '$2b$10$3v.dafjJ/1iQLuol2jJFOeymP6DQ.pBZyHwEDbeAwZh6BHe0P12Gm', 'staff', '2026-04-18 09:17:32.905974+00');


--
-- Data for Name: weather_readings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.weather_readings VALUES (1, '2026-04-14 04:27:54.640791', 50.00, 50.00, 75.00, 'None');
INSERT INTO public.weather_readings VALUES (32, '2026-04-18 08:10:35.576664', 12.93, NULL, 81.43, 'Light Rain');
INSERT INTO public.weather_readings VALUES (33, '2026-04-18 07:10:35.576664', 28.02, 2.68, 85.32, 'Mist');
INSERT INTO public.weather_readings VALUES (34, '2026-04-18 06:10:35.576664', 27.35, NULL, 76.72, 'Heavy Rain');
INSERT INTO public.weather_readings VALUES (35, '2026-04-18 05:10:35.576664', 6.83, NULL, 70.52, 'Light Rain');
INSERT INTO public.weather_readings VALUES (36, '2026-04-18 04:10:35.576664', 5.33, NULL, 83.15, 'Light Rain');
INSERT INTO public.weather_readings VALUES (37, '2026-04-18 03:10:35.576664', 8.18, NULL, 65.88, 'None');
INSERT INTO public.weather_readings VALUES (38, '2026-04-18 02:10:35.576664', 4.97, NULL, 67.56, 'Heavy Rain');
INSERT INTO public.weather_readings VALUES (39, '2026-04-18 01:10:35.576664', 7.25, NULL, 88.49, 'Snow');
INSERT INTO public.weather_readings VALUES (40, '2026-04-18 00:10:35.576664', 7.88, NULL, 76.98, 'Mist');
INSERT INTO public.weather_readings VALUES (41, '2026-04-17 23:10:35.576664', 10.19, 1.92, 71.92, 'Heavy Rain');
INSERT INTO public.weather_readings VALUES (42, '2026-04-17 22:10:35.576664', 13.23, NULL, 58.61, 'Snow');
INSERT INTO public.weather_readings VALUES (43, '2026-04-17 21:10:35.576664', 5.44, NULL, 70.73, 'Light Rain');
INSERT INTO public.weather_readings VALUES (44, '2026-04-17 20:10:35.576664', 8.79, NULL, 92.42, 'Heavy Rain');
INSERT INTO public.weather_readings VALUES (45, '2026-04-17 19:10:35.576664', 8.54, NULL, 93.65, 'Heavy Rain');
INSERT INTO public.weather_readings VALUES (46, '2026-04-17 18:10:35.576664', 26.95, NULL, 61.54, 'Snow');
INSERT INTO public.weather_readings VALUES (47, '2026-04-17 17:10:35.576664', 9.36, NULL, 88.14, 'None');
INSERT INTO public.weather_readings VALUES (48, '2026-04-17 16:10:35.576664', 27.09, NULL, 76.55, 'None');
INSERT INTO public.weather_readings VALUES (49, '2026-04-17 15:10:35.576664', 2.94, NULL, 77.72, 'Heavy Rain');
INSERT INTO public.weather_readings VALUES (50, '2026-04-17 14:10:35.576664', 26.90, NULL, 75.10, 'None');
INSERT INTO public.weather_readings VALUES (51, '2026-04-17 13:10:35.576664', 21.94, NULL, 60.73, 'Mist');
INSERT INTO public.weather_readings VALUES (52, '2026-04-17 12:10:35.576664', 3.44, 14.85, 68.65, 'Mist');
INSERT INTO public.weather_readings VALUES (53, '2026-04-17 11:10:35.576664', 6.63, 11.44, 74.29, 'Mist');
INSERT INTO public.weather_readings VALUES (54, '2026-04-17 10:10:35.576664', 28.67, 2.32, 91.44, 'Snow');
INSERT INTO public.weather_readings VALUES (55, '2026-04-17 09:10:35.576664', 0.21, NULL, 89.78, 'Snow');
INSERT INTO public.weather_readings VALUES (56, '2026-04-17 08:10:35.576664', 13.59, NULL, 68.15, 'Light Rain');
INSERT INTO public.weather_readings VALUES (57, '2026-04-17 07:10:35.576664', 4.39, 5.18, 73.16, 'Light Rain');
INSERT INTO public.weather_readings VALUES (58, '2026-04-17 06:10:35.576664', 4.13, NULL, 83.15, 'None');
INSERT INTO public.weather_readings VALUES (59, '2026-04-17 05:10:35.576664', 22.84, NULL, 61.65, 'Snow');
INSERT INTO public.weather_readings VALUES (60, '2026-04-17 04:10:35.576664', 4.35, NULL, 68.91, 'Mist');
INSERT INTO public.weather_readings VALUES (61, '2026-04-17 03:10:35.576664', 11.33, 14.13, 63.41, 'Light Rain');


--
-- Name: _migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public._migrations_id_seq', 81, true);


--
-- Name: customers_customer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_customer_id_seq', 30, true);


--
-- Name: dispatch_rejections_rejection_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dispatch_rejections_rejection_id_seq', 72, true);


--
-- Name: employees_employee_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_employee_id_seq', 30, true);


--
-- Name: game_game_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.game_game_id_seq', 31, true);


--
-- Name: gift_shop_gift_shop_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gift_shop_gift_shop_id_seq', 18, true);


--
-- Name: maintenance_requests_request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.maintenance_requests_request_id_seq', 41, true);


--
-- Name: merch_merch_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.merch_merch_id_seq', 48, true);


--
-- Name: merch_purchases_purchase_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.merch_purchases_purchase_id_seq', 1, false);


--
-- Name: notifications_notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_notification_id_seq', 156, true);


--
-- Name: operator_assignments_assignment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.operator_assignments_assignment_id_seq', 80, true);


--
-- Name: park_closures_closure_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.park_closures_closure_id_seq', 95, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 173, true);


--
-- Name: restaurant_restaurant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_restaurant_id_seq', 32, true);


--
-- Name: ride_dispatches_dispatch_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ride_dispatches_dispatch_id_seq', 107, true);


--
-- Name: ride_interlocks_interlock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ride_interlocks_interlock_id_seq', 36, true);


--
-- Name: rides_ride_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rides_ride_id_seq', 51, true);


--
-- Name: ticket_purchases_purchase_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ticket_purchases_purchase_id_seq', 30, true);


--
-- Name: ticket_types_ticket_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ticket_types_ticket_type_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 60, true);


--
-- Name: weather_readings_reading_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.weather_readings_reading_id_seq', 61, true);


--
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);


--
-- Name: dispatch_rejections dispatch_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_rejections
    ADD CONSTRAINT dispatch_rejections_pkey PRIMARY KEY (rejection_id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (employee_id);


--
-- Name: game game_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game
    ADD CONSTRAINT game_pkey PRIMARY KEY (game_id);


--
-- Name: gift_shop gift_shop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_shop
    ADD CONSTRAINT gift_shop_pkey PRIMARY KEY (gift_shop_id);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (request_id);


--
-- Name: merch merch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merch
    ADD CONSTRAINT merch_pkey PRIMARY KEY (merch_id);


--
-- Name: merch_purchases merch_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merch_purchases
    ADD CONSTRAINT merch_purchases_pkey PRIMARY KEY (purchase_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: operator_assignments operator_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_assignments
    ADD CONSTRAINT operator_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: park_closures park_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.park_closures
    ADD CONSTRAINT park_closures_pkey PRIMARY KEY (closure_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: restaurant restaurant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant
    ADD CONSTRAINT restaurant_pkey PRIMARY KEY (restaurant_id);


--
-- Name: ride_dispatches ride_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_dispatches
    ADD CONSTRAINT ride_dispatches_pkey PRIMARY KEY (dispatch_id);


--
-- Name: ride_interlocks ride_interlocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_interlocks
    ADD CONSTRAINT ride_interlocks_pkey PRIMARY KEY (interlock_id);


--
-- Name: rides rides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rides
    ADD CONSTRAINT rides_pkey PRIMARY KEY (ride_id);


--
-- Name: ticket_purchases ticket_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_pkey PRIMARY KEY (purchase_id);


--
-- Name: ticket_types ticket_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_pkey PRIMARY KEY (ticket_type_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: weather_readings weather_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_readings
    ADD CONSTRAINT weather_readings_pkey PRIMARY KEY (reading_id);


--
-- Name: idx_customers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_maint_requests_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maint_requests_archived_at ON public.maintenance_requests USING btree (archived_at);


--
-- Name: idx_maintenance_ride_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_ride_id ON public.maintenance_requests USING btree (ride_id);


--
-- Name: idx_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_status ON public.maintenance_requests USING btree (status);


--
-- Name: idx_merch_purchases_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_merch_purchases_customer ON public.merch_purchases USING btree (customer_id);


--
-- Name: idx_merch_purchases_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_merch_purchases_date ON public.merch_purchases USING btree (purchase_date);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_role ON public.notifications USING btree (recipient_role);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (recipient_user_id);


--
-- Name: idx_park_closures_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_park_closures_archived_at ON public.park_closures USING btree (archived_at);


--
-- Name: idx_refresh_tokens_family_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_family_id ON public.refresh_tokens USING btree (family_id);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_ticket_purchases_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_purchases_customer_id ON public.ticket_purchases USING btree (customer_id);


--
-- Name: idx_ticket_purchases_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_purchases_date ON public.ticket_purchases USING btree (purchase_date);


--
-- Name: idx_ticket_purchases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_purchases_user_id ON public.ticket_purchases USING btree (user_id);


--
-- Name: employees trg_guard_employee_deactivation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_employee_deactivation BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.fn_guard_employee_deactivation();


--
-- Name: rides trg_guard_ride_reopen; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_ride_reopen BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.fn_guard_ride_reopen();


--
-- Name: park_closures trg_park_closure_cascade; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_park_closure_cascade AFTER INSERT OR UPDATE ON public.park_closures FOR EACH ROW EXECUTE FUNCTION public.fn_park_closure_cascade();


--
-- Name: maintenance_requests trg_route_maintenance_event; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_route_maintenance_event AFTER INSERT OR UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.fn_route_maintenance_event();


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dispatch_rejections dispatch_rejections_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_rejections
    ADD CONSTRAINT dispatch_rejections_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.employees(employee_id);


--
-- Name: dispatch_rejections dispatch_rejections_ride_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_rejections
    ADD CONSTRAINT dispatch_rejections_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(ride_id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employees gift_shop_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT gift_shop_id FOREIGN KEY (gift_shop_id) REFERENCES public.gift_shop(gift_shop_id);


--
-- Name: maintenance_requests maintenance_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE SET NULL;


--
-- Name: maintenance_requests maintenance_requests_ride_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(ride_id) ON DELETE CASCADE;


--
-- Name: merch_purchases merch_purchases_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merch_purchases
    ADD CONSTRAINT merch_purchases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);


--
-- Name: notifications notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: operator_assignments operator_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_assignments
    ADD CONSTRAINT operator_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: operator_assignments operator_assignments_ride_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_assignments
    ADD CONSTRAINT operator_assignments_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(ride_id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employees restaurant_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT restaurant_id FOREIGN KEY (restaurant_id) REFERENCES public.restaurant(restaurant_id);


--
-- Name: ride_dispatches ride_dispatches_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_dispatches
    ADD CONSTRAINT ride_dispatches_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.employees(employee_id);


--
-- Name: ride_dispatches ride_dispatches_ride_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_dispatches
    ADD CONSTRAINT ride_dispatches_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(ride_id);


--
-- Name: ride_interlocks ride_interlocks_blocking_ride_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_interlocks
    ADD CONSTRAINT ride_interlocks_blocking_ride_id_fkey FOREIGN KEY (blocking_ride_id) REFERENCES public.rides(ride_id);


--
-- Name: ride_interlocks ride_interlocks_ride_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_interlocks
    ADD CONSTRAINT ride_interlocks_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(ride_id);


--
-- Name: ticket_purchases ticket_purchases_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: ticket_purchases ticket_purchases_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(ticket_type_id) ON DELETE SET NULL;


--
-- Name: ticket_purchases ticket_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--



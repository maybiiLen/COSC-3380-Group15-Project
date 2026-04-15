# CougarRide Database Presentation Script
## Triggers & Reports (6-7 Minutes)

---

## OPENING (30 seconds)

"Our team built CougarRide, a theme park management system. My section covers the database triggers and reports. We have two triggers that enforce business rules at the database level, and three multi-table reports that give managers operational visibility."

---

## TRIGGER 1: Ride Safety Interlock (2 minutes)

### What It Does

"The first trigger is a BEFORE INSERT trigger on the ride_dispatches table. Every time the system tries to dispatch a ride cycle, this trigger runs 7 safety checks before allowing it. If any check fails, it blocks the dispatch and logs the rejection."

### The 7 Gates

"The checks are ordered from cheapest to most expensive in terms of database cost:"

1. **Ride status check** - Is the ride marked Operational? Is there a pending Critical maintenance request? If not, it blocks immediately. This is the cheapest check since it just reads the ride's own row.

2. **Inspection cycle** - Has the ride exceeded its inspection interval? Every ride has a cycles_since_inspection counter and a max interval. If it's overdue, the dispatch is blocked.

3. **Throughput limit** - Counts dispatches in the last 60 minutes against the ride's max_cycles_per_hour. This prevents mechanical wear from over-cycling.

4. **Operator fatigue** - Checks the operator_assignments table to see if the assigned operator has been on the same ride for 4+ consecutive hours. Safety regulation.

5. **Weather envelope** - Reads the latest weather_readings and compares wind speed, lightning proximity, and temperature against ride-specific thresholds. Each has its own rejection code: WEATHER_WIND, WEATHER_LIGHTNING, WEATHER_TEMPERATURE.

6. **Guest height compliance** - Checks the dispatch queue to verify every guest's measured height meets the ride's minimum. One violation blocks the entire dispatch.

7. **Cross-ride interlock** - Some rides share infrastructure. This checks the ride_interlocks table to see if a blocking ride is non-operational or has critical maintenance.

### Semantic Constraints

"This trigger enforces constraints that can't be expressed with CHECK constraints or foreign keys:

- **Temporal validity**: Weather data and operator hours are time-windowed queries
- **Cross-table business rules**: Ride status, maintenance, weather, operator, and guest data all live in different tables
- **Computational consistency**: Throughput counts are rolling 60-minute windows, not static values"

### Demo (if showing)

"Let me show you what happens when a check fails."

> In pgAdmin, show the ride_dispatches table and dispatch_rejections table. Run a dispatch insert when conditions are wrong. Show the rejection row with its JSONB context.

---

## TRIGGER 2: Ticket Purchase Policy (2 minutes)

### What It Does

"The second trigger is a BEFORE INSERT on ticket_purchases. It enforces 6 anti-fraud and business policy checks on every ticket purchase. This is the one we can demo live from the UI."

### The 6 Gates

1. **Visit date validity** - The visit date must be today or in the future. You can't buy a ticket for yesterday. Cheapest check, just a date comparison.

2. **Quantity sanity** - Total tickets (adults + children) must be at least 1, and can't exceed the configurable per-transaction maximum. The default is 20. Two possible rejection codes: INVALID_QUANTITY or QUANTITY_EXCEEDED.

3. **Price integrity** - The trigger recomputes the total: (adult_qty times unit_price_adult) plus (child_qty times unit_price_child). If the submitted total_price doesn't match within one cent, it's rejected as PRICE_MISMATCH. This catches any client-side price tampering.

4. **Customer existence** - If a customer_id is provided, it must exist in the customers table. Catches orphaned references.

5. **Park closure check** - Queries the park_closures table for any active park-wide closure on the visit date. You can't sell tickets for a date the park is closed.

6. **Rate limiting** - Counts how many purchases this customer has made in the last 24 hours. If it exceeds the configurable limit (default 10), it's blocked. This is the most expensive check since it scans recent purchases, which is why it runs last.

### Semantic Constraints

"This trigger addresses:

- **Domain integrity**: Visit dates must be logically valid (future, not past)
- **Computational consistency**: Price is verified server-side, not trusted from the client
- **Time-windowed rate limiting**: The 24-hour rolling window can't be done with a CHECK constraint
- **Cross-table validation**: Customer existence and park closure checks span multiple tables"

### LIVE DEMO

> Navigate to the Ticket Shop page.

**Demo 1: Visit Date Violation (Gate 1)**
1. "I'll add a General Admission ticket to the cart"
2. "At checkout, I'll pick yesterday's date as the visit date"
3. "Fill in name, email, and card info, then submit"
4. "You can see the error: POLICY VIOLATION: VISIT_DATE_INVALID"

**Demo 2: Rate Limit (Gate 6)**
1. "Now go to the Maintenance page, scroll down to the Ticket Policy Monitor"
2. "Click Load Monitor. You can see the policy configuration here"
3. "I'll change the rate limit from 10 down to 1"
4. "Go back to Ticket Shop, buy a valid ticket successfully"
5. "Now try to buy a second ticket immediately"
6. "Blocked: RATE_LIMIT_EXCEEDED. The trigger counted my purchase from a moment ago"

**Demo 3: Show the Monitor**
1. "Back on the Monitor, click Refresh"
2. "You can see both rejections logged with timestamps, customer info, the rejection code, and the detail message"
3. "Each rejection also stores a JSONB context object with the full transaction data for auditing"

> For Gates 2-5, mention: "The other gates like price tampering and park closures can be demonstrated through direct SQL inserts in pgAdmin, since the frontend has client-side validation that prevents those inputs from reaching the trigger."

---

## REPORTS (2 minutes)

"We have three reports, each using multi-table JOINs. Every report has a summary table with aggregates and a detail table that shows exactly which raw columns feed into those aggregates."

### Report 1: Maintenance Report (5 tables)

**Tables:** maintenance_requests JOIN rides JOIN employees LEFT JOIN park_closures LEFT JOIN notifications

**Summary columns and how they're calculated:**
- **Completion %**: COUNT of completed requests divided by total COUNT, times 100
- **Avg Hours**: AVG of the time difference between completed_at and created_at, converted to hours using EXTRACT(EPOCH) / 3600
- **Min/Max Hours**: MIN and MAX of that same hours calculation
- **Total Downtime**: SUM of all hours to complete
- **Employees**: COUNT DISTINCT of employee_id
- **Closure Related**: COUNT with a FILTER clause, only counting rows where the park_closures JOIN found a match
- **Alerts**: SUM of notification counts from a correlated subquery on the notifications table

"The detail table shows every individual request with its ride name, priority, status, assigned employee, completion time, whether the zone was closed, and how many alert notifications were generated. Every summary number maps directly to a visible column in the detail table."

### Report 2: Ticket Sales (3 tables)

**Tables:** ticket_purchases JOIN customers JOIN ticket_types

**Summary columns:**
- **Tickets Sold**: SUM of adult_qty plus child_qty
- **Revenue**: SUM of total_price
- **Revenue %**: Each ticket type's revenue divided by the overall total revenue, using NULLIF to prevent division by zero
- **Avg Order**: AVG of total_price
- **Customers**: COUNT DISTINCT of customer_id

"The detail table shows each transaction with buyer name, email, ticket type, individual adult and child prices, quantities, and the computed total. You can verify that adult_qty times adult_price plus child_qty times child_price equals the total."

### Report 3: Employee Activity (3 tables)

**Tables:** employees JOIN maintenance_requests JOIN rides

**Summary columns:**
- **Tasks/Done/Active/Pending**: COUNT with FILTER clauses for each status
- **Done %**: Completed count divided by total count
- **Total Hours**: SUM of hours to complete
- **Labor Cost**: SUM of (hours times hourly_rate) for each employee
- **Workload Ratio**: Each employee's task count divided by the team average, computed with a subquery. A ratio above 1.0 means they're handling more than average.

"The detail table shows every task assignment with the employee's hourly rate, the specific ride, task description, hours elapsed, and the individual labor cost. The summary labor cost is just the SUM of those individual labor costs from the detail rows."

### Demo (if time)

> Navigate to Analytics page. Select Maintenance Report. Click View Report. Point out the summary table, then scroll to the detail table. "You can see exactly where each summary number comes from in the detail rows."

---

## CLOSING (15 seconds)

"So to summarize: the safety interlock trigger prevents unsafe ride dispatches with 7 real-time checks, the ticket policy trigger prevents fraud and enforces business rules with 6 checks, and our three reports give managers full operational visibility with aggregates that are fully traceable to the underlying detail data. Questions?"

---

## QUICK REFERENCE CARD

| Trigger | Table | Type | Gates | Key Constraint Types |
|---------|-------|------|-------|---------------------|
| Safety Interlock | ride_dispatches | BEFORE INSERT | 7 | Temporal, cross-table, computational |
| Ticket Policy | ticket_purchases | BEFORE INSERT | 6 | Domain, computational, rate-limiting |

| Report | Tables Joined | Key Aggregates |
|--------|--------------|----------------|
| Maintenance | 5 (requests, rides, employees, closures, notifications) | Completion %, Avg/Min/Max Hours, Downtime, Closure Related, Alerts |
| Ticket Sales | 3 (purchases, customers, ticket_types) | Revenue, Revenue %, Avg Order, Tickets Sold |
| Employee Activity | 3 (employees, requests, rides) | Labor Cost, Total Hours, Workload Ratio, Done % |

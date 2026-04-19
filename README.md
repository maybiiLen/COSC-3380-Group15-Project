# CougarRide

An amusement park management system built for COSC 3380 — Database Systems. CougarRide is a full-stack web application that supports day-to-day theme park operations: ticket sales, ride management, maintenance workflows, staff scheduling, zone closures, customer-facing storefronts, and management reporting. The backend uses a PostgreSQL database with PL/pgSQL triggers to enforce semantic business rules and cascade state changes across tables.

A live deployment is available, but the project can also be run locally against a PostgreSQL database using the instructions below.

---

## Tech Stack

- **Frontend:** React, Tailwind CSS, Vite
- **Backend:** Node.js
- **Database:** PostgreSQL

---

## Features

### Customer-facing
- Landing page with seasonal highlights and "Know Before You Go" tiles
- Ticket shop with adult and child quantity selection, ride browser, dining and games pages
- Merchandise shopping page with online checkout
- "My Purchases" page that aggregates tickets and merchandise orders for a signed-in customer

### Employee / Manager / Admin dashboard
- Role-aware sidebar that only shows tabs the user is authorized for
- Rides tab: view ride status, filter by zone; managers and admins can change ride status
- Dining and Shops tab: manage restaurants, gift shops, games, and merchandise inventory
- Maintenance tab (manager and admin only): create, edit, and archive maintenance requests; view park-closure log; create and lift zone closures
- My Tasks tab (staff only): shows only the logged-in technician's active assignments with a "Mark Done" button that transitions the request to "Awaiting Review" for manager confirmation
- Notifications tab with role-scoped inbox, mark-as-read, and clear-inbox actions
- Reports tab (manager and admin only): three parameterized reports
  - Maintenance Report
  - Ticket Sales Report
  - Ride Operations Report

### Database triggers and semantic constraints
All triggers are implemented in PL/pgSQL and applied automatically by the migration runner.

1. `trg_route_maintenance_event` — routes new maintenance requests into notifications, auto-closes rides on Critical/High priority, auto-reopens when the last blocker is cleared, detects repeated-failure patterns, and broadcasts interlock advisories.
2. `trg_guard_ride_reopen` — pure safety constraint. Blocks any attempt to set a ride back to Operational while it has an open Critical/High maintenance request or its zone is under an active closure.
3. `trg_guard_employee_deactivation` — pure safety constraint. Blocks deactivation of an employee who is currently assigned as an active ride operator.
4. `trg_park_closure_cascade` — cascades zone closures to every ride in the zone, reopens them when the closure is lifted, and emits open/lift notifications.

A test harness at `backend/test/triggers-test.js` exercises all four triggers inside a single transaction that rolls back on completion, so nothing persists.

---

## Project Structure

```
COSC-3380-Group15-Project/
├── backend/
│   ├── src/
│   │   ├── config/          # database pool + environment
│   │   ├── db/              # migrate.js (all schema + triggers), seed.js
│   │   ├── lib/             # shared helpers
│   │   ├── middleware/      # verifyToken, verifyRole, validate
│   │   ├── routes/          # API endpoints:
│   │   │                    #   auth.routes.js
│   │   │                    #   employees.routes.js
│   │   │                    #   health.routes.js
│   │   │                    #   maintenance.routes.js
│   │   │                    #   notifications.routes.js
│   │   │                    #   ParkOperations.routes.js
│   │   │                    #   reports.routes.js
│   │   │                    #   rides.routes.js
│   │   │                    #   tickets.routes.js
│   │   ├── services/        # auth token minting, notification helper
│   │   └── app.js           # Express app + route mounting
│   ├── test/
│   │   └── triggers-test.js # automated trigger verification (13 assertions)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/          # logos, icons, hero and ride images
│   │   ├── components/      # CustomerNav, CustomerFooter, shared UI
│   │   ├── context/         # AuthContext (token + role state)
│   │   ├── pages/           # top-level pages (see list below)
│   │   ├── utils/           # api.js (authFetch wrapper, base URL)
│   │   ├── App.jsx          # router + role gating
│   │   └── Sidebar.jsx      # role-aware navigation
│   ├── public/
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── README.md                # this file
└── package-lock.json
```

### Frontend pages

| File | Description |
|---|---|
| `CustomerLanding.jsx` | Public landing page |
| `TicketShop.jsx` | Ticket purchase form |
| `DiningPage.jsx` | Restaurant and dining info |
| `GamesPage.jsx` | Carnival games listing |
| `ShoppingPage.jsx` | Merchandise storefront |
| `CustomerRidesPage.jsx` | Guest-facing ride directory |
| `MyPurchases.jsx` | Signed-in customer purchase history |
| `AuthPage.jsx` | Login and registration |
| `Rides.jsx` | Employee ride management |
| `Staff.jsx` | Admin-only staff management |
| `ParkOperations.jsx` | Dining and shops admin |
| `Maintenance.jsx` | Manager/admin maintenance list + park closure panel |
| `MyTasks.jsx` | Staff-only active assignments with Mark Done |
| `Notifications.jsx` | In-app notification inbox |
| `Analytics.jsx` | Reports dashboard with charts |

---

## Getting Started (Local Installation)

### Prerequisites
- Node.js 18 or newer
- A PostgreSQL 17 database. The project was developed against Neon serverless Postgres; any Postgres 17 instance will work.
- npm (bundled with Node.js)

### 1. Clone the repository
```bash
git clone https://github.com/maybiiLen/COSC-3380-Group15-Project.git
cd COSC-3380-Group15-Project
```

### 2. Configure environment variables
Create `backend/.env` by copying `backend/.env.example` and filling in your database connection string:

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
JWT_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-another-long-random-string
PORT=3000
```

For the frontend, create `frontend/.env` with:
```
VITE_API_URL=http://localhost:3000
```

### 3. Install dependencies
```bash
cd backend
npm install

cd ../frontend
npm install --legacy-peer-deps
```

### 4. Initialize the database
Run the migrations and then seed the database. The migration script creates every table, function, and trigger the application needs; the seed script populates representative data for rides, employees, users, tickets, and merchandise.

```bash
cd backend
node src/db/migrate.js    # creates tables, functions, triggers
node src/db/seed.js       # populates rides, employees, users, tickets, etc.
```

### 5. Run the application (two terminals)
```bash
# Terminal 1 — backend API
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

### 6. Open the app
Visit http://localhost:5173

Test accounts covering each role (admin, manager, staff, customer) are provided separately from this document.

---

## Verifying the Triggers

All four database triggers have an automated test harness that proves they behave correctly. From the `backend/` directory:

```bash
node test/triggers-test.js
```

Expected output: 13 of 13 assertions pass. The test wraps everything in `BEGIN ... ROLLBACK` so no data persists.

---

## Deployment

The project is hosted on Render (backend) and Vercel (frontend), both auto-deploying from the `main` branch. To reproduce the deployment:

- **Backend (Render):** connect the repo, set root to `backend`, build command `npm install`, start command `npm start`. Set `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGIN` environment variables.
- **Frontend (Vercel):** connect the repo, set root to `frontend`. Set `VITE_API_URL` to the Render backend URL.

---

## Submitted Files

| File | Purpose |
|---|---|
| `backend/` | Node.js API source. Includes the migration runner, seed script, route handlers, and trigger test harness. |
| `frontend/` | React, Vite, and Tailwind application source. |
| `README.md` | This file. |

---

## Course Information

- **Course:** COSC 3380 — Database Systems
- **Institution:** University of Houston
- **Team:** Group 15

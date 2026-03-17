# CougarRide

Amusement park management system built for COSC 3380 - Database Systems.

## Tech Stack

- **Frontend:** React, Tailwind CSS, Vite
- **Backend:** Express.js
- **Database:** PostgreSQL (Neon)

## Getting Started

1. Clone the repo
2. Copy `.env.example` to `.env` and add your Neon database URL
3. Install dependencies:
   ```
   cd backend && npm install
   cd ../frontend && npm install
   ```
4. Run the app (two terminals):
   ```
   # Terminal 1
   cd backend && npm run dev

   # Terminal 2
   cd frontend && npm run dev
   ```
5. Open http://localhost:5173

## Project Structure

```
backend/
  src/
    routes/          -> defines API endpoints
    controllers/     -> handles requests/responses
    services/        -> business logic
    repositories/    -> database queries
    config/          -> database connection

frontend/
  src/
    components/      -> reusable UI components
    pages/           -> page-level components
```
